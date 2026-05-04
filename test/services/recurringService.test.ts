/**
 * 重复事项服务测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldCreateNextOccurrence,
  createNextOccurrence,
  isItemExpired,
  skipCurrentOccurrence
} from '@/services/recurringService';
import type { Item } from '@/types/models';

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
const mockInsertBlock = vi.fn();
vi.mock('@/api', () => ({
  updateBlock: (...args: unknown[]) => mockUpdateBlock(...args),
  insertBlock: (...args: unknown[]) => mockInsertBlock(...args)
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

    it('工作日重复遇到法定节假日时应跳过到节后工作日', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '节前任务',
        date: '2026-04-30',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'workday' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-05-06'),
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
      // 验证重复规则和结束条件保留（新格式）
      const callArg = mockUpdateBlock.mock.calls[0][1] as string;
      expect(callArg).toContain('🔁每月3日');
      expect(callArg).toContain('截止到2026-05-31');
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

  // ==================== P0: createNextOccurrence 测试 ====================

  describe('createNextOccurrence', () => {
    beforeEach(() => {
      mockInsertBlock.mockClear();
    });

    it('无重复规则时应返回 false', async () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockInsertBlock).not.toHaveBeenCalled();
    });

    it('无 blockId 时应返回 false', async () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        repeatRule: { type: 'daily' },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockInsertBlock).not.toHaveBeenCalled();
    });

    it('超过结束日期时应返回 false 且不创建', async () => {
      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-12-31',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'date', endDate: '2026-12-31' },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockInsertBlock).not.toHaveBeenCalled();
    });

    it('次数为0时应返回 false 且不创建', async () => {
      const item: Item = {
        id: '1',
        content: '背单词',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'count', maxCount: 0 },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
      expect(mockInsertBlock).not.toHaveBeenCalled();
    });

    it('每天重复应创建明天的事项并插入到当前块之后', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '背单词',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-03-18'),
        undefined,
        'block123',
        undefined,
      );
    });

    it('任务列表格式应保留 [ ] 前缀', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '每日任务',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
        isTaskList: true,
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toMatch(/^- \[ \]/);
    });

    it('应继承提醒配置', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'weekly' },
        reminder: {
          enabled: true,
          type: 'absolute',
          time: '09:00',
        },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toContain('⏰09:00');
      expect(blockContent).toContain('📅2026-03-24');
    });

    it('应保留时间范围', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        startDateTime: '2026-03-17 14:00:00',
        endDateTime: '2026-03-17 16:00:00',
        repeatRule: { type: 'weekly' },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toContain('📅2026-03-24 14:00:00~16:00:00');
    });

    it('次数结束条件应递减', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '背单词',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'count', maxCount: 3 },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toContain('剩余2次');
    });

    it('次数递减到 1 后新事项不显示剩余次数标记', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '背单词',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'count', maxCount: 1 },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      // 递减到 0，不显示次数标记
      expect(blockContent).not.toContain('剩余');
      expect(blockContent).not.toContain('remaining');
    });

    it('日期结束条件应保持不变', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '月会',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'monthly' },
        endCondition: { type: 'date', endDate: '2026-12-31' },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toContain('截止到2026-12-31');
      expect(blockContent).toContain('📅2026-04-17');
    });

    it('API 调用失败时应返回 false', async () => {
      mockInsertBlock.mockResolvedValue(null);

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
    });

    it('API 调用异常时应返回 false', async () => {
      mockInsertBlock.mockRejectedValue(new Error('Network error'));

      const item: Item = {
        id: '1',
        content: '测试事项',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'daily' },
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(false);
    });

    it('任务列表事项应使用 listItemBlockId 作为插入点', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '每日任务',
        date: '2026-03-17',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'content-block-id',
        listItemBlockId: 'list-item-block-id',
        repeatRule: { type: 'daily' },
        isTaskList: true,
      };

      await createNextOccurrence({} as any, item);
      // 应使用 listItemBlockId 作为插入点
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'markdown',
        expect.any(String),
        undefined,
        'list-item-block-id',
        undefined,
      );
    });

    it('完整组合：内容+日期+时间+提醒+重复+次数结束条件', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '这是一个带时间的事项',
        date: '2026-03-28',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        startDateTime: '2026-03-28 09:00:00',
        endDateTime: '2026-03-28 10:00:00',
        repeatRule: { type: 'monthly', dayOfMonth: 3 },
        endCondition: { type: 'date', endDate: '2026-05-31' },
        reminder: {
          enabled: true,
          type: 'relative',
          relativeTo: 'start',
          offsetMinutes: 15,
        },
      };

      await createNextOccurrence({} as any, item);
      const blockContent = mockInsertBlock.mock.calls[0][1] as string;
      expect(blockContent).toContain('📅2026-04-03 09:00:00~10:00:00');
      expect(blockContent).toContain('⏰提前15分钟');
      expect(blockContent).toContain('🔁每月3日');
      expect(blockContent).toContain('截止到2026-05-31');
    });

    it('工作日重复创建下一次时应命中补班周六', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '节后任务',
        date: '2026-05-08',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'workday' }
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-05-09'),
        undefined,
        'block123',
        undefined,
      );
    });
  });
});
