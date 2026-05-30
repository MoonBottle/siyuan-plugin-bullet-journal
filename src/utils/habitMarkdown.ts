import type { HabitCheckInTimePrecision } from '@/settings/types'
import type { Habit } from '@/types/models'
import { formatHabitCompletedAtForMarkdown } from '@/utils/habitDateTime'

const DATE_PREFIX_RE = /@|📅/

export interface HabitRecordMarkdownInput {
  content: string
  habitType: Habit['type']
  date: string
  value?: number
  target?: number
  unit?: string
  precision?: HabitCheckInTimePrecision
  recordStatus?: 'completed' | 'missed'
}

function isToday(date: string): boolean {
  return date === formatHabitCompletedAtForMarkdown('day')
}

export function buildCompletedAtMarkdown(
  date: string,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  if (precision === 'day' || !isToday(date)) {
    return date
  }

  const currentTimestamp = formatHabitCompletedAtForMarkdown(precision)
  return currentTimestamp.replace(DATE_PREFIX_RE, date)
}

export function buildHabitRecordMarkdown(input: HabitRecordMarkdownInput): string {
  const completedAt = buildCompletedAtMarkdown(input.date, input.precision ?? 'day')

  if (input.recordStatus === 'missed') {
    return `${input.content} 📅${completedAt} ❌`
  }

  if (input.habitType === 'count') {
    const target = input.target ?? 0
    const unit = input.unit ?? ''
    const value = input.value ?? 0
    return `${input.content} ${value}/${target}${unit} 📅${completedAt}`
  }

  return `${input.content} 📅${completedAt}`
}

export function buildCheckInMarkdown(
  habit: Habit,
  date: string,
  currentValue?: number,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  return buildHabitRecordMarkdown({
    content: habit.name,
    habitType: habit.type,
    date,
    value: currentValue,
    target: habit.target,
    unit: habit.unit,
    precision,
    recordStatus: 'completed',
  })
}

export function buildMissedCheckInMarkdown(
  habit: Habit,
  date: string,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  return buildHabitRecordMarkdown({
    content: habit.name,
    habitType: habit.type,
    date,
    target: habit.target,
    unit: habit.unit,
    precision,
    recordStatus: 'missed',
  })
}
