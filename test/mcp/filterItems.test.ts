/**
 * filter_items 过滤逻辑的单元测试
 * 重点验证 status 过滤是否正常
 */
import { describe, it, expect } from 'vitest';
import { filterItems } from '@/mcp/filterItems';
import type { Item, Project, Task } from '@/types/models';

function createMockItem(overrides: Partial<Item> & { status: Item['status'] }): Item {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    content: '测试事项',
    date: '2026-01-06',
    lineNumber: 1,
    docId: 'doc-1',
    status: 'pending',
    ...overrides
  };
}

const mockProject: Project = {
  id: 'proj-1',
  name: '子弹笔记插件',
  path: '/test',
  tasks: []
};

const mockTask: Task = {
  id: 'task-1',
  name: '搭建插件框架',
  level: 'L1',
  items: [],
  lineNumber: 1
};

describe('filterItems - status 过滤', () => {
  it('status: pending 时只返回 pending 事项', () => {
    const items: Item[] = [
      createMockItem({ id: '1', content: '待办1', status: 'pending' }),
      createMockItem({ id: '2', content: '已完成1', status: 'completed' }),
      createMockItem({ id: '3', content: '待办2', status: 'pending' }),
      createMockItem({ id: '4', content: '已放弃1', status: 'abandoned' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, { status: 'pending' });

    expect(result).toHaveLength(2);
    expect(result.every(i => i.status === 'pending')).toBe(true);
    expect(result.map(i => i.id)).toEqual(['1', '3']);
  });

  it('status: completed 时只返回 completed 事项', () => {
    const items: Item[] = [
      createMockItem({ id: '1', content: '待办1', status: 'pending' }),
      createMockItem({ id: '2', content: '已完成1', status: 'completed' }),
      createMockItem({ id: '3', content: '已完成2', status: 'completed' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, { status: 'completed' });

    expect(result).toHaveLength(2);
    expect(result.every(i => i.status === 'completed')).toBe(true);
    expect(result.map(i => i.id)).toEqual(['2', '3']);
  });

  it('status: abandoned 时只返回 abandoned 事项', () => {
    const items: Item[] = [
      createMockItem({ id: '1', content: '待办1', status: 'pending' }),
      createMockItem({ id: '2', content: '已放弃1', status: 'abandoned' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, { status: 'abandoned' });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('abandoned');
    expect(result[0].id).toBe('2');
  });

  it('不传 status 时返回全部事项', () => {
    const items: Item[] = [
      createMockItem({ id: '1', status: 'pending' }),
      createMockItem({ id: '2', status: 'completed' }),
      createMockItem({ id: '3', status: 'abandoned' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, {});

    expect(result).toHaveLength(3);
  });

  it('status 过滤与日期过滤可组合', () => {
    const items: Item[] = [
      createMockItem({ id: '1', date: '2026-01-05', status: 'pending' }),
      createMockItem({ id: '2', date: '2026-01-06', status: 'pending' }),
      createMockItem({ id: '2b', date: '2026-01-06', status: 'completed' }),
      createMockItem({ id: '3', date: '2026-01-07', status: 'pending' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, {
      status: 'pending',
      startDate: '2026-01-06',
      endDate: '2026-01-06'
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
    expect(result[0].status).toBe('pending');
  });

  it('无匹配项时返回空数组', () => {
    const items: Item[] = [
      createMockItem({ id: '1', status: 'completed' }),
      createMockItem({ id: '2', status: 'abandoned' })
    ].map(i => ({ ...i, project: mockProject, task: mockTask }));

    const result = filterItems(items, { status: 'pending' });

    expect(result).toHaveLength(0);
  });
});
