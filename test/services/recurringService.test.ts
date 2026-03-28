/**
 * 重复事项服务测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldCreateNextOccurrence,
  isItemExpired,
  skipCurrentOccurrence
} from '@/services/recurringService';
import type { Item, RepeatRule, EndCondition } from '@/types/models';

// Mock getSharedPinia and useProjectStore
vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}));

vi.mock('@/stores', () => ({
  useProjectStore: vi.fn(() => ({
    projects: []
  })),
}));

// Mock siyuanAPI
const mockUpdateBlock = vi.fn();
vi.mock('@/api', () => ({
  updateBlock: (...args: unknown[]) => mockUpdateBlock(...args)
}));

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

  describe('skipCurrentOccurrence', () => {
    beforeEach(() => {
      mockUpdateBlock.mockClear();
    });

    it('无重复规则时应返回 false', async () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123'
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockUpdateBlock).not.toHaveBeenCalled();
    });

    it('无 blockId 时应返回 false', async () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockUpdateBlock).not.toHaveBeenCalled();
    });

    it('每天重复应跳过到明天', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '每日任务',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-03-18'),
        'block123'
      );
    });

    it('每周重复应跳过到下周同一天', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'weekly' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-03-24'),
        'block123'
      );
    });

    it('每月重复应跳过到下个月同一天', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '月会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'monthly' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-04-17'),
        'block123'
      );
    });

    it('每月指定日期重复应跳过到指定日期', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '月会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'monthly', dayOfMonth: 15 }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      // 3月17日 -> 4月15日（指定日期）
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-04-15'),
        'block123'
      );
    });

    it('带时间范围的事项应保留时间', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '会议',
        date: '2026-03-17',
        startDateTime: '2026-03-17 09:00:00',
        endDateTime: '2026-03-17 10:00:00',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-03-18 09:00:00~10:00:00'),
        'block123'
      );
    });

    it('用户具体案例：每月3日重复，当前28日，应跳到4月3日', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      // 这是一个带时间的事项 📅2026-03-28 09:00:00~10:00:00 🔁每月:3日🔚2026-05-31
      const item: Item = {
        id: '1',
        content: '这是一个带时间的事项',
        date: '2026-03-28',
        startDateTime: '2026-03-28 09:00:00',
        endDateTime: '2026-03-28 10:00:00',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'monthly', dayOfMonth: 3 },
        endCondition: { type: 'date', endDate: '2026-05-31' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      // 3月28日 -> 4月3日（每月3日）
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-04-03 09:00:00~10:00:00'),
        'block123'
      );
      // 验证重复规则和结束条件保留
      const callArg = mockUpdateBlock.mock.calls[0][1] as string;
      expect(callArg).toContain('🔁每月:3日');
      expect(callArg).toContain('🔚2026-05-31');
    });

    it('更新失败时应返回 false', async () => {
      mockUpdateBlock.mockResolvedValue(null);

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(false);
    });
  });
});
