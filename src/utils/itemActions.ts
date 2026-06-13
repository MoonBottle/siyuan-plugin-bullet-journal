import type { Item } from '@/types/models'
import { skipCurrentOccurrence } from '@/services/recurringService'
import { writeBlock } from '@/utils/blockWriter'
import dayjs from '@/utils/dayjs'

function buildDatePatch(item: Item, targetDate: string) {
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date
      ? [{
          date: item.date,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
          timePrecision: item.timePrecision,
        }]
      : []),
  ]

  return {
    type: 'addDate' as const,
    date: targetDate,
    startTime: item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    endTime: item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    allDay: !item.startDateTime,
    originalDate: item.date,
    siblingItems: completeSiblingItems,
    timePrecision: item.timePrecision,
  }
}

export async function completeItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  return writeBlock(
    {
      blockId: item.blockId,
      listItemBlockId: item.listItemBlockId,
    },
    {
      type: 'setStatus',
      status: 'completed',
    },
  )
}

export async function abandonItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  return writeBlock(
    {
      blockId: item.blockId,
      listItemBlockId: item.listItemBlockId,
    },
    {
      type: 'setStatus',
      status: 'abandoned',
    },
  )
}

export async function migrateItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  const targetDate = item.date < dayjs().format('YYYY-MM-DD')
    ? dayjs().format('YYYY-MM-DD')
    : dayjs().add(1, 'day').format('YYYY-MM-DD')
  return writeBlock({ blockId: item.blockId }, buildDatePatch(item, targetDate))
}

export async function migrateItemToToday(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  const todayStr = dayjs().format('YYYY-MM-DD')
  return writeBlock({ blockId: item.blockId }, buildDatePatch(item, todayStr))
}

export async function migrateItemToDate(item: Item, targetDate: string): Promise<boolean> {
  if (!item.blockId) return false
  return writeBlock({ blockId: item.blockId }, buildDatePatch(item, targetDate))
}

export async function skipOccurrenceItem(plugin: any, item: Item): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false
  return skipCurrentOccurrence(plugin, item)
}
