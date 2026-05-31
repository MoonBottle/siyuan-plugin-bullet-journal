import type { KernelDataHabit } from '@/kernel/types'
import { describe, expect, it } from 'vitest'
import { isDateEligibleForHabit, isTodayCompleted } from '@/kernel/habitSchedule'

function makeHabit(overrides: Partial<KernelDataHabit> = {}): KernelDataHabit {
  return {
    id: 'h1',
    name: '喝水',
    type: 'binary',
    targetDate: '2026-05-01',
    blockId: 'block-h1',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  }
}

describe('isDateEligibleForHabit', () => {
  it('daily: 始终返回 true（在有效期内）', () => {
    const habit = makeHabit({ startDate: '2026-05-01' })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(true)
  })

  it('daily: 早于 startDate 返回 false', () => {
    const habit = makeHabit({ startDate: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(false)
  })

  it('daily: 超过 durationDays 返回 false', () => {
    const habit = makeHabit({ startDate: '2026-05-01', durationDays: 7 })
    expect(isDateEligibleForHabit(habit, '2026-05-08')).toBe(false)
  })

  it('daily: 最后一天仍返回 true', () => {
    const habit = makeHabit({ startDate: '2026-05-01', durationDays: 7 })
    expect(isDateEligibleForHabit(habit, '2026-05-07')).toBe(true)
  })

  it('已归档习惯返回 false', () => {
    const habit = makeHabit({ archivedAt: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(false)
  })

  it('归档日期当天仍返回 true', () => {
    const habit = makeHabit({ archivedAt: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-10')).toBe(true)
  })

  it('无 frequency 时默认视为 daily', () => {
    const habit = makeHabit({ frequency: undefined })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(true)
  })
})

describe('isDateEligibleForHabit - every_n_days', () => {
  it('每2天：startDate 当天返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(true)
  })

  it('每2天：间隔日返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
  })

  it('每2天：非间隔日返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(false)
  })
})

describe('isDateEligibleForHabit - weekly_days', () => {
  it('每周一三五：周一返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(true)
  })

  it('每周一三五：周二返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-05')).toBe(false)
  })
})

describe('isDateEligibleForHabit - ebbinghaus', () => {
  it('无打卡记录时：startDate 当天返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(true)
  })

  it('无打卡记录时：startDate 之后仍返回 true（逾期未打卡）', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(true)
  })

  it('5月1日打卡后：5月2日（间隔1天）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [{ date: '2026-05-01', status: 'completed' }],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(true)
  })

  it('5月1日打卡后：5月3日（间隔1天已过）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [{ date: '2026-05-01', status: 'completed' }],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
  })

  it('5月1日和2日打卡后：5月5日（间隔2天）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'completed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-05')).toBe(true)
  })

  it('5月1日和2日打卡后：5月4日（间隔2天到期日）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'completed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(true)
  })

  it('missed 记录不计入完成日期', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'missed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(true)
  })
})

describe('isTodayCompleted', () => {
  it('二元型：有今天的记录返回 true', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [{ date: '2026-05-15', status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('二元型：无记录返回 false', () => {
    const habit = makeHabit({ type: 'binary', records: [] })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('二元型：missed 记录返回 false', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [{ date: '2026-05-15', status: 'missed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('计数型：currentValue >= target 返回 true', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [{ date: '2026-05-15', currentValue: 8, status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('计数型：currentValue < target 返回 false', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [{ date: '2026-05-15', currentValue: 5, status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('计数型：多条记录累加', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [
        { date: '2026-05-15', currentValue: 3, status: 'completed' },
        { date: '2026-05-15', currentValue: 5, status: 'completed' },
      ],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('不同日期的记录不影响判断', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [
        { date: '2026-05-14', status: 'completed' },
      ],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })
})
