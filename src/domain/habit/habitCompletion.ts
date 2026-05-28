import type {
  CheckInRecord,
  Habit,
  HabitDayState,
  HabitPeriodState,
} from '@/types/models'
import {
  getEbbinghausScheduleState,
  getHabitPeriod,
  isDateEligibleForHabit,
  isEbbinghausDueOnDate,
} from './habitPeriod'
import {
  getHabitRecordStatus,
  getRecordsForDate,
  hasMissedRecord,
} from './habitStatus'

export function isHabitRecordCompleted(record: CheckInRecord, habit: Habit): boolean {
  if (getHabitRecordStatus(record) === 'missed')
    return false

  if (habit.type === 'binary')
    return true

  const target = habit.target ?? record.targetValue ?? 0
  return (record.currentValue ?? 0) >= target
}

function getBestRecordForDate(habit: Habit, date: string): CheckInRecord | null {
  const records = getRecordsForDate(habit, date)
  if (records.length === 0)
    return null

  if (habit.type === 'binary')
    return records[0]

  return records.reduce((best, record) => {
    const bestValue = best.currentValue ?? 0
    const currentValue = record.currentValue ?? 0
    return currentValue >= bestValue ? record : best
  })
}

export function getHabitDayState(habit: Habit, date: string): HabitDayState {
  const records = getRecordsForDate(habit, date)
  const ebbinghausState = habit.frequency?.type === 'ebbinghaus'
    ? getEbbinghausScheduleState(habit, date)
    : null
  if (records.length === 0) {
    return {
      date,
      hasRecord: false,
      isCompleted: false,
      isMissed: false,
      isDue: ebbinghausState?.isDue ?? false,
      isOverdue: ebbinghausState?.isOverdue ?? false,
      overdueDays: ebbinghausState?.overdueDays,
      nextDueDate: ebbinghausState?.nextDueDate,
      currentStageIndex: ebbinghausState?.currentStageIndex,
      currentIntervalDays: ebbinghausState?.currentIntervalDays,
    }
  }

  if (hasMissedRecord(habit, date)) {
    return {
      date,
      hasRecord: true,
      isCompleted: false,
      isMissed: true,
      isDue: ebbinghausState?.isDue ?? false,
      isOverdue: ebbinghausState?.isOverdue ?? false,
      overdueDays: ebbinghausState?.overdueDays,
      nextDueDate: ebbinghausState?.nextDueDate,
      currentStageIndex: ebbinghausState?.currentStageIndex,
      currentIntervalDays: ebbinghausState?.currentIntervalDays,
    }
  }

  const bestRecord = getBestRecordForDate(habit, date)

  if (!bestRecord) {
    return {
      date,
      hasRecord: false,
      isCompleted: false,
      isMissed: false,
    }
  }

  return {
    date,
    hasRecord: true,
    isCompleted: isHabitRecordCompleted(bestRecord, habit),
    isMissed: false,
    isDue: ebbinghausState?.isDue ?? false,
    isOverdue: ebbinghausState?.isOverdue ?? false,
    overdueDays: ebbinghausState?.overdueDays,
    nextDueDate: ebbinghausState?.nextDueDate,
    currentStageIndex: ebbinghausState?.currentStageIndex,
    currentIntervalDays: ebbinghausState?.currentIntervalDays,
    currentValue: bestRecord.currentValue,
    targetValue: habit.target ?? bestRecord.targetValue,
  }
}

function getCompletedCountInRange(habit: Habit, start: string, end: string): number {
  const dates = new Set(
    habit.records
      .filter((record) => {
        return record.date >= start
          && record.date <= end
          && isDateEligibleForHabit(habit, record.date)
      })
      .map((record) => record.date),
  )

  let completedCount = 0
  for (const date of dates) {
    if (getHabitDayState(habit, date).isCompleted)
      completedCount++
  }

  return completedCount
}

export function getHabitPeriodState(habit: Habit, date: string): HabitPeriodState {
  const period = getHabitPeriod(habit, date)
  const completedCount = getCompletedCountInRange(habit, period.periodStart, period.periodEnd)
  const requiredCount = period.requiredCount
  const normalizedCompletedCount = Math.min(completedCount, requiredCount)
  const ebbinghausState = habit.frequency?.type === 'ebbinghaus'
    ? getEbbinghausScheduleState(habit, date)
    : null
  const isCompleted = requiredCount > 0 && normalizedCompletedCount >= requiredCount

  return {
    ...period,
    completedCount: normalizedCompletedCount,
    remainingCount: Math.max(requiredCount - normalizedCompletedCount, 0),
    isCompleted,
    eligibleToday: habit.frequency?.type === 'ebbinghaus'
      ? isEbbinghausDueOnDate(habit, date)
      : isDateEligibleForHabit(habit, date),
    nextDueDate: ebbinghausState?.nextDueDate ?? period.nextDueDate,
    currentStageIndex: ebbinghausState?.currentStageIndex ?? period.currentStageIndex,
    currentIntervalDays: ebbinghausState?.currentIntervalDays ?? period.currentIntervalDays,
    overdueDays: ebbinghausState?.overdueDays ?? period.overdueDays,
  }
}
