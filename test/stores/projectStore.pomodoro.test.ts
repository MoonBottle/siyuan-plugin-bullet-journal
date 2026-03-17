/**
 * projectStore 番茄钟相关功能测试
 * 验证自定义属性形式的专注记录合并逻辑，特别是多日期事项场景
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import type { Item, Project, Task, PomodoroRecord } from '@/types/models';
import * as api from '@/api';

// Mock getBlockAttrs API
vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api');
  return {
    ...actual,
    getBlockAttrs: vi.fn()
  };
});

const mockGetBlockAttrs = vi.mocked(api.getBlockAttrs);

// 测试数据构造器
const mkItem = (
  date: string,
  blockId: string,
  overrides?: Partial<Item>
): Item =>
  ({
    id: `item-${date}-${Math.random().toString(36).substr(2, 5)}`,
    content: '测试事项',
    date,
    lineNumber: 1,
    docId: 'doc1',
    blockId,
    status: 'pending',
    ...overrides
  }) as Item;

/** 模拟 parser 行为：同 blockId 的 items 共享同一个 pomodoros 数组 */
const mkItemsWithSharedBlockId = (
  configs: Array<{ date: string } & Partial<Item>>,
  sharedBlockId: string
): Item[] => {
  const sharedPomodoros: PomodoroRecord[] = [];
  return configs.map(c => {
    const { date, ...rest } = c;
    return mkItem(date, sharedBlockId, { ...rest, pomodoros: sharedPomodoros });
  });
};

const mkTask = (items: Item[], overrides?: Partial<Task>): Task =>
  ({
    id: `task-${Math.random().toString(36).substr(2, 5)}`,
    name: '测试任务',
    level: 'L1',
    items,
    lineNumber: 1,
    ...overrides
  }) as Task;

const mkProject = (tasks: Task[], overrides?: Partial<Project>): Project =>
  ({
    id: `proj-${Math.random().toString(36).substr(2, 5)}`,
    name: '测试项目',
    path: '/test',
    tasks,
    ...overrides
  }) as Project;

const mockPlugin = {
  getSettings: () => ({
    pomodoro: {
      attrPrefix: 'custom-pomodoro'
    }
  })
};

describe('mergePomodoroAttrs - 多日期事项自定义属性专注记录', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('多日期事项：共享同一个 pomodoros 数组', async () => {
    const store = useProjectStore();

    const sharedBlockId = '20250315123456-abcdef';
    const [item1, item2] = mkItemsWithSharedBlockId(
      [
        { date: '2026-03-15', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' },
        { date: '2026-03-16', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' }
      ],
      sharedBlockId
    );

    const task = mkTask([item1, item2]);
    const project = mkProject([task]);

    // Mock 返回两个日期的专注记录
    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 专注工作1',
      'custom-pomodoro-2': '30,2026-03-16 14:00:00~14:30:00 专注工作2'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：两个 Item 共享同一个 pomodoros 数组
    expect(item1.pomodoros).toBe(item2.pomodoros);
    // 验证：共享数组包含所有记录
    expect(item1.pomodoros).toHaveLength(2);
    expect(item2.pomodoros).toHaveLength(2);
  });

  it('多日期事项：共享 pomodoros 包含所有日期的记录', async () => {
    const store = useProjectStore();

    const sharedBlockId = '20250315123456-abcdef';
    const [item1, item2, item3] = mkItemsWithSharedBlockId(
      [
        { date: '2026-03-15', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-17' },
        { date: '2026-03-16', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-17' },
        { date: '2026-03-17', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-17' }
      ],
      sharedBlockId
    );

    const task = mkTask([item1, item2, item3]);
    const project = mkProject([task]);

    // 只有 3月15日 和 3月17日 有专注记录
    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 专注工作1',
      'custom-pomodoro-2': '20,2026-03-17 15:00:00~15:20:00 专注工作2'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：所有 Item 共享同一个数组，包含所有记录
    expect(item1.pomodoros).toBe(item2.pomodoros);
    expect(item2.pomodoros).toBe(item3.pomodoros);
    expect(item1.pomodoros).toHaveLength(2);
  });

  it('单日期事项：专注记录正常合并', async () => {
    const store = useProjectStore();

    const blockId = '20250315123456-abcdef';
    const [item] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], blockId);
    const task = mkTask([item]);
    const project = mkProject([task]);

    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 专注工作1',
      'custom-pomodoro-2': '15,2026-03-15 14:00:00~14:15:00 专注工作2'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：单日期事项应该包含所有记录
    expect(item.pomodoros).toHaveLength(2);
    expect(item.pomodoros?.[0].date).toBe('2026-03-15');
    expect(item.pomodoros?.[1].date).toBe('2026-03-15');
  });

  it('多个事项有不同的 blockId：各自获取自己的专注记录', async () => {
    const store = useProjectStore();

    const [item1] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], 'block-id-1');
    const [item2] = mkItemsWithSharedBlockId([{ date: '2026-03-16' }], 'block-id-2');
    const task = mkTask([item1, item2]);
    const project = mkProject([task]);

    // 不同的 blockId 返回不同的记录
    mockGetBlockAttrs.mockImplementation(async (id: string) => {
      if (id === 'block-id-1') {
        return {
          'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 事项1的专注'
        };
      }
      if (id === 'block-id-2') {
        return {
          'custom-pomodoro-1': '30,2026-03-16 14:00:00~14:30:00 事项2的专注'
        };
      }
      return {};
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：每个 Item 只有自己的记录
    expect(item1.pomodoros).toHaveLength(1);
    expect(item1.pomodoros?.[0].description).toBe('事项1的专注');

    expect(item2.pomodoros).toHaveLength(1);
    expect(item2.pomodoros?.[0].description).toBe('事项2的专注');

    // 验证：不同的 blockId 不共享数组
    expect(item1.pomodoros).not.toBe(item2.pomodoros);
  });

  it('多日期事项：同一天有多条专注记录时全部合并到共享数组', async () => {
    const store = useProjectStore();

    const sharedBlockId = '20250315123456-abcdef';
    const [item1, item2] = mkItemsWithSharedBlockId(
      [
        { date: '2026-03-15', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' },
        { date: '2026-03-16', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' }
      ],
      sharedBlockId
    );

    const task = mkTask([item1, item2]);
    const project = mkProject([task]);

    // 3月15日有两条记录，3月16日有一条
    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 09:00:00~09:25:00 上午专注',
      'custom-pomodoro-2': '30,2026-03-15 14:00:00~14:30:00 下午专注',
      'custom-pomodoro-3': '20,2026-03-16 10:00:00~10:20:00 第二天专注'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：两个 Item 共享同一个数组，包含所有3条记录
    expect(item1.pomodoros).toBe(item2.pomodoros);
    expect(item1.pomodoros).toHaveLength(3);
    expect(item2.pomodoros).toHaveLength(3);
  });

  it('没有自定义属性时 pomodoros 保持原值', async () => {
    const store = useProjectStore();

    const blockId = '20250315123456-abcdef';
    const existingPomodoro: PomodoroRecord = {
      id: 'existing-1',
      date: '2026-03-15',
      startTime: '09:00:00',
      endTime: '09:25:00',
      durationMinutes: 25,
      blockId
    };
    const item = mkItem('2026-03-15', blockId, {
      pomodoros: [existingPomodoro]
    });
    const task = mkTask([item]);
    const project = mkProject([task]);

    // 返回空属性（没有专注记录）
    mockGetBlockAttrs.mockResolvedValue({});

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：原有的 pomodoros 应该保留
    expect(item.pomodoros).toHaveLength(1);
    expect(item.pomodoros?.[0].id).toBe('existing-1');
  });

  it('获取属性失败时不影响其他事项', async () => {
    const store = useProjectStore();

    const [item1] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], 'block-id-1');
    const [item2] = mkItemsWithSharedBlockId([{ date: '2026-03-16' }], 'block-id-2');
    const task = mkTask([item1, item2]);
    const project = mkProject([task]);

    // block-id-1 获取失败，block-id-2 成功
    mockGetBlockAttrs.mockImplementation(async (id: string) => {
      if (id === 'block-id-1') {
        throw new Error('网络错误');
      }
      return {
        'custom-pomodoro-1': '25,2026-03-16 10:00:00~10:25:00 专注工作'
      };
    });

    // 不应该抛出错误
    await expect(store.mergePomodoroAttrs([project], mockPlugin)).resolves.not.toThrow();

    // 验证：item1 没有记录（API 抛错未合并），item2 有记录
    expect(item1.pomodoros).toHaveLength(0);
    expect(item2.pomodoros).toHaveLength(1);
  });

  it('Task 级别的专注记录正常合并', async () => {
    const store = useProjectStore();

    const task = mkTask([], { blockId: 'task-block-id' });
    const project = mkProject([task]);

    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 Task级别专注'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：Task 应该有专注记录
    expect(task.pomodoros).toHaveLength(1);
    expect(task.pomodoros?.[0].description).toBe('Task级别专注');
    expect(task.pomodoros?.[0].taskId).toBe(task.id);
    expect(task.pomodoros?.[0].projectId).toBe(project.id);
  });

  it('自定义 attrPrefix 配置正常工作', async () => {
    const store = useProjectStore();

    const customPlugin = {
      getSettings: () => ({
        pomodoro: {
          attrPrefix: 'my-pomodoro'
        }
      })
    };

    const blockId = '20250315123456-abcdef';
    const [item] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], blockId);
    const task = mkTask([item]);
    const project = mkProject([task]);

    mockGetBlockAttrs.mockResolvedValue({
      'my-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 自定义前缀',
      'custom-pomodoro-1': '30,2026-03-15 11:00:00~11:30:00 错误前缀' // 应该被忽略
    });

    await store.mergePomodoroAttrs([project], customPlugin);

    // 验证：只合匹配前缀的记录
    expect(item.pomodoros).toHaveLength(1);
    expect(item.pomodoros?.[0].description).toBe('自定义前缀');
  });

  it('按 blockId 去重：同一个 blockId 只调用一次 getBlockAttrs', async () => {
    const store = useProjectStore();

    const sharedBlockId = '20250315123456-abcdef';
    const [item1, item2] = mkItemsWithSharedBlockId(
      [{ date: '2026-03-15' }, { date: '2026-03-16' }],
      sharedBlockId
    );
    const [item3] = mkItemsWithSharedBlockId([{ date: '2026-03-17' }], 'different-block-id');

    const task = mkTask([item1, item2, item3]);
    const project = mkProject([task]);

    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 测试'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：共享 blockId 的 item 只调用一次 API
    expect(mockGetBlockAttrs).toHaveBeenCalledTimes(2);
    expect(mockGetBlockAttrs).toHaveBeenCalledWith(sharedBlockId);
    expect(mockGetBlockAttrs).toHaveBeenCalledWith('different-block-id');
  });
});

describe('mergePomodoroAttrs - 实际应用场景', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('日期范围跨天的场景：所有 Item 共享同一个 pomodoros 数组', async () => {
    const store = useProjectStore();

    const sharedBlockId = '20250315000000-xyzabc';
    const items = mkItemsWithSharedBlockId(
      [
        {
          date: '2026-03-15',
          startDateTime: '2026-03-15 06:15:00',
          endDateTime: '2026-03-15 08:00:00',
          dateRangeStart: '2026-03-15',
          dateRangeEnd: '2026-03-21'
        },
        { date: '2026-03-16', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-21' },
        { date: '2026-03-21', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-21' }
      ],
      sharedBlockId
    );

    const task = mkTask(items);
    const project = mkProject([task]);

    // 3月15日有专注记录
    mockGetBlockAttrs.mockResolvedValue({
      'custom-pomodoro-20250315-194000': '1,2026-03-15 19:40:00~19:41:00 测试记录'
    });

    await store.mergePomodoroAttrs([project], mockPlugin);

    // 验证：所有 Item 共享同一个 pomodoros 数组
    expect(items[0].pomodoros).toBe(items[1].pomodoros);
    expect(items[1].pomodoros).toBe(items[2].pomodoros);
    // 验证：所有 Item 都能看到这条记录
    expect(items[0].pomodoros).toHaveLength(1);
    expect(items[1].pomodoros).toHaveLength(1);
    expect(items[2].pomodoros).toHaveLength(1);
  });

  it('复杂场景：多个项目、多个任务、多种日期范围', async () => {
    const store = useProjectStore();

    // 项目1：单日期事项
    const [item1] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], 'block-1');
    const task1 = mkTask([item1]);
    const project1 = mkProject([task1], { id: 'proj-1', name: '项目1' });

    // 项目2：多日期事项（共享 blockId）
    const [item2a, item2b] = mkItemsWithSharedBlockId(
      [
        { date: '2026-03-15', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' },
        { date: '2026-03-16', dateRangeStart: '2026-03-15', dateRangeEnd: '2026-03-16' }
      ],
      'block-2'
    );
    const task2 = mkTask([item2a, item2b]);
    const project2 = mkProject([task2], { id: 'proj-2', name: '项目2' });

    mockGetBlockAttrs.mockImplementation(async (id: string) => {
      switch (id) {
        case 'block-1':
          return {
            'custom-pomodoro-1': '25,2026-03-15 10:00:00~10:25:00 项目1专注'
          };
        case 'block-2':
          return {
            'custom-pomodoro-1': '30,2026-03-15 14:00:00~14:30:00 项目2第一天',
            'custom-pomodoro-2': '20,2026-03-16 09:00:00~09:20:00 项目2第二天'
          };
        default:
          return {};
      }
    });

    await store.mergePomodoroAttrs([project1, project2], mockPlugin);

    // 验证项目1
    expect(item1.pomodoros).toHaveLength(1);
    expect(item1.pomodoros?.[0].description).toBe('项目1专注');
    expect(item1.pomodoros?.[0].projectId).toBe('proj-1');

    // 验证项目2：item2a 和 item2b 共享同一个数组，包含所有记录
    expect(item2a.pomodoros).toBe(item2b.pomodoros);
    expect(item2a.pomodoros).toHaveLength(2);
    expect(item2b.pomodoros).toHaveLength(2);
    expect(item2a.pomodoros?.[0].projectId).toBe('proj-2');
  });
});
