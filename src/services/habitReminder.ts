/**
 * 习惯提醒服务
 * 检查需要提醒的习惯，根据频率规则判断今天是否应为打卡日
 * 集成到 ReminderService 的 checkReminders 中
 */

import dayjs from '@/utils/dayjs';
import type { Habit, HabitFrequency } from '@/types/models';
import { calculateHabitStats } from '@/utils/habitStatsUtils';

export interface HabitReminderEntry {
  habit: Habit;
  reminderTime: number;
  key: string;
}

/**
 * 判断指定日期是否是习惯的打卡日
 */
export function isCheckInDay(habit: Habit, date: string): boolean {
  const frequency = habit.frequency;
  if (!frequency) return true; // 无频率规则默认每天

  const startDate = habit.startDate;
  if (date < startDate) return false; // 还没开始

  // 如果习惯已结束
  if (habit.durationDays) {
    const endDate = dayjs(startDate).add(habit.durationDays - 1, 'day').format('YYYY-MM-DD');
    if (date > endDate) return false;
  }

  return isFrequencyDay(frequency, startDate, date);
}

/**
 * 根据频率规则判断指定日期是否是打卡日
 */
function isFrequencyDay(frequency: HabitFrequency, startDate: string, date: string): boolean {
  const d = dayjs(date);
  const start = dayjs(startDate);
  const daysSinceStart = d.diff(start, 'day');

  switch (frequency.type) {
    case 'daily':
      return true;

    case 'every_n_days': {
      const interval = frequency.interval || 2;
      return daysSinceStart % interval === 0;
    }

    case 'weekly':
      // 每周一次，默认在开始日打卡，之后每隔7天
      return daysSinceStart % 7 === 0;

    case 'n_per_week':
      // 每周N天：简化为均匀分布
      return true; // 无法精确判断，默认都算打卡日

    case 'weekly_days': {
      const daysOfWeek = frequency.daysOfWeek || [];
      if (daysOfWeek.length === 0) return false;
      // dayjs day(): 0=Sun, 1=Mon, ..., 6=Sat
      return daysOfWeek.includes(d.day());
    }

    default:
      return true;
  }
}

/**
 * 解析习惯提醒时间
 * 返回当天的提醒时间（如果配置了 ⏰ 的话）
 */
export function getHabitReminderTime(habit: Habit, date: string): Date | null {
  if (!habit.reminder) return null;

  const reminder = habit.reminder;
  let timeStr: string | null = null;

  if (reminder.type === 'absolute' && reminder.time) {
    timeStr = reminder.time;
  } else if (reminder.type === 'relative' && reminder.offsetMinutes) {
    // 相对时间默认按 09:00 + offset 处理
    const baseHour = 9;
    const totalMinutes = baseHour * 60 + reminder.offsetMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (!timeStr) return null;

  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const d = dayjs(date);
  return d.hour(hours).minute(minutes).second(0).millisecond(0).toDate();
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
    if (!isCheckInDay(habit, currentDate)) continue;

    const stats = calculateHabitStats(habit, currentDate);
    if (stats.isPeriodCompleted) continue;

    const reminderTime = getHabitReminderTime(habit, currentDate);
    if (!reminderTime) continue;

    const reminderTimestamp = reminderTime.getTime();
    entries.push({
      habit,
      reminderTime: reminderTimestamp,
      key: `habit-${habit.blockId}-${currentDate}-${reminderTimestamp}`,
    });
  }

  return entries;
}
