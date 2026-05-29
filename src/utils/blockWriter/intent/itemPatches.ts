import type {
  ItemDateTimeInfo,
  ItemStatus,
  TimePrecision,
} from '@/types/models'
import type { DatePatch } from '@/utils/blockWriter/shared/types'

const TIME_PART_EXTRACT_RE = /\d{1,2}:\d{2}(?::\d{2})?/

export interface ItemDatePatchSource {
  date: string
  startDateTime?: string | null
  endDateTime?: string | null
  siblingItems?: ItemDateTimeInfo[]
  status?: ItemStatus
  timePrecision?: TimePrecision
}

export interface BuildItemDatePatchOptions {
  includeCurrentItemInSiblings?: boolean
  startTime?: string
  endTime?: string
  allDay?: boolean
  originalDate?: string
  timePrecision?: TimePrecision
}

export function extractTimePart(value?: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const matched = normalized.match(TIME_PART_EXTRACT_RE)
  return matched?.[0] ?? normalized
}

export function buildDatePatchFromItem(
  item: ItemDatePatchSource,
  targetDate: string,
  options: BuildItemDatePatchOptions = {},
): DatePatch {
  const startTime = options.startTime ?? extractTimePart(item.startDateTime)
  const endTime = options.endTime ?? extractTimePart(item.endDateTime)
  const timePrecision = options.timePrecision ?? item.timePrecision
  const siblingItems = options.includeCurrentItemInSiblings
    ? [
        ...(item.siblingItems ?? []),
        {
          date: item.date,
          startDateTime: item.startDateTime ?? undefined,
          endDateTime: item.endDateTime ?? undefined,
          timePrecision,
        },
      ]
    : item.siblingItems

  return {
    type: 'addDate',
    date: targetDate,
    startTime,
    endTime,
    allDay: options.allDay ?? (!startTime && !endTime),
    originalDate: options.originalDate ?? item.date,
    siblingItems,
    status: item.status,
    timePrecision,
  }
}
