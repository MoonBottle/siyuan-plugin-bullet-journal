import type { GanttDatePreset } from '@/types/workbench'
import dayjs from 'dayjs'

export interface GanttDateRange {
  start: string
  end: string
}

export function buildGanttDateRange(
  preset: GanttDatePreset,
  customStart?: string,
  customEnd?: string,
): GanttDateRange | undefined {
  const today = dayjs()
  switch (preset) {
    case 'today':
      return {
        start: today.format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'thisWeek':
      return {
        start: today.startOf('week').format('YYYY-MM-DD'),
        end: today.endOf('week').format('YYYY-MM-DD'),
      }
    case 'thisMonth':
      return {
        start: today.startOf('month').format('YYYY-MM-DD'),
        end: today.endOf('month').format('YYYY-MM-DD'),
      }
    case 'recent7':
      return {
        start: today.subtract(7, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent30':
      return {
        start: today.subtract(30, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent90':
      return {
        start: today.subtract(90, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent180':
      return {
        start: today.subtract(180, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'all':
      return undefined
    case 'custom':
      if (customStart || customEnd) {
        return {
          start: customStart || '',
          end: customEnd || '',
        }
      }
      return undefined
  }
}
