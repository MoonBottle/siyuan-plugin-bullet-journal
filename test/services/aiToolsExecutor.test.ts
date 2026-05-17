import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@/types/models';

const { mockWriteBlock, mockInsertBlockAfterWithResult } = vi.hoisted(() => ({
  mockWriteBlock: vi.fn(),
  mockInsertBlockAfterWithResult: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
  insertBlockAfterWithResult: mockInsertBlockAfterWithResult,
}));

vi.mock('@/api', () => ({
  getBlockKramdown: vi.fn(),
  updateBlock: vi.fn(),
  insertBlock: vi.fn(),
  deleteBlock: vi.fn(),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({ directories: [] })),
}));

vi.mock('@/utils/refreshRequests', () => ({
  RefreshReasons: { AI_TOOLS_CREATE_PROJECT_DOC: 'AI_TOOLS_CREATE_PROJECT_DOC' },
  createFullRefreshRequest: vi.fn((reason: string) => ({ reason })),
  submitRefreshRequest: vi.fn(),
}));

vi.mock('@/services/skillService', () => ({
  SkillService: {
    getInstance: vi.fn(() => ({
      preloadAllSkills: vi.fn(),
      getEnabledSkillsOverview: vi.fn(() => []),
      getSkillDetail: vi.fn(),
    })),
  },
}));

import { executeTool, type ToolExecutionContext } from '@/services/aiToolsExecutor';

function createToolCall(name: string, args: Record<string, unknown>) {
  return {
    id: `tool-${name}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  } as any;
}

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    content: '整理日报',
    date: '2026-05-01',
    lineNumber: 1,
    docId: 'doc-1',
    blockId: 'block-1',
    status: 'pending',
    ...overrides,
  };
}

function createContext(item: Item): ToolExecutionContext {
  return {
    groups: [],
    projects: [],
    allItems: [item],
    directories: [],
  };
}

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteBlock.mockResolvedValue(true);
    mockInsertBlockAfterWithResult.mockResolvedValue([
      { doOperations: [{ id: 'new-block-1' }], undoOperations: null },
    ]);
  });

  it('routes update_item_status through writeBlock for completed state', async () => {
    const item = createItem();

    const raw = await executeTool(
      createToolCall('update_item_status', { itemId: 'item-1', status: 'completed' }),
      createContext(item),
    );
    const result = JSON.parse(raw);

    expect(result).toEqual({
      success: true,
      message: '已将"整理日报"标记为已完成',
    });
    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setStatus', status: 'completed' },
    );
  });

  it('routes update_item_status through writeBlock for pending state', async () => {
    const item = createItem({ status: 'completed' });

    const raw = await executeTool(
      createToolCall('update_item_status', { itemId: 'item-1', status: 'pending' }),
      createContext(item),
    );
    const result = JSON.parse(raw);

    expect(result).toEqual({
      success: true,
      message: '已将"整理日报"恢复为待办',
    });
    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setStatus', status: 'pending' },
    );
  });

  it('routes update_item date and content edits through block patches', async () => {
    const item = createItem({
      startDateTime: '2026-05-01 09:00:00',
      endDateTime: '2026-05-01 10:00:00',
      timePrecision: 'second',
      siblingItems: [
        {
          date: '2026-05-03',
          startDateTime: '2026-05-03 14:00:00',
          endDateTime: '2026-05-03 15:00:00',
        },
      ],
    });

    const raw = await executeTool(
      createToolCall('update_item', {
        itemId: 'item-1',
        content: '改后的内容',
        date: '2026-05-02',
        startTime: '10:00:00',
        endTime: '11:30:00',
      }),
      createContext(item),
    );
    const result = JSON.parse(raw);

    expect(result).toEqual({
      success: true,
      message: '已更新事项"整理日报"（内容）（日期时间）',
    });
    expect(mockWriteBlock).toHaveBeenNthCalledWith(
      1,
      { blockId: 'block-1' },
      {
        type: 'addDate',
        date: '2026-05-02',
        originalDate: '2026-05-01',
        startTime: '10:00:00',
        endTime: '11:30:00',
        allDay: false,
        status: 'pending',
        timePrecision: 'second',
        siblingItems: [
          {
            date: '2026-05-03',
            startDateTime: '2026-05-03 14:00:00',
            endDateTime: '2026-05-03 15:00:00',
          },
          {
            date: '2026-05-01',
            startDateTime: '2026-05-01 09:00:00',
            endDateTime: '2026-05-01 10:00:00',
            timePrecision: 'second',
          },
        ],
      },
    );
    expect(mockWriteBlock).toHaveBeenNthCalledWith(
      2,
      { blockId: 'block-1' },
      { type: 'setContent', newItemContent: '改后的内容' },
    );
  });

  it('routes create_item through blockWriter insertion and returns the new block id', async () => {
    const context: ToolExecutionContext = {
      groups: [],
      directories: [],
      allItems: [],
      projects: [
        {
          id: 'project-1',
          name: '项目 A',
          description: '',
          path: '/project-a',
          groupId: 'group-a',
          lineNumber: 1,
          docId: 'doc-1',
          tasks: [
            {
              id: 'task-1',
              name: '任务 A',
              level: 'L1',
              lineNumber: 1,
              blockId: 'task-block-1',
              items: [],
            },
          ],
        } as any,
      ],
    };

    const raw = await executeTool(
      createToolCall('create_item', {
        projectId: 'project-1',
        content: '新事项',
        date: '2026-05-03',
        startTime: '09:00',
        endTime: '10:00',
      }),
      context,
    );
    const result = JSON.parse(raw);

    expect(result).toEqual({
      success: true,
      message: '已在项目"项目 A"的任务"任务 A"下创建事项"新事项"（2026-05-03 09:00）',
      itemId: 'new-block-1',
    });
    expect(mockInsertBlockAfterWithResult).toHaveBeenCalledWith(
      'task-block-1',
      {
        type: 'replaceMarkdown',
        markdown: '新事项 📅2026-05-03 09:00~10:00',
      },
    );
  });
});
