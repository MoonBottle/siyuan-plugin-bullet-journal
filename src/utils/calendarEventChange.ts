import type {
  ItemDateTimeInfo,
  ItemStatus,
  TimePrecision,
} from '@/types/models'
import { t } from '@/i18n'
import { writeBlock } from '@/utils/blockWriter'
import { showMessage } from '@/utils/dialog'

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

function addOneHour(timeStr: string): string {
  const match = timeStr.match(TIME_RE)
  if (!match) return timeStr
  let hours = Number.parseInt(match[1], 10)
  const minutes = match[2]
  const seconds = match[3] || '00'
  hours = (hours + 1) % 24
  const hoursStr = String(hours).padStart(2, '0')
  return `${hoursStr}:${minutes}:${seconds}`
}

export interface CalendarEventChangePayload {
  blockId?: string
  allDay?: boolean
  start?: string
  end?: string
  date?: string
  originalStartDateTime?: string
  originalEndDateTime?: string
  timePrecision?: TimePrecision
  siblingItems?: Array<{
    date?: string
    startDateTime?: string
    endDateTime?: string
    timePrecision?: TimePrecision
  }>
  status?: ItemStatus
  extendedProps?: {
    blockId?: string
    timePrecision?: TimePrecision
  }
}

export async function persistCalendarEventChange(
  eventInfo: CalendarEventChangePayload,
  action: 'move' | 'resize',
): Promise<boolean> {
  const blockId = eventInfo.blockId || eventInfo.extendedProps?.blockId
  const allDay = eventInfo.allDay ?? false

  if (!blockId) {
    showMessage(t('common').blockIdError, 'error')
    return false
  }

  const originalDate = eventInfo.date
  const originalStartDateTime = eventInfo.originalStartDateTime
  const originalEndDateTime = eventInfo.originalEndDateTime
  const siblingItems = eventInfo.siblingItems
  let newDate = ''
  let newStartTime = ''
  let newEndTime = ''

  if (eventInfo.start) {
    if (eventInfo.start.includes('T')) {
      const [date, time] = eventInfo.start.split('T')
      newDate = date
      newStartTime = time.substring(0, 8)
    }
    else {
      newDate = eventInfo.start
    }
  }

  if (eventInfo.end && eventInfo.end.includes('T')) {
    const time = eventInfo.end.split('T')[1]
    newEndTime = time.substring(0, 8)
  }

  // 全天事项拖拽到非全天时，FullCalendar 可能不提供 end，需自动计算结束时间（开始时间+1小时）
  if (!allDay && newStartTime && !newEndTime && !originalStartDateTime) {
    newEndTime = addOneHour(newStartTime)
  }

  // 移动操作且原始有开始时间但无结束时间时，不写入 FullCalendar 自动生成的结束时间
  if (action === 'move' && originalStartDateTime && !originalEndDateTime) {
    newEndTime = ''
  }

  const timePrecision
    = eventInfo.timePrecision
      || eventInfo.extendedProps?.timePrecision
      || (!originalStartDateTime && newStartTime ? 'minute' : 'second')

  const completeSiblingItems = [
    ...(siblingItems || []),
    ...(originalDate
      ? [{
          date: originalDate,
          startDateTime: originalStartDateTime,
          endDateTime: originalEndDateTime,
          timePrecision,
        }]
      : []),
  ]

  const success = await writeBlock(
    { blockId },
    {
      type: 'addDate',
      date: newDate,
      startTime: newStartTime || undefined,
      endTime: newEndTime || undefined,
      allDay,
      originalDate,
      siblingItems: completeSiblingItems as ItemDateTimeInfo[],
      timePrecision,
    },
  )

  if (success) {
    showMessage(action === 'move' ? t('common').moveSuccess : t('common').resizeSuccess)
    return true
  }

  showMessage(t('common').actionFailed, 'error')
  return false
}
