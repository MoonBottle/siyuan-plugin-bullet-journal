import { describe, expect, it } from 'vitest';
import {
  getHabitPeriod,
  isDateEligibleForHabit,
} from '@/domain/habit/habitPeriod';
import type { Habit } from '@/types/models';

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides,
  };
}

describe('getHabitPeriod', () => {
  it('weekly 应返回自然周边界和 requiredCount=1', () => {
    const habit = mkHabit({ frequency: { type: 'weekly' } });
    const period = getHabitPeriod(habit, '2026-04-09');

    expect(period.periodType).toBe('week');
    expect(period.periodStart).toBe('2026-04-06');
    expect(period.periodEnd).toBe('2026-04-12');
    expect(period.requiredCount).toBe(1);
  });

  it('every_n_days 应返回 interval 周期边界', () => {
    const habit = mkHabit({ frequency: { type: 'every_n_days', interval: 3 } });
    const period = getHabitPeriod(habit, '2026-04-08');

    expect(period.periodType).toBe('interval');
    expect(period.periodStart).toBe('2026-04-07');
    expect(period.periodEnd).toBe('2026-04-09');
    expect(period.requiredCount).toBe(1);
  });

  it('every_n_days interval 非法时应回退到默认 2 天', () => {
    const habit = mkHabit({ frequency: { type: 'every_n_days', interval: 0 } });
    const period = getHabitPeriod(habit, '2026-04-08');

    expect(period.periodStart).toBe('2026-04-07');
    expect(period.periodEnd).toBe('2026-04-08');
  });
});

describe('isDateEligibleForHabit', () => {
  it('weekly 在当周每天都有资格', () => {
    const habit = mkHabit({ frequency: { type: 'weekly' } });
    expect(isDateEligibleForHabit(habit, '2026-04-08')).toBe(true);
    expect(isDateEligibleForHabit(habit, '2026-04-12')).toBe(true);
  });

  it('weekly_days 仅要求日具备资格', () => {
    const habit = mkHabit({ frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] } });
    expect(isDateEligibleForHabit(habit, '2026-04-08')).toBe(true);
    expect(isDateEligibleForHabit(habit, '2026-04-09')).toBe(false);
  });
});
