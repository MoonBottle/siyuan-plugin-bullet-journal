/**
 * 斜杠命令工具函数
 */

import { getSharedPinia } from '@/utils/sharedPinia';
import { useProjectStore } from '@/stores';
import { generateSlashPatterns, processLineText } from './stringUtils';

import type { Item } from '@/types/models';

export { generateSlashPatterns, processLineText };

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 从块内容中提取所有日期时间信息
 * 直接从 pinia store 中获取，避免重新解析
 * 包括 siblingItems 中的日期时间
 */
export async function extractDatesFromBlock(
  blockId: string
): Promise<Array<{ date: string; startDateTime?: string; endDateTime?: string }>> {
  const pinia = getSharedPinia();
  if (!pinia) return [];

  const projectStore = useProjectStore(pinia);
  const item = projectStore.getItemByBlockId(blockId);

  if (item) {
    const items: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = [
      { date: item.date, startDateTime: item.startDateTime, endDateTime: item.endDateTime }
    ];
    // 添加 siblingItems 中的日期时间
    if (item.siblingItems) {
      items.push(...item.siblingItems.map(s => ({
        date: s.date,
        startDateTime: s.startDateTime,
        endDateTime: s.endDateTime
      })));
    }
    return items;
  }

  return [];
}

/**
 * 找到离今天最近的日期
 * 规则：
 * 1. 如果有多个日期，找离今天最近的一天
 * 2. 间隔相同（今天前后各有一天），取今天之后的日期
 */
export function findNearestDate(items: Array<{ date: string }>): string {
  if (items.length === 0) {
    return formatDate(new Date()); // 今天
  }
  if (items.length === 1) {
    return items[0].date;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  let nearestDate = items[0].date;
  let minDiff = Math.abs(new Date(items[0].date).getTime() - todayTime);
  let isAfterToday = new Date(items[0].date).getTime() >= todayTime;

  for (let i = 1; i < items.length; i++) {
    const dateTime = new Date(items[i].date).getTime();
    const diff = Math.abs(dateTime - todayTime);
    const afterToday = dateTime >= todayTime;

    // 如果间隔更小，更新最近日期
    if (diff < minDiff) {
      minDiff = diff;
      nearestDate = items[i].date;
      isAfterToday = afterToday;
    }
    // 如果间隔相同，优先取今天之后的日期
    else if (diff === minDiff && afterToday && !isAfterToday) {
      nearestDate = items[i].date;
      isAfterToday = true;
    }
  }

  return nearestDate;
}

/**
 * 从块内容提取事项信息
 * 直接从 pinia store 中获取，避免重新解析
 */
export async function extractItemFromBlock(blockId: string): Promise<Item | null> {
  const pinia = getSharedPinia();
  if (!pinia) return null;

  const projectStore = useProjectStore(pinia);
  const item = projectStore.getItemByBlockId(blockId);

  return item || null;
}
