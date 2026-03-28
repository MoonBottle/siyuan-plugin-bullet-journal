/**
 * displayUtils 单元测试
 * 测试提醒和重复规则的显示格式化
 */
import { describe, it, expect } from 'vitest';
import { formatReminderDisplay, formatRepeatRuleDisplay } from '@/utils/displayUtils';
import type { ReminderConfig, RepeatRule, EndCondition } from '@/types/models';

// 模拟翻译函数
const createMockT = () => {
  const translations: Record<string, Record<string, string>> = {
    'zh': {
      'reminder.beforeTime': '提前{time}',
      'reminder.beforeEndTime': '结束前{time}',
      'reminder.minutes': '{count}分钟',
      'reminder.hours': '{count}小时',
      'reminder.days': '{count}天',
      'recurring.daily': '每天',
      'recurring.weekly': '每周',
      'recurring.monthly': '每月',
      'recurring.yearly': '每年',
      'recurring.workday': '工作日',
      'recurring.monday': '周一',
      'recurring.tuesday': '周二',
      'recurring.wednesday': '周三',
      'recurring.thursday': '周四',
      'recurring.friday': '周五',
      'recurring.saturday': '周六',
      'recurring.sunday': '周日',
      'recurring.withEndDate': '{rule}，截止到{date}',
      'recurring.withRemainingCount': '{rule}，剩余{count}次'
    }
  };

  return (key: string, params?: Record<string, string>) => {
    let result = translations['zh'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, v);
      });
    }
    return result;
  };
};

describe('formatReminderDisplay', () => {
  const t = createMockT();

  it('未启用提醒应返回空字符串', () => {
    const reminder: ReminderConfig = { enabled: false, type: 'absolute' };
    expect(formatReminderDisplay(reminder, t)).toBe('');
  });

  it('绝对时间应直接返回时间', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'absolute',
      time: '09:00'
    };
    expect(formatReminderDisplay(reminder, t)).toBe('09:00');
  });

  it('相对开始 -5m 应显示为提前5分钟', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'relative',
      relativeTo: 'start',
      offsetMinutes: 5
    };
    expect(formatReminderDisplay(reminder, t)).toBe('提前5分钟');
  });

  it('相对开始 -1h 应显示为提前1小时', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'relative',
      relativeTo: 'start',
      offsetMinutes: 60
    };
    expect(formatReminderDisplay(reminder, t)).toBe('提前1小时');
  });

  it('相对结束 e-30m 应显示为结束前30分钟', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'relative',
      relativeTo: 'end',
      offsetMinutes: 30
    };
    expect(formatReminderDisplay(reminder, t)).toBe('结束前30分钟');
  });

  it('相对结束 e-2h 应显示为结束前2小时', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'relative',
      relativeTo: 'end',
      offsetMinutes: 120
    };
    expect(formatReminderDisplay(reminder, t)).toBe('结束前2小时');
  });

  it('相对开始 -1d 应显示为提前1天', () => {
    const reminder: ReminderConfig = {
      enabled: true,
      type: 'relative',
      relativeTo: 'start',
      offsetMinutes: 24 * 60
    };
    expect(formatReminderDisplay(reminder, t)).toBe('提前1天');
  });

  it('未定义提醒应返回空字符串', () => {
    expect(formatReminderDisplay(undefined, t)).toBe('');
  });
});

describe('formatRepeatRuleDisplay', () => {
  const t = createMockT();

  it('每天应显示为每天', () => {
    const rule: RepeatRule = { type: 'daily' };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每天');
  });

  it('每周应显示为每周', () => {
    const rule: RepeatRule = { type: 'weekly' };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每周');
  });

  it('每月:3日应显示为每月3日', () => {
    const rule: RepeatRule = { type: 'monthly', dayOfMonth: 3 };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每月3日');
  });

  it('每月应显示为每月', () => {
    const rule: RepeatRule = { type: 'monthly' };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每月');
  });

  it('每周:1,3,5应显示为每周周一、周三、周五', () => {
    const rule: RepeatRule = { type: 'weekly', daysOfWeek: [1, 3, 5] };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每周周一、周三、周五');
  });

  it('每年应显示为每年', () => {
    const rule: RepeatRule = { type: 'yearly' };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每年');
  });

  it('工作日应显示为工作日', () => {
    const rule: RepeatRule = { type: 'workday' };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('工作日');
  });

  it('每月3日 + 结束日期应显示为每月3日，截止到2026-05-31', () => {
    const rule: RepeatRule = { type: 'monthly', dayOfMonth: 3 };
    const endCondition: EndCondition = { type: 'date', endDate: '2026-05-31' };
    expect(formatRepeatRuleDisplay(rule, endCondition, t)).toBe('每月3日，截止到2026-05-31');
  });

  it('每月3日 + 次数限制应显示为每月3日，剩余5次', () => {
    const rule: RepeatRule = { type: 'monthly', dayOfMonth: 3 };
    const endCondition: EndCondition = { type: 'count', maxCount: 5 };
    expect(formatRepeatRuleDisplay(rule, endCondition, t)).toBe('每月3日，剩余5次');
  });

  it('每周 + 结束日期应显示为每周，截止到2026-12-31', () => {
    const rule: RepeatRule = { type: 'weekly' };
    const endCondition: EndCondition = { type: 'date', endDate: '2026-12-31' };
    expect(formatRepeatRuleDisplay(rule, endCondition, t)).toBe('每周，截止到2026-12-31');
  });

  it('每周:0,6（周末）应显示为每周周日、周六', () => {
    const rule: RepeatRule = { type: 'weekly', daysOfWeek: [0, 6] };
    expect(formatRepeatRuleDisplay(rule, undefined, t)).toBe('每周周日、周六');
  });

  it('未定义规则应返回空字符串', () => {
    expect(formatRepeatRuleDisplay(undefined, undefined, t)).toBe('');
  });
});
