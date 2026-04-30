import { describe, expect, it } from 'vitest';
import { calculateHabitStats } from '@/domain/habit/habitStats';
import type { CheckInRecord, Habit } from '@/types/models';

function mkRecord(date: string, overrides: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    content: '周报',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides,
  };
}

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '周报',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'weekly' },
    ...overrides,
  };
}

describe('calculateHabitStats', () => {
  it('weekly 完成率应按周数而不是自然天数计算', () => {
    const habit = mkHabit({
      records: [mkRecord('2026-04-03'), mkRecord('2026-04-08'), mkRecord('2026-04-15')],
    });
    const stats = calculateHabitStats(habit, '2026-04-20');

    expect(stats.completionRate).toBeCloseTo(3 / 4, 5);
  });

  it('durationDays 到期应返回 isEnded=true', () => {
    const habit = mkHabit({ durationDays: 7 });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.isEnded).toBe(true);
  });

  it('weekly 连续按周期完成时 streak 应按周累积', () => {
    const habit = mkHabit({
      records: [mkRecord('2026-04-03'), mkRecord('2026-04-08'), mkRecord('2026-04-15')],
    });
    const stats = calculateHabitStats(habit, '2026-04-20');

    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('weekly_days 非要求日记录不应提升完成率', () => {
    const habit = mkHabit({
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
      records: [mkRecord('2026-04-09')],
    });
    const stats = calculateHabitStats(habit, '2026-04-12');

    expect(stats.totalCheckins).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('当前周期未完成时 currentStreak 应归零', () => {
    const habit = mkHabit({
      records: [mkRecord('2026-04-03')],
    });
    const stats = calculateHabitStats(habit, '2026-04-20');

    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
  });

  it('every_n_days 的月窗口若不含可打卡日，不应增加月完成率分母', () => {
    const habit = mkHabit({
      frequency: { type: 'every_n_days', interval: 3 },
      startDate: '2026-03-31',
      records: [],
    });
    const stats = calculateHabitStats(habit, '2026-04-02');

    expect(stats.monthlyCompletionRate).toBe(0);
    expect(stats.weeklyCompletionRate).toBe(0);
  });
});
