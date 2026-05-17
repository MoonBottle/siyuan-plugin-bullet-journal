import { describe, expect, it } from 'vitest';
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';
import { applyBlockPatch, applyBlockPatches } from '@/utils/blockWriter/kramdownModifier';

describe('kramdownModifier', () => {
  function parts(raw: string) {
    return splitKramdownBlock(raw);
  }

  describe('setStatus', () => {
    it('completes task list', () => {
      expect(applyBlockPatch(parts('- [ ] 任务\n{: id="abc"}'), { type: 'setStatus', status: 'completed' })).toBe(
        '- [x] 任务\n{: id="abc"}',
      );
    });

    it('abandons task list', () => {
      expect(applyBlockPatch(parts('- [x] 任务\n{: id="abc"}'), { type: 'setStatus', status: 'abandoned' })).toBe(
        '- [ ] 任务 ❌\n{: id="abc"}',
      );
    });

    it('completes pending non-task-list', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'setStatus', status: 'completed' })).toBe(
        '任务 ✅\n{: id="abc"}',
      );
    });

    it('reverts completed to pending', () => {
      expect(applyBlockPatch(parts('- [x] 任务 #已完成\n{: id="abc"}'), { type: 'setStatus', status: 'pending' })).toBe(
        '- [ ] 任务\n{: id="abc"}',
      );
    });

    it('preserves business tags and appends emoji status', () => {
      expect(applyBlockPatch(parts('测试事项 📅2026-05-16 #测试#\n{: id="abc"}'), { type: 'setStatus', status: 'abandoned' })).toBe(
        '测试事项 📅2026-05-16 #测试# ❌\n{: id="abc"}',
      );
    });
  });

  describe('setPriority', () => {
    it('sets priority', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'setPriority', priority: 'high' })).toBe(
        '任务 🔥\n{: id="abc"}',
      );
    });

    it('clears priority', () => {
      expect(applyBlockPatch(parts('任务 🔥\n{: id="abc"}'), { type: 'setPriority', priority: undefined })).toBe(
        '任务\n{: id="abc"}',
      );
    });

    it('sets priority before date', () => {
      expect(applyBlockPatch(parts('任务 📅2026-05-14\n{: id="abc"}'), { type: 'setPriority', priority: 'high' })).toBe(
        '任务 🔥 📅2026-05-14\n{: id="abc"}',
      );
    });
  });

  describe('removeSlashCommand', () => {
    it('requires an active Protyle Range', () => {
      expect(() => applyBlockPatch(parts('任务 /done\n{: id="abc"}'), { type: 'removeSlashCommand', suffix: '#done' })).toThrow(
        'removeSlashCommand requires an active Protyle Range',
      );
    });
  });

  describe('addDate', () => {
    it('appends date to plain line', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'addDate', date: '2026-05-16' })).toBe(
        '任务 📅2026-05-16\n{: id="abc"}',
      );
    });

    it('replaces existing date', () => {
      expect(applyBlockPatch(parts('任务 📅2026-05-14\n{: id="abc"}'), { type: 'addDate', date: '2026-05-16' })).toBe(
        '任务 📅2026-05-16\n{: id="abc"}',
      );
    });

    it('replaces specific originalDate when multiple dates exist', () => {
      expect(applyBlockPatch(parts('任务 📅2026-05-14~2026-05-16\n{: id="abc"}'), { type: 'addDate', date: '2026-05-20', originalDate: '2026-05-14' })).toBe(
        '任务 📅2026-05-20\n{: id="abc"}',
      );
    });

    it('adds time for non-allDay', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'addDate', date: '2026-05-16', allDay: false, startTime: '09:00', endTime: '10:00' })).toBe(
        '任务 📅2026-05-16 09:00-10:00\n{: id="abc"}',
      );
    });

    it('preserves priority marker', () => {
      expect(applyBlockPatch(parts('任务 🔥\n{: id="abc"}'), { type: 'addDate', date: '2026-05-16' })).toBe(
        '任务 🔥 📅2026-05-16\n{: id="abc"}',
      );
    });

    it('preserves IAL', () => {
      expect(applyBlockPatch(parts('任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}'), { type: 'addDate', date: '2026-05-16' })).toBe(
        '任务 📅2026-05-16\n{: id="abc" custom-reminder="yes"}',
      );
    });
  });

  describe('setContent', () => {
    it('appends suffix', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'setContent', suffix: '#done' })).toBe(
        '任务 #done\n{: id="abc"}',
      );
    });

    it('does not duplicate suffix', () => {
      expect(applyBlockPatch(parts('任务 #done\n{: id="abc"}'), { type: 'setContent', suffix: '#done' })).toBe(
        '任务 #done\n{: id="abc"}',
      );
    });

    it('replaces content preserving markers', () => {
      expect(applyBlockPatch(parts('- [x] 旧内容 📅2026-05-14\n{: id="abc"}'), { type: 'setContent', newItemContent: '新内容' })).toBe(
        '- [x] 新内容 📅2026-05-14\n{: id="abc"}',
      );
    });

    it('replaces content preserving status and priority', () => {
      expect(applyBlockPatch(parts('旧内容 🔥 📅2026-05-14 #已完成\n{: id="abc"}'), { type: 'setContent', newItemContent: '新任务' })).toBe(
        '新任务 🔥 📅2026-05-14 #已完成\n{: id="abc"}',
      );
    });
  });

  describe('setFocusPlan', () => {
    it('replaces existing focus plan markers and preserves other markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 🍅x2 🔥\n{: id="abc"}'), {
        type: 'setFocusPlan',
        plan: { type: 'duration', rawValue: 70 },
      })).toBe(
        '事项 @2026-05-14 🔥 ⏳1h10m\n{: id="abc"}',
      );
    });

    it('clears focus plan markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 ⏳1h 🍅x3\n{: id="abc"}'), {
        type: 'setFocusPlan',
      })).toBe(
        '事项 @2026-05-14\n{: id="abc"}',
      );
    });

    it('preserves extra lines and IAL', () => {
      expect(applyBlockPatch(parts(`事项 @2026-05-14
🍅2026-05-14 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`), {
        type: 'setFocusPlan',
        plan: { type: 'duration', rawValue: 30 },
      })).toBe(
        `事项 @2026-05-14 ⏳30m
🍅2026-05-14 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`,
      );
    });
  });

  describe('setReminder', () => {
    it('replaces existing reminder markers and preserves other markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 🔁每天 ⏰09:00\n{: id="abc"}'), {
        type: 'setReminder',
        reminder: { enabled: true, type: 'relative', relativeTo: 'start', offsetMinutes: 10 },
      })).toBe(
        '事项 @2026-05-14 🔁每天 ⏰提前10分钟\n{: id="abc"}',
      );
    });

    it('clears reminder markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 ⏰结束前30分钟\n{: id="abc"}'), {
        type: 'setReminder',
        reminder: { enabled: false, type: 'absolute', time: '09:00' },
      })).toBe(
        '事项 @2026-05-14\n{: id="abc"}',
      );
    });
  });

  describe('setRecurring', () => {
    it('replaces recurring markers and preserves other markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 ⏰09:00 🔁每天 截止到2026-06-01\n{: id="abc"}'), {
        type: 'setRecurring',
        repeatRule: { type: 'weekly', daysOfWeek: [1, 3, 5] },
        endCondition: { type: 'count', maxCount: 8 },
      })).toBe(
        '事项 @2026-05-14 ⏰09:00 🔁每周一三五 剩余8次\n{: id="abc"}',
      );
    });

    it('clears recurring markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 🔁每月15日 剩余10次\n{: id="abc"}'), {
        type: 'setRecurring',
      })).toBe(
        '事项 @2026-05-14\n{: id="abc"}',
      );
    });

    it('preserves extra lines and IAL', () => {
      expect(applyBlockPatch(parts(`事项 @2026-05-14
🍅2026-05-14 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`), {
        type: 'setRecurring',
        repeatRule: { type: 'daily' },
        endCondition: { type: 'date', endDate: '2026-06-01' },
      })).toBe(
        `事项 @2026-05-14 🔁每天 截止到2026-06-01
🍅2026-05-14 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`,
      );
    });
  });

  describe('batch patches', () => {
    it('applies priority then date', () => {
      const result = applyBlockPatches(parts('任务\n{: id="abc"}'), [
        { type: 'setPriority', priority: 'high' },
      ]);
      expect(result).toContain('🔥');
      expect(result).toContain('{: id="abc"}');
    });

    it('preserves IAL through batch', () => {
      const result = applyBlockPatches(parts('任务\n{: id="abc" custom-x="1"}'), [
        { type: 'setPriority', priority: 'high' },
        { type: 'setStatus', status: 'completed' },
      ]);
      expect(result).toContain('🔥');
      expect(result).toContain('✅');
      expect(result).toContain('{: id="abc" custom-x="1"}');
    });

    it('applies setPriority then addDate', () => {
      const result = applyBlockPatches(parts('任务\n{: id="abc"}'), [
        { type: 'setPriority', priority: 'high' },
        { type: 'addDate', date: '2026-05-16' },
      ]);
      expect(result).toContain('🔥');
      expect(result).toContain('📅2026-05-16');
      expect(result).toContain('{: id="abc"}');
    });

  });
});
