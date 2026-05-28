import { t } from '@/i18n'

export interface DatePickerDailySummary {
  date: string
  total: number
  completed: number
  abandoned: number
  pending: number
  overdue: number
}

export function emptySummary(): DatePickerDailySummary {
  return {
    date: '',
    total: 0,
    completed: 0,
    abandoned: 0,
    pending: 0,
    overdue: 0,
  }
}

export function hasItems(summary: DatePickerDailySummary): boolean {
  return summary.total > 0
}

export function hasOverdue(summary: DatePickerDailySummary): boolean {
  return summary.overdue > 0
}

export function hasPending(summary: DatePickerDailySummary): boolean {
  return summary.pending > 0
}

export function hasCompleted(summary: DatePickerDailySummary): boolean {
  return summary.completed > 0
}

export function hasMarker(summary: DatePickerDailySummary): boolean {
  return hasItems(summary)
}

export function getCellMarkerLabel(summary: DatePickerDailySummary): string {
  if (hasOverdue(summary)) return t('datePicker').legendOverdue
  if (hasPending(summary)) return t('datePicker').legendPending
  if (hasCompleted(summary)) return t('datePicker').legendCompleted
  return ''
}

export function getDotType(summary: DatePickerDailySummary): 'overdue' | 'pending' | 'completed' | '' {
  if (hasOverdue(summary)) return 'overdue'
  if (hasPending(summary)) return 'pending'
  if (hasCompleted(summary)) return 'completed'
  return ''
}
