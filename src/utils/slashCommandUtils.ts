/**
 * 斜杠命令工具函数
 * 纯函数，无 Vue/siyuan 依赖，便于测试
 */

import { getSharedPinia } from '@/utils/sharedPinia';
import { useProjectStore } from '@/stores';
import { findItemByBlockId } from '@/utils/itemBlockUtils';
import type { Item } from '@/types/models';

/**
 * 生成所有可能的子集命令（如 /sx -> /s）
 * @param filters 可能的斜杠命令前缀数组
 * @returns 所有子集命令的集合
 */
export function generateSlashPatterns(filters: string[]): Set<string> {
  const allPatterns = new Set<string>();
  for (const filter of filters) {
    // 添加完整 filter
    allPatterns.add(filter);
    // 添加所有前缀（从 / 后开始，至少保留 / 和一个字符）
    for (let i = 2; i < filter.length; i++) {
      allPatterns.add(filter.substring(0, i));
    }
  }
  return allPatterns;
}

/**
 * 处理行文本，删除所有匹配的斜杠命令
 * @param lineText 行文本
 * @param filters 可能的斜杠命令前缀数组
 * @returns 处理后的行文本
 */
export function processLineText(lineText: string, filters: string[]): string {
  const allPatterns = generateSlashPatterns(filters);

  // 将 patterns 按长度降序排序，确保从长到短匹配（/gtt -> /gt -> /g）
  const sortedPatterns = Array.from(allPatterns).sort((a, b) => b.length - a.length);

  // 删除行中所有匹配的 pattern
  let result = lineText;
  for (const pattern of sortedPatterns) {
    if (result.includes(pattern)) {
      // 使用正则全局替换，删除所有出现的 pattern
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      result = result.replace(regex, '');
    }
  }

  // 去除尾部空格
  result = result.trimEnd();

  return result;
}

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
  const item = findItemByBlockId(blockId, projectStore.items);

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
  const item = findItemByBlockId(blockId, projectStore.items);

  return item || null;
}
