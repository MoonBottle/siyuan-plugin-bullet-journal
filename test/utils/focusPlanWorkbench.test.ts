import type { Item } from '@/types/models'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { buildFocusPlanCandidateSections } from '@/utils/focusPlanWorkbench'

function createItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    status: partial.status || 'pending',
    date: partial.date || '2026-05-14',
    blockId: partial.blockId === undefined ? 'block' : partial.blockId,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    focusPlan: partial.focusPlan,
    siblingItems: partial.siblingItems,
    lineNumber: partial.lineNumber || 1,
    docId: partial.docId || 'doc-1',
    pomodoros: partial.pomodoros || [],
  } as Item
}

describe('buildFocusPlanCandidateSections', () => {
  it('返回过期、所选日期和其他未完成事项，并过滤完成、放弃、无 blockId 事项', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({
          id: 'expired-1',
          date: '2026-05-13',
          content: '过期 A',
        }),
        createItem({
          id: 'selected-1',
          date: '2026-05-14',
          content: '当天 A',
        }),
        createItem({
          id: 'done-1',
          date: '2026-05-14',
          status: 'completed',
          content: '完成事项',
        }),
        createItem({
          id: 'abandoned-1',
          date: '2026-05-12',
          status: 'abandoned',
          content: '放弃事项',
        }),
        createItem({
          id: 'invalid-1',
          date: '2026-05-13',
          blockId: '',
          content: '无块事项',
        }),
        createItem({
          id: 'other-1',
          date: '2026-05-16',
          content: '其他日期',
        }),
      ],
      selectedDate: '2026-05-14',
    })

    expect(sections).toEqual([
      expect.objectContaining({
        key: 'expired',
        items: [expect.objectContaining({ id: 'expired-1' })],
      }),
      expect.objectContaining({
        key: 'selected-date',
        items: [expect.objectContaining({ id: 'selected-1' })],
      }),
      expect.objectContaining({
        key: 'other-open',
        items: [expect.objectContaining({ id: 'other-1' })],
      }),
    ])
  })

  it('过期事项按日期升序，同日内按开始时间排序，无时间排后', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({
          id: 'a',
          date: '2026-05-12',
          startDateTime: '2026-05-12 12:00',
          content: 'A',
        }),
        createItem({
          id: 'b',
          date: '2026-05-12',
          startDateTime: '2026-05-12 09:00',
          content: 'B',
        }),
        createItem({
          id: 'c',
          date: '2026-05-11',
          content: 'C',
        }),
        createItem({
          id: 'd',
          date: '2026-05-12',
          content: 'D',
        }),
      ],
      selectedDate: '2026-05-14',
    })

    expect(sections[0].items.map((item) => item.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('历史日期不提供新增预计候选', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({
          id: 'selected-1',
          date: '2026-05-13',
          content: '历史事项',
        }),
      ],
      selectedDate: '2026-05-13',
      today: '2026-05-14',
    })

    expect(sections).toEqual([])
  })

  it('选择未来日期时，过期事项只计算到今天之前，不把今天事项算作过期', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({
          id: 'expired-1',
          date: '2026-05-13',
          content: '真正过期',
        }),
        createItem({
          id: 'today-1',
          date: '2026-05-14',
          content: '今天事项',
        }),
        createItem({
          id: 'future-1',
          date: '2026-05-15',
          content: '未来事项',
        }),
      ],
      selectedDate: '2026-05-15',
      today: '2026-05-14',
    })

    expect(sections).toEqual([
      expect.objectContaining({
        key: 'expired',
        items: [expect.objectContaining({ id: 'expired-1' })],
      }),
      expect.objectContaining({
        key: 'selected-date',
        items: [expect.objectContaining({ id: 'future-1' })],
      }),
      expect.objectContaining({
        key: 'other-open',
        items: [expect.objectContaining({ id: 'today-1' })],
      }),
    ])
  })

  it('多日期事项只把所选日期 occurrence 放入所选日期分组', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({
          id: 'multi-14',
          date: '2026-05-14',
          content: '多日期事项',
          siblingItems: [{ date: '2026-05-15' }, { date: '2026-05-17' }],
        }),
        createItem({
          id: 'multi-15',
          date: '2026-05-15',
          content: '多日期事项',
          siblingItems: [{ date: '2026-05-14' }, { date: '2026-05-17' }],
        }),
        createItem({
          id: 'multi-17',
          date: '2026-05-17',
          content: '多日期事项',
          siblingItems: [{ date: '2026-05-14' }, { date: '2026-05-15' }],
        }),
        createItem({
          id: 'other-1',
          date: '2026-05-16',
          content: '其他日期',
        }),
      ],
      selectedDate: '2026-05-17',
      today: '2026-05-14',
    })

    expect(sections).toEqual([
      expect.objectContaining({
        key: 'selected-date',
        items: [expect.objectContaining({ id: 'multi-17' })],
      }),
      expect.objectContaining({
        key: 'other-open',
        items: [expect.objectContaining({ id: 'other-1' })],
      }),
    ])
    expect(sections.flatMap((section) => section.items).map((item) => item.id)).not.toContain('multi-14')
    expect(sections.flatMap((section) => section.items).map((item) => item.id)).not.toContain('multi-15')
  })
})
