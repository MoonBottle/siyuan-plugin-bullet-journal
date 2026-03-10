/**
 * projectStore 集成测试
 * 验证多日期事项去重与代表项逻辑
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import type { Item, Project } from '@/types/models';

const mkItem = (
  date: string,
  blockId: string,
  overrides?: Partial<Item>
): Item =>
  ({
    id: `item-${date}`,
    content: '测试事项',
    date,
    lineNumber: 1,
    docId: 'doc1',
    blockId,
    status: 'pending',
    dateRangeStart: '2026-03-07',
    dateRangeEnd: '2026-03-09',
    ...overrides
  }) as Item;

const mockProject: Project = {
  id: 'proj-1',
  name: '测试项目',
  path: '/test',
  tasks: []
};

describe('projectStore 多日期事项', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('getExpiredItems 去重：7~9 事项，今天 10 号，返回 1 条（9 号）', () => {
    const store = useProjectStore();
    const items = [
      mkItem('2026-03-07', 'b1'),
      mkItem('2026-03-08', 'b1'),
      mkItem('2026-03-09', 'b1')
    ].map(i => ({ ...i, project: mockProject }));
    store.$patch({ items, currentDate: '2026-03-10' });

    const result = store.getExpiredItems('');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-09');
  });

  it('getFutureItems 代表项：7~9 事项，今天 8 号，返回 1 条（8 号）', () => {
    const store = useProjectStore();
    const items = [
      mkItem('2026-03-07', 'b1'),
      mkItem('2026-03-08', 'b1'),
      mkItem('2026-03-09', 'b1')
    ].map(i => ({ ...i, project: mockProject }));
    store.$patch({ items, currentDate: '2026-03-08' });

    const result = store.getFutureItems('');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-08');
  });

  it('getCompletedItems 去重：7~9 事项已完成，返回 1 条', () => {
    const store = useProjectStore();
    const items = [
      mkItem('2026-03-07', 'b1', { status: 'completed' }),
      mkItem('2026-03-08', 'b1', { status: 'completed' }),
      mkItem('2026-03-09', 'b1', { status: 'completed' })
    ].map(i => ({ ...i, project: mockProject }));
    store.$patch({ items, currentDate: '2026-03-10' });

    const result = store.getCompletedItems('');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });
});
