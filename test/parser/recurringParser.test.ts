/**
 * 重复事项标记解析器测试
 */
import { describe, it, expect } from 'vitest';
import {
  parseRepeatRule,
  parseEndCondition,
  hasRepeatRule,
  stripRecurringMarkers,
  getNextOccurrenceDate,
  checkEndCondition,
  generateRepeatRuleMarker,
  generateEndConditionMarker,
  decrementCount
} from '@/parser/recurringParser';
import type { RepeatRule, EndCondition } from '@/types/models';

describe('recurringParser', () => {
  describe('parseRepeatRule', () => {
    it('应该解析中文每天', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每天');
      expect(result).toBeDefined();
      expect(result?.type).toBe('daily');
    });

    it('应该解析中文每周', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每周');
      expect(result?.type).toBe('weekly');
    });

    it('应该解析中文每月', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每月');
      expect(result?.type).toBe('monthly');
    });

    it('应该解析中文每年', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每年');
      expect(result?.type).toBe('yearly');
    });

    it('应该解析中文工作日', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁工作日');
      expect(result?.type).toBe('workday');
    });

    it('应该解析英文 daily', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁daily');
      expect(result?.type).toBe('daily');
    });

    it('应该解析英文 weekly', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁weekly');
      expect(result?.type).toBe('weekly');
    });

    it('应该解析每月指定日期', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每月:15日');
      expect(result?.type).toBe('monthly');
      expect(result?.dayOfMonth).toBe(15);
    });

    it('应该解析每月指定日期（纯数字）', () => {
      const result = parseRepeatRule('任务 @2026-03-17 🔁每月:15');
      expect(result?.type).toBe('monthly');
      expect(result?.dayOfMonth).toBe(15);
    });

    it('无重复标记时应返回 undefined', () => {
      const result = parseRepeatRule('任务 @2026-03-17');
      expect(result).toBeUndefined();
    });
  });

  describe('parseEndCondition', () => {
    it('应该解析日期结束条件', () => {
      const result = parseEndCondition('任务 @2026-03-17 🔁每天🔚2026-12-31');
      expect(result).toBeDefined();
      expect(result?.type).toBe('date');
      expect(result?.endDate).toBe('2026-12-31');
    });

    it('应该解析次数结束条件', () => {
      const result = parseEndCondition('任务 @2026-03-17 🔁每天🔢10');
      expect(result).toBeDefined();
      expect(result?.type).toBe('count');
      expect(result?.maxCount).toBe(10);
    });

    it('无结束条件时应返回 undefined', () => {
      const result = parseEndCondition('任务 @2026-03-17 🔁每天');
      expect(result).toBeUndefined();
    });
  });

  describe('hasRepeatRule', () => {
    it('应该检测到有重复标记', () => {
      expect(hasRepeatRule('任务 @2026-03-17 🔁每天')).toBe(true);
    });

    it('应该检测到无重复标记', () => {
      expect(hasRepeatRule('任务 @2026-03-17')).toBe(false);
    });
  });

  describe('stripRecurringMarkers', () => {
    it('应该移除重复规则标记', () => {
      const result = stripRecurringMarkers('任务 @2026-03-17 🔁每天');
      expect(result).toBe('任务 @2026-03-17');
    });

    it('应该移除结束日期标记', () => {
      const result = stripRecurringMarkers('任务 @2026-03-17 🔚2026-12-31');
      expect(result).toBe('任务 @2026-03-17');
    });

    it('应该移除次数标记', () => {
      const result = stripRecurringMarkers('任务 @2026-03-17 🔢10');
      expect(result).toBe('任务 @2026-03-17');
    });

    it('应该同时移除多个标记', () => {
      const result = stripRecurringMarkers('任务 @2026-03-17 🔁每天🔚2026-12-31🔢10');
      expect(result).toBe('任务 @2026-03-17');
    });
  });

  describe('getNextOccurrenceDate', () => {
    it('应该计算每天的下一次', () => {
      const rule: RepeatRule = { type: 'daily' };
      const result = getNextOccurrenceDate('2026-03-17', rule);
      expect(result).toBe('2026-03-18');
    });

    it('应该计算每周的下一次', () => {
      const rule: RepeatRule = { type: 'weekly' };
      const result = getNextOccurrenceDate('2026-03-17', rule);
      expect(result).toBe('2026-03-24');
    });

    it('应该计算每月的下一次（保持日号）', () => {
      const rule: RepeatRule = { type: 'monthly' };
      const result = getNextOccurrenceDate('2026-03-17', rule);
      expect(result).toBe('2026-04-17');
    });

    it('应该处理月末边界（1月31日→2月28日）', () => {
      const rule: RepeatRule = { type: 'monthly' };
      const result = getNextOccurrenceDate('2026-01-31', rule);
      expect(result).toBe('2026-02-28');
    });

    it('应该处理月末边界（3月31日→4月30日）', () => {
      const rule: RepeatRule = { type: 'monthly' };
      const result = getNextOccurrenceDate('2026-03-31', rule);
      expect(result).toBe('2026-04-30');
    });

    it('应该计算每月指定日期的下一次', () => {
      const rule: RepeatRule = { type: 'monthly', dayOfMonth: 15 };
      const result = getNextOccurrenceDate('2026-03-17', rule);
      expect(result).toBe('2026-04-15');
    });

    it('应该计算每年的下一次', () => {
      const rule: RepeatRule = { type: 'yearly' };
      const result = getNextOccurrenceDate('2026-03-17', rule);
      expect(result).toBe('2027-03-17');
    });

    it('应该计算工作日的下一次（跳过周末）', () => {
      const rule: RepeatRule = { type: 'workday' };
      // 周五 3月20日
      const result = getNextOccurrenceDate('2026-03-20', rule);
      // 下周一 3月23日
      expect(result).toBe('2026-03-23');
    });

    it('应该计算工作日的下一次（周一到周二）', () => {
      const rule: RepeatRule = { type: 'workday' };
      const result = getNextOccurrenceDate('2026-03-23', rule);
      expect(result).toBe('2026-03-24');
    });
  });

  describe('checkEndCondition', () => {
    it('无条件时应该允许创建', () => {
      const result = checkEndCondition('2026-04-17', undefined);
      expect(result.canCreate).toBe(true);
    });

    it('日期未超过结束日期时应允许创建', () => {
      const endCondition: EndCondition = { type: 'date', endDate: '2026-12-31' };
      const result = checkEndCondition('2026-04-17', endCondition);
      expect(result.canCreate).toBe(true);
    });

    it('日期超过结束日期时应禁止创建', () => {
      const endCondition: EndCondition = { type: 'date', endDate: '2026-03-17' };
      const result = checkEndCondition('2026-04-17', endCondition);
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('已超过结束日期');
    });

    it('次数大于0时应允许创建', () => {
      const endCondition: EndCondition = { type: 'count', maxCount: 5 };
      const result = checkEndCondition('2026-04-17', endCondition);
      expect(result.canCreate).toBe(true);
    });

    it('次数为0时应禁止创建', () => {
      const endCondition: EndCondition = { type: 'count', maxCount: 0 };
      const result = checkEndCondition('2026-04-17', endCondition);
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('已达到最大次数限制');
    });
  });

  describe('generateRepeatRuleMarker', () => {
    it('应该生成每天标记', () => {
      const rule: RepeatRule = { type: 'daily' };
      expect(generateRepeatRuleMarker(rule)).toBe('🔁每天');
    });

    it('应该生成每周标记', () => {
      const rule: RepeatRule = { type: 'weekly' };
      expect(generateRepeatRuleMarker(rule)).toBe('🔁每周');
    });

    it('应该生成每月标记', () => {
      const rule: RepeatRule = { type: 'monthly' };
      expect(generateRepeatRuleMarker(rule)).toBe('🔁每月');
    });

    it('应该生成每月指定日期标记', () => {
      const rule: RepeatRule = { type: 'monthly', dayOfMonth: 15 };
      expect(generateRepeatRuleMarker(rule)).toBe('🔁每月:15日');
    });
  });

  describe('generateEndConditionMarker', () => {
    it('应该生成日期标记', () => {
      const endCondition: EndCondition = { type: 'date', endDate: '2026-12-31' };
      expect(generateEndConditionMarker(endCondition)).toBe('🔚2026-12-31');
    });

    it('应该生成次数标记', () => {
      const endCondition: EndCondition = { type: 'count', maxCount: 10 };
      expect(generateEndConditionMarker(endCondition)).toBe('🔢10');
    });

    it('无条件时应返回空字符串', () => {
      expect(generateEndConditionMarker(undefined)).toBe('');
    });

    it('永不结束时应返回空字符串', () => {
      const endCondition: EndCondition = { type: 'never' };
      expect(generateEndConditionMarker(endCondition)).toBe('');
    });
  });

  describe('decrementCount', () => {
    it('应该递减次数', () => {
      const endCondition: EndCondition = { type: 'count', maxCount: 10 };
      const result = decrementCount(endCondition);
      expect(result?.maxCount).toBe(9);
    });

    it('递减到0后应该保持0', () => {
      const endCondition: EndCondition = { type: 'count', maxCount: 1 };
      const result = decrementCount(endCondition);
      expect(result?.maxCount).toBe(0);
    });

    it('非次数类型应该保持不变', () => {
      const endCondition: EndCondition = { type: 'date', endDate: '2026-12-31' };
      const result = decrementCount(endCondition);
      expect(result?.type).toBe('date');
    });
  });
});
