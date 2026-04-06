/**
 * 重复事项标记解析器（人类可读格式，中英文）
 * 支持格式：
 * - 🔁每天 / 🔁daily
 * - 🔁每周 / 🔁weekly
 * - 🔁每月3日 / 🔁monthly on day 3
 * - 🔁每周一三五 / 🔁weekly on Mon,Wed,Fri
 * - 截止到2026-12-31 / until 2026-12-31
 * - 剩余5次 / 5 times remaining
 */

import type { RepeatRule, EndCondition, RepeatRuleType } from '@/types/models';
import { t } from '@/i18n';

// 重复规则类型映射（解析用）
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

// 中文周几到数字的映射（紧凑格式）
const CHINESE_WEEKDAY_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
};

// 英文周几缩写到数字的映射
const ENGLISH_WEEKDAY_MAP: Record<string, number> = {
  'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
};

/**
 * 解析重复规则
 * @param line 行内容
 * @returns RepeatRule | undefined
 */
export function parseRepeatRule(line: string): RepeatRule | undefined {
  // 尝试匹配带参数的格式
  // 中文: 🔁每月3日
  // 英文: 🔁monthly on day 3
  const monthlyWithDayMatch = line.match(/🔁(?:每月(\d+)日|monthly\s+on\s+day\s+(\d+))/i);
  if (monthlyWithDayMatch) {
    const dayOfMonth = parseInt(monthlyWithDayMatch[1] || monthlyWithDayMatch[2], 10);
    return { type: 'monthly', dayOfMonth };
  }

  // 中文: 🔁每周一三五（紧凑格式）
  // 英文: 🔁weekly on Mon,Wed,Fri 或 🔁weekly on Mon Wed Fri
  const weeklyWithDaysMatch = line.match(/🔁(?:每周([一二三四五六日天]+)|weekly\s+on\s+([MonTueWedThuFriSatSun,\s]+))/i);
  if (weeklyWithDaysMatch) {
    let daysOfWeek: number[] = [];

    if (weeklyWithDaysMatch[1]) {
      // 中文紧凑格式："一三五"（连续字符）
      const chineseDays = weeklyWithDaysMatch[1].split('');
      daysOfWeek = chineseDays
        .map(d => CHINESE_WEEKDAY_MAP[d])
        .filter((d): d is number => d !== undefined);
    } else if (weeklyWithDaysMatch[2]) {
      // 英文格式
      const englishDays = weeklyWithDaysMatch[2]
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map(d => d.trim().toLowerCase().substring(0, 3));
      daysOfWeek = englishDays
        .map(d => ENGLISH_WEEKDAY_MAP[d])
        .filter((d): d is number => d !== undefined);
    }

    if (daysOfWeek.length > 0) {
      return { type: 'weekly', daysOfWeek };
    }
  }

  // 基础规则: 🔁每天 / 🔁daily
  const baseMatch = line.match(/🔁(每天|每周|每月|每年|工作日|daily|weekly|monthly|yearly|workday)/i);
  if (baseMatch) {
    const ruleKey = baseMatch[1].toLowerCase();
    const type = REPEAT_RULE_MAP[ruleKey];
    if (type) {
      return { type };
    }
  }

  return undefined;
}

/**
 * 解析结束条件
 * @param line 行内容
 * @returns EndCondition | undefined
 */
export function parseEndCondition(line: string): EndCondition | undefined {
  // 按日期结束
  // 中文: 截止到2026-12-31
  // 英文: until 2026-12-31
  const dateMatch = line.match(/(?:截止到|until)\s*(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    return {
      type: 'date',
      endDate: dateMatch[1]
    };
  }

  // 按次数结束
  // 中文: 剩余5次
  // 英文: 5 times remaining / 5 remaining
  const countMatch = line.match(/(?:剩余\s*(\d+)\s*次|(\d+)\s*(?:times?\s*)?remaining)/i);
  if (countMatch) {
    const maxCount = parseInt(countMatch[1] || countMatch[2], 10);
    return {
      type: 'count',
      maxCount
    };
  }

  return undefined;
}

/**
 * 检查是否有重复规则
 * @param line 行内容
 */
export function hasRepeatRule(line: string): boolean {
  return /🔁/.test(line);
}

/**
 * 从行内容中移除重复和结束条件标记
 * @param content 内容
 * @returns 清理后的内容
 */
export function stripRecurringMarkers(content: string): string {
  // 使用更宽松的匹配方式，先匹配完整的重复规则标记
  // 中文格式：🔁每月3日, 🔁每周一三五, 🔁每天, 🔁每周, 🔁每月, 🔁每年, 🔁工作日
  // 英文格式：🔁monthly on day 3, 🔁weekly on Mon,Wed,Fri, 🔁daily, 🔁weekly, 🔁monthly, 🔁yearly, 🔁workday
  
  // 使用 🔁 的 unicode 转义 \u{1F501} 以确保正确匹配
  const repeatEmoji = '🔁';
  
  // 第一步：移除带参数的复杂格式
  // 注意：必须先匹配更具体的模式（如 🔁每周一三五）再匹配通用的（如 🔁每周）
  content = content
    .replace(new RegExp(`${repeatEmoji}\\s*每月\\d+日`, 'gi'), '')
    // 匹配紧凑格式：🔁每周一三五（连续星期几字符）
    .replace(new RegExp(`${repeatEmoji}\\s*每周[一二三四五六日天]+`, 'gi'), '')
    .replace(new RegExp(`${repeatEmoji}\\s*monthly\\s+on\\s+day\\s+\\d+`, 'gi'), '')
    .replace(new RegExp(`${repeatEmoji}\\s*weekly\\s+on\\s+[MonTueWedThuFriSatSun,\\s]+`, 'gi'), '');
  
  // 第二步：移除基础格式（通用的，不带参数）
  content = content
    .replace(new RegExp(`${repeatEmoji}\\s*(?:每天|每周|每月|每年|工作日)`, 'gi'), '')
    .replace(new RegExp(`${repeatEmoji}\\s*(?:daily|weekly|monthly|yearly|workday)`, 'gi'), '');
  
  // 第三步：移除结束条件
  content = content
    .replace(/(?:截止到|until)\s*\d{4}-\d{2}-\d{2}/gi, '')
    .replace(/(?:剩余\s*\d+\s*次|\d+\s*(?:times?\s*)?remaining)/gi, '');
  
  return content.replace(/\s+/g, ' ').trim();
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

    case 'weekly': {
      const daysOfWeek = repeatRule.daysOfWeek;
      if (daysOfWeek && daysOfWeek.length > 0) {
        const currentDay = date.getDay();
        const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
        let nextDay = sortedDays.find(d => d > currentDay);
        if (nextDay === undefined) {
          nextDay = sortedDays[0];
          date.setDate(date.getDate() + (7 - currentDay + nextDay));
        } else {
          date.setDate(date.getDate() + (nextDay - currentDay));
        }
      } else {
        date.setDate(date.getDate() + 7);
      }
      break;
    }

    case 'monthly':
      if (dayOfMonth !== undefined) {
        // 先将日期设为 1 号避免 setMonth 时月末溢出问题
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        date.setDate(dayOfMonth);
        // 月末对齐：如果 dayOfMonth 超过目标月份最大天数，
        // setDate 会溢出到下月，需要回退到目标月份的最后一天
        if (date.getDate() !== dayOfMonth) {
          date.setDate(0);
        }
      } else {
        const currentDay = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        date.setDate(currentDay);
        if (date.getDate() !== currentDay) {
          date.setDate(0);
        }
      }
      break;

    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;

    case 'workday':
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
 * @param _currentCount 当前已创建次数（可选）
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
 * 生成重复规则标记（人类可读格式）
 * @param repeatRule 重复规则
 * @returns 标记字符串
 */
export function generateRepeatRuleMarker(repeatRule: RepeatRule): string {
  const { type, dayOfMonth, daysOfWeek } = repeatRule;

  // 获取基础类型文本
  const typeMap: Record<RepeatRuleType, string> = {
    'daily': t('recurring.daily'),
    'weekly': t('recurring.weekly'),
    'monthly': t('recurring.monthly'),
    'yearly': t('recurring.yearly'),
    'workday': t('recurring.workday')
  };

  const typeStr = typeMap[type] || type;

  if (type === 'monthly' && dayOfMonth !== undefined) {
    return `🔁${t('recurring.generate.monthlyOnDay', { day: String(dayOfMonth) })}`;
  }

  if (type === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    // 紧凑格式：使用单字（一、二、三...）连续排列
    const weekDayChars = ['日', '一', '二', '三', '四', '五', '六'];
    const dayChars = daysOfWeek.map(d => weekDayChars[d]).filter(Boolean);
    return `🔁${t('recurring.parse.weeklyOnPrefix') || '每周'}${dayChars.join('')}`;
  }

  return `🔁${typeStr}`;
}

/**
 * 生成结束条件标记（人类可读格式）
 * @param endCondition 结束条件
 * @returns 标记字符串
 */
export function generateEndConditionMarker(endCondition: EndCondition | undefined): string {
  if (!endCondition || endCondition.type === 'never') {
    return '';
  }

  if (endCondition.type === 'date' && endCondition.endDate) {
    return t('recurring.generate.withEndDate', { date: endCondition.endDate });
  }

  if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
    return t('recurring.generate.withRemainingCount', { count: String(endCondition.maxCount) });
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
