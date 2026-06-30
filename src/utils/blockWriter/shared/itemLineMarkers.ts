import type { PriorityLevel } from '@/types/models'

const PRIORITY_EMOJI: Record<PriorityLevel, string> = {
  high: '🔥',
  medium: '🌱',
  low: '🍃',
}

const STATUS_LABELS: Record<string, string> = {
  completed: '✅',
  abandoned: '❌',
}

const PRIORITY_REGEX = /[🔥🌱🍃]/gu
const TASK_LIST_FORMAT_RE = /\[\s*(?:x\s*)?\]/i
const MULTI_WHITESPACE_RE = /\s{2,}/g

export function isTaskListFormat(line: string): boolean {
  return TASK_LIST_FORMAT_RE.test(line)
}

export function generatePriorityMarker(priority: PriorityLevel): string {
  return PRIORITY_EMOJI[priority]
}

export function stripPriorityMarker(line: string): string {
  return line.replace(PRIORITY_REGEX, '').replace(MULTI_WHITESPACE_RE, ' ').trim()
}

export function statusToLabel(status: string): string {
  return STATUS_LABELS[status] || ''
}
