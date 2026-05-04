import { describe, expect, it } from 'vitest';
import {
  getHabitDayState,
  getHabitPeriodState,
} from '@/domain/habit/habitCompletion';
import type { CheckInRecord, Habit } from '@/types/models';

function mkRecord(date: string, overrides: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    content: '喝水',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides,
  };
}

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '喝水',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'count',
    startDate: '2026-04-01',
    target: 8,
    unit: '杯',
    records: [],
    frequency: { type: 'n_per_week', daysPerWeek: 3 },
    ...overrides,
  };
}

describe('getHabitDayState', () => {
  it('计数型单日取最大 currentValue', () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-09', { currentValue: 3, targetValue: 8 }),
        mkRecord('2026-04-09', { currentValue: 7, targetValue: 8 }),
      ],
    });
    const state = getHabitDayState(habit, '2026-04-09');

    expect(state.hasRecord).toBe(true);
    expect(state.currentValue).toBe(7);
    expect(state.isCompleted).toBe(false);
  });
});

describe('getHabitPeriodState', () => {
  it('n_per_week 应统计当周 completedCount / requiredCount', () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-07', { currentValue: 8, targetValue: 8 }),
        mkRecord('2026-04-08', { currentValue: 8, targetValue: 8 }),
      ],
    });
    const state = getHabitPeriodState(habit, '2026-04-09');

    expect(state.requiredCount).toBe(3);
    expect(state.completedCount).toBe(2);
    expect(state.remainingCount).toBe(1);
    expect(state.isCompleted).toBe(false);
    expect(state.eligibleToday).toBe(true);
  });

  it('weekly_days 不应把非要求日记录计入 completedCount', () => {
    const habit = mkHabit({
      type: 'binary',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
      records: [
        mkRecord('2026-04-09'),
      ],
    });
    const state = getHabitPeriodState(habit, '2026-04-09');

    expect(state.completedCount).toBe(0);
    expect(state.remainingCount).toBe(3);
    expect(state.eligibleToday).toBe(false);
  });
});
