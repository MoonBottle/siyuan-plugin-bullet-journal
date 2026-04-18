/**
 * MarkdownParser 番茄钟相关功能测试
 * 验证自定义属性形式的专注记录合并逻辑，特别是多日期事项场景
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarkdownParser } from '@/parser/markdownParser';
import type { Item, Project, Task, PomodoroRecord } from '@/types/models';
import * as api from '@/api';

// Mock API
vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api');
  return {
    ...actual,
    sql: vi.fn(),
    getDocKramdown: vi.fn()
  };
});

const mockSql = vi.mocked(api.sql);
const mockGetDocKramdown = vi.mocked(api.getDocKramdown);

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
    habits: [],
    ...overrides
  }) as Project;

const mockPlugin = {
  getSettings: () => ({
    pomodoro: {
      attrPrefix: 'custom-pomodoro'
    }
  })
};

describe('MarkdownParser 番茄钟属性合并', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    parser = new MarkdownParser([]);
    vi.clearAllMocks();
  });

  it('多日期事项：共享同一个 pomodoros 数组', async () => {
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

    // Mock SQL 返回番茄钟属性
    mockSql.mockResolvedValue([
      { blockId: sharedBlockId, name: 'custom-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 专注工作1' },
      { blockId: sharedBlockId, name: 'custom-pomodoro-2', value: '30,2026-03-16 14:00:00~14:30:00 专注工作2' }
    ]);

    // 使用 private 方法测试
    await (parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin);

    // 验证：两个 Item 共享同一个 pomodoros 数组
    expect(item1.pomodoros).toBe(item2.pomodoros);
    // 验证：共享数组包含所有记录
    expect(item1.pomodoros).toHaveLength(2);
    expect(item2.pomodoros).toHaveLength(2);
  });

  it('多日期事项：共享 pomodoros 包含所有日期的记录', async () => {
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

    mockSql.mockResolvedValue([
      { blockId: sharedBlockId, name: 'custom-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 专注工作1' },
      { blockId: sharedBlockId, name: 'custom-pomodoro-2', value: '20,2026-03-17 15:00:00~15:20:00 专注工作2' }
    ]);

    await (parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin);

    // 验证：所有 Item 共享同一个数组，包含所有记录
    expect(item1.pomodoros).toBe(item2.pomodoros);
    expect(item2.pomodoros).toBe(item3.pomodoros);
    expect(item1.pomodoros).toHaveLength(2);
  });

  it('单日期事项：专注记录正常合并', async () => {
    const blockId = '20250315123456-abcdef';
    const [item] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], blockId);
    const task = mkTask([item]);
    const project = mkProject([task]);

    mockSql.mockResolvedValue([
      { blockId, name: 'custom-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 专注工作1' },
      { blockId, name: 'custom-pomodoro-2', value: '15,2026-03-15 14:00:00~14:15:00 专注工作2' }
    ]);

    await (parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin);

    // 验证：单日期事项应该包含所有记录
    expect(item.pomodoros).toHaveLength(2);
    expect(item.pomodoros?.[0].date).toBe('2026-03-15');
    expect(item.pomodoros?.[1].date).toBe('2026-03-15');
  });

  it('多个事项有不同的 blockId：各自获取自己的专注记录', async () => {
    const [item1] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], 'block-id-1');
    const [item2] = mkItemsWithSharedBlockId([{ date: '2026-03-16' }], 'block-id-2');
    const task = mkTask([item1, item2]);
    const project = mkProject([task]);

    // Mock SQL 返回不同 blockId 的记录
    mockSql.mockResolvedValue([
      { blockId: 'block-id-1', name: 'custom-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 事项1的专注' },
      { blockId: 'block-id-2', name: 'custom-pomodoro-1', value: '30,2026-03-16 14:00:00~14:30:00 事项2的专注' }
    ]);

    await (parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin);

    // 验证：每个 Item 只有自己的记录
    expect(item1.pomodoros).toHaveLength(1);
    expect(item1.pomodoros?.[0].description).toBe('事项1的专注');

    expect(item2.pomodoros).toHaveLength(1);
    expect(item2.pomodoros?.[0].description).toBe('事项2的专注');

    // 验证：不同的 blockId 不共享数组
    expect(item1.pomodoros).not.toBe(item2.pomodoros);
  });

  it('Task 级别的专注记录正常合并', async () => {
    const task = mkTask([], { blockId: 'task-block-id' });
    const project = mkProject([task]);

    mockSql.mockResolvedValue([
      { blockId: 'task-block-id', name: 'custom-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 Task级别专注' }
    ]);

    await (parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin);

    // 验证：Task 应该有专注记录
    expect(task.pomodoros).toHaveLength(1);
    expect(task.pomodoros?.[0].description).toBe('Task级别专注');
    expect(task.pomodoros?.[0].taskId).toBe(task.id);
    expect(task.pomodoros?.[0].projectId).toBe(project.id);
  });

  it('自定义 attrPrefix 配置正常工作', async () => {
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

    mockSql.mockResolvedValue([
      { blockId, name: 'my-pomodoro-1', value: '25,2026-03-15 10:00:00~10:25:00 自定义前缀' },
      { blockId, name: 'custom-pomodoro-1', value: '30,2026-03-15 11:00:00~11:30:00 错误前缀' }
    ]);

    await (parser as any).mergePomodoroAttrsForSingleProject(project, customPlugin);

    // 验证：只合匹配前缀的记录
    expect(item.pomodoros).toHaveLength(1);
    expect(item.pomodoros?.[0].description).toBe('自定义前缀');
  });

  it('SQL 查询失败时不影响项目解析', async () => {
    const blockId = '20250315123456-abcdef';
    const [item] = mkItemsWithSharedBlockId([{ date: '2026-03-15' }], blockId);
    const task = mkTask([item]);
    const project = mkProject([task]);

    // Mock SQL 抛出错误
    mockSql.mockRejectedValue(new Error('数据库错误'));

    // 不应该抛出错误
    await expect((parser as any).mergePomodoroAttrsForSingleProject(project, mockPlugin)).resolves.not.toThrow();

    // 验证：没有专注记录，但不影响项目
    expect(item.pomodoros).toHaveLength(0);
  });
});
