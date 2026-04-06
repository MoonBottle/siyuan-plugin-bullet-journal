/**
 * 重复事项服务
 * 处理完成时自动创建下次 occurrence
 */

import type { Plugin } from 'siyuan';
import type { Item } from '@/types/models';
import {
  getNextOccurrenceDate,
  checkEndCondition,
  generateRepeatRuleMarker,
  generateEndConditionMarker,
  stripRecurringMarkers
} from '@/parser/recurringParser';
import { generateReminderMarker, stripReminderMarker } from '@/parser/reminderParser';
import * as siyuanAPI from '@/api';

/**
 * 检查是否需要创建下次
 */
export function shouldCreateNextOccurrence(item: Item): boolean {
  // 必须有重复规则
  if (!item.repeatRule) return false;
  
  // 必须已完成
  if (item.status !== 'completed') return false;

  // 检查结束条件
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule);
  const checkResult = checkEndCondition(nextDate, item.endCondition);
  
  if (!checkResult.canCreate) {
    console.log(`[RecurringService] Cannot create next: ${checkResult.reason}`);
    return false;
  }

  return true;
}

/**
 * 创建下次 occurrence
 * @param plugin 插件实例
 * @param item 当前事项
 * @returns 是否成功创建
 */
export async function createNextOccurrence(
  _plugin: Plugin,
  item: Item
): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false;

  // 计算下次日期
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule);

  // 检查结束条件
  const checkResult = checkEndCondition(nextDate, item.endCondition);
  if (!checkResult.canCreate) {
    console.log(`[RecurringService] ${checkResult.reason}`);
    return false;
  }

  try {
    // 构建新的 block 内容
    const newBlockContent = buildNextOccurrenceBlock(item, nextDate);

    // 确定插入点：
    // 1. 对于任务列表事项，使用 listItemBlockId（在列表项后面插入，保持平级）
    // 2. 其他情况使用 lastBlockId（在相关内容后面插入）
    const insertAfterId = item.isTaskList 
      ? (item.listItemBlockId || item.blockId)
      : (item.lastBlockId || item.blockId);
    
    if (!insertAfterId) {
      console.error('[RecurringService] No insert point found');
      return false;
    }
    
    console.log(`[RecurringService] Inserting after block: ${insertAfterId}, isTaskList: ${item.isTaskList}`);

    // 在最后一个相关块后插入新事项
    const result = await siyuanAPI.insertBlock(
      'markdown',
      newBlockContent,
      undefined,
      insertAfterId,
      undefined
    );

    if (result && result[0]) {
      console.log(`[RecurringService] Created next occurrence: ${nextDate}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[RecurringService] Failed to create next occurrence:', error);
    return false;
  }
}

/**
 * 构建下次 occurrence 的 block 内容
 */
function buildNextOccurrenceBlock(item: Item, nextDate: string): string {
  const { reminder, repeatRule, endCondition } = item;
  
  // 清理内容：使用解析器的 strip 函数
  let content = stripRecurringMarkers(stripReminderMarker(item.content))
    .replace(/[@📅]\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')  // 日期和时间
    .replace(/[✅❌✔️]/gu, '')  // 完成标记
    .trim();

  // 构建日期部分（使用 📅 emoji）
  let datePart = `📅${nextDate}`;
  
  // 如果有时间范围，保持时间
  if (item.startDateTime && item.endDateTime) {
    const startTime = item.startDateTime.split(' ')[1];
    const endTime = item.endDateTime.split(' ')[1];
    datePart = `📅${nextDate} ${startTime}~${endTime}`;
  } else if (item.startDateTime) {
    const startTime = item.startDateTime.split(' ')[1];
    datePart = `📅${nextDate} ${startTime}`;
  }

  // 构建提醒部分（使用新的生成器）
  const reminderPart = reminder?.enabled ? ` ${generateReminderMarker(reminder)}` : '';

  // 构建重复规则部分
  const repeatPart = repeatRule ? ` ${generateRepeatRuleMarker(repeatRule)}` : '';

  // 构建结束条件部分（次数递减）
  let endConditionPart = '';
  if (endCondition) {
    if (endCondition.type === 'date' && endCondition.endDate) {
      endConditionPart = ` ${generateEndConditionMarker(endCondition)}`;
    } else if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
      const newCount = endCondition.maxCount - 1;
      if (newCount > 0) {
        endConditionPart = ` ${generateEndConditionMarker({ ...endCondition, maxCount: newCount })}`;
      }
      // 如果递减后为 0，不显示标记
    }
  }

  let result = `${content} ${datePart}${reminderPart}${repeatPart}${endConditionPart}`;
  
  // 如果是任务列表格式，添加任务列表标记（- [ ]）
  if (item.isTaskList) {
    result = `- [ ] ${result}`;
  }
  
  return result;
}

/**
 * 跳过本次（直接修改当前事项日期）
 * @param plugin 插件实例
 * @param item 当前事项
 * @returns 是否成功修改
 */
export async function skipCurrentOccurrence(
  _plugin: Plugin,
  item: Item
): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false;

  // 计算下次日期
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule);

  try {
    // 构建新的 block 内容（保持其他配置，只改日期）
    const newBlockContent = buildNextOccurrenceBlock(item, nextDate);

    // 更新当前 block
    const result = await siyuanAPI.updateBlock(
      'markdown',
      newBlockContent,
      item.blockId
    );

    if (result && result[0]) {
      console.log(`[RecurringService] Skipped to: ${nextDate}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[RecurringService] Failed to skip occurrence:', error);
    return false;
  }
}

/**
 * 检查事项是否过期
 */
export function isItemExpired(item: Item): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const itemDate = new Date(item.date);
  itemDate.setHours(0, 0, 0, 0);
  
  return itemDate <= today && item.status === 'pending';
}
