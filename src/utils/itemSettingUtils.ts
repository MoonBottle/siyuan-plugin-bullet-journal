/**
 * 事项设置工具函数
 * 用于保存提醒和重复设置到 SiYuan 块
 */

import type {
  Item,
  ReminderConfig,
  RepeatRule,
  EndCondition,
  PriorityLevel
} from '@/types/models';
import { getBlockByID, updateBlock } from '@/api';
import {
  generateReminderMarker,
  stripReminderMarker
} from '@/parser/reminderParser';
import {
  generateRepeatRuleMarker,
  generateEndConditionMarker,
  stripRecurringMarkers
} from '@/parser/recurringParser';
import { generatePriorityMarker } from '@/parser/priorityParser';

/**
 * 构建设置项内容选项
 */
export interface BuildItemContentOptions {
  /** 开始时间 (HH:mm) */
  startTime?: string;
  /** 结束时间 (HH:mm) */
  endTime?: string;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 提醒配置 */
  reminder?: ReminderConfig;
  /** 重复规则 */
  repeatRule?: RepeatRule;
  /** 结束条件 */
  endCondition?: EndCondition;
}

/**
 * 清理内容中的多余空格和制表符（保留换行）
 * @param content 原始内容
 * @returns 清理后的内容
 */
function normalizeWhitespace(content: string): string {
  return content.replace(/[ \t]+/g, ' ').trim();
}

/**
 * 获取块内容
 * @param blockId 块ID
 * @returns 块内容
 */
async function fetchBlockContent(blockId: string): Promise<string> {
  try {
    const block = await getBlockByID(blockId);
    if (!block) {
      throw new Error(`未找到块: ${blockId}`);
    }
    return block.markdown || block.content || '';
  } catch (error) {
    console.error(`获取块内容失败 (${blockId}):`, error);
    throw error;
  }
}

/**
 * 更新块内容
 * @param blockId 块ID
 * @param content 新内容
 */
async function updateBlockContent(blockId: string, content: string): Promise<void> {
  try {
    await updateBlock('markdown', content, blockId);
  } catch (error) {
    console.error(`更新块内容失败 (${blockId}):`, error);
    throw error;
  }
}

/**
 * 更新事项的提醒设置
 * @param item 事项对象
 * @param config 提醒配置
 */
export async function updateItemWithReminder(
  item: Item,
  config: ReminderConfig
): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  // 获取块内容
  const currentContent = await fetchBlockContent(item.blockId);

  // 移除旧的提醒标记
  let newContent = stripReminderMarker(currentContent);

  // 如果启用了提醒，添加新标记
  if (config.enabled) {
    const reminderMarker = generateReminderMarker(config);
    if (reminderMarker) {
      newContent = `${newContent} ${reminderMarker}`;
    }
  }

  // 清理多余空格（保留换行）
  newContent = normalizeWhitespace(newContent);

  // 更新块
  await updateBlockContent(item.blockId, newContent);
}

/**
 * 更新事项的重复设置
 * @param item 事项对象
 * @param repeatRule 重复规则（可选）
 * @param endCondition 结束条件（可选）
 */
export async function updateItemWithRecurring(
  item: Item,
  repeatRule?: RepeatRule,
  endCondition?: EndCondition
): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  // 获取块内容
  const currentContent = await fetchBlockContent(item.blockId);

  // 移除旧的重复和结束条件标记
  let newContent = stripRecurringMarkers(currentContent);

  // 添加新的重复规则标记
  if (repeatRule) {
    const repeatMarker = generateRepeatRuleMarker(repeatRule);
    if (repeatMarker) {
      newContent = `${newContent} ${repeatMarker}`;
    }
  }

  // 添加新的结束条件标记
  if (endCondition && endCondition.type !== 'never') {
    const endMarker = generateEndConditionMarker(endCondition);
    if (endMarker) {
      newContent = `${newContent} ${endMarker}`;
    }
  }

  // 清理多余空格（保留换行）
  newContent = normalizeWhitespace(newContent);

  // 更新块
  await updateBlockContent(item.blockId, newContent);
}

/**
 * 构建完整的事项内容
 * 用于 QuickCreate 功能，组合日期、优先级、提醒、重复等标记
 *
 * @param baseContent 基础内容（不含标记）
 * @param date 日期 (YYYY-MM-DD)
 * @param options 设置选项
 * @returns 完整的 markdown 内容
 */
export function buildItemContent(
  baseContent: string,
  date: string,
  options: BuildItemContentOptions = {}
): string {
  const { startTime, endTime, priority, reminder, repeatRule, endCondition } = options;

  // 构建日期部分（支持时间范围）
  let datePart = `📅${date}`;
  if (startTime && endTime) {
    datePart = `📅${date} ${startTime}~${endTime}`;
  } else if (startTime) {
    datePart = `📅${date} ${startTime}`;
  }
  let content = `${baseContent} ${datePart}`;

  // 添加优先级标记
  if (priority) {
    const priorityMarker = generatePriorityMarker(priority);
    if (priorityMarker) {
      content = `${content} ${priorityMarker}`;
    }
  }

  // 添加提醒标记
  if (reminder?.enabled) {
    const reminderMarker = generateReminderMarker(reminder);
    if (reminderMarker) {
      content = `${content} ${reminderMarker}`;
    }
  }

  // 添加重复规则标记
  if (repeatRule) {
    const repeatMarker = generateRepeatRuleMarker(repeatRule);
    if (repeatMarker) {
      content = `${content} ${repeatMarker}`;
    }
  }

  // 添加结束条件标记
  if (endCondition && endCondition.type !== 'never') {
    const endMarker = generateEndConditionMarker(endCondition);
    if (endMarker) {
      content = `${content} ${endMarker}`;
    }
  }

  return content;
}
