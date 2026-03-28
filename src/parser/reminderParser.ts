/**
 * 提醒标记解析器（人类可读格式）
 * 支持格式（中英文）：
 * - 绝对时间: ⏰HH:mm 或 ⏰HH:mm:ss
 * - 相对开始时间: ⏰提前5分钟 / ⏰5 minutes before
 * - 相对结束时间: ⏰结束前30分钟 / ⏰30 minutes before end
 */

import type { ReminderConfig } from '@/types/models';
import { t } from '@/i18n';

// 单位到分钟的转换
const UNIT_TO_MINUTES: Record<string, number> = {
  'm': 1,
  'minutes': 1,
  '分钟': 1,
  'h': 60,
  'hours': 60,
  '小时': 60,
  'd': 24 * 60,
  'days': 24 * 60,
  '天': 24 * 60
};

/**
 * 解析提醒标记
 * @param line 行内容
 * @returns ReminderConfig | undefined
 */
export function parseReminderFromLine(line: string): ReminderConfig | undefined {
  // 1. 尝试匹配相对结束时间（中英文）
  // 中文: ⏰结束前5分钟
  // 英文: ⏰5 minutes before end / ⏰30m before end
  const relativeToEndMatch = line.match(/⏰(?:结束前|(\d+)\s*(minutes?|hours?|days?|m|h|d)\s*before\s*end)/i);
  if (relativeToEndMatch) {
    if (line.includes('结束前')) {
      // 中文格式
      const match = line.match(/⏰结束前(\d+)(分钟|小时|天)/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const offsetMinutes = convertToMinutes(value, unit);
        return {
          enabled: true,
          type: 'relative',
          relativeTo: 'end',
          offsetMinutes
        };
      }
    } else if (relativeToEndMatch[1]) {
      // 英文格式
      const value = parseInt(relativeToEndMatch[1], 10);
      const unit = relativeToEndMatch[2].toLowerCase();
      const offsetMinutes = convertToMinutes(value, unit);
      return {
        enabled: true,
        type: 'relative',
        relativeTo: 'end',
        offsetMinutes
      };
    }
  }

  // 2. 尝试匹配相对开始时间（中英文）
  // 中文: ⏰提前5分钟
  // 英文: ⏰5 minutes before / ⏰30m before
  const relativeToStartMatch = line.match(/⏰(?:提前|(\d+)\s*(minutes?|hours?|days?|m|h|d)\s*before(?!\s*end))/i);
  if (relativeToStartMatch) {
    if (line.includes('提前')) {
      // 中文格式
      const match = line.match(/⏰提前(\d+)(分钟|小时|天)/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const offsetMinutes = convertToMinutes(value, unit);
        return {
          enabled: true,
          type: 'relative',
          relativeTo: 'start',
          offsetMinutes
        };
      }
    } else if (relativeToStartMatch[1]) {
      // 英文格式
      const value = parseInt(relativeToStartMatch[1], 10);
      const unit = relativeToStartMatch[2].toLowerCase();
      const offsetMinutes = convertToMinutes(value, unit);
      return {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes
      };
    }
  }

  // 3. 尝试匹配绝对时间
  // ⏰09:00 或 ⏰09:00:00
  const absoluteMatch = line.match(/⏰(\d{2}:\d{2})(?::\d{2})?/);
  if (absoluteMatch) {
    const time = absoluteMatch[1];
    return {
      enabled: true,
      type: 'absolute',
      time,
      alertMode: { type: 'ontime' }
    };
  }

  return undefined;
}

/**
 * 将时间单位转换为分钟
 */
function convertToMinutes(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase();
  const multiplier = UNIT_TO_MINUTES[normalizedUnit] || 1;
  return value * multiplier;
}

/**
 * 计算实际提醒时间
 * @param itemDate 事项日期 YYYY-MM-DD
 * @param startTime 开始时间 HH:mm:ss（可选）
 * @param endTime 结束时间 HH:mm:ss（可选）
 * @param reminder 提醒配置
 * @returns 提醒时间戳（毫秒）
 */
export function calculateReminderTime(
  itemDate: string,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig
): number {
  console.log(`[calculateReminderTime] itemDate=${itemDate}, startTime=${startTime}, endTime=${endTime}, reminder=`, reminder);

  if (reminder.type === 'absolute' && reminder.time) {
    // 绝对时间：日期 + 时间
    const [hours, minutes] = reminder.time.split(':').map(Number);
    const date = new Date(itemDate);
    date.setHours(hours, minutes, 0, 0);
    const result = date.getTime();
    console.log(`[calculateReminderTime] Absolute: ${reminder.time} -> ${new Date(result).toLocaleString()}`);
    return result;
  }

  if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    const { relativeTo, offsetMinutes } = reminder;

    if (relativeTo === 'end') {
      // 相对结束时间
      if (endTime) {
        const baseTime = parseTime(endTime);
        const date = new Date(itemDate);
        date.setHours(baseTime.hours, baseTime.minutes, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to end: ${endTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      } else {
        const date = new Date(itemDate);
        date.setHours(23, 59, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to end (no endTime): 23:59 - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      }
    } else {
      // 相对开始时间（默认）
      if (startTime) {
        const baseTime = parseTime(startTime);
        const date = new Date(itemDate);
        date.setHours(baseTime.hours, baseTime.minutes, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to start: ${startTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      } else {
        const date = new Date(itemDate);
        date.setHours(0, 0, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to start (no startTime): 00:00 - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      }
    }
  }

  console.log(`[calculateReminderTime] Invalid reminder config, returning 0`);
  return 0;
}

/**
 * 解析时间字符串
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0], 10),
    minutes: parseInt(parts[1], 10)
  };
}

/**
 * 从行内容中移除提醒标记
 * @param content 内容
 * @returns 清理后的内容
 */
export function stripReminderMarker(content: string): string {
  // 匹配所有可能的提醒格式：
  // 1. 中文相对时间: ⏰提前5分钟, ⏰结束前30分钟, ⏰提前1小时, ⏰提前1天
  // 2. 英文相对时间: ⏰5 minutes before, ⏰30 minutes before end, ⏰1 hour before
  // 3. 绝对时间: ⏰09:00, ⏰09:00:00
  return content
    .replace(/⏰\s*(?:提前|结束前)\s*\d+\s*(?:分钟|小时|天)/g, '')
    .replace(/⏰\s*\d+\s*(?:minutes?|hours?|days?)\s*before(?:\s*end)?/gi, '')
    .replace(/⏰\s*\d{1,2}:\d{2}(?::\d{2})?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 生成提醒标记（人类可读格式）
 * @param reminder 提醒配置
 * @returns 标记字符串
 */
export function generateReminderMarker(reminder: ReminderConfig): string {
  if (!reminder.enabled) return '';

  if (reminder.type === 'absolute' && reminder.time) {
    return `⏰${reminder.time}`;
  }

  if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    const { relativeTo, offsetMinutes } = reminder;

    // 转换为合适的单位
    if (offsetMinutes % (24 * 60) === 0) {
      const days = offsetMinutes / (24 * 60);
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndDays', { count: String(days) })}`
        : `⏰${t('reminder.generate.beforeDays', { count: String(days) })}`;
    } else if (offsetMinutes % 60 === 0) {
      const hours = offsetMinutes / 60;
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndHours', { count: String(hours) })}`
        : `⏰${t('reminder.generate.beforeHours', { count: String(hours) })}`;
    } else {
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndMinutes', { count: String(offsetMinutes) })}`
        : `⏰${t('reminder.generate.beforeMinutes', { count: String(offsetMinutes) })}`;
    }
  }

  return '';
}
