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
        '- [x] 任务 #已完成\n{: id="abc"}',
      );
    });

    it('abandons task list', () => {
      expect(applyBlockPatch(parts('- [x] 任务\n{: id="abc"}'), { type: 'setStatus', status: 'abandoned' })).toBe(
        '- [ ] 任务 #已放弃\n{: id="abc"}',
      );
    });

    it('completes pending non-task-list', () => {
      expect(applyBlockPatch(parts('任务\n{: id="abc"}'), { type: 'setStatus', status: 'completed' })).toBe(
        '任务 #已完成\n{: id="abc"}',
      );
    });

    it('reverts completed to pending', () => {
      expect(applyBlockPatch(parts('- [x] 任务 #已完成\n{: id="abc"}'), { type: 'setStatus', status: 'pending' })).toBe(
        '- [ ] 任务\n{: id="abc"}',
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
      expect(result).toContain('#已完成');
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
