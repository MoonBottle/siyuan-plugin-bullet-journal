/**
 * 重复事项服务
 * 处理完成时自动创建下次 occurrence
 */

import type { Plugin } from 'siyuan';
import type { Item } from '@/types/models';
import {
  getNextOccurrenceDate,
  checkEndCondition,
  generateRepeatRuleMarker
} from '@/parser/recurringParser';
import * as siyuanAPI from '@/api';
import { getSharedPinia } from '@/utils/sharedPinia';
import { useProjectStore } from '@/stores';

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
 * 获取同一文档中的下一个事项
 * @param item 当前事项
 * @returns 下一个事项的 blockId，如果没有则返回 null
 */
function getNextItemBlockId(item: Item): string | null {
  const pinia = getSharedPinia();
  if (!pinia) return null;

  const projectStore = useProjectStore(pinia);
  
  // 获取同一文档中的所有事项
  const docItems: Item[] = [];
  projectStore.projects.forEach(project => {
    project.tasks?.forEach(task => {
      task.items?.forEach(taskItem => {
        if (taskItem.docId === item.docId) {
          docItems.push(taskItem);
        }
      });
    });
  });

  // 按行号排序
  docItems.sort((a, b) => a.lineNumber - b.lineNumber);

  // 找到当前事项的索引
  const currentIndex = docItems.findIndex(i => i.blockId === item.blockId);
  if (currentIndex === -1) return null;

  // 获取下一个事项
  const nextItem = docItems[currentIndex + 1];
  return nextItem?.blockId || null;
}

/**
 * 获取文档的最后一个块 ID
 * @param docId 文档 ID（root_id）
 * @returns 最后一个块的 ID
 */
async function getDocLastBlockId(docId: string): Promise<string | null> {
  try {
    // 查询文档中 path 最长的块（即嵌套层级最深的块）
    // 按 path 长度降序、updated 降序排序
    const sqlScript = `SELECT id FROM blocks 
      WHERE root_id = '${docId}'
      ORDER BY LENGTH(path) DESC, updated DESC 
      LIMIT 1`;
    
    const blocks = await siyuanAPI.sql(sqlScript);
    
    if (blocks && blocks.length > 0) {
      return blocks[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('[RecurringService] Failed to get doc last block:', error);
    return null;
  }
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

    // 获取同一文档中的下一个事项
    const nextItemBlockId = getNextItemBlockId(item);

    let result;
    if (nextItemBlockId) {
      // 有下一个事项，插入到它前面
      result = await siyuanAPI.insertBlock(
        'markdown',
        newBlockContent,
        nextItemBlockId,  // 插入到下一个事项前面
        undefined,
        undefined
      );
    } else {
      // 没有下一个事项，插入到文档末尾
      const lastBlockId = await getDocLastBlockId(item.docId);
      if (lastBlockId) {
        result = await siyuanAPI.insertBlock(
          'markdown',
          newBlockContent,
          undefined,
          lastBlockId,  // 插入到最后一个块后面
          undefined
        );
      } else {
        // 兜底：插入到当前块后面
        result = await siyuanAPI.insertBlock(
          'markdown',
          newBlockContent,
          undefined,
          item.blockId,
          undefined
        );
      }
    }

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
  const { content, reminder, repeatRule, endCondition } = item;

  // 构建日期部分
  let datePart = `@${nextDate}`;
  
  // 如果有时间范围，保持时间
  if (item.startDateTime && item.endDateTime) {
    const startTime = item.startDateTime.split(' ')[1];
    const endTime = item.endDateTime.split(' ')[1];
    datePart = `@${nextDate} ${startTime}~${endTime}`;
  } else if (item.startDateTime) {
    const startTime = item.startDateTime.split(' ')[1];
    datePart = `@${nextDate} ${startTime}`;
  }

  // 构建提醒部分
  let reminderPart = '';
  if (reminder?.enabled) {
    if (reminder.type === 'absolute' && reminder.time) {
      reminderPart = ` ⏰${reminder.time}`;
    } else if (reminder.type === 'relative') {
      const prefix = reminder.relativeTo === 'end' ? '⏰e-' : '⏰-';
      const offset = reminder.offsetMinutes || 0;
      if (offset % (24 * 60) === 0) {
        reminderPart = ` ${prefix}${offset / (24 * 60)}d`;
      } else if (offset % 60 === 0) {
        reminderPart = ` ${prefix}${offset / 60}h`;
      } else {
        reminderPart = ` ${prefix}${offset}m`;
      }
    }
  }

  // 构建重复规则部分
  const repeatPart = repeatRule ? ` ${generateRepeatRuleMarker(repeatRule)}` : '';

  // 构建结束条件部分（次数递减）
  let endConditionPart = '';
  if (endCondition) {
    if (endCondition.type === 'date' && endCondition.endDate) {
      endConditionPart = ` 🔚${endCondition.endDate}`;
    } else if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
      const newCount = endCondition.maxCount - 1;
      if (newCount > 0) {
        endConditionPart = ` 🔢${newCount}`;
      }
      // 如果递减后为 0，不显示标记
    }
  }

  return `${content} ${datePart}${reminderPart}${repeatPart}${endConditionPart}`;
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
