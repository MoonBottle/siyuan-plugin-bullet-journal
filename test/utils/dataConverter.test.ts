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
              lineNumber: 2,
              status: 'pending',
            },
            {
              id: 'item-2',
              content: '16号',
              date: '2026-05-16',
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
});
