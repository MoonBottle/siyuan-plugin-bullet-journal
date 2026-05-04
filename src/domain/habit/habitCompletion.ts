import type {
  CheckInRecord,
  Habit,
  HabitDayState,
  HabitPeriodState,
} from '@/types/models';
import { getHabitPeriod, isDateEligibleForHabit } from './habitPeriod';

export function isHabitRecordCompleted(record: CheckInRecord, habit: Habit): boolean {
  if (habit.type === 'binary')
    return true;

  const target = habit.target ?? record.targetValue ?? 0;
  return (record.currentValue ?? 0) >= target;
}

function getRecordsForDate(habit: Habit, date: string): CheckInRecord[] {
  return habit.records.filter(record => record.date === date);
}

function getBestRecordForDate(habit: Habit, date: string): CheckInRecord | null {
  const records = getRecordsForDate(habit, date);
  if (records.length === 0)
    return null;

  if (habit.type === 'binary')
    return records[0];

  return records.reduce((best, record) => {
    const bestValue = best.currentValue ?? 0;
    const currentValue = record.currentValue ?? 0;
    return currentValue >= bestValue ? record : best;
  });
}

export function getHabitDayState(habit: Habit, date: string): HabitDayState {
  const bestRecord = getBestRecordForDate(habit, date);

  if (!bestRecord) {
    return {
      date,
      hasRecord: false,
      isCompleted: false,
    };
  }

  return {
    date,
    hasRecord: true,
    isCompleted: isHabitRecordCompleted(bestRecord, habit),
    currentValue: bestRecord.currentValue,
    targetValue: habit.target ?? bestRecord.targetValue,
  };
}

function getCompletedCountInRange(habit: Habit, start: string, end: string): number {
  const dates = new Set(
    habit.records
      .filter((record) => {
        return record.date >= start
          && record.date <= end
          && isDateEligibleForHabit(habit, record.date);
      })
      .map(record => record.date),
  );

  let completedCount = 0;
  for (const date of dates) {
    if (getHabitDayState(habit, date).isCompleted)
      completedCount++;
  }

  return completedCount;
}

export function getHabitPeriodState(habit: Habit, date: string): HabitPeriodState {
  const period = getHabitPeriod(habit, date);
  const completedCount = getCompletedCountInRange(habit, period.periodStart, period.periodEnd);
  const requiredCount = period.requiredCount;
  const normalizedCompletedCount = Math.min(completedCount, requiredCount);

  return {
    ...period,
    completedCount: normalizedCompletedCount,
    remainingCount: Math.max(requiredCount - normalizedCompletedCount, 0),
    isCompleted: normalizedCompletedCount >= requiredCount,
    eligibleToday: isDateEligibleForHabit(habit, date),
  };
}
