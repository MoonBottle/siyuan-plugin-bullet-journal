import type { Habit, HabitStats } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { getHabitDayState, getHabitPeriodState, isHabitRecordCompleted } from './habitCompletion';
import { getHabitEndDate, getHabitPeriod, isDateEligibleForHabit, isHabitActiveOnDate } from './habitPeriod';

type CompletionWindow = {
  completedCount: number;
  expectedCount: number;
};

function getUniqueRecordDates(habit: Habit): string[] {
  return Array.from(new Set(habit.records.map(record => record.date))).sort();
}

function getCompletedDates(habit: Habit, startDate?: string, endDate?: string): string[] {
  return getUniqueRecordDates(habit).filter((date) => {
    if (startDate && date < startDate)
      return false;
    if (endDate && date > endDate)
      return false;
    if (!isDateEligibleForHabit(habit, date))
      return false;
    return getHabitDayState(habit, date).isCompleted;
  });
}

function getPeriodStatesUntil(habit: Habit, currentDate: string) {
  const states: Array<{
    key: string;
    isCompleted: boolean;
  }> = [];
  const visitedPeriods = new Set<string>();
  let cursor = dayjs(habit.startDate);
  const endDate = dayjs(currentDate);

  while (cursor.isSame(endDate, 'day') || cursor.isBefore(endDate, 'day')) {
    const current = cursor.format('YYYY-MM-DD');
    if (!isHabitActiveOnDate(habit, current)) {
      cursor = cursor.add(1, 'day');
      continue;
    }

    const period = getHabitPeriod(habit, current);
    const key = `${period.periodType}:${period.periodStart}`;
    if (!visitedPeriods.has(key)) {
      visitedPeriods.add(key);
      states.push({
        key,
        isCompleted: getHabitPeriodState(habit, current).isCompleted,
      });
    }

    cursor = cursor.add(1, 'day');
  }

  return states;
}

function calculateStreaks(habit: Habit, currentDate: string) {
  const states = getPeriodStatesUntil(habit, currentDate);
  const completedStates = states.filter(state => state.isCompleted);
  if (completedStates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (const state of states) {
    if (state.isCompleted) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    }
    else {
      tempStreak = 0;
    }
  }

  let currentStreak = 0;
  let cursor = states.length - 1;
  if (cursor < 0) {
    return { currentStreak, longestStreak };
  }

  if (!states[cursor].isCompleted) {
    cursor--;
  }
  if (cursor < 0 || !states[cursor].isCompleted) {
    return { currentStreak, longestStreak };
  }

  while (cursor >= 0 && states[cursor].isCompleted) {
    currentStreak++;
    cursor--;
  }

  return { currentStreak, longestStreak };
}

function getBestValueByDate(habit: Habit, date: string): number {
  if (habit.type !== 'count')
    return 0;

  return habit.records
    .filter(record => record.date === date)
    .reduce((maxValue, record) => Math.max(maxValue, record.currentValue ?? 0), 0);
}

function getCompletedCountInDateRange(habit: Habit, start: string, end: string): number {
  return getCompletedDates(habit, start, end).length;
}

function countExpectedAndCompletedForRange(habit: Habit, start: string, end: string): CompletionWindow {
  let cursor = dayjs(start);
  const endDate = dayjs(end);
  const visitedPeriods = new Set<string>();
  let completedCount = 0;
  let expectedCount = 0;

  while (cursor.isSame(endDate, 'day') || cursor.isBefore(endDate, 'day')) {
    const current = cursor.format('YYYY-MM-DD');
    if (!isHabitActiveOnDate(habit, current)) {
      cursor = cursor.add(1, 'day');
      continue;
    }

    const period = getHabitPeriod(habit, current);
    const periodKey = `${period.periodType}:${period.periodStart}`;
    if (!visitedPeriods.has(periodKey)) {
      visitedPeriods.add(periodKey);

      const overlapStart = period.periodStart > start ? period.periodStart : start;
      const overlapEnd = period.periodEnd < end ? period.periodEnd : end;
      const activeRequiredCount = getActiveRequiredCount(habit, overlapStart, overlapEnd, period.requiredCount);
      const completedCountInOverlap = getCompletedCountInDateRange(habit, overlapStart, overlapEnd);

      expectedCount += activeRequiredCount;
      completedCount += Math.min(completedCountInOverlap, activeRequiredCount);
    }

    cursor = cursor.add(1, 'day');
  }

  return {
    completedCount,
    expectedCount,
  };
}

function getActiveRequiredCount(
  habit: Habit,
  start: string,
  end: string,
  fallbackRequiredCount: number,
): number {
  const frequencyType = habit.frequency?.type ?? 'daily';

  if (frequencyType === 'daily' || frequencyType === 'weekly_days' || frequencyType === 'every_n_days') {
    let count = 0;
    let cursor = dayjs(start);
    const endDate = dayjs(end);
    while (cursor.isSame(endDate, 'day') || cursor.isBefore(endDate, 'day')) {
      if (isDateEligibleForHabit(habit, cursor.format('YYYY-MM-DD')))
        count++;
      cursor = cursor.add(1, 'day');
    }
    return count;
  }

  return fallbackRequiredCount;
}

export function calculateHabitStats(habit: Habit, currentDate: string): HabitStats {
  const completedDates = getCompletedDates(habit);
  const totalCheckins = completedDates.length;
  const currentMonth = currentDate.slice(0, 7);
  const monthlyCheckins = completedDates.filter(date => date.startsWith(currentMonth)).length;

  const { currentStreak, longestStreak } = calculateStreaks(habit, currentDate);

  const overallWindow = countExpectedAndCompletedForRange(habit, habit.startDate, currentDate);
  const weekStart = dayjs(currentDate).startOf('isoWeek').format('YYYY-MM-DD');
  const monthStart = `${currentMonth}-01`;
  const monthEnd = dayjs(currentDate).endOf('month').format('YYYY-MM-DD');
  const habitEndDate = getHabitEndDate(habit);
  const monthlyWindowEnd = habitEndDate && habitEndDate < monthEnd ? habitEndDate : monthEnd;
  const monthlyWindow = countExpectedAndCompletedForRange(
    habit,
    habit.startDate > monthStart ? habit.startDate : monthStart,
    monthlyWindowEnd,
  );
  const weeklyWindow = countExpectedAndCompletedForRange(
    habit,
    habit.startDate > weekStart ? habit.startDate : weekStart,
    currentDate,
  );

  const uniqueDates = getUniqueRecordDates(habit);
  const totalValue = habit.type === 'count'
    ? uniqueDates.reduce((sum, date) => sum + getBestValueByDate(habit, date), 0)
    : undefined;
  const elapsedDays = dayjs(currentDate).diff(dayjs(habit.startDate), 'day') + 1;
  const averageValue = habit.type === 'count' && totalValue !== undefined && elapsedDays > 0
    ? totalValue / elapsedDays
    : undefined;

  const isEnded = Boolean(getHabitEndDate(habit) && getHabitEndDate(habit)! <= currentDate);
  const currentPeriodState = getHabitPeriodState(habit, currentDate);

  return {
    habitId: habit.blockId,
    monthlyCheckins,
    totalCheckins,
    currentStreak,
    longestStreak,
    completionRate: overallWindow.expectedCount > 0 ? Math.min(overallWindow.completedCount / overallWindow.expectedCount, 1) : 0,
    monthlyCompletionRate: monthlyWindow.expectedCount > 0 ? Math.min(monthlyWindow.completedCount / monthlyWindow.expectedCount, 1) : 0,
    weeklyCompletionRate: weeklyWindow.expectedCount > 0 ? Math.min(weeklyWindow.completedCount / weeklyWindow.expectedCount, 1) : 0,
    totalValue,
    averageValue,
    isEnded,
    isCompleted: isEnded,
    isPeriodCompleted: currentPeriodState.isCompleted,
  };
}

export function calculateAllHabitStats(habits: Habit[], currentDate: string): Map<string, HabitStats> {
  return new Map(habits.map(habit => [habit.blockId, calculateHabitStats(habit, currentDate)]));
}

export { isHabitRecordCompleted as isRecordCompleted };
