import dayjs from '@/utils/dayjs';
import type { Habit, HabitFrequency, HabitPeriodState } from '@/types/models';

type HabitPeriodSnapshot = Omit<
  HabitPeriodState,
  'completedCount' | 'remainingCount' | 'isCompleted' | 'eligibleToday'
>;

function getHabitFrequency(habit: Habit): HabitFrequency {
  return habit.frequency ?? { type: 'daily' };
}

export function getEveryNDaysInterval(interval?: number): number {
  if (!interval || interval < 1)
    return 2;

  return Math.floor(interval);
}

export function getHabitEndDate(habit: Habit): string | null {
  if (!habit.durationDays)
    return null;

  return dayjs(habit.startDate)
    .add(habit.durationDays - 1, 'day')
    .format('YYYY-MM-DD');
}

export function isHabitActiveOnDate(habit: Habit, date: string): boolean {
  if (date < habit.startDate)
    return false;

  const endDate = getHabitEndDate(habit);
  if (!endDate)
    return true;

  return date <= endDate;
}

export function isDateEligibleForHabit(habit: Habit, date: string): boolean {
  if (!isHabitActiveOnDate(habit, date))
    return false;

  const frequency = getHabitFrequency(habit);
  const current = dayjs(date);

  switch (frequency.type) {
    case 'daily':
    case 'weekly':
    case 'n_per_week':
      return true;
    case 'every_n_days': {
      const interval = getEveryNDaysInterval(frequency.interval);
      return current.diff(dayjs(habit.startDate), 'day') % interval === 0;
    }
    case 'weekly_days':
      return (frequency.daysOfWeek ?? []).includes(current.day());
    default:
      return true;
  }
}

function countActiveEligibleDaysInRange(habit: Habit, start: string, end: string): number {
  let count = 0;
  let cursor = dayjs(start);
  const endDate = dayjs(end);

  while (cursor.isSame(endDate, 'day') || cursor.isBefore(endDate, 'day')) {
    const current = cursor.format('YYYY-MM-DD');
    if (isDateEligibleForHabit(habit, current))
      count++;
    cursor = cursor.add(1, 'day');
  }

  return count;
}

export function getHabitPeriod(habit: Habit, date: string): HabitPeriodSnapshot {
  const frequency = getHabitFrequency(habit);

  if (frequency.type === 'every_n_days') {
    const interval = getEveryNDaysInterval(frequency.interval);
    const diff = Math.max(0, dayjs(date).diff(dayjs(habit.startDate), 'day'));
    const offset = Math.floor(diff / interval) * interval;
    const periodStart = dayjs(habit.startDate).add(offset, 'day');
    const periodEnd = periodStart.add(interval - 1, 'day');

    return {
      periodType: 'interval',
      periodStart: periodStart.format('YYYY-MM-DD'),
      periodEnd: periodEnd.format('YYYY-MM-DD'),
      requiredCount: 1,
    };
  }

  if (frequency.type === 'daily') {
    return {
      periodType: 'day',
      periodStart: date,
      periodEnd: date,
      requiredCount: 1,
    };
  }

  const weekStart = dayjs(date).startOf('isoWeek');
  const weekEnd = weekStart.add(6, 'day');
  const periodStart = weekStart.format('YYYY-MM-DD');
  const periodEnd = weekEnd.format('YYYY-MM-DD');

  let requiredCount = 1;
  if (frequency.type === 'n_per_week') {
    requiredCount = frequency.daysPerWeek ?? 1;
  }
  else if (frequency.type === 'weekly_days') {
    requiredCount = countActiveEligibleDaysInRange(habit, periodStart, periodEnd);
  }

  return {
    periodType: 'week',
    periodStart,
    periodEnd,
    requiredCount,
  };
}
