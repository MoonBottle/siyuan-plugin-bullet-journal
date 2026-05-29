import type {
  CheckInRecord,
  Habit,
  HabitFrequency,
} from '@/types/models'
import {
  extractHabitCompletedAt,
  stripHabitCompletedAtTokens,
} from '@/utils/habitDateTime'
import { parseReminderFromLine } from './reminderParser'

const CHINESE_DAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
}

const ENGLISH_DAY_MAP: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
}

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\uFEFF]/g
const EBBINGHAUS_RE = /^(?:艾宾浩斯|ebbinghaus)(?:\[(.+)\])?$/i
const EVERY_N_DAYS_RE = /^每(\d+)天$|^every\s+(\d+)\s+days?$/i
const N_PER_WEEK_RE = /^每周(\d+)天$|^(\d+)\s+days?\/week$/i
const WEEKLY_DAYS_RE = /^每周([一二三四五六日天]+)$|^weekly\s+on\s+(.+)$/i
const DAY_SEPARATOR_RE = /[,，\s]+/
const START_DATE_RE = /🎯(\d{4}-\d{2}-\d{2})/
const DURATION_DAYS_RE = /坚持(\d+)天/
const START_DATE_REMOVE_RE = /🎯\d{4}-\d{2}-\d{2}/
const DURATION_DAYS_REMOVE_RE = /坚持\d+天/
const REMINDER_TIME_REMOVE_RE = /⏰\d{2}:\d{2}(?::\d{2})?/
const COUNT_TARGET_RE = /(\d+)([a-z\u4E00-\u9FFF]{1,4})$/i
const FREQ_MARKER_RE = /🔄(.+?)(?=\s+📦\S+$|$)/
const ARCHIVE_DATE_RE = /(?:^|\s)📦(\d{4}-\d{2}-\d{2})(?=\s|$)/
const ARCHIVE_MARKER_RE = /(?:^|\s)📦\d{4}-\d{2}-\d{2}(?=\s|$)/
const MISSED_MARKER_RE = /(?:^|\s)❌$/
const COMPLETED_MARKER_RE = /(?:^|\s)✅$/
const LEGACY_DATE_RE = /@(\d{4}-\d{2}-\d{2})/
const COUNT_SLASH_RE = /(\d+)\/(\d+)([a-z\u4E00-\u9FFF]+)/i
const LEGACY_DATE_REMOVE_RE = /@\d{4}-\d{2}-\d{2}/g
const COUNT_SLASH_REMOVE_RE = /\d+\/\d+[a-z\u4E00-\u9FFF]+/gi
const MISSED_MARKER_REMOVE_RE = /(?:^|\s)❌$/g
const COMPLETED_MARKER_REMOVE_RE = /(?:^|\s)✅$/g
const MULTI_SPACE_RE = /\s+/g
const SPACE_BEFORE_PUNCT_RE = /\s+([,.;!?，。；！？])/g
const COUNT_SLASH_TEST_RE = /\d+\/\d+[a-z\u4E00-\u9FFF]+/i

function normalizeHabitText(value: string): string {
  return value.replace(ZERO_WIDTH_CHARS_RE, '').trim()
}

function parseEbbinghausIntervals(raw?: string): number[] | null {
  if (!raw) {
    return null
  }

  const values = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))

  if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value <= 0)) {
    return null
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return null
    }
  }

  return values
}

export function isHabitLine(line: string): boolean {
  return line.includes('🎯')
}

export function parseHabitFrequency(freqStr: string): HabitFrequency | null {
  const str = normalizeHabitText(freqStr)

  const ebbinghausMatch = str.match(EBBINGHAUS_RE)
  if (ebbinghausMatch) {
    const intervals = parseEbbinghausIntervals(ebbinghausMatch[1])
    if (ebbinghausMatch[1] && !intervals) {
      return null
    }
    return intervals
      ? {
          type: 'ebbinghaus',
          intervals,
        }
      : { type: 'ebbinghaus' }
  }

  if (str === '每天' || str === 'daily') {
    return { type: 'daily' }
  }

  const everyNDaysMatch = str.match(EVERY_N_DAYS_RE)
  if (everyNDaysMatch) {
    const interval = Number.parseInt(everyNDaysMatch[1] || everyNDaysMatch[2], 10)
    return {
      type: 'every_n_days',
      interval,
    }
  }

  const nPerWeekMatch = str.match(N_PER_WEEK_RE)
  if (nPerWeekMatch) {
    const daysPerWeek = Number.parseInt(nPerWeekMatch[1] || nPerWeekMatch[2], 10)
    return {
      type: 'n_per_week',
      daysPerWeek,
    }
  }

  const weeklyDaysMatch = str.match(WEEKLY_DAYS_RE)
  if (weeklyDaysMatch) {
    const daysOfWeek: number[] = []

    if (weeklyDaysMatch[1]) {
      for (const char of weeklyDaysMatch[1]) {
        if (CHINESE_DAY_MAP[char] !== undefined) {
          daysOfWeek.push(CHINESE_DAY_MAP[char])
        }
      }
    } else if (weeklyDaysMatch[2]) {
      const dayStrs = weeklyDaysMatch[2].split(DAY_SEPARATOR_RE)
      for (const dayStr of dayStrs) {
        const lower = dayStr.trim().toLowerCase().substring(0, 3)
        if (ENGLISH_DAY_MAP[lower] !== undefined) {
          daysOfWeek.push(ENGLISH_DAY_MAP[lower])
        }
      }
    }

    if (daysOfWeek.length > 0) {
      return {
        type: 'weekly_days',
        daysOfWeek,
      }
    }
  }

  if (str === '每周' || str === 'weekly') {
    return { type: 'weekly' }
  }

  return null
}

export function parseHabitLine(line: string): Partial<Habit> | null {
  const normalizedLine = normalizeHabitText(line)

  if (!normalizedLine.includes('🎯')) {
    return null
  }

  if (!normalizedLine.includes('🔄')) {
    return null
  }

  const targetIndex = normalizedLine.indexOf('🎯')
  const name = normalizedLine.substring(0, targetIndex).trim()
  if (!name) {
    return null
  }

  const startDateMatch = normalizedLine.match(START_DATE_RE)
  if (!startDateMatch) {
    return null
  }
  const startDate = startDateMatch[1]

  const durationMatch = normalizedLine.match(DURATION_DAYS_RE)
  const durationDays = durationMatch ? Number.parseInt(durationMatch[1], 10) : undefined

  let endDate: string | undefined
  if (durationDays !== undefined) {
    endDate = calculateEndDate(startDate, durationDays)
  }

  const afterTarget = normalizedLine.substring(targetIndex)
  const freqIndex = afterTarget.indexOf('🔄')
  const beforeFreq = freqIndex >= 0 ? afterTarget.substring(0, freqIndex) : afterTarget

  const searchArea = beforeFreq
    .replace(START_DATE_REMOVE_RE, '')
    .replace(DURATION_DAYS_REMOVE_RE, '')
    .replace(REMINDER_TIME_REMOVE_RE, '')
    .trim()

  const countMatch = searchArea.match(COUNT_TARGET_RE)

  let type: 'binary' | 'count' = 'binary'
  let target: number | undefined
  let unit: string | undefined

  if (countMatch) {
    type = 'count'
    target = Number.parseInt(countMatch[1], 10)
    unit = countMatch[2]
  }

  const freqMatch = normalizedLine.match(FREQ_MARKER_RE)
  if (!freqMatch) {
    return null
  }
  const frequency = parseHabitFrequency(freqMatch[1].trim())
  if (!frequency) {
    return null
  }

  const archiveMatch = normalizedLine.match(ARCHIVE_DATE_RE)

  const reminder = parseReminderFromLine(normalizedLine)

  const result: Partial<Habit> = {
    name,
    type,
    startDate,
    frequency,
  }

  if (durationDays !== undefined) {
    result.durationDays = durationDays
  }
  if (endDate !== undefined) {
    result.endDate = endDate
  }
  if (type === 'count') {
    result.target = target
    result.unit = unit
  }
  if (reminder) {
    result.reminder = reminder
  }
  if (archiveMatch) {
    result.archivedAt = archiveMatch[1]
  }

  return result
}

export function parseCheckInRecordLine(line: string, habitId: string): Partial<CheckInRecord> | null {
  const normalizedLine = normalizeHabitText(line)
  const hasArchiveMarker = ARCHIVE_MARKER_RE.test(normalizedLine)
  const isMissedRecord = MISSED_MARKER_RE.test(normalizedLine)
  const hasCompletedMarker = COMPLETED_MARKER_RE.test(normalizedLine)

  if (hasArchiveMarker) {
    return null
  }

  const habitCompletedAt = extractHabitCompletedAt(normalizedLine)
  const legacyDateMatch = normalizedLine.match(LEGACY_DATE_RE)
  if (!habitCompletedAt && !legacyDateMatch) {
    return null
  }

  const date = habitCompletedAt?.date ?? legacyDateMatch![1]
  const completedAt = habitCompletedAt?.completedAt ?? legacyDateMatch![1]

  const countMatch = normalizedLine.match(COUNT_SLASH_RE)
  let currentValue: number | undefined
  let targetValue: number | undefined
  let unit: string | undefined

  if (countMatch && !isMissedRecord) {
    currentValue = Number.parseInt(countMatch[1], 10)
    targetValue = Number.parseInt(countMatch[2], 10)
    unit = countMatch[3]
  }

  let content = stripHabitCompletedAtTokens(normalizedLine)
    .replace(LEGACY_DATE_REMOVE_RE, '')
    .replace(COUNT_SLASH_REMOVE_RE, '')
    .replace(MISSED_MARKER_REMOVE_RE, '')
    .replace(COMPLETED_MARKER_REMOVE_RE, '')
    .trim()

  content = content
    .replace(MULTI_SPACE_RE, ' ')
    .replace(SPACE_BEFORE_PUNCT_RE, '$1')
    .trim()

  if (!content) {
    return null
  }

  const result: Partial<CheckInRecord> = {
    content,
    date,
    completedAt,
    habitId,
    status: isMissedRecord ? 'missed' : 'completed',
  }

  if (currentValue !== undefined) {
    result.currentValue = currentValue
  }
  if (targetValue !== undefined) {
    result.targetValue = targetValue
  }
  if (unit !== undefined) {
    result.unit = unit
  }

  return result
}

export function parseHabitRecordLine(line: string, habitId: string): Partial<CheckInRecord> | null {
  const normalizedLine = normalizeHabitText(line)
  const parsedRecord = parseCheckInRecordLine(normalizedLine, habitId)
  if (!parsedRecord) {
    return null
  }

  const hasHabitRecordMarkers = COUNT_SLASH_TEST_RE.test(normalizedLine) || MISSED_MARKER_RE.test(normalizedLine) || COMPLETED_MARKER_RE.test(normalizedLine)
  return hasHabitRecordMarkers ? parsedRecord : null
}

function calculateEndDate(startDate: string, durationDays: number): string {
  const date = new Date(startDate)
  date.setDate(date.getDate() + durationDays - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildHabitDefinitionMarkdown(habit: Partial<Habit>): string {
  const parts: string[] = []

  if (habit.name) {
    parts.push(habit.name)
  }

  if (habit.startDate) {
    parts.push(`🎯${habit.startDate}`)
  }

  if (habit.durationDays) {
    parts.push(`坚持${habit.durationDays}天`)
  }

  if (habit.type === 'count' && habit.target !== undefined && habit.unit) {
    parts.push(`${habit.target}${habit.unit}`)
  }

  if (habit.reminder?.enabled && habit.reminder.type === 'absolute' && habit.reminder.time) {
    parts.push(`⏰${habit.reminder.time}`)
  }

  if (habit.frequency) {
    parts.push(`🔄${frequencyToMarkdown(habit.frequency)}`)
  }

  if (habit.archivedAt) {
    parts.push(`📦${habit.archivedAt}`)
  }

  return parts.join(' ')
}

function frequencyToMarkdown(freq: HabitFrequency): string {
  switch (freq.type) {
    case 'ebbinghaus':
      if (freq.intervals?.length) {
        return `艾宾浩斯[${freq.intervals.join(',')}]`
      }
      return '艾宾浩斯'
    case 'daily':
      return '每天'
    case 'every_n_days':
      return `每${freq.interval}天`
    case 'weekly':
      return '每周'
    case 'n_per_week':
      return `每周${freq.daysPerWeek}天`
    case 'weekly_days': {
      if (freq.daysOfWeek && freq.daysOfWeek.length > 0) {
        const weekDayChars = ['日', '一', '二', '三', '四', '五', '六']
        const dayChars = freq.daysOfWeek
          .map((d) => weekDayChars[d] ?? '')
          .filter(Boolean)
          .join('')
        return `每周${dayChars}`
      }
      return '每周'
    }
    default:
      return ''
  }
}
