import dayjs from '@/utils/dayjs';
import type { Habit, HabitFrequency, HabitPeriodState } from '@/types/models';

const DEFAULT_EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15];

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

export function getEbbinghausIntervals(frequency?: HabitFrequency): number[] {
  if (frequency?.type !== 'ebbinghaus') {
    return DEFAULT_EBBINGHAUS_INTERVALS;
  }

  const values = frequency.intervals?.filter(value => Number.isInteger(value) && value > 0) ?? [];
  if (values.length === 0) {
    return DEFAULT_EBBINGHAUS_INTERVALS;
  }

  return values;
}

function getCompletedEbbinghausDates(habit: Habit, predicate?: (date: string) => boolean): string[] {
  const dates = Array.from(new Set(
    habit.records
      .filter(record => record.status !== 'missed')
      .map(record => record.date),
  )).sort();

  return predicate ? dates.filter(predicate) : dates;
}

function buildEbbinghausScheduleState(
  habit: Habit,
  date: string,
  completedDates: string[],
) {
  const intervals = getEbbinghausIntervals(habit.frequency);

  if (completedDates.length === 0) {
    const overdueDays = Math.max(dayjs(date).diff(dayjs(habit.startDate), 'day'), 0);
    return {
      currentStageIndex: -1,
      currentIntervalDays: intervals[0],
      nextDueDate: habit.startDate,
      isDue: date >= habit.startDate,
      isOverdue: date > habit.startDate,
      overdueDays,
    };
  }

  const currentStageIndex = Math.min(completedDates.length - 1, intervals.length - 1);
  const currentIntervalDays = intervals[currentStageIndex];
  const lastCompletedDate = completedDates.at(-1)!;
  const nextDueDate = dayjs(lastCompletedDate).add(currentIntervalDays, 'day').format('YYYY-MM-DD');
  const overdueDays = Math.max(dayjs(date).diff(dayjs(nextDueDate), 'day'), 0);

  return {
    currentStageIndex,
    currentIntervalDays,
    nextDueDate,
    isDue: date >= nextDueDate,
    isOverdue: date > nextDueDate,
    overdueDays,
  };
}

export function getEbbinghausScheduleState(habit: Habit, date: string) {
  return buildEbbinghausScheduleState(habit, date, getCompletedEbbinghausDates(habit));
}

export function isEbbinghausDueOnDate(habit: Habit, date: string): boolean {
  if (!isHabitActiveOnDate(habit, date))
    return false;

  const scheduleState = buildEbbinghausScheduleState(
    habit,
    date,
    getCompletedEbbinghausDates(habit, completedDate => completedDate < date),
  );

  return scheduleState.isDue;
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
    case 'ebbinghaus':
      return isEbbinghausDueOnDate(habit, date);
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

  if (frequency.type === 'ebbinghaus') {
    const scheduleState = getEbbinghausScheduleState(habit, date);
    return {
      periodType: 'day',
      periodStart: date,
      periodEnd: date,
      requiredCount: isEbbinghausDueOnDate(habit, date) ? 1 : 0,
      nextDueDate: scheduleState.nextDueDate,
      currentStageIndex: scheduleState.currentStageIndex,
      currentIntervalDays: scheduleState.currentIntervalDays,
      overdueDays: scheduleState.overdueDays,
    };
  }

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
      nextDueDate: undefined,
      currentStageIndex: undefined,
      currentIntervalDays: undefined,
      overdueDays: undefined,
    };
  }

  if (frequency.type === 'daily') {
    return {
      periodType: 'day',
      periodStart: date,
      periodEnd: date,
      requiredCount: 1,
      nextDueDate: undefined,
      currentStageIndex: undefined,
      currentIntervalDays: undefined,
      overdueDays: undefined,
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
    nextDueDate: undefined,
    currentStageIndex: undefined,
    currentIntervalDays: undefined,
    overdueDays: undefined,
  };
}
