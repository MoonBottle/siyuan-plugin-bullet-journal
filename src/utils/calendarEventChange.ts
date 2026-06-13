import type {
  ItemDateTimeInfo,
  ItemStatus,
  TimePrecision,
} from '@/types/models'
import { t } from '@/i18n'
import { writeBlock } from '@/utils/blockWriter'
import { showMessage } from '@/utils/dialog'

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

  // 移动操作且原始无结束时间时，不写入 FullCalendar 自动生成的结束时间
  if (action === 'move' && !originalEndDateTime) {
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
