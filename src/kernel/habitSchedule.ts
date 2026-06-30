import type { KernelDataHabit } from './types'

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function daysBetween(dateA: string, dateB: string): number {
  const a = parseLocalDate(dateA)
  const b = parseLocalDate(dateB)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDateInValidRange(habit: KernelDataHabit, dateStr: string): boolean {
  if (dateStr < habit.startDate) return false
  if (habit.archivedAt && dateStr > habit.archivedAt) return false
  if (habit.durationDays !== undefined) {
    const endDate = addDays(habit.startDate, habit.durationDays - 1)
    if (dateStr > endDate) return false
  }
  return true
}

function getCompletedDates(habit: KernelDataHabit): string[] {
  return [...new Set<string>(
    (habit.records ?? [])
      .filter((r) => r.status !== 'missed')
      .map((r) => r.date),
  )].sort()
}

function isEbbinghausDueOnDate(habit: KernelDataHabit, dateStr: string): boolean {
  const intervals = habit.frequency?.intervals ?? [1, 2, 4, 7, 15]
  const completedDates = getCompletedDates(habit)
  const priorCompleted = completedDates.filter((d) => d < dateStr)

  if (priorCompleted.length === 0) {
    return dateStr >= habit.startDate
  }

  const stageIndex = Math.min(priorCompleted.length - 1, intervals.length - 1)
  const intervalDays = intervals[stageIndex]
  const lastCompleted = priorCompleted.at(-1)!
  const nextDueDate = addDays(lastCompleted, intervalDays)

  return dateStr >= nextDueDate
}

export function isDateEligibleForHabit(habit: KernelDataHabit, dateStr: string): boolean {
  if (!isDateInValidRange(habit, dateStr)) return false

  const frequency = habit.frequency
  if (!frequency) return true

  switch (frequency.type) {
    case 'daily':
    case 'weekly':
    case 'n_per_week':
      return true
    case 'every_n_days': {
      const interval = frequency.interval ?? 2
      return daysBetween(habit.startDate, dateStr) % interval === 0
    }
    case 'weekly_days': {
      const d = parseLocalDate(dateStr)
      return (frequency.daysOfWeek ?? []).includes(d.getDay())
    }
    case 'ebbinghaus':
      return isEbbinghausDueOnDate(habit, dateStr)
    default:
      return true
  }
}

export function isTodayCompleted(habit: KernelDataHabit, today: string): boolean {
  const todayRecords = (habit.records ?? []).filter(
    (r) => r.date === today && r.status !== 'missed',
  )
  if (todayRecords.length === 0) return false

  if (habit.type === 'binary') return true

  const currentValue = todayRecords.reduce(
    (sum, r) => sum + (r.currentValue ?? 1),
    0,
  )
  return currentValue >= (habit.target ?? 1)
}
