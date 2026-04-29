import { describe, it, expect } from 'vitest';
import { isCheckInDay, getHabitReminderTime, getHabitReminderEntries } from '@/services/habitReminder';
import type { Habit } from '@/types/models';

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

describe('isCheckInDay', () => {
  it('每天频率每天都应打卡', () => {
    const habit = mkHabit({ name: '早起', frequency: { type: 'daily' } });
    expect(isCheckInDay(habit, '2026-04-01')).toBe(true);
    expect(isCheckInDay(habit, '2026-04-07')).toBe(true);
  });

  it('开始日期之前不应打卡', () => {
    const habit = mkHabit({ name: '早起', startDate: '2026-04-05', frequency: { type: 'daily' } });
    expect(isCheckInDay(habit, '2026-04-04')).toBe(false);
    expect(isCheckInDay(habit, '2026-04-05')).toBe(true);
  });

  it('每2天频率应间隔打卡', () => {
    const habit = mkHabit({ name: '跑步', frequency: { type: 'every_n_days', interval: 2 } });
    expect(isCheckInDay(habit, '2026-04-01')).toBe(true);  // 第0天
    expect(isCheckInDay(habit, '2026-04-02')).toBe(false); // 第1天
    expect(isCheckInDay(habit, '2026-04-03')).toBe(true);  // 第2天
  });

  it('指定周几频率', () => {
    const habit = mkHabit({ name: '周报', frequency: { type: 'weekly_days', daysOfWeek: [5] } }); // 周五
    // 2026-04-03 是周五
    expect(isCheckInDay(habit, '2026-04-03')).toBe(true);
    // 2026-04-04 是周六
    expect(isCheckInDay(habit, '2026-04-04')).toBe(false);
  });

  it('已结束的习惯不应打卡', () => {
    const habit = mkHabit({
      name: '30天挑战',
      startDate: '2026-04-01',
      durationDays: 30,
      frequency: { type: 'daily' }
    });
    expect(isCheckInDay(habit, '2026-04-30')).toBe(true);
    expect(isCheckInDay(habit, '2026-05-01')).toBe(false);
  });
});

describe('getHabitReminderTime', () => {
  it('绝对时间提醒', () => {
    const habit = mkHabit({
      name: '早起',
      reminder: { type: 'absolute', time: '07:00' }
    });
    const result = getHabitReminderTime(habit, '2026-04-07');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(7);
    expect(result!.getMinutes()).toBe(0);
  });

  it('无提醒配置返回 null', () => {
    const habit = mkHabit({ name: '早起' });
    expect(getHabitReminderTime(habit, '2026-04-07')).toBeNull();
  });
});

describe('getHabitReminderEntries', () => {
  it('今天应提醒的习惯会生成 entry', () => {
    const habit = mkHabit({
      name: '冥想',
      reminder: { type: 'absolute', time: '07:00' }
    });

    const entries = getHabitReminderEntries([habit], '2026-04-07');

    expect(entries).toHaveLength(1);
    expect(entries[0].habit.name).toBe('冥想');
    expect(entries[0].reminderTime).toBe(new Date('2026-04-07T07:00:00').getTime());
    expect(entries[0].key).toBe(`habit-habit-1-2026-04-07-${entries[0].reminderTime}`);
  });

  it('今天已达标的习惯不生成 entry', () => {
    const habit = mkHabit({
      name: '早起',
      frequency: { type: 'daily' },
      reminder: { type: 'absolute', time: '07:00' },
      records: [{
        content: '早起',
        date: '2026-04-07',
        docId: 'doc-1',
        blockId: 'record-1',
        habitId: 'habit-1'
      }]
    });

    expect(getHabitReminderEntries([habit], '2026-04-07')).toHaveLength(0);
  });

  it('非打卡日不生成 entry', () => {
    const habit = mkHabit({
      name: '跑步',
      frequency: { type: 'weekly_days', daysOfWeek: [5] },
      reminder: { type: 'absolute', time: '07:00' },
      records: []
    });

    expect(getHabitReminderEntries([habit], '2026-04-04')).toHaveLength(0);
  });
});
