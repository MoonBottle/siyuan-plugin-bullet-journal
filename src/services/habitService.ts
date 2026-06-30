import type { HabitCheckInTimePrecision } from '@/settings/types'
import type {
  CheckInRecord,
  Habit,
} from '@/types/models'
import type {
  BlockPatch,
  InsertableBlockPatch,
} from '@/utils/blockWriter'
/**
 * 习惯打卡服务
 * 负责创建、更新、删除打卡记录（SiYuan block 操作）
 */
import {
  deleteBlock,
  getBlockKramdown,
} from '@/api'
import {
  getHabitRecordStatus,
  getRecordsForDate,
} from '@/domain/habit/habitStatus'
import {


  insertBlockAfter,
  writeBlock,
} from '@/utils/blockWriter'

export {
  buildCheckInMarkdown,
  buildMissedCheckInMarkdown,
} from '@/utils/habitMarkdown'

export interface HabitBlockWriter {
  insertAfter: (previousBlockId: string, patch: InsertableBlockPatch) => Promise<boolean>
  update: (blockId: string, patch: BlockPatch) => Promise<boolean>
}

function isSuccessfulBlockOperationResult(result: unknown): boolean {
  return Array.isArray(result)
    && result.some((entry) => Array.isArray((entry as any)?.doOperations) && (entry as any).doOperations.length > 0)
}

function buildHabitRecordPatch(
  habit: Habit,
  date: string,
  precision: HabitCheckInTimePrecision,
  options: {
    value?: number
    recordStatus: 'completed' | 'missed'
  },
): Extract<BlockPatch, { type: 'setHabitRecord' }> {
  return {
    type: 'setHabitRecord',
    record: {
      content: habit.name,
      habitType: habit.type,
      date,
      value: options.value,
      target: habit.target,
      unit: habit.unit,
      precision,
      recordStatus: options.recordStatus,
    },
  }
}

async function insertHabitPatch(
  previousBlockId: string,
  patch: InsertableBlockPatch,
  writer?: HabitBlockWriter,
): Promise<boolean> {
  if (writer) {
    return writer.insertAfter(previousBlockId, patch)
  }
  return insertBlockAfter(previousBlockId, patch)
}

async function updateHabitPatch(
  blockId: string,
  patch: BlockPatch,
  writer?: HabitBlockWriter,
): Promise<boolean> {
  if (writer) {
    return writer.update(blockId, patch)
  }
  return writeBlock({ blockId }, patch)
}

export function findInsertAfterBlockId(habit: Habit, date: string): string {
  const sortedRecords = [...habit.records].sort((a, b) => a.date.localeCompare(b.date))
  if (sortedRecords.length === 0) {
    return habit.lastBlockId || habit.blockId
  }

  let previousId = habit.blockId

  for (const record of sortedRecords) {
    if (record.date > date) {
      break
    }
    previousId = record.blockId
  }

  const latestRecord = sortedRecords.at(-1)
  if (date >= latestRecord.date) {
    return habit.lastBlockId || previousId
  }

  return previousId
}

export function getRecordForDate(habit: Habit, date: string): CheckInRecord | null {
  const records = getRecordsForDate(habit, date)
  if (records.length === 0) {
    return null
  }

  const missedRecord = records.find((record) => getHabitRecordStatus(record) === 'missed')
  if (missedRecord) {
    return missedRecord
  }

  if (habit.type === 'binary') {
    return records[0]
  }

  return records.reduce((best, record) => {
    const bestValue = best.currentValue ?? 0
    const currentValue = record.currentValue ?? 0
    return currentValue >= bestValue ? record : best
  })
}

/**
 * 二元型打卡
 * 创建新的打卡记录 block
 */
export async function checkIn(
  habit: Habit,
  date: string,
  writer?: HabitBlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  if (habit.type !== 'binary') {
    console.warn('[HabitService] checkIn only for binary habits')
    return false
  }

  const existingRecord = getRecordForDate(habit, date)
  if (existingRecord) {
    console.log('[HabitService] Already checked in for', date)
    return false
  }

  const previousId = findInsertAfterBlockId(habit, date)
  const patch = buildHabitRecordPatch(habit, date, precision, { recordStatus: 'completed' })

  try {
    return await insertHabitPatch(previousId, patch, writer)
  } catch (error) {
    console.error('[HabitService] checkIn failed:', error)
    return false
  }
}

/**
 * 计数型打卡（增量）
 * 如果已有记录则更新，否则创建新记录
 */
export async function checkInCount(
  habit: Habit,
  date: string,
  incrementBy: number = 1,
  writer?: HabitBlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  if (habit.type !== 'count') {
    console.warn('[HabitService] checkInCount only for count habits')
    return false
  }

  const dayRecord = getRecordForDate(habit, date)

  if (dayRecord) {
    if (getHabitRecordStatus(dayRecord) === 'missed') {
      console.log('[HabitService] Missed record exists for', date)
      return false
    }

    const currentValue = (dayRecord.currentValue ?? 0) + incrementBy
    return setCheckInValue(habit, date, currentValue, writer, precision)
  }

  const previousId = findInsertAfterBlockId(habit, date)
  const patch = buildHabitRecordPatch(habit, date, precision, {
    value: incrementBy,
    recordStatus: 'completed',
  })

  try {
    return await insertHabitPatch(previousId, patch, writer)
  } catch (error) {
    console.error('[HabitService] checkInCount failed:', error)
    return false
  }
}

/**
 * 计数型打卡（设置具体值）
 * 如果已有记录则更新，否则创建新记录
 */
export async function setCheckInValue(
  habit: Habit,
  date: string,
  value: number,
  writer?: HabitBlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  if (habit.type !== 'count') {
    console.warn('[HabitService] setCheckInValue only for count habits')
    return false
  }

  const existingRecord = getRecordForDate(habit, date)
  const patch = buildHabitRecordPatch(habit, date, precision, {
    value,
    recordStatus: 'completed',
  })

  if (existingRecord) {
    if (getHabitRecordStatus(existingRecord) === 'missed') {
      console.log('[HabitService] Missed record exists for', date)
      return false
    }

    try {
      return await updateHabitPatch(existingRecord.blockId, patch, writer)
    } catch (error) {
      console.error('[HabitService] setCheckInValue failed:', error)
      return false
    }
  }

  const previousId = findInsertAfterBlockId(habit, date)

  try {
    return await insertHabitPatch(previousId, patch, writer)
  } catch (error) {
    console.error('[HabitService] setCheckInValue failed:', error)
    return false
  }
}

/**
 * 删除打卡记录
 */
export async function deleteCheckIn(record: CheckInRecord): Promise<boolean> {
  try {
    const result = await deleteBlock(record.blockId)
    return isSuccessfulBlockOperationResult(result)
  } catch (error) {
    console.error('[HabitService] deleteCheckIn failed:', error)
    return false
  }
}

export async function markHabitMissed(
  habit: Habit,
  date: string,
  writer?: HabitBlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  const existingRecord = getRecordForDate(habit, date)
  if (existingRecord) {
    console.log('[HabitService] Record already exists for', date)
    return false
  }

  const previousId = findInsertAfterBlockId(habit, date)
  const patch = buildHabitRecordPatch(habit, date, precision, { recordStatus: 'missed' })

  try {
    return await insertHabitPatch(previousId, patch, writer)
  } catch (error) {
    console.error('[HabitService] markHabitMissed failed:', error)
    return false
  }
}

export async function resetHabitRecord(record: CheckInRecord): Promise<boolean> {
  return deleteCheckIn(record)
}

export async function getCheckInMarkdown(record: CheckInRecord): Promise<string | null> {
  try {
    const result = await getBlockKramdown(record.blockId)
    return result?.kramdown ?? null
  } catch (error) {
    console.error('[HabitService] getCheckInMarkdown failed:', error)
    return null
  }
}

export async function updateCheckInMarkdown(record: CheckInRecord, markdown: string): Promise<boolean> {
  try {
    return await writeBlock(
      { blockId: record.blockId },
      {
        type: 'replaceMarkdown',
        markdown,
      },
    )
  } catch (error) {
    console.error('[HabitService] updateCheckInMarkdown failed:', error)
    return false
  }
}

export async function archiveHabit(habit: Habit, archiveDate: string): Promise<boolean> {
  if (habit.archivedAt) {
    return false
  }

  try {
    return await writeBlock(
      { blockId: habit.blockId },
      {
        type: 'setHabitArchive',
        archivedAt: archiveDate,
      },
    )
  } catch (error) {
    console.error('[HabitService] archiveHabit failed:', error)
    return false
  }
}

export async function unarchiveHabit(habit: Habit): Promise<boolean> {
  if (!habit.archivedAt) {
    return false
  }

  try {
    return await writeBlock(
      { blockId: habit.blockId },
      { type: 'setHabitArchive' },
    )
  } catch (error) {
    console.error('[HabitService] unarchiveHabit failed:', error)
    return false
  }
}
