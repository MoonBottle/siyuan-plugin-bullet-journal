import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  buildDailyFocusPlanSummary,
  buildFocusPlanReview,
  formatFocusActualDisplay,
  formatFocusPlanDisplay,
  formatFocusPlanProgress,
} from '@/utils/focusPlanReview'

describe('focusPlanReview', () => {
  it('已完成事项在 25 分钟内偏差应归类为 matched', () => {
    const result = buildFocusPlanReview({
      itemStatus: 'completed',
      estimatedMinutes: 75,
      actualMinutes: 90,
    })

    expect(result.status).toBe('matched')
    expect(result.deltaMinutes).toBe(15)
  })

  it('无预计但有实际专注时应归类为 unplanned', () => {
    const result = buildFocusPlanReview({
      itemStatus: 'completed',
      estimatedMinutes: 0,
      actualMinutes: 30,
    })

    expect(result.status).toBe('unplanned')
    expect(result.deltaMinutes).toBe(30)
  })

  it('统计今日摘要时不重复累计同一 blockId 的预计', () => {
    const summary = buildDailyFocusPlanSummary([
      {
        itemId: 'item-1',
        blockId: 'same',
        date: '2026-05-13',
        estimatedMinutes: 70,
        actualMinutes: 50,
        itemStatus: 'pending',
      },
      {
        itemId: 'item-2',
        blockId: 'same',
        date: '2026-05-13',
        estimatedMinutes: 70,
        actualMinutes: 50,
        itemStatus: 'pending',
      },
    ], '2026-05-13')

    expect(summary.estimatedMinutes).toBe(70)
    expect(summary.actualMinutes).toBe(50)
  })

  it('blockId 为空时不按相同内容错误合并不同事项', () => {
    const summary = buildDailyFocusPlanSummary([
      {
        itemId: 'item-1',
        date: '2026-05-13',
        estimatedMinutes: 25,
        actualMinutes: 25,
        itemStatus: 'completed',
        itemContent: '整理资料',
      },
      {
        itemId: 'item-2',
        date: '2026-05-13',
        estimatedMinutes: 50,
        actualMinutes: 30,
        itemStatus: 'pending',
        itemContent: '整理资料',
      },
    ], '2026-05-13')

    expect(summary.total).toBe(2)
    expect(summary.estimatedMinutes).toBe(75)
    expect(summary.actualMinutes).toBe(55)
  })

  it('格式化时长预计展示', () => {
    expect(formatFocusPlanDisplay({
      type: 'duration',
      rawValue: 70,
      normalizedMinutes: 70,
      sourceText: '⏳1h10m',
    })).toBe('1h10m')
  })

  it('格式化实际累计时长展示', () => {
    expect(formatFocusActualDisplay(50)).toBe('50m')
    expect(formatFocusActualDisplay(70)).toBe('1h10m')
  })

  it('格式化专注中进度展示', () => {
    expect(formatFocusPlanProgress({
      type: 'duration',
      rawValue: 70,
      normalizedMinutes: 70,
      sourceText: '⏳1h10m',
    }, 60)).toBe('1h / 1h10m')

    expect(formatFocusPlanProgress({
      type: 'pomodoro',
      rawValue: 3,
      normalizedMinutes: 75,
      sourceText: '🍅x3',
    }, 10)).toBe('10m / 3 🍅')
  })
})
