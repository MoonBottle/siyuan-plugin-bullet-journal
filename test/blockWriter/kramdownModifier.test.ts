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
        '任务 📅2026-05-14 🔥\n{: id="abc"}',
      );
    });

    it('appends a new priority marker after existing date/time markers', () => {
      expect(applyBlockPatch(parts('任务 📅2026-05-14 ⏰14:00\n{: id="abc"}'), {
        type: 'setPriority',
        priority: 'medium',
      })).toBe(
        '任务 📅2026-05-14 ⏰14:00 🌱\n{: id="abc"}',
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

    it('keeps priority after an updated date marker when the original line already used @ syntax', () => {
      expect(applyBlockPatch(parts('任务 @2026-05-14 🌱\n{: id="abc"}'), {
        type: 'addDate',
        date: '2026-05-16',
      })).toBe(
        '任务 📅2026-05-16 🌱\n{: id="abc"}',
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

    it('preserves heading prefix when replacing content', () => {
      expect(applyBlockPatch(parts('### 旧标题 🍃 📅2026-05-17 #测试#\n{: id="abc"}'), { type: 'setContent', newItemContent: '新标题事项356' })).toBe(
        '### 新标题事项356 🍃 📅2026-05-17 #测试#\n{: id="abc"}',
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

    it('replaces content preserving reminder, recurring, end condition, and pin markers', () => {
      expect(applyBlockPatch(parts('- [ ] 旧任务 📌 🌱 📅2026-03-08 ⏰09:00 🔁每月1,15日 剩余30次\n{: id="abc"}'), {
        type: 'setContent',
        newItemContent: '新任务',
      })).toBe(
        '- [ ] 新任务 📌 🌱 📅2026-03-08 ⏰09:00 🔁每月1,15日 剩余30次\n{: id="abc"}',
      );
    });

    it('does not treat pin-like text inside block refs as a pinned marker', () => {
      expect(applyBlockPatch(parts(`跟进((20260310210016-gkixdit '📌 #Alpha 设计稿')) @2026-03-21 #done
{: id="abc"}`), {
        type: 'setContent',
        newItemContent: '新跟进',
      })).toBe(
        `新跟进 @2026-03-21 #done
{: id="abc"}`,
      );
    });
  });

  describe('setFocusPlan', () => {
    it('replaces existing focus plan markers and preserves other markers', () => {
      expect(applyBlockPatch(parts('事项 @2026-05-14 🍅x2 🔥\n{: id="abc"}'), {
        type: 'setFocusPlan',
        plan: { type: 'duration', rawValue: 70 },
      })).toBe(
        '事项 @2026-05-14 ⏳1h10m 🔥\n{: id="abc"}',
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

  describe('togglePinned', () => {
    it('adds a pinned marker to the item line', () => {
      expect(applyBlockPatch(parts('写日报 @2026-05-08\n{: id="abc"}'), {
        type: 'togglePinned',
      })).toBe(
        '写日报 @2026-05-08 📌\n{: id="abc"}',
      );
    });

    it('removes pinned markers from the item line', () => {
      expect(applyBlockPatch(parts('写日报 📌 @2026-05-08\n{: id="abc"}'), {
        type: 'togglePinned',
      })).toBe(
        '写日报 @2026-05-08\n{: id="abc"}',
      );
    });

    it('preserves extra lines and IAL while pinning', () => {
      expect(applyBlockPatch(parts(`写日报 @2026-05-08
🍅2026-05-08 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`), {
        type: 'togglePinned',
      })).toBe(
        `写日报 @2026-05-08 📌
🍅2026-05-08 09:00:00~09:25:00 第一轮
{: id="abc" custom-x="1"}`,
      );
    });

    it('toggles against the item line instead of descendant lines', () => {
      expect(applyBlockPatch(parts(`写日报 @2026-05-08
((20260510074935-sch6ybk '测试独立事项2  📌  '))
{: id="abc"}`), {
        type: 'togglePinned',
      })).toBe(
        `写日报 @2026-05-08 📌
((20260510074935-sch6ybk '测试独立事项2  📌  '))
{: id="abc"}`,
      );
    });
  });

  describe('habit patches', () => {
    it('replaces habit definition line and preserves IAL', () => {
      expect(applyBlockPatch(parts('喝水 🎯2026-04-01 6杯 🔄每天\n{: id="abc"}'), {
        type: 'setHabitDefinition',
        habit: {
          name: '喝水',
          startDate: '2026-04-01',
          type: 'count',
          target: 8,
          unit: '杯',
          frequency: { type: 'daily' },
        },
      })).toBe(
        '喝水 🎯2026-04-01 8杯 🔄每天\n{: id="abc"}',
      );
    });

    it('replaces habit record line and preserves IAL', () => {
      expect(applyBlockPatch(parts('喝水 1/8杯 📅2026-05-16\n{: id="abc"}'), {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-05-16',
          value: 3,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      })).toBe(
        '喝水 3/8杯 📅2026-05-16\n{: id="abc"}',
      );
    });

    it('writes missed habit record with trailing emoji', () => {
      expect(applyBlockPatch(parts('早起 📅2026-05-16\n{: id="abc"}'), {
        type: 'setHabitRecord',
        record: {
          content: '早起',
          habitType: 'binary',
          date: '2026-05-16',
          precision: 'day',
          recordStatus: 'missed',
        },
      })).toBe(
        '早起 📅2026-05-16 ❌\n{: id="abc"}',
      );
    });

    it('adds archive marker while preserving extra lines and IAL', () => {
      expect(applyBlockPatch(parts(`喝水 🎯2026-04-01 8杯 🔄每天
说明行
{: id="abc"}`), {
        type: 'setHabitArchive',
        archivedAt: '2026-05-04',
      })).toBe(
        `喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04
说明行
{: id="abc"}`,
      );
    });

    it('removes archive marker while preserving extra lines and IAL', () => {
      expect(applyBlockPatch(parts(`喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04
说明行
{: id="abc"}`), {
        type: 'setHabitArchive',
      })).toBe(
        `喝水 🎯2026-04-01 8杯 🔄每天
说明行
{: id="abc"}`,
      );
    });

    it('replaces markdown content and preserves original IAL by default', () => {
      expect(applyBlockPatch(parts('早起 📅2026-05-16\n{: id="abc" custom-x="1"}'), {
        type: 'replaceMarkdown',
        markdown: '早起 📅2026-05-16 #补签',
      })).toBe(
        '早起 📅2026-05-16 #补签\n{: id="abc" custom-x="1"}',
      );
    });

    it('replaces markdown with provided indented IAL when preserveIAL is false', () => {
      expect(applyBlockPatch(parts('早起 📅2026-05-16\n{: id="abc" custom-x="1"}'), {
        type: 'replaceMarkdown',
        markdown: '早起 📅2026-05-17\n  {: id="abc" custom-y="2"}',
        preserveIAL: false,
      })).toBe(
        '早起 📅2026-05-17\n  {: id="abc" custom-y="2"}',
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
      expect(result).toBe('任务 🔥 📅2026-05-16\n{: id="abc"}');
    });

    it('applies focus plan onto the primary line after replaceMarkdown for multiline task-list content', () => {
      const result = applyBlockPatches(parts('占位内容\n{: id="abc"}'), [
        {
          type: 'replaceMarkdown',
          markdown: `- {: updated="20260517144207" id="list-1"}[ ] 测试任务列表事项235 📅2026-05-13, 2026-05-17 #测试#
  测试换行
  {: id="abc" updated="20260517144207" bookmark="🍅"}`,
          preserveIAL: false,
        },
        {
          type: 'setFocusPlan',
          plan: { type: 'pomodoro', rawValue: 1 },
        },
      ]);

      expect(result).toBe(`- {: updated="20260517144207" id="list-1"}[ ] 测试任务列表事项235 📅2026-05-13, 2026-05-17 #测试# 🍅x1
  测试换行
  {: id="abc" updated="20260517144207" bookmark="🍅"}`);
    });

  });
});
