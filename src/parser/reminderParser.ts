/**
 * 提醒标记解析器（人类可读格式）
 * 支持格式（中英文）：
 * - 绝对时间: ⏰HH:mm 或 ⏰HH:mm:ss
 * - 相对开始时间: ⏰提前5分钟 / ⏰5 minutes before
 * - 相对结束时间: ⏰结束前30分钟 / ⏰30 minutes before end
 */

import type { ReminderConfig } from '@/types/models'
import { t } from '@/i18n'

// 单位到分钟的转换
const UNIT_TO_MINUTES: Record<string, number> = {
  m: 1,
  minutes: 1,
  分钟: 1,
  h: 60,
  hours: 60,
  小时: 60,
  d: 24 * 60,
  days: 24 * 60,
  天: 24 * 60,
}

const RELATIVE_TO_END_EN_RE = /⏰(?:结束前|(\d+)\s*(minutes?|hours?|days?|[mhd])\s*before\s*end)/i
const RELATIVE_TO_END_CN_RE = /⏰结束前(\d+)(分钟|小时|天)/
const RELATIVE_TO_START_EN_RE = /⏰(?:提前|(\d+)\s*(minutes?|hours?|days?|[mhd])\s*before(?!\s*end))/i
const RELATIVE_TO_START_CN_RE = /⏰提前(\d+)(分钟|小时|天)/
const ABSOLUTE_TIME_RE = /⏰(\d{2}:\d{2})(?::\d{2})?/
const STRIP_CN_RELATIVE_RE = /⏰\s*(?:提前|结束前)\s*\d+\s*(?:分钟|小时|天)/g
const STRIP_EN_RELATIVE_RE = /⏰\s*\d+\s*(?:minutes?|hours?|days?)\s*before(?:\s*end)?/gi
const STRIP_ABSOLUTE_TIME_RE = /⏰\s*\d{1,2}:\d{2}(?::\d{2})?/g
const MULTI_SPACE_RE = /\s+/g

/**
 * 解析提醒标记
 * @param line 行内容
 * @returns ReminderConfig | undefined
 */
export function parseReminderFromLine(line: string): ReminderConfig | undefined {
  // 1. 尝试匹配相对结束时间（中英文）
  // 中文: ⏰结束前5分钟
  // 英文: ⏰5 minutes before end / ⏰30m before end
  const relativeToEndMatch = line.match(RELATIVE_TO_END_EN_RE)
  if (relativeToEndMatch) {
    if (line.includes('结束前')) {
      // 中文格式
      const match = line.match(RELATIVE_TO_END_CN_RE)
      if (match) {
        const value = Number.parseInt(match[1], 10)
        const unit = match[2]
        const offsetMinutes = convertToMinutes(value, unit)
        return {
          enabled: true,
          type: 'relative',
          relativeTo: 'end',
          offsetMinutes,
        }
      }
    } else if (relativeToEndMatch[1]) {
      // 英文格式
      const value = Number.parseInt(relativeToEndMatch[1], 10)
      const unit = relativeToEndMatch[2].toLowerCase()
      const offsetMinutes = convertToMinutes(value, unit)
      return {
        enabled: true,
        type: 'relative',
        relativeTo: 'end',
        offsetMinutes,
      }
    }
  }

  // 2. 尝试匹配相对开始时间（中英文）
  // 中文: ⏰提前5分钟
  // 英文: ⏰5 minutes before / ⏰30m before
  const relativeToStartMatch = line.match(RELATIVE_TO_START_EN_RE)
  if (relativeToStartMatch) {
    if (line.includes('提前')) {
      // 中文格式
      const match = line.match(RELATIVE_TO_START_CN_RE)
      if (match) {
        const value = Number.parseInt(match[1], 10)
        const unit = match[2]
        const offsetMinutes = convertToMinutes(value, unit)
        return {
          enabled: true,
          type: 'relative',
          relativeTo: 'start',
          offsetMinutes,
        }
      }
    } else if (relativeToStartMatch[1]) {
      // 英文格式
      const value = Number.parseInt(relativeToStartMatch[1], 10)
      const unit = relativeToStartMatch[2].toLowerCase()
      const offsetMinutes = convertToMinutes(value, unit)
      return {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes,
      }
    }
  }

  // 3. 尝试匹配绝对时间
  // ⏰09:00 或 ⏰09:00:00
  const absoluteMatch = line.match(ABSOLUTE_TIME_RE)
  if (absoluteMatch) {
    const time = absoluteMatch[1]
    return {
      enabled: true,
      type: 'absolute',
      time,
      alertMode: { type: 'ontime' },
    }
  }

  return undefined
}

/**
 * 将时间单位转换为分钟
 */
function convertToMinutes(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase()
  const multiplier = UNIT_TO_MINUTES[normalizedUnit] || 1
  return value * multiplier
}

/**
 * 计算实际提醒时间
 * @param itemDate 事项日期 YYYY-MM-DD
 * @param startDateTime 开始日期时间 YYYY-MM-DD HH:mm:ss（可选，优先使用）
 * @param endDateTime 结束日期时间 YYYY-MM-DD HH:mm:ss（可选，优先使用）
 * @param startTime 开始时间 HH:mm:ss（可选，当 startDateTime 不存在时使用）
 * @param endTime 结束时间 HH:mm:ss（可选，当 endDateTime 不存在时使用）
 * @param reminder 提醒配置
 * @returns 提醒时间戳（毫秒）
 */
export function calculateReminderTime(
  itemDate: string,
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig,
): number {
  // console.log(`[calculateReminderTime] itemDate=${itemDate}, startDateTime=${startDateTime}, endDateTime=${endDateTime}, reminder=`, reminder);

  if (reminder.type === 'absolute' && reminder.time) {
    // 绝对时间：日期 + 时间
    const [hours, minutes] = reminder.time.split(':').map(Number)
    const date = new Date(itemDate)
    date.setHours(hours, minutes, 0, 0)
    const result = date.getTime()
    // console.log(`[calculateReminderTime] Absolute: ${reminder.time} -> ${new Date(result).toLocaleString()}`);
    return result
  }

  if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    const {
      relativeTo,
      offsetMinutes,
    } = reminder

    if (relativeTo === 'end') {
      // 相对结束时间：优先使用 endDateTime，否则用 itemDate + endTime
      const baseDateTime = endDateTime || (endTime ? `${itemDate} ${endTime}` : undefined)
      if (baseDateTime) {
        const result = new Date(baseDateTime).getTime() - offsetMinutes * 60 * 1000
        console.log(`[calculateReminderTime] Relative to end: ${baseDateTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`)
        return result
      } else {
        const date = new Date(itemDate)
        date.setHours(23, 59, 0, 0)
        const result = date.getTime() - offsetMinutes * 60 * 1000
        console.log(`[calculateReminderTime] Relative to end (no endTime): 23:59 - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`)
        return result
      }
    } else {
      // 相对开始时间（默认）：优先使用 startDateTime，否则用 itemDate + startTime
      const baseDateTime = startDateTime || (startTime ? `${itemDate} ${startTime}` : undefined)
      if (baseDateTime) {
        const result = new Date(baseDateTime).getTime() - offsetMinutes * 60 * 1000
        console.log(`[calculateReminderTime] Relative to start: ${baseDateTime} - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`)
        return result
      } else {
        const date = new Date(itemDate)
        date.setHours(0, 0, 0, 0)
        const result = date.getTime() - offsetMinutes * 60 * 1000
        console.log(`[calculateReminderTime] Relative to start (no startTime): 00:00 - ${offsetMinutes}min -> ${new Date(result).toLocaleString()}`)
        return result
      }
    }
  }

  console.log(`[calculateReminderTime] Invalid reminder config, returning 0`)
  return 0
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
    .replace(STRIP_CN_RELATIVE_RE, '')
    .replace(STRIP_EN_RELATIVE_RE, '')
    .replace(STRIP_ABSOLUTE_TIME_RE, '')
    .replace(MULTI_SPACE_RE, ' ')
    .trim()
}

/**
 * 生成提醒标记（人类可读格式）
 * @param reminder 提醒配置
 * @returns 标记字符串
 */
export function generateReminderMarker(reminder: ReminderConfig): string {
  if (!reminder.enabled) return ''

  if (reminder.type === 'absolute' && reminder.time) {
    return `⏰${reminder.time}`
  }

  if (reminder.type === 'relative' && reminder.offsetMinutes !== undefined) {
    const {
      relativeTo,
      offsetMinutes,
    } = reminder

    // 转换为合适的单位
    if (offsetMinutes % (24 * 60) === 0) {
      const days = offsetMinutes / (24 * 60)
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndDays', { count: String(days) })}`
        : `⏰${t('reminder.generate.beforeDays', { count: String(days) })}`
    } else if (offsetMinutes % 60 === 0) {
      const hours = offsetMinutes / 60
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndHours', { count: String(hours) })}`
        : `⏰${t('reminder.generate.beforeHours', { count: String(hours) })}`
    } else {
      return relativeTo === 'end'
        ? `⏰${t('reminder.generate.beforeEndMinutes', { count: String(offsetMinutes) })}`
        : `⏰${t('reminder.generate.beforeMinutes', { count: String(offsetMinutes) })}`
    }
  }

  return ''
}
