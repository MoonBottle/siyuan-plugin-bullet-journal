/**
 * 习惯打卡服务
 * 负责创建、更新、删除打卡记录（SiYuan block 操作）
 */
import { insertBlock, updateBlock, deleteBlock, getBlockKramdown } from '@/api';
import type { HabitCheckInTimePrecision } from '@/settings/types';
import type { Habit, CheckInRecord } from '@/types/models';
import { formatHabitCompletedAtForMarkdown } from '@/utils/habitDateTime';
import { getHabitRecordStatus, getRecordsForDate } from '@/domain/habit/habitStatus';

const HABIT_ARCHIVE_MARKER_RE = /\s*📦\d{4}-\d{2}-\d{2}\s*$/;

type HabitBlockWriter = {
  insertAfter: (markdown: string, previousBlockId: string) => Promise<boolean>;
  update: (markdown: string, blockId: string) => Promise<boolean>;
};

function isSuccessfulBlockOperationResult(result: unknown): boolean {
  return Array.isArray(result)
    && result.some((entry) => Array.isArray((entry as any)?.doOperations) && (entry as any).doOperations.length > 0);
}

function replaceHabitDefinitionLine(
  markdown: string,
  transform: (line: string) => string | null,
): string | null {
  const normalizedMarkdown = markdown.trim();
  if (!normalizedMarkdown) {
    return null;
  }

  const lines = normalizedMarkdown.split('\n');
  const nextFirstLine = transform(lines[0]?.trim() ?? '');
  if (!nextFirstLine) {
    return null;
  }

  lines[0] = nextFirstLine;
  return lines.join('\n');
}

function isToday(date: string): boolean {
  return date === formatHabitCompletedAtForMarkdown('day');
}

export function findInsertAfterBlockId(habit: Habit, date: string): string {
  const sortedRecords = [...habit.records].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedRecords.length === 0) {
    return habit.lastBlockId || habit.blockId;
  }

  let previousId = habit.blockId;

  for (const record of sortedRecords) {
    if (record.date > date)
      break;
    previousId = record.blockId;
  }

  const latestRecord = sortedRecords[sortedRecords.length - 1];
  if (date >= latestRecord.date) {
    return habit.lastBlockId || previousId;
  }

  return previousId;
}

/**
 * 构建二元型打卡记录行 Markdown
 */
function buildCompletedAtMarkdown(
  date: string,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  if (precision === 'day' || !isToday(date)) {
    return date;
  }

  const currentTimestamp = formatHabitCompletedAtForMarkdown(precision);
  return currentTimestamp.replace(/^\d{4}-\d{2}-\d{2}/, date);
}

export function buildCheckInMarkdown(
  habit: Habit,
  date: string,
  currentValue?: number,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  const completedAt = buildCompletedAtMarkdown(date, precision);

  if (habit.type === 'binary') {
    return `${habit.name} 📅${completedAt}`;
  }

  // 计数型
  const target = habit.target ?? 0;
  const unit = habit.unit ?? '';
  const value = currentValue ?? 0;
  return `${habit.name} ${value}/${target}${unit} 📅${completedAt}`;
}

export function buildMissedCheckInMarkdown(
  habit: Habit,
  date: string,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  const completedAt = buildCompletedAtMarkdown(date, precision);
  return `${habit.name} 📅${completedAt} ❌`;
}

export function getRecordForDate(habit: Habit, date: string): CheckInRecord | null {
  const records = getRecordsForDate(habit, date);
  if (records.length === 0) {
    return null;
  }

  const missedRecord = records.find(record => getHabitRecordStatus(record) === 'missed');
  if (missedRecord) {
    return missedRecord;
  }

  if (habit.type === 'binary') {
    return records[0];
  }

  return records.reduce((best, record) => {
    const bestValue = best.currentValue ?? 0;
    const currentValue = record.currentValue ?? 0;
    return currentValue >= bestValue ? record : best;
  });
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
    console.warn('[HabitService] checkIn only for binary habits');
    return false;
  }

  // 检查是否已存在该日期的打卡记录
  const existingRecord = getRecordForDate(habit, date);
  if (existingRecord) {
    console.log('[HabitService] Already checked in for', date);
    return false;
  }

  const markdown = buildCheckInMarkdown(habit, date, undefined, precision);
  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer.insertAfter(markdown, previousId);
    } else {
      const result = await insertBlock('markdown', markdown, undefined, previousId);
      return isSuccessfulBlockOperationResult(result);
    }
  } catch (error) {
    console.error('[HabitService] checkIn failed:', error);
    return false;
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
    console.warn('[HabitService] checkInCount only for count habits');
    return false;
  }

  const dayRecord = getRecordForDate(habit, date);

  if (dayRecord) {
    if (getHabitRecordStatus(dayRecord) === 'missed') {
      console.log('[HabitService] Missed record exists for', date);
      return false;
    }

    // 更新现有记录
    const currentValue = (dayRecord.currentValue ?? 0) + incrementBy;
    return await setCheckInValue(habit, date, currentValue, writer, precision);
  }

  // 创建新记录
  const value = incrementBy;
  const markdown = buildCheckInMarkdown(habit, date, value, precision);

  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer.insertAfter(markdown, previousId);
    } else {
      const result = await insertBlock('markdown', markdown, undefined, previousId);
      return isSuccessfulBlockOperationResult(result);
    }
  } catch (error) {
    console.error('[HabitService] checkInCount failed:', error);
    return false;
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
    console.warn('[HabitService] setCheckInValue only for count habits');
    return false;
  }

  const existingRecord = getRecordForDate(habit, date);

  if (existingRecord) {
    if (getHabitRecordStatus(existingRecord) === 'missed') {
      console.log('[HabitService] Missed record exists for', date);
      return false;
    }

    // 更新现有记录 block
    const markdown = buildCheckInMarkdown(habit, date, value, precision);

    try {
      if (writer) {
        return await writer.update(markdown, existingRecord.blockId);
      } else {
        const result = await updateBlock('markdown', markdown, existingRecord.blockId);
        return isSuccessfulBlockOperationResult(result);
      }
    } catch (error) {
      console.error('[HabitService] setCheckInValue failed:', error);
      return false;
    }
  }

  // 创建新记录
  const markdown = buildCheckInMarkdown(habit, date, value, precision);
  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer.insertAfter(markdown, previousId);
    } else {
      const result = await insertBlock('markdown', markdown, undefined, previousId);
      return isSuccessfulBlockOperationResult(result);
    }
  } catch (error) {
    console.error('[HabitService] setCheckInValue failed:', error);
    return false;
  }
}

/**
 * 删除打卡记录
 */
export async function deleteCheckIn(record: CheckInRecord): Promise<boolean> {
  try {
    const result = await deleteBlock(record.blockId);
    return isSuccessfulBlockOperationResult(result);
  } catch (error) {
    console.error('[HabitService] deleteCheckIn failed:', error);
    return false;
  }
}

export async function markHabitMissed(
  habit: Habit,
  date: string,
  writer?: HabitBlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  const existingRecord = getRecordForDate(habit, date);
  if (existingRecord) {
    console.log('[HabitService] Record already exists for', date);
    return false;
  }

  const markdown = buildMissedCheckInMarkdown(habit, date, precision);
  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer.insertAfter(markdown, previousId);
    }

    const result = await insertBlock('markdown', markdown, undefined, previousId);
    return isSuccessfulBlockOperationResult(result);
  } catch (error) {
    console.error('[HabitService] markHabitMissed failed:', error);
    return false;
  }
}

export async function resetHabitRecord(record: CheckInRecord): Promise<boolean> {
  return await deleteCheckIn(record);
}

export async function getCheckInMarkdown(record: CheckInRecord): Promise<string | null> {
  try {
    const result = await getBlockKramdown(record.blockId);
    return result?.kramdown ?? null;
  } catch (error) {
    console.error('[HabitService] getCheckInMarkdown failed:', error);
    return null;
  }
}

export async function updateCheckInMarkdown(record: CheckInRecord, markdown: string): Promise<boolean> {
  try {
    const result = await updateBlock('markdown', markdown, record.blockId);
    return isSuccessfulBlockOperationResult(result);
  } catch (error) {
    console.error('[HabitService] updateCheckInMarkdown failed:', error);
    return false;
  }
}

export async function archiveHabit(habit: Habit, archiveDate: string): Promise<boolean> {
  if (habit.archivedAt) {
    return false;
  }

  try {
    const result = await getBlockKramdown(habit.blockId);
    const markdown = result?.kramdown;
    const nextMarkdown = markdown
      ? replaceHabitDefinitionLine(markdown, (line) => {
          if (!line || HABIT_ARCHIVE_MARKER_RE.test(line)) {
            return null;
          }

          return `${line} 📦${archiveDate}`;
        })
      : null;
    if (!nextMarkdown) {
      return false;
    }

    const updateResult = await updateBlock('markdown', nextMarkdown, habit.blockId);
    return isSuccessfulBlockOperationResult(updateResult);
  } catch (error) {
    console.error('[HabitService] archiveHabit failed:', error);
    return false;
  }
}

export async function unarchiveHabit(habit: Habit): Promise<boolean> {
  if (!habit.archivedAt) {
    return false;
  }

  try {
    const result = await getBlockKramdown(habit.blockId);
    const markdown = result?.kramdown;
    const nextMarkdown = markdown
      ? replaceHabitDefinitionLine(markdown, (line) => {
          if (!line) {
            return null;
          }

          const nextLine = line.replace(HABIT_ARCHIVE_MARKER_RE, '').trimEnd();
          if (nextLine === line) {
            return null;
          }

          return nextLine;
        })
      : null;
    if (!nextMarkdown) {
      return false;
    }

    const updateResult = await updateBlock('markdown', nextMarkdown, habit.blockId);
    return isSuccessfulBlockOperationResult(updateResult);
  } catch (error) {
    console.error('[HabitService] unarchiveHabit failed:', error);
    return false;
  }
}
