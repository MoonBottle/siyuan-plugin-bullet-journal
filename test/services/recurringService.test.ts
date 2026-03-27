/**
 * 重复事项服务测试
 */
import { describe, it, expect, vi } from 'vitest';
import {
  shouldCreateNextOccurrence,
  isItemExpired
} from '@/services/recurringService';
import type { Item, RepeatRule, EndCondition } from '@/types/models';

describe('recurringService', () => {
  describe('shouldCreateNextOccurrence', () => {
    it('有重复规则且已完成时应该返回 true', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' }
      };

      expect(shouldCreateNextOccurrence(item)).toBe(true);
    });

    it('无重复规则时应该返回 false', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1'
      };

      expect(shouldCreateNextOccurrence(item)).toBe(false);
    });

    it('未完成时应该返回 false', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' }
      };

      expect(shouldCreateNextOccurrence(item)).toBe(false);
    });

    it('已放弃时应该返回 false', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'abandoned',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' }
      };

      expect(shouldCreateNextOccurrence(item)).toBe(false);
    });

    it('超过结束日期时应该返回 false', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-12-31',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'date', endDate: '2026-12-31' }
      };

      // 下次日期 2027-01-01 超过了结束日期 2026-12-31
      expect(shouldCreateNextOccurrence(item)).toBe(false);
    });

    it('次数为0时应该返回 false', () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'count', maxCount: 0 }
      };

      expect(shouldCreateNextOccurrence(item)).toBe(false);
    });
  });

  describe('isItemExpired', () => {
    it('过去日期应该返回 true', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: dateStr,
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1'
      };

      expect(isItemExpired(item)).toBe(true);
    });

    it('今天日期应该返回 true', () => {
      const today = new Date().toISOString().split('T')[0];

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: today,
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1'
      };

      expect(isItemExpired(item)).toBe(true);
    });

    it('未来日期应该返回 false', () => {
      // 使用一个明确是未来日期的字符串
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1); // 明年
      const dateStr = futureDate.toISOString().split('T')[0];

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: dateStr,
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1'
      };

      expect(isItemExpired(item)).toBe(false);
    });

    it('已完成事项不应该算过期', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: dateStr,
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1'
      };

      expect(isItemExpired(item)).toBe(false);
    });
  });
});
