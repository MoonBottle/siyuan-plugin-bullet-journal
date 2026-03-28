/**
 * 提醒标记解析器
 * 支持格式：
 * - 绝对时间: ⏰HH:mm 或 ⏰HH:mm:ss
 * - 相对开始时间: ⏰-Xm (分钟) / ⏰-Xh (小时) / ⏰-Xd (天)
 * - 相对结束时间: ⏰e-Xm / ⏰e-Xh / ⏰e-Xd
 */

import type { ReminderConfig } from '@/types/models';

// 正则匹配规则
const PATTERNS = {
  // 相对结束时间: ⏰e-5m / ⏰e-5h / ⏰e-5d（e = end，基于结束时间）
  relativeToEnd: /⏰e-(\d+)(分钟|m|小时|h|天|d)/i,
  // 相对开始时间: ⏰-5m / ⏰-5h / ⏰-5d（基于开始时间）
  relativeToStart: /⏰-(\d+)(分钟|m|小时|h|天|d)/i,
  // 绝对时间: ⏰09:00 或 ⏰09:00:00
  absolute: /⏰(\d{2}:\d{2})(?::\d{2})?/
};

/**
 * 解析提醒标记
 * @param line 行内容
 * @returns ReminderConfig | undefined
 */
export function parseReminderFromLine(line: string): ReminderConfig | undefined {
  // 按优先级匹配：相对结束时间 > 相对开始时间 > 绝对时间
  
  // 1. 尝试匹配相对结束时间
  const relativeToEndMatch = line.match(PATTERNS.relativeToEnd);
  if (relativeToEndMatch) {
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

  // 2. 尝试匹配相对开始时间
  const relativeToStartMatch = line.match(PATTERNS.relativeToStart);
  if (relativeToStartMatch) {
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

  // 3. 尝试匹配绝对时间
  const absoluteMatch = line.match(PATTERNS.absolute);
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
  switch (unit) {
    case 'm':
    case '分钟':
      return value;
    case 'h':
    case '小时':
      return value * 60;
    case 'd':
    case '天':
      return value * 60 * 24;
    default:
      return value;
  }
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
    date.setHours(hours, minutes, 0, 0); // 秒数统一为 00
    const result = date.getTime();
    console.log(`[calculateReminderTime] Absolute: ${reminder.time} -> ${new Date(result).toLocaleString()}`);
    return result;
  }

  if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    const { relativeTo, offsetMinutes } = reminder;
    
    if (relativeTo === 'end') {
      // 相对结束时间
      if (endTime) {
        // 有结束时间：基于结束时间计算
        const baseTime = parseTime(endTime);
        const date = new Date(itemDate);
        date.setHours(baseTime.hours, baseTime.minutes, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to end: ${endTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      } else {
        // 无结束时间：基于 23:59:59 计算
        const date = new Date(itemDate);
        date.setHours(23, 59, 0, 0); // 秒数 00
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to end (no endTime): 23:59 - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      }
    } else {
      // 相对开始时间（默认）
      if (startTime) {
        // 有开始时间：基于开始时间计算
        const baseTime = parseTime(startTime);
        const date = new Date(itemDate);
        date.setHours(baseTime.hours, baseTime.minutes, 0, 0);
        const result = date.getTime() - offsetMinutes * 60 * 1000;
        console.log(`[calculateReminderTime] Relative to start: ${startTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`);
        return result;
      } else {
        // 无开始时间：基于 00:00 计算
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
  return content
    .replace(/⏰e-\d+(分钟|m|小时|h|天|d)/gi, '')
    .replace(/⏰-\d+(分钟|m|小时|h|天|d)/g, '')
    .replace(/⏰\d{2}:\d{2}(?::\d{2})?/g, '')
    .trim();
}

/**
 * 生成提醒标记
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
    const prefix = relativeTo === 'end' ? '⏰e-' : '⏰-';
    
    // 转换为合适的单位
    if (offsetMinutes % (24 * 60) === 0) {
      return `${prefix}${offsetMinutes / (24 * 60)}d`;
    } else if (offsetMinutes % 60 === 0) {
      return `${prefix}${offsetMinutes / 60}h`;
    } else {
      return `${prefix}${offsetMinutes}m`;
    }
  }

  return '';
}
