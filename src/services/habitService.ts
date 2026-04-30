/**
 * 习惯打卡服务
 * 负责创建、更新、删除打卡记录（SiYuan block 操作）
 */
import { insertBlock, updateBlock, deleteBlock, getBlockKramdown } from '@/api';
import type { Habit, CheckInRecord } from '@/types/models';
import type { BlockWriter } from '@/utils/fileUtils';

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
export function buildCheckInMarkdown(habit: Habit, date: string, currentValue?: number): string {
  if (habit.type === 'binary') {
    return `${habit.name} 📅${date} ✅`;
  }

  // 计数型
  const target = habit.target ?? 0;
  const unit = habit.unit ?? '';
  const value = currentValue ?? 0;
  const completed = value >= target;
  return `${habit.name} ${value}/${target}${unit} 📅${date}${completed ? ' ✅' : ''}`;
}

/**
 * 二元型打卡
 * 创建新的打卡记录 block
 */
export async function checkIn(
  habit: Habit,
  date: string,
  writer?: BlockWriter
): Promise<boolean> {
  if (habit.type !== 'binary') {
    console.warn('[HabitService] checkIn only for binary habits');
    return false;
  }

  // 检查是否已存在该日期的打卡记录
  const existingRecord = habit.records.find(r => r.date === date);
  if (existingRecord) {
    console.log('[HabitService] Already checked in for', date);
    return false;
  }

  const markdown = buildCheckInMarkdown(habit, date);
  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer(markdown, previousId);
    } else {
      await insertBlock('markdown', markdown, undefined, previousId);
      return true;
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
  writer?: BlockWriter
): Promise<boolean> {
  if (habit.type !== 'count') {
    console.warn('[HabitService] checkInCount only for count habits');
    return false;
  }

  const existingRecord = habit.records.find(r => r.date === date);

  if (existingRecord) {
    // 更新现有记录
    const currentValue = (existingRecord.currentValue ?? 0) + incrementBy;
    return await setCheckInValue(habit, date, currentValue, writer);
  }

  // 创建新记录
  const target = habit.target ?? 0;
  const unit = habit.unit ?? '';
  const value = incrementBy;
  const completed = value >= target;
  const markdown = `${habit.name} ${value}/${target}${unit} 📅${date}${completed ? ' ✅' : ''}`;

  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer(markdown, previousId);
    } else {
      await insertBlock('markdown', markdown, undefined, previousId);
      return true;
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
  writer?: BlockWriter
): Promise<boolean> {
  const existingRecord = habit.records.find(r => r.date === date);

  if (existingRecord) {
    // 更新现有记录 block
    const target = habit.target ?? existingRecord.targetValue ?? 0;
    const unit = habit.unit ?? existingRecord.unit ?? '';
    const completed = value >= target;
    const markdown = `${habit.name} ${value}/${target}${unit} 📅${date}${completed ? ' ✅' : ''}`;

    try {
      if (writer) {
        return await writer(markdown, existingRecord.blockId);
      } else {
        await updateBlock('markdown', markdown, existingRecord.blockId);
        return true;
      }
    } catch (error) {
      console.error('[HabitService] setCheckInValue failed:', error);
      return false;
    }
  }

  // 创建新记录
  const target = habit.target ?? 0;
  const unit = habit.unit ?? '';
  const completed = value >= target;
  const markdown = `${habit.name} ${value}/${target}${unit} 📅${date}${completed ? ' ✅' : ''}`;
  const previousId = findInsertAfterBlockId(habit, date);

  try {
    if (writer) {
      return await writer(markdown, previousId);
    } else {
      await insertBlock('markdown', markdown, undefined, previousId);
      return true;
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
    await deleteBlock(record.blockId);
    return true;
  } catch (error) {
    console.error('[HabitService] deleteCheckIn failed:', error);
    return false;
  }
}
