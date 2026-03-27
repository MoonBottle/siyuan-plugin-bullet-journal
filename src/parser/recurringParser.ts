/**
 * 重复事项标记解析器
 * 支持格式：
 * - 🔁每天 / 🔁daily
 * - 🔁每周 / 🔁weekly
 * - 🔁每月 / 🔁monthly
 * - 🔁每月:15日 / 🔁monthly:15（每月指定日期）
 * - 🔁每年 / 🔁yearly
 * - 🔁工作日 / 🔁workday
 * 
 * 结束条件：
 * - 🔚YYYY-MM-DD（按日期结束）
 * - 🔢N（按次数结束，创建时递减）
 */

import type { RepeatRule, EndCondition, RepeatRuleType } from '@/types/models';

// 重复规则映射（支持中英文）
const REPEAT_RULE_MAP: Record<string, RepeatRuleType> = {
  // 中文
  '每天': 'daily',
  '每周': 'weekly',
  '每月': 'monthly',
  '每年': 'yearly',
  '工作日': 'workday',
  // 英文
  'daily': 'daily',
  'weekly': 'weekly',
  'monthly': 'monthly',
  'yearly': 'yearly',
  'workday': 'workday'
};

// 重复规则正则
const REPEAT_RULE_REGEX = /🔁(每天|每周|每月|每年|工作日|daily|weekly|monthly|yearly|workday)(?::(\d+)日?)?/i;

// 结束条件正则
const END_DATE_REGEX = /🔚(\d{4}-\d{2}-\d{2})/;
const END_COUNT_REGEX = /🔢(\d+)/;

/**
 * 解析重复规则
 * @param line 行内容
 * @returns RepeatRule | undefined
 */
export function parseRepeatRule(line: string): RepeatRule | undefined {
  const match = line.match(REPEAT_RULE_REGEX);
  if (!match) return undefined;

  const ruleKey = match[1].toLowerCase();
  const dayOfMonth = match[2] ? parseInt(match[2], 10) : undefined;
  
  const type = REPEAT_RULE_MAP[ruleKey];
  if (!type) return undefined;

  return {
    type,
    dayOfMonth
  };
}

/**
 * 解析结束条件
 * @param line 行内容
 * @returns EndCondition | undefined
 */
export function parseEndCondition(line: string): EndCondition | undefined {
  // 检查日期结束条件
  const dateMatch = line.match(END_DATE_REGEX);
  if (dateMatch) {
    return {
      type: 'date',
      endDate: dateMatch[1]
    };
  }

  // 检查次数结束条件
  const countMatch = line.match(END_COUNT_REGEX);
  if (countMatch) {
    return {
      type: 'count',
      maxCount: parseInt(countMatch[1], 10)
    };
  }

  return undefined;
}

/**
 * 检查是否有重复规则（用于多日期与重复互斥时的判断）
 * @param line 行内容
 */
export function hasRepeatRule(line: string): boolean {
  return REPEAT_RULE_REGEX.test(line);
}

/**
 * 从行内容中移除重复和结束条件标记
 * @param content 内容
 * @returns 清理后的内容
 */
export function stripRecurringMarkers(content: string): string {
  return content
    .replace(REPEAT_RULE_REGEX, '')
    .replace(END_DATE_REGEX, '')
    .replace(END_COUNT_REGEX, '')
    .trim();
}

/**
 * 计算下次日期
 * @param currentDate 当前日期 YYYY-MM-DD
 * @param repeatRule 重复规则
 * @returns 下次日期 YYYY-MM-DD
 */
export function getNextOccurrenceDate(
  currentDate: string,
  repeatRule: RepeatRule
): string {
  const date = new Date(currentDate);
  const { type, dayOfMonth } = repeatRule;

  switch (type) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;

    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;

    case 'monthly':
      if (dayOfMonth !== undefined) {
        // 指定每月几号
        // 从当前日期往后找下个指定日期
        date.setMonth(date.getMonth() + 1);
        date.setDate(dayOfMonth);
      } else {
        // 保持当前日号
        const currentDay = date.getDate();
        date.setMonth(date.getMonth() + 1);
        
        // 边界处理：如果日期变成了下个月的月初，说明当月没有这一天
        // 比如 1月31日 → 2月（没有31日）→ 调整为2月最后一天
        if (date.getDate() !== currentDay) {
          date.setDate(0); // 设置为上月最后一天，即当月最后一天
        }
      }
      break;

    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;

    case 'workday':
      // 简单实现：+1天，如果是周末则跳过
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;

    default:
      date.setDate(date.getDate() + 1);
  }

  return formatDate(date);
}

/**
 * 检查是否满足结束条件
 * @param nextDate 下次日期
 * @param endCondition 结束条件
 * @param currentCount 当前已创建次数（可选）
 * @returns { canCreate: boolean; reason?: string }
 */
export function checkEndCondition(
  nextDate: string,
  endCondition: EndCondition | undefined,
  _currentCount?: number
): { canCreate: boolean; reason?: string } {
  if (!endCondition || endCondition.type === 'never') {
    return { canCreate: true };
  }

  if (endCondition.type === 'date' && endCondition.endDate) {
    if (nextDate > endCondition.endDate) {
      return {
        canCreate: false,
        reason: `已超过结束日期 ${endCondition.endDate}`
      };
    }
  }

  if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
    // 次数检查在创建时通过递减处理
    // 这里只检查是否已为 0
    if (endCondition.maxCount <= 0) {
      return {
        canCreate: false,
        reason: '已达到最大次数限制'
      };
    }
  }

  return { canCreate: true };
}

/**
 * 生成重复规则标记
 * @param repeatRule 重复规则
 * @returns 标记字符串
 */
export function generateRepeatRuleMarker(repeatRule: RepeatRule): string {
  const { type, dayOfMonth } = repeatRule;
  
  // 中文优先
  const typeMap: Record<RepeatRuleType, string> = {
    'daily': '每天',
    'weekly': '每周',
    'monthly': '每月',
    'yearly': '每年',
    'workday': '工作日'
  };

  const typeStr = typeMap[type] || type;
  
  if (type === 'monthly' && dayOfMonth !== undefined) {
    return `🔁每月:${dayOfMonth}日`;
  }

  return `🔁${typeStr}`;
}

/**
 * 生成结束条件标记
 * @param endCondition 结束条件
 * @returns 标记字符串
 */
export function generateEndConditionMarker(endCondition: EndCondition | undefined): string {
  if (!endCondition || endCondition.type === 'never') {
    return '';
  }

  if (endCondition.type === 'date' && endCondition.endDate) {
    return `🔚${endCondition.endDate}`;
  }

  if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
    return `🔢${endCondition.maxCount}`;
  }

  return '';
}

/**
 * 递减次数
 * @param endCondition 结束条件
 * @returns 新的结束条件
 */
export function decrementCount(endCondition: EndCondition | undefined): EndCondition | undefined {
  if (!endCondition || endCondition.type !== 'count') {
    return endCondition;
  }

  const newMaxCount = (endCondition.maxCount || 0) - 1;
  
  return {
    ...endCondition,
    maxCount: Math.max(0, newMaxCount)
  };
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
