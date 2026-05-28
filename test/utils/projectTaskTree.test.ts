import type {
  Item,
  Project,
  Task,
} from '@/types/models'
import type { MergedItem } from '@/utils/projectTaskTree'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  buildProjectTaskTree,
  filterProjectTaskTree,
  formatDateRange,
  getTaskItemProgress,
  mergeItemsByBlockId,
} from '@/utils/projectTaskTree'

function item(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    links: partial.links,
    focusPlan: partial.focusPlan,
    pomodoros: partial.pomodoros,
  } as Item
}

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    links: partial.links,
  }
}

function project(tasks: Task[]): Project {
  return {
    id: 'project-1',
    name: '项目 Alpha',
    path: '工作安排/2026/项目 Alpha',
    tasks,
    habits: [],
  }
}

describe('projectTaskTree', () => {
  it('按前序 L1/L2/L3 规则构建任务层级', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1-a',
        name: '一级 A',
        level: 'L1',
      }),
      task({
        id: 'l2-a',
        name: '二级 A',
        level: 'L2',
      }),
      task({
        id: 'l3-a',
        name: '三级 A',
        level: 'L3',
      }),
      task({
        id: 'l1-b',
        name: '一级 B',
        level: 'L1',
      }),
      task({
        id: 'l3-b',
        name: '孤立三级',
        level: 'L3',
      }),
      task({
        id: 'l2-b',
        name: '二级 B',
        level: 'L2',
      }),
    ]))

    expect(tree.map((node) => node.task.id)).toEqual(['l1-a', 'l1-b'])
    expect(tree[0].children.map((node) => node.task.id)).toEqual(['l2-a'])
    expect(tree[0].children[0].children.map((node) => node.task.id)).toEqual(['l3-a'])
    expect(tree[1].children.map((node) => node.task.id)).toEqual(['l3-b', 'l2-b'])
    expect(tree[1].children[0]).toMatchObject({
      depth: 1,
      orphaned: true,
    })
  })

  it('搜索命中任务时保留必要父级并保留命中任务分支', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1',
        name: '研发项目',
        level: 'L1',
      }),
      task({
        id: 'l2',
        name: '界面改造',
        level: 'L2',
      }),
      task({
        id: 'l3',
        name: '右栏详情',
        level: 'L3',
        items: [item({
          id: 'item-1',
          content: '事项内容',
        })],
      }),
    ]))

    const result = filterProjectTaskTree(tree, '右栏')

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].task.id).toBe('l1')
    expect(result.nodes[0].children[0].task.id).toBe('l2')
    expect(result.nodes[0].children[0].children[0].task.id).toBe('l3')
    expect(result.matchedTaskIds).toEqual(new Set(['l3']))
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1', 'l2', 'l3']))
  })

  it('搜索命中事项时只显示事项和所属任务父级链路', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1',
        name: '一级',
        level: 'L1',
        items: [
          item({
            id: 'keep',
            content: '准备评审材料',
            priority: 'high',
          }),
          item({
            id: 'hide',
            content: '其他事项',
          }),
        ],
      }),
    ]))

    const result = filterProjectTaskTree(tree, '评审')

    expect(result.nodes[0].items.map((row) => row.id)).toEqual(['keep'])
    expect(result.matchedItemIds).toEqual(new Set(['keep']))
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1']))
  })

  it('统计任务事项进度', () => {
    const progress = getTaskItemProgress(task({
      items: [
        item({
          id: 'a',
          status: 'pending',
        }),
        item({
          id: 'b',
          status: 'completed',
        }),
        item({
          id: 'c',
          status: 'abandoned',
        }),
      ],
    }))

    expect(progress).toEqual({
      total: 3,
      completed: 1,
      pending: 1,
      abandoned: 1,
    })
  })

  it('统计含合并事项的进度（合并项计为1个）', () => {
    const mergedItems: (Item | MergedItem)[] = [
      {
        isMerged: true,
        blockId: 'blk-1',
        items: [
          item({
            id: 'a1',
            blockId: 'blk-1',
            status: 'completed',
            date: '2026-05-01',
          }),
          item({
            id: 'a2',
            blockId: 'blk-1',
            status: 'completed',
            date: '2026-05-02',
          }),
        ],
        content: '写文档',
        status: 'completed',
        dateRange: '2026-05-01 ~ 02',
        firstItemId: 'a1',
      },
      item({
        id: 'b',
        status: 'pending',
        date: '2026-05-03',
      }),
    ]

    const progress = getTaskItemProgress(mergedItems)

    expect(progress).toEqual({
      total: 2,
      completed: 1,
      pending: 1,
      abandoned: 0,
    })
  })

  it('mergeItemsByBlockId 按blockId分组合并多日期Item', () => {
    const items = [
      item({
        id: 'i1',
        blockId: 'blk-a',
        content: '写文档',
        date: '2026-05-20',
        status: 'pending',
      }),
      item({
        id: 'i2',
        blockId: 'blk-a',
        content: '写文档',
        date: '2026-05-22',
        status: 'pending',
      }),
      item({
        id: 'i3',
        blockId: 'blk-a',
        content: '写文档',
        date: '2026-05-25',
        status: 'pending',
      }),
      item({
        id: 'i4',
        blockId: 'blk-b',
        content: '测试',
        date: '2026-05-21',
        status: 'completed',
      }),
      item({
        id: 'i5',
        content: '无blockId',
        date: '2026-05-21',
        status: 'pending',
      }),
    ]

    const result = mergeItemsByBlockId(items)

    expect(result).toHaveLength(3)
    const merged = result[0] as MergedItem
    expect(merged.isMerged).toBe(true)
    expect(merged.blockId).toBe('blk-a')
    expect(merged.dateRange).toBe('2026-05-20 ~ 25')
    expect(merged.firstItemId).toBe('i1')
    expect(merged.status).toBe('pending')
    expect(merged.items).toHaveLength(3)
    expect(result[1]).toMatchObject({
      id: 'i4',
      content: '测试',
    })
    expect(result[2]).toMatchObject({
      id: 'i5',
      content: '无blockId',
    })
  })

  it('mergeItemsByBlockId 单个blockId不合并', () => {
    const items = [
      item({
        id: 'i1',
        blockId: 'blk-a',
        content: '写文档',
        date: '2026-05-20',
      }),
    ]

    const result = mergeItemsByBlockId(items)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'i1' })
  })

  it('搜索命中合并事项时保留该项', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1',
        level: 'L1',
        items: [
          item({
            id: 'i1',
            blockId: 'blk-a',
            content: '写周报',
            date: '2026-05-19',
          }),
          item({
            id: 'i2',
            blockId: 'blk-a',
            content: '写周报',
            date: '2026-05-26',
          }),
          item({
            id: 'i3',
            content: '开会',
            date: '2026-05-20',
          }),
        ],
      }),
    ]))

    const result = filterProjectTaskTree(tree, '周报')

    expect(result.nodes[0].items).toHaveLength(1)
    const merged = result.nodes[0].items[0] as MergedItem
    expect(merged.isMerged).toBe(true)
    expect(merged.dateRange).toBe('2026-05-19 ~ 26')
    expect(result.matchedItemIds).toContain('i1')
  })
})


describe('formatDateRange', () => {
  it('同年同月只显示日', () => {
    expect(formatDateRange('2026-05-20', '2026-05-23')).toBe('2026-05-20 ~ 23')
  })

  it('同年不同月显示月-日', () => {
    expect(formatDateRange('2026-05-20', '2026-06-03')).toBe('2026-05-20 ~ 06-03')
  })

  it('不同年显示完整日期', () => {
    expect(formatDateRange('2025-12-28', '2026-01-03')).toBe('2025-12-28 ~ 2026-01-03')
  })

  it('起止日期相同只返回单个日期', () => {
    expect(formatDateRange('2026-05-20', '2026-05-20')).toBe('2026-05-20')
  })
})
