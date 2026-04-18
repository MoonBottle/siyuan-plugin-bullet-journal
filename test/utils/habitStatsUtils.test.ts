import { describe, it, expect } from 'vitest';
import { calculateHabitStats, isRecordCompleted } from '@/utils/habitStatsUtils';
import type { Habit, CheckInRecord } from '@/types/models';

function mkHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides
  };
}

function mkRecord(date: string, overrides?: Partial<CheckInRecord>): CheckInRecord {
  return {
    content: '早起',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides
  };
}

describe('calculateHabitStats', () => {
  it('#30: 每天打卡连续5天 → currentStreak=5', () => {
    const habit = mkHabit({
      name: '早起',
      records: [
        mkRecord('2026-04-03'), mkRecord('2026-04-04'),
        mkRecord('2026-04-05'), mkRecord('2026-04-06'), mkRecord('2026-04-07')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(5);
    expect(stats.longestStreak).toBe(5);
  });

  it('#31: 昨天未打卡 → currentStreak=1', () => {
    const habit = mkHabit({
      name: '早起',
      records: [mkRecord('2026-04-05'), mkRecord('2026-04-07')]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(1);
  });

  it('#32: 今天未打卡，昨天前天都打 → currentStreak=2（从昨天算起）', () => {
    const habit = mkHabit({
      name: '早起',
      records: [mkRecord('2026-04-05'), mkRecord('2026-04-06')]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(2);
  });

  it('#33: 打卡3天→断1天→连续7天 → currentStreak=7, longestStreak=7', () => {
    const habit = mkHabit({
      name: '早起',
      records: [
        mkRecord('2026-04-01'), mkRecord('2026-04-02'), mkRecord('2026-04-03'),
        // 4月4日断
        mkRecord('2026-04-05'), mkRecord('2026-04-06'), mkRecord('2026-04-07'),
        mkRecord('2026-04-08'), mkRecord('2026-04-09'), mkRecord('2026-04-10'), mkRecord('2026-04-11')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-11');
    expect(stats.currentStreak).toBe(7);
    expect(stats.longestStreak).toBe(7);
  });

  it('#36: 全部无打卡记录 → currentStreak=0, longestStreak=0', () => {
    const habit = mkHabit({ name: '早起', records: [] });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it('#37: 🔄每天，开始4/1，今天4/7，打卡5天 → 完成率=5/7≈71.4%', () => {
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      records: [
        mkRecord('2026-04-01'), mkRecord('2026-04-02'), mkRecord('2026-04-03'),
        mkRecord('2026-04-05'), mkRecord('2026-04-07')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.completionRate).toBeCloseTo(5 / 7, 1);
  });

  it('计数型：达标天计入完成', () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [
        mkRecord('2026-04-06', { currentValue: 5, targetValue: 8, unit: '杯' }),
        mkRecord('2026-04-07', { currentValue: 8, targetValue: 8, unit: '杯' })
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.totalCheckins).toBe(1); // 只有4/7达标
  });

  it('计数型：累计值和日均值', () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      startDate: '2026-04-01',
      records: [
        mkRecord('2026-04-05', { currentValue: 6, targetValue: 8, unit: '杯' }),
        mkRecord('2026-04-06', { currentValue: 8, targetValue: 8, unit: '杯' }),
        mkRecord('2026-04-07', { currentValue: 5, targetValue: 8, unit: '杯' })
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.totalValue).toBe(19); // 6+8+5
    expect(stats.averageValue).toBeCloseTo(19 / 7, 1); // 7天日均值
  });

  it('习惯结束：durationDays 到期', () => {
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      durationDays: 7,
      records: []
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.isCompleted).toBe(true);
  });

  it('习惯未结束：durationDays 未到期', () => {
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      durationDays: 30,
      records: []
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.isCompleted).toBe(false);
  });

  it('本周完成率', () => {
    // 4/6 是周一，4/7 是周二
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      records: [
        mkRecord('2026-04-06'), mkRecord('2026-04-07')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.weeklyCompletionRate).toBeGreaterThanOrEqual(0);
    expect(stats.weeklyCompletionRate).toBeLessThanOrEqual(1);
  });

  it('本月完成率', () => {
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      records: [
        mkRecord('2026-04-01'), mkRecord('2026-04-02'), mkRecord('2026-04-03')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.monthlyCompletionRate).toBeGreaterThanOrEqual(0);
    expect(stats.monthlyCompletionRate).toBeLessThanOrEqual(1);
  });
});

describe('isRecordCompleted', () => {
  it('二元型：有记录即完成', () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    const record = mkRecord('2026-04-07');
    expect(isRecordCompleted(record, habit)).toBe(true);
  });

  it('计数型：达到目标值即完成', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8 });
    const record = mkRecord('2026-04-07', { currentValue: 8, targetValue: 8 });
    expect(isRecordCompleted(record, habit)).toBe(true);
  });

  it('计数型：未达到目标值未完成', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8 });
    const record = mkRecord('2026-04-07', { currentValue: 5, targetValue: 8 });
    expect(isRecordCompleted(record, habit)).toBe(false);
  });
});
