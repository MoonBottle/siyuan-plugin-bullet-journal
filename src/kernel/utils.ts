import type { ReminderConfig } from './types'

const RE_PLUS = /\+/g
const RE_SLASH = /\//g
const RE_PADDING = /=+$/

export function toBase64Url(input: string): string {
  return Buffer.from(input).toString('base64').replace(RE_PLUS, '-').replace(RE_SLASH, '_').replace(RE_PADDING, '')
}

export function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateReminderTime(
  itemDate: string,
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig,
): number {
  let baseTime: number
  if (reminder.type === 'absolute') {
    baseTime = new Date(`${itemDate}T${reminder.time || '00:00'}:00`).getTime()
    if (reminder.alertMode && reminder.alertMode.type === 'before' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    if (reminder.alertMode && reminder.alertMode.type === 'custom' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    return baseTime
  }
  if (reminder.relativeTo === 'end') {
    baseTime = endDateTime
      ? new Date(endDateTime).getTime()
      : new Date(`${itemDate}T${endTime || '23:59'}:00`).getTime()
  } else {
    baseTime = startDateTime
      ? new Date(startDateTime).getTime()
      : new Date(`${itemDate}T${startTime || '00:00'}:00`).getTime()
  }
  return baseTime - (reminder.offsetMinutes || 0) * 60000
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const key in vars) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), vars[key])
  }
  return result
}
