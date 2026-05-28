import type { Item } from '@/types/models'
import type { QuadrantPanelConfig } from '@/types/quadrant'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { DEFAULT_QUADRANT_CONFIG } from '@/utils/quadrant'
import {
  assignItemsToQuadrants,
  getQuadrantDateBucket,
  matchesQuadrantPanel,
} from '@/utils/quadrantEvaluator'

function mkItem(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? 'item-1',
    content: partial.content ?? 'task',
    date: partial.date ?? '',
    lineNumber: 1,
    blockId: partial.blockId ?? 'block-1',
    docId: partial.docId ?? 'doc-1',
    status: partial.status ?? 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    ...partial,
  } as Item
}

describe('quadrantEvaluator', () => {
  it('uses q1-q4 default panel ids', () => {
    const result = assignItemsToQuadrants([], DEFAULT_QUADRANT_CONFIG.panels)

    expect(result).toEqual({
      q1: [],
      q2: [],
      q3: [],
      q4: [],
      unassigned: [],
    })
  })

  it('matches a panel by priority and date together', () => {
    const panel: QuadrantPanelConfig = {
      id: 'q1',
      title: 'Important & urgent',
      rules: {
        priority: ['high'],
        date: ['today'],
      },
    }

    expect(matchesQuadrantPanel(mkItem({
      priority: 'high',
      date: '2026-05-11',
    }), panel, '2026-05-11')).toBe(true)
    expect(matchesQuadrantPanel(mkItem({
      priority: 'high',
      date: '2026-05-12',
    }), panel, '2026-05-11')).toBe(false)
  })

  it('classifies overdue/today/tomorrow buckets', () => {
    expect(getQuadrantDateBucket(mkItem({
      date: '2026-05-10',
      status: 'pending',
    }), '2026-05-11')).toBe('overdue')
    expect(getQuadrantDateBucket(mkItem({ date: '2026-05-11' }), '2026-05-11')).toBe('today')
    expect(getQuadrantDateBucket(mkItem({ date: '2026-05-12' }), '2026-05-11')).toBe('tomorrow')
  })

  it('does not classify completed items as overdue', () => {
    expect(getQuadrantDateBucket(mkItem({
      date: '2026-05-10',
      status: 'completed',
    }), '2026-05-11')).toBe(null)
  })

  it('matches thisWeek/thisMonth/recent7 date rules', () => {
    const weekPanel: QuadrantPanelConfig = {
      id: 'q1',
      title: '本周',
      rules: { date: ['thisWeek'] },
    }
    const monthPanel: QuadrantPanelConfig = {
      id: 'q2',
      title: '本月',
      rules: { date: ['thisMonth'] },
    }
    const recentPanel: QuadrantPanelConfig = {
      id: 'q3',
      title: '近7天',
      rules: { date: ['recent7'] },
    }

    expect(matchesQuadrantPanel(mkItem({ date: '2026-05-17' }), weekPanel, '2026-05-11')).toBe(true)
    expect(matchesQuadrantPanel(mkItem({ date: '2026-05-18' }), weekPanel, '2026-05-11')).toBe(false)

    expect(matchesQuadrantPanel(mkItem({ date: '2026-05-31' }), monthPanel, '2026-05-11')).toBe(true)
    expect(matchesQuadrantPanel(mkItem({ date: '2026-06-01' }), monthPanel, '2026-05-11')).toBe(false)

    expect(matchesQuadrantPanel(mkItem({ date: '2026-05-17' }), recentPanel, '2026-05-11')).toBe(true)
    expect(matchesQuadrantPanel(mkItem({ date: '2026-05-18' }), recentPanel, '2026-05-11')).toBe(false)
  })

  it('assigns each item to the first matching panel only', () => {
    const panels: QuadrantPanelConfig[] = [
      {
        id: 'q1',
        title: 'Q1',
        rules: { priority: ['high'] },
      },
      {
        id: 'q2',
        title: 'Q2',
        rules: { priority: ['high', 'medium'] },
      },
      {
        id: 'q3',
        title: 'Q3',
        rules: { priority: ['low'] },
      },
      {
        id: 'q4',
        title: 'Q4',
        rules: { priority: ['none'] },
      },
    ]

    const result = assignItemsToQuadrants([
      mkItem({
        id: 'a',
        blockId: 'a',
        priority: 'high',
      }),
      mkItem({
        id: 'b',
        blockId: 'b',
        priority: 'medium',
      }),
      mkItem({
        id: 'c',
        blockId: 'c',
      }),
    ], panels, '2026-05-11')

    expect(result.q1.map((item) => item.id)).toEqual(['a'])
    expect(result.q2.map((item) => item.id)).toEqual(['b'])
    expect(result.q4.map((item) => item.id)).toEqual(['c'])
  })

  it('puts unmatched items into unassigned', () => {
    const panels: QuadrantPanelConfig[] = [
      {
        id: 'q1',
        title: 'Q1',
        rules: { priority: ['high'] },
      },
      {
        id: 'q2',
        title: 'Q2',
        rules: { priority: ['medium'] },
      },
      {
        id: 'q3',
        title: 'Q3',
        rules: { priority: ['low'] },
      },
      {
        id: 'q4',
        title: 'Q4',
        rules: { priority: [] },
      },
    ]

    const result = assignItemsToQuadrants([
      mkItem({
        id: 'x',
        blockId: 'x',
        priority: 'high',
        date: '2026-05-12',
      }),
    ], panels, '2026-05-11')

    expect(result.q1.map((item) => item.id)).toEqual(['x'])
    expect(result.unassigned).toEqual([])
  })

  it('defaults missing priority to none', () => {
    const panel: QuadrantPanelConfig = {
      id: 'q4',
      title: 'No priority',
      rules: { priority: ['none'] },
    }

    expect(matchesQuadrantPanel(mkItem({}), panel, '2026-05-11')).toBe(true)
  })
})
