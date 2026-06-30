import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  getHabitRecordStatus,
  getNextEligibleHabitDate,
  hasMissedRecord,
} from '@/domain/habit/habitStatus'

describe('habitStatus', () => {
  it('treats legacy records as completed by default', () => {
    expect(getHabitRecordStatus({ date: '2026-05-01' } as any)).toBe('completed')
  })

  it('detects missed records for a date', () => {
    const habit = {
      startDate: '2026-05-01',
      frequency: { type: 'daily' },
      records: [{
        date: '2026-05-03',
        status: 'missed',
      }],
    } as any

    expect(hasMissedRecord(habit, '2026-05-03')).toBe(true)
  })

  it('finds the next eligible date from the provided date forward', () => {
    const habit = {
      startDate: '2026-05-01',
      frequency: {
        type: 'weekly_days',
        daysOfWeek: [1, 3, 5],
      },
      records: [],
    } as any

    expect(getNextEligibleHabitDate(habit, '2026-05-12')).toBe('2026-05-13')
  })
})
