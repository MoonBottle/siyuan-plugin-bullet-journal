import { describe, expect, it } from 'vitest';
import { DataConverter } from '@/utils/dataConverter';
import type { Project } from '@/types/models';

function projectWithTasks(tasks: Project['tasks']): Project {
  return {
    id: 'project-1',
    name: '项目',
    tasks,
    habits: [],
    path: '/项目',
  };
}

function localParts(date: Date | undefined) {
  expect(date).toBeInstanceOf(Date);
  return {
    year: date!.getFullYear(),
    month: date!.getMonth() + 1,
    day: date!.getDate(),
    hour: date!.getHours(),
    minute: date!.getMinutes(),
    second: date!.getSeconds(),
    millisecond: date!.getMilliseconds(),
  };
}

describe('DataConverter.projectsToGanttTasks', () => {
  it('将纯日期任务转换为本地全天范围', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '单日任务',
          level: 'L1',
          date: '2026-05-14',
          items: [],
          lineNumber: 1,
        },
      ]),
    ]);

    const task = tasks.find(t => t.id === 'task-task-1');

    expect(localParts(task?.start_date)).toEqual({
      year: 2026,
      month: 5,
      day: 14,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expect(localParts(task?.end_date)).toEqual({
      year: 2026,
      month: 5,
      day: 14,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
  });

  it('由多日纯日期事项聚合的任务覆盖完整日期范围', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '多日任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '14号',
              date: '2026-05-14',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
            {
              id: 'item-2',
              content: '16号',
              date: '2026-05-16',
              docId: 'doc-1',
              lineNumber: 3,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ]);

    const task = tasks.find(t => t.id === 'task-task-1');

    expect(localParts(task?.start_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 0,
      minute: 0,
      second: 0,
    });
    expect(localParts(task?.end_date)).toEqual({
      year: 2026,
      month: 5,
      day: 16,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
  });

  it('保留带时间事项的精确时间', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '带时间任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '会议',
              date: '2026-05-14',
              docId: 'doc-1',
              startDateTime: '2026-05-14 09:00:00',
              endDateTime: '2026-05-14 10:00:00',
              lineNumber: 2,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true);

    const item = tasks.find(t => t.id === 'item-item-1');

    expect(localParts(item?.start_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 9,
      minute: 0,
      second: 0,
    });
    expect(localParts(item?.end_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 10,
      minute: 0,
      second: 0,
    });
  });

  it('日期筛选的结束日包含当天结束边界', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '边界任务',
          level: 'L1',
          date: '2026-05-16',
          items: [],
          lineNumber: 1,
        },
      ]),
    ], false, { end: '2026-05-16' });

    expect(tasks.some(t => t.id === 'task-task-1')).toBe(true);
  });

  it('多日期全天事项合并为单条 + segments', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '整理资料',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
            {
              id: 'item-2',
              content: '整理资料',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
            {
              id: 'item-3',
              content: '整理资料',
              date: '2026-03-11',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
            {
              id: 'item-4',
              content: '整理资料',
              date: '2026-03-12',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true);

    const splitParent = tasks.find(t => t.id === 'split-block-1');
    expect(splitParent).toBeUndefined();

    const item = tasks.find(t => t.id === 'item-item-1');
    expect(item).toBeDefined();
    expect(item!.parent).toBe('task-task-1');
    expect(item!.extendedProps?.isMultiDate).toBe(true);
    expect(item!.extendedProps?.segments).toHaveLength(2);
    expect(item!.extendedProps?.segments![0].startTs).toBeTypeOf('number');
    expect(item!.extendedProps?.segments![0].endTs).toBeTypeOf('number');
  });

  it('多日期有时间事项合并为单条，每个日期独立 segment', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '整理资料',
              date: '2026-03-10',
              docId: 'doc-1',
              startDateTime: '2026-03-10 14:00:00',
              endDateTime: '2026-03-10 15:00:00',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
            {
              id: 'item-2',
              content: '整理资料',
              date: '2026-03-11',
              docId: 'doc-1',
              startDateTime: '2026-03-11 14:00:00',
              endDateTime: '2026-03-11 15:00:00',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true);

    const item = tasks.find(t => t.id === 'item-item-1');
    expect(item).toBeDefined();
    expect(item!.extendedProps?.isMultiDate).toBe(true);
    expect(item!.extendedProps?.segments).toHaveLength(2);
  });

  it('单日期事项不生成 isMultiDate 标记', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '单日事项',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
              blockId: 'block-1',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true);

    const item = tasks.find(t => t.id === 'item-item-1');
    expect(item).toBeDefined();
    expect(item!.parent).toBe('task-task-1');
    expect(item!.extendedProps?.isMultiDate).toBeFalsy();
    expect(item!.extendedProps?.segments).toBeUndefined();
  });
});

describe('DataConverter.mergeItemsToSegments', () => {
  const mkItem = (date: string, startDateTime?: string, endDateTime?: string) => ({
    id: `item-${date}`,
    content: '事项',
    date,
    startDateTime,
    endDateTime,
    docId: 'doc-1',
    lineNumber: 1,
    status: 'pending' as const,
    blockId: 'block-1',
  });

  it('全天连续日期合并为一段', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(1);
    expect(segments[0].items).toHaveLength(3);
  });

  it('全天不连续日期拆为多段', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(3);
  });

  it('全天混合连续与不连续', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
    expect(segments[0].items).toHaveLength(1);
    expect(segments[1].items).toHaveLength(3);
  });

  it('有时间的事项各自独立成段', () => {
    const items = [
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
      mkItem('2026-03-11', '2026-03-11 14:00:00', '2026-03-11 15:00:00'),
      mkItem('2026-03-12', '2026-03-12 14:00:00', '2026-03-12 15:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(3);
  });

  it('全天与有时间混合', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
  });

  it('全天连续后接有时间事项，全天段合并、时间项独立', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12', '2026-03-12 09:00:00', '2026-03-12 10:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
    expect(segments[0].items).toHaveLength(2);
    expect(segments[1].items).toHaveLength(1);
  });

  it('单日全天返回一段', () => {
    const items = [mkItem('2026-03-10')];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(1);
    expect(segments[0].items).toHaveLength(1);
  });

  it('空数组返回空', () => {
    const segments = DataConverter.mergeItemsToSegments([]);
    expect(segments).toHaveLength(0);
  });
});
