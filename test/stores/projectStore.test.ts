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

// 创建包含 items 的 mock project
const createMockProject = (items: Item[]): Project => {
  const task: Task = {
    id: 'task-1',
    name: '测试任务',
    level: 'L1',
    items,
    lineNumber: 1
  };
  return {
    id: 'proj-1',
    name: '测试项目',
    path: '/test',
    tasks: [task]
  };
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
    ];
    store.$patch({
      projects: [createMockProject(items)],
      currentDate: '2026-03-10'
    });

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
    ];
    store.$patch({
      projects: [createMockProject(items)],
      currentDate: '2026-03-08'
    });

    const result = store.getFutureItems('');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-08');
  });

  it('getFutureItems 代表项：离散 @07,11，今天 10 号，返回 1 条（11 号，归入明天）', () => {
    const store = useProjectStore();
    const items = [
      mkItem('2026-03-07', 'b1', { dateRangeStart: '2026-03-07', dateRangeEnd: '2026-03-11' }),
      mkItem('2026-03-11', 'b1', { dateRangeStart: '2026-03-07', dateRangeEnd: '2026-03-11' })
    ];
    store.$patch({
      projects: [createMockProject(items)],
      currentDate: '2026-03-10'
    });

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
    ];
    store.$patch({
      projects: [createMockProject(items)],
      currentDate: '2026-03-10'
    });

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
      id: 'proj-1',
      name: '测试项目',
      path: '/test',
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
      id: 'proj-1',
      name: '测试项目',
      path: '/test',
      tasks: [task],
      habits: []
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
      id: 'proj-1',
      name: '测试项目',
      path: '/test',
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
      id: 'proj-1',
      name: '测试项目',
      path: '/test',
      tasks: [task],
      habits: []
    };
    store.$patch({ projects: [project] });

    const byDay = store.getFocusMinutesByDateRange('2026-03-10', '2026-03-10', '');
    expect(byDay.get('2026-03-10')).toBe(20);
  });
});

describe('habits getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('getHabits 返回所有习惯', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [{
        id: 'doc-1', name: '测试', tasks: [], habits: [
          { name: '早起', type: 'binary', startDate: '2026-04-01', records: [], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' } },
          { name: '喝水', type: 'count', startDate: '2026-04-01', target: 8, unit: '杯', records: [], blockId: 'b2', docId: 'doc-1', frequency: { type: 'daily' } }
        ], path: '/test'
      }]
    });
    const habits = store.getHabits('');
    expect(habits).toHaveLength(2);
  });

  it('getTodayRecords 返回今日打卡记录', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [{
        id: 'doc-1', name: '测试', tasks: [], habits: [{
          name: '早起', type: 'binary', startDate: '2026-04-01', records: [
            { content: '早起', date: '2026-04-06', blockId: 'r1', docId: 'doc-1', habitId: 'b1' }
          ], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' }
        }], path: '/test'
      }],
      currentDate: '2026-04-06'
    });
    const records = store.getTodayRecords('');
    expect(records).toHaveLength(1);
  });

  it('getRecordsByDate 返回指定日期打卡记录', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [{
        id: 'doc-1', name: '测试', tasks: [], habits: [{
          name: '早起', type: 'binary', startDate: '2026-04-01', records: [
            { content: '早起', date: '2026-04-06', blockId: 'r1', docId: 'doc-1', habitId: 'b1' },
            { content: '早起', date: '2026-04-07', blockId: 'r2', docId: 'doc-1', habitId: 'b1' }
          ], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' }
        }], path: '/test'
      }]
    });
    const records = store.getRecordsByDate('2026-04-06', '');
    expect(records).toHaveLength(1);
    expect(records[0].date).toBe('2026-04-06');
  });

  it('getHabits 按分组过滤', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [
        { id: 'doc-1', name: '测试A', groupId: 'g1', tasks: [], habits: [{ name: '早起', type: 'binary', startDate: '2026-04-01', records: [], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' } }], path: '/testA' },
        { id: 'doc-2', name: '测试B', groupId: 'g2', tasks: [], habits: [{ name: '喝水', type: 'count', startDate: '2026-04-01', target: 8, unit: '杯', records: [], blockId: 'b2', docId: 'doc-2', frequency: { type: 'daily' } }], path: '/testB' }
      ]
    });
    expect(store.getHabits('')).toHaveLength(2);
    expect(store.getHabits('g1')).toHaveLength(1);
    expect(store.getHabits('g1')[0].name).toBe('早起');
  });
});
