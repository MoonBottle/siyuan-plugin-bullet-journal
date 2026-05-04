import dayjs from '@/utils/dayjs';
import { getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { isDateEligibleForHabit } from '@/domain/habit/habitPeriod';
import type { Habit } from '@/types/models';

export interface HabitReminderEntry {
  habit: Habit;
  reminderTime: number;
  key: string;
}

export function isCheckInDay(habit: Habit, date: string): boolean {
  return isDateEligibleForHabit(habit, date);
}

/**
 * 解析习惯提醒时间
 * 返回当天的提醒时间（如果配置了 ⏰ 的话）
 */
export function getHabitReminderTime(habit: Habit, date: string): Date | null {
  if (!habit.reminder) return null;

  const reminder = habit.reminder;
  const day = dayjs(date);
  let timeStr: string | null = null;

  if (reminder.type === 'absolute' && reminder.time) {
    timeStr = reminder.time;
  }
  else if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    return day
      .hour(9)
      .minute(0)
      .second(0)
      .millisecond(0)
      .subtract(reminder.offsetMinutes, 'minute')
      .toDate();
  }

  if (!timeStr) return null;

  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  return day.hour(hours).minute(minutes).second(0).millisecond(0).toDate();
}

/**
 * 获取当前日期的习惯提醒条目
 */
export function getHabitReminderEntries(
  habits: Habit[],
  currentDate: string
): HabitReminderEntry[] {
  const entries: HabitReminderEntry[] = [];

  for (const habit of habits) {
    if (habit.archivedAt)
      continue;

    if (!isDateEligibleForHabit(habit, currentDate))
      continue;

    const periodState = getHabitPeriodState(habit, currentDate);
    if (periodState.isCompleted)
      continue;

    const reminderTime = getHabitReminderTime(habit, currentDate);
    if (!reminderTime)
      continue;

    const reminderTimestamp = reminderTime.getTime();
    entries.push({
      habit,
      reminderTime: reminderTimestamp,
      key: `habit-${habit.blockId}-${currentDate}-${reminderTimestamp}`,
    });
  }

  return entries;
}
