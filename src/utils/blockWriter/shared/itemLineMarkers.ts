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

export function isTaskListFormat(line: string): boolean {
  return /\[\s*(?:x\s*)?\]/i.test(line)
}

export function generatePriorityMarker(priority: PriorityLevel): string {
  return PRIORITY_EMOJI[priority]
}

export function stripPriorityMarker(line: string): string {
  return line.replace(PRIORITY_REGEX, '').replace(/\s{2,}/g, ' ').trim()
}

export function statusToLabel(status: string): string {
  return STATUS_LABELS[status] || ''
}
