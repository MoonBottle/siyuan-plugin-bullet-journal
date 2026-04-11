/**
 * 优先级解析器
 * 处理事项优先级的解析、生成和排序
 */

import type { PriorityLevel } from '@/types/models';

/**
 * 优先级配置
 */
export const PRIORITY_CONFIG: Record<PriorityLevel, {
  emoji: string;
  label: string;
  sortOrder: number;
}> = {
  high:   { emoji: '🔥', label: '高优先级', sortOrder: 0 },
  medium: { emoji: '🌱', label: '中优先级', sortOrder: 1 },
  low:    { emoji: '🍃', label: '低优先级', sortOrder: 2 },
};

/**
 * 从行内容解析优先级
 * @param line 事项行内容
 * @returns PriorityLevel 或 undefined
 */
export function parsePriorityFromLine(line: string): PriorityLevel | undefined {
  if (line.includes('🔥')) return 'high';
  if (line.includes('🌱')) return 'medium';
  if (line.includes('🍃')) return 'low';
  return undefined;
}

/**
 * 移除优先级标记
 */
export function stripPriorityMarker(content: string): string {
  return content.replace(/[🔥🌱🍃]/gu, '').trim();
}

/**
 * 生成优先级标记
 */
export function generatePriorityMarker(priority: PriorityLevel): string {
  const emojiMap: Record<PriorityLevel, string> = {
    high: '🔥',
    medium: '🌱',
    low: '🍃',
  };
  return emojiMap[priority] || '';
}

/**
 * 获取优先级排序权重（越小越靠前）
 */
export function getPrioritySortOrder(priority?: PriorityLevel): number {
  const orderMap: Record<PriorityLevel, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return priority !== undefined ? orderMap[priority] : 3;
}

/**
 * 优先级比较函数（用于排序）
 * @returns 负数表示 a 在前，正数表示 b 在前
 */
export function comparePriority(
  a?: PriorityLevel,
  b?: PriorityLevel
): number {
  return getPrioritySortOrder(a) - getPrioritySortOrder(b);
}
