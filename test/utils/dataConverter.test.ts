import type {
  Item,
  Project,
  Task,
} from '@/types/models'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { DataConverter } from '@/utils/dataConverter'

function projectWithTasks(tasks: Project['tasks']): Project {
  return {
    id: 'project-1',
    name: '项目',
    tasks,
    habits: [],
    path: '/项目',
  }
}

function localParts(date: Date | undefined) {
  expect(date).toBeInstanceOf(Date)
  return {
    year: date!.getFullYear(),
    month: date!.getMonth() + 1,
    day: date!.getDate(),
    hour: date!.getHours(),
    minute: date!.getMinutes(),
    second: date!.getSeconds(),
    millisecond: date!.getMilliseconds(),
  }
}

describe('dataConverter.projectsToGanttTasks', () => {
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
    ])

    const task = tasks.find((t) => t.id === 'task-task-1')

    expect(localParts(task?.start_date)).toEqual({
      year: 2026,
      month: 5,
      day: 14,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    expect(localParts(task?.end_date)).toEqual({
      year: 2026,
      month: 5,
      day: 14,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    })
  })

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
    ])

    const task = tasks.find((t) => t.id === 'task-task-1')

    expect(localParts(task?.start_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 0,
      minute: 0,
      second: 0,
    })
    expect(localParts(task?.end_date)).toEqual({
      year: 2026,
      month: 5,
      day: 16,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    })
  })

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
    ], true)

    const item = tasks.find((t) => t.id === 'item-item-1')

    expect(localParts(item?.start_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 9,
      minute: 0,
      second: 0,
    })
    expect(localParts(item?.end_date)).toMatchObject({
      year: 2026,
      month: 5,
      day: 14,
      hour: 10,
      minute: 0,
      second: 0,
    })
  })

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
    ], false, { end: '2026-05-16' })

    expect(tasks.some((t) => t.id === 'task-task-1')).toBe(true)
  })

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
    ], true)

    const splitParent = tasks.find((t) => t.id === 'split-block-1')
    expect(splitParent).toBeUndefined()

    const item = tasks.find((t) => t.id === 'item-item-1')
    expect(item).toBeDefined()
    expect(item!.parent).toBe('task-task-1')
    expect(item!.extendedProps?.isMultiDate).toBe(true)
    expect(item!.extendedProps?.segments).toHaveLength(2)
    expect(item!.extendedProps?.segments![0].startTs).toBeTypeOf('number')
    expect(item!.extendedProps?.segments![0].endTs).toBeTypeOf('number')
  })

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
    ], true)

    const item = tasks.find((t) => t.id === 'item-item-1')
    expect(item).toBeDefined()
    expect(item!.extendedProps?.isMultiDate).toBe(true)
    expect(item!.extendedProps?.segments).toHaveLength(2)
  })

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
    ], true)

    const item = tasks.find((t) => t.id === 'item-item-1')
    expect(item).toBeDefined()
    expect(item!.parent).toBe('task-task-1')
    expect(item!.extendedProps?.isMultiDate).toBeFalsy()
    expect(item!.extendedProps?.segments).toBeUndefined()
  })

  it('showItems=true + 日期过滤：任务日期精确到毫秒级边界', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
            {
              id: 'item-2',
              content: '3月10号',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 3,
              status: 'pending',
            },
            {
              id: 'item-3',
              content: '3月20号',
              date: '2026-03-20',
              docId: 'doc-1',
              lineNumber: 4,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true, {
      start: '2026-03-05',
      end: '2026-03-15',
    })

    const task = tasks.find((t) => t.id === 'task-task-1')
    expect(task).toBeDefined()

    // 任务日期应基于过滤后的事项（3月10号），而非全部事项
    expect(localParts(task!.start_date)).toMatchObject({
      year: 2026,
      month: 3,
      day: 10,
      hour: 0,
      minute: 0,
      second: 0,
    })
    expect(localParts(task!.end_date)).toEqual({
      year: 2026,
      month: 3,
      day: 10,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    })
  })

  it('showItems=true + 日期过滤：事项和任务日期范围一致', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
            {
              id: 'item-2',
              content: '3月10号',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 3,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true, {
      start: '2026-03-05',
      end: '2026-03-15',
    })

    const task = tasks.find((t) => t.id === 'task-task-1')
    expect(task).toBeDefined()

    // 任务日期应基于过滤后的事项（3月10号），而非全部事项
    expect(localParts(task!.start_date)).toMatchObject({
      year: 2026,
      month: 3,
      day: 10,
    })
    expect(localParts(task!.end_date)).toMatchObject({
      year: 2026,
      month: 3,
      day: 10,
    })

    // 只有过滤后的事项节点
    const itemNodes = tasks.filter((t) => t.id.startsWith('item-'))
    expect(itemNodes).toHaveLength(1)
    expect(itemNodes[0].id).toBe('item-item-2')
  })

  it('showItems=true + 日期过滤后事项为空：任务不显示', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true, {
      start: '2026-03-10',
      end: '2026-03-15',
    })

    expect(tasks.some((t) => t.id === 'task-task-1')).toBe(false)
    expect(tasks.some((t) => t.id === 'item-item-1')).toBe(false)
  })

  it('showItems=true + 日期过滤后所有任务事项为空：项目不显示', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true, {
      start: '2026-03-10',
      end: '2026-03-15',
    })

    expect(tasks.some((t) => t.id === 'proj-project-1')).toBe(false)
  })

  it('showItems=false + 日期过滤：保持现有逻辑', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'pending',
            },
            {
              id: 'item-2',
              content: '3月10号',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 3,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], false, {
      start: '2026-03-05',
      end: '2026-03-15',
    })

    // showItems=false 时，任务日期仍基于全部事项（3月1号~3月10号）
    const task = tasks.find((t) => t.id === 'task-task-1')
    expect(task).toBeDefined()
    expect(localParts(task!.start_date)).toMatchObject({
      year: 2026,
      month: 3,
      day: 1,
    })
    expect(localParts(task!.end_date)).toMatchObject({
      year: 2026,
      month: 3,
      day: 10,
    })
  })

  it('showItems=true + 日期过滤 + 状态过滤叠加', () => {
    const tasks = DataConverter.projectsToGanttTasks([
      projectWithTasks([
        {
          id: 'task-1',
          name: '任务',
          level: 'L1',
          items: [
            {
              id: 'item-1',
              content: '3月1号已完成',
              date: '2026-03-01',
              docId: 'doc-1',
              lineNumber: 2,
              status: 'completed',
            },
            {
              id: 'item-2',
              content: '3月10号待办',
              date: '2026-03-10',
              docId: 'doc-1',
              lineNumber: 3,
              status: 'pending',
            },
          ],
          lineNumber: 1,
        },
      ]),
    ], true, {
      start: '2026-03-05',
      end: '2026-03-15',
    }, ['pending'])

    const task = tasks.find((t) => t.id === 'task-task-1')
    expect(task).toBeDefined()

    // 只有 pending + 日期范围内的事项
    const itemNodes = tasks.filter((t) => t.id.startsWith('item-'))
    expect(itemNodes).toHaveLength(1)
    expect(itemNodes[0].id).toBe('item-item-2')
  })
})

describe('dataConverter.mergeItemsToSegments', () => {
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
  })

  it('全天连续日期合并为一段', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(1)
    expect(segments[0].items).toHaveLength(3)
  })

  it('全天不连续日期拆为多段', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-12'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(3)
  })

  it('全天混合连续与不连续', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(2)
    expect(segments[0].items).toHaveLength(1)
    expect(segments[1].items).toHaveLength(3)
  })

  it('有时间的事项各自独立成段', () => {
    const items = [
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
      mkItem('2026-03-11', '2026-03-11 14:00:00', '2026-03-11 15:00:00'),
      mkItem('2026-03-12', '2026-03-12 14:00:00', '2026-03-12 15:00:00'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(3)
  })

  it('全天与有时间混合', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(2)
  })

  it('全天连续后接有时间事项，全天段合并、时间项独立', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12', '2026-03-12 09:00:00', '2026-03-12 10:00:00'),
    ]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(2)
    expect(segments[0].items).toHaveLength(2)
    expect(segments[1].items).toHaveLength(1)
  })

  it('单日全天返回一段', () => {
    const items = [mkItem('2026-03-10')]
    const segments = DataConverter.mergeItemsToSegments(items)
    expect(segments).toHaveLength(1)
    expect(segments[0].items).toHaveLength(1)
  })

  it('空数组返回空', () => {
    const segments = DataConverter.mergeItemsToSegments([])
    expect(segments).toHaveLength(0)
  })
})

describe('dataConverter.filterItemsByDate', () => {
  const mkItem = (date: string, startDateTime?: string, endDateTime?: string) => ({
    id: `item-${date}`,
    content: '事项',
    date,
    startDateTime,
    endDateTime,
    docId: 'doc-1',
    lineNumber: 1,
    status: 'pending' as const,
  })

  it('无 dateFilter 时返回全部事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items)
    expect(result).toHaveLength(2)
  })

  it('过滤掉完全在范围外的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10'), mkItem('2026-03-20')]
    const result = DataConverter.filterItemsByDate(items, {
      start: '2026-03-05',
      end: '2026-03-15',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('保留与范围有交集的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, {
      start: '2026-03-01',
      end: '2026-03-01',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-01')
  })

  it('带时间的事项与范围有交集时保留', () => {
    const items = [
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
      mkItem('2026-03-20', '2026-03-20 09:00:00', '2026-03-20 10:00:00'),
    ]
    const result = DataConverter.filterItemsByDate(items, {
      start: '2026-03-10',
      end: '2026-03-10',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('只有 start 过滤时保留开始日期 >= start 的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, { start: '2026-03-05' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('只有 end 过滤时保留结束日期 <= end 的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, { end: '2026-03-05' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-01')
  })

  it('空数组返回空', () => {
    const result = DataConverter.filterItemsByDate([], {
      start: '2026-03-01',
      end: '2026-03-10',
    })
    expect(result).toHaveLength(0)
  })
})

function makeItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId ?? (partial.id || 'item'),
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    task: partial.task,
    project: partial.project,
  } as Item
}

function makeTask(partial: Partial<Task>): Task {
  const base = {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId ?? (partial.id || 'task'),
  } as Task
  base.items.forEach((row) => {
    row.task = base
  })
  return base
}

function makeProject(partial: Partial<Project>): Project {
  const base = {
    id: partial.id || 'project',
    name: partial.name || '项目',
    description: partial.description,
    path: partial.path || '工作安排/2026/项目',
    tasks: partial.tasks || [],
    habits: [],
    links: partial.links,
  } as Project
  base.tasks.forEach((task) => {
    task.items.forEach((row) => {
      row.project = base
      row.task = task
    })
  })
  return base
}

describe('projectsToCalendarEvents - showItems', () => {
  it('showItems=false 时只生成 Task 级别事件', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({
            id: 'item-1',
            date: '2026-06-12',
            status: 'pending',
          }),
          makeItem({
            id: 'item-2',
            date: '2026-06-13',
            status: 'completed',
          }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    expect(events.every((e) => e.extendedProps.item === undefined)).toBe(true)
    expect(events.length).toBe(1)
    expect(events[0].title).toBe('设计任务')
  })

  it('showItems=false 时 Task 事件包含 firstItemBlockId 和 taskProgress', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({
            id: 'item-1',
            date: '2026-06-12',
            status: 'pending',
            blockId: 'b1',
          }),
          makeItem({
            id: 'item-2',
            date: '2026-06-13',
            status: 'completed',
            blockId: 'b2',
          }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    expect(events[0].extendedProps.firstItemBlockId).toBe('b1')
    expect(events[0].extendedProps.taskProgress).toEqual({
      completed: 1,
      total: 2,
    })
  })

  it('showItems=false 时 Task 无自身日期则从子 Items 推算', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({
            id: 'item-1',
            date: '2026-06-12',
          }),
          makeItem({
            id: 'item-2',
            date: '2026-06-15',
          }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    expect(events[0].start).toBe('2026-06-12')
    // FullCalendar allDay 事件的 end 是 exclusive 的，需要 +1 天
    // 最后一天 06-15 → end 应为 06-16
    expect(events[0].end).toBe('2026-06-16')
    expect(events[0].allDay).toBe(true)
  })

  it('showItems=true（默认）保持当前行为，只生成 Item 事件', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [makeItem({
          id: 'item-1',
          date: '2026-06-12',
        })],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects)

    expect(events.every((e) => e.extendedProps.item !== undefined)).toBe(true)
  })
})
