/**
 * 显示格式化工具
 * 将提醒和重复规则配置格式化为人类可读的字符串
 */

import type { ReminderConfig, RepeatRule, EndCondition } from '@/types/models';

/**
 * 格式化偏移量为可读字符串
 * @param offsetMinutes 偏移分钟数
 * @param t 翻译函数
 * @returns 格式化后的时间字符串，如 "5分钟"、"1小时"、"2天"
 */
function formatOffsetMinutes(
  offsetMinutes: number,
  t: (key: string, params?: Record<string, string>) => string
): string {
  const absOffset = Math.abs(offsetMinutes);
  
  // 天
  if (absOffset % (24 * 60) === 0) {
    const days = absOffset / (24 * 60);
    return t('reminder.days', { count: String(days) });
  }
  
  // 小时
  if (absOffset % 60 === 0) {
    const hours = absOffset / 60;
    return t('reminder.hours', { count: String(hours) });
  }
  
  // 分钟
  return t('reminder.minutes', { count: String(absOffset) });
}

/**
 * 格式化提醒配置为显示字符串
 * @param reminder 提醒配置
 * @param t 翻译函数
 * @returns 格式化后的提醒显示字符串
 * 
 * 示例：
 * - 绝对时间："09:00"
 * - 相对开始："提前5分钟"
 * - 相对结束："结束前5分钟"
 */
export function formatReminderDisplay(
  reminder: ReminderConfig | undefined,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (!reminder?.enabled) return '';

  // 绝对时间
  if (reminder.type === 'absolute' && reminder.time) {
    return reminder.time;
  }

  // 相对时间
  if (reminder.type === 'relative') {
    const offset = reminder.offsetMinutes || 0;
    const timeStr = formatOffsetMinutes(offset, t);

    if (reminder.relativeTo === 'end') {
      return t('reminder.beforeEndTime', { time: timeStr });
    }
    return t('reminder.beforeTime', { time: timeStr });
  }

  return '';
}

/**
 * 获取重复规则的基础显示文本
 * @param rule 重复规则
 * @param t 翻译函数
 * @returns 基础规则文本
 */
function getBaseRuleText(
  rule: RepeatRule,
  t: (key: string, params?: Record<string, string>) => string
): string {
  // 获取基础类型文本
  const typeMap: Record<string, string> = {
    'daily': t('recurring.daily'),
    'weekly': t('recurring.weekly'),
    'monthly': t('recurring.monthly'),
    'yearly': t('recurring.yearly'),
    'workday': t('recurring.workday')
  };

  let text = typeMap[rule.type] || rule.type;

  // 每月指定日期
  if (rule.type === 'monthly' && rule.dayOfMonth !== undefined) {
    text += rule.dayOfMonth + '日';
  }

  // 每周指定周几
  if (rule.type === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const weekDays = [
      t('recurring.sunday'),
      t('recurring.monday'),
      t('recurring.tuesday'),
      t('recurring.wednesday'),
      t('recurring.thursday'),
      t('recurring.friday'),
      t('recurring.saturday')
    ];
    const dayNames = rule.daysOfWeek.map(d => weekDays[d]).filter(Boolean);
    if (dayNames.length > 0) {
      text += dayNames.join('、');
    }
  }

  return text;
}

/**
 * 格式化重复规则为显示字符串
 * @param rule 重复规则
 * @param endCondition 结束条件
 * @param t 翻译函数
 * @returns 格式化后的重复规则显示字符串
 * 
 * 示例：
 * - 基础规则："每月3日"
 * - 带结束日期："每月3日，截止到2026-05-31"
 * - 带次数限制："每月3日，剩余5次"
 */
export function formatRepeatRuleDisplay(
  rule: RepeatRule | undefined,
  endCondition: EndCondition | undefined,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (!rule) return '';

  // 获取基础规则文本
  const ruleText = getBaseRuleText(rule, t);

  // 添加结束条件
  if (endCondition) {
    if (endCondition.type === 'date' && endCondition.endDate) {
      return t('recurring.withEndDate', {
        rule: ruleText,
        date: endCondition.endDate
      });
    }
    if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
      return t('recurring.withRemainingCount', {
        rule: ruleText,
        count: String(endCondition.maxCount)
      });
    }
  }

  return ruleText;
}
