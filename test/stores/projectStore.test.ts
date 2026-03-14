/**
 * projectStore 集成测试
 * 验证多日期事项去重与代表项逻辑、专注时长统计
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import type { Item, Project, Task, PomodoroRecord } from '@/types/models';

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

  it('getFutureItems 代表项：离散 @07,11，今天 10 号，返回 1 条（11 号，归入明天）', () => {
    const store = useProjectStore();
    const items = [
      mkItem('2026-03-07', 'b1', { dateRangeStart: '2026-03-07', dateRangeEnd: '2026-03-11' }),
      mkItem('2026-03-11', 'b1', { dateRangeStart: '2026-03-07', dateRangeEnd: '2026-03-11' })
    ].map(i => ({ ...i, project: mockProject }));
    store.$patch({ items, currentDate: '2026-03-10' });

    const result = store.getFutureItems('');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-11');
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

const mkPomodoro = (date: string, minutes: number, overrides?: Partial<PomodoroRecord>): PomodoroRecord =>
  ({
    id: `p-${date}-${minutes}`,
    date,
    startTime: '10:00:00',
    endTime: '10:30:00',
    durationMinutes: minutes,
    actualDurationMinutes: minutes,
    ...overrides
  }) as PomodoroRecord;

describe('projectStore 专注时长统计', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('getFocusMinutesByDay 返回某日专注分钟', () => {
    const store = useProjectStore();
    const task: Task = {
      id: 't1',
      name: '任务',
      level: 'L1',
      items: [],
      lineNumber: 1,
      pomodoros: [
        mkPomodoro('2026-03-10', 25),
        mkPomodoro('2026-03-10', 15)
      ]
    };
    const project: Project = {
      ...mockProject,
      tasks: [task]
    };
    store.$patch({ projects: [project] });

    const mins = store.getFocusMinutesByDay('2026-03-10', '');
    expect(mins).toBe(40);
  });

  it('getFocusMinutesByDay 无数据返回 0', () => {
    const store = useProjectStore();
    store.$patch({ projects: [] });
    expect(store.getFocusMinutesByDay('2026-03-10', '')).toBe(0);
  });

  it('getFocusMinutesByDateRange 返回日期范围内按日聚合', () => {
    const store = useProjectStore();
    const task: Task = {
      id: 't1',
      name: '任务',
      level: 'L1',
      items: [],
      lineNumber: 1,
      pomodoros: [
        mkPomodoro('2026-03-10', 25),
        mkPomodoro('2026-03-10', 15),
        mkPomodoro('2026-03-11', 30),
        mkPomodoro('2026-03-12', 20)
      ]
    };
    const project: Project = {
      ...mockProject,
      tasks: [task]
    };
    store.$patch({ projects: [project] });

    const byDay = store.getFocusMinutesByDateRange('2026-03-10', '2026-03-12', '');
    expect(byDay.get('2026-03-10')).toBe(40);
    expect(byDay.get('2026-03-11')).toBe(30);
    expect(byDay.get('2026-03-12')).toBe(20);
  });

  it('getFocusMinutesByDateRange 范围外日期不包含', () => {
    const store = useProjectStore();
    const task: Task = {
      id: 't1',
      name: '任务',
      level: 'L1',
      items: [],
      lineNumber: 1,
      pomodoros: [
        mkPomodoro('2026-03-09', 25),
        mkPomodoro('2026-03-11', 30)
      ]
    };
    const project: Project = {
      ...mockProject,
      tasks: [task]
    };
    store.$patch({ projects: [project] });

    const byDay = store.getFocusMinutesByDateRange('2026-03-10', '2026-03-12', '');
    expect(byDay.has('2026-03-09')).toBe(false);
    expect(byDay.get('2026-03-11')).toBe(30);
  });

  it('getFocusMinutesByDateRange 优先使用 actualDurationMinutes', () => {
    const store = useProjectStore();
    const task: Task = {
      id: 't1',
      name: '任务',
      level: 'L1',
      items: [],
      lineNumber: 1,
      pomodoros: [
        mkPomodoro('2026-03-10', 25, { actualDurationMinutes: 20 })
      ]
    };
    const project: Project = {
      ...mockProject,
      tasks: [task]
    };
    store.$patch({ projects: [project] });

    const byDay = store.getFocusMinutesByDateRange('2026-03-10', '2026-03-10', '');
    expect(byDay.get('2026-03-10')).toBe(20);
  });
});
