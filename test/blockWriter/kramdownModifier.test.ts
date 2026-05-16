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

  describe('removeSlashCommands', () => {
    it('removes first matching slash command', () => {
      expect(applyBlockPatch(parts('任务 /p=高的内容\n{: id="abc"}'), { type: 'removeSlashCommands', filters: ['p=高'], suffix: '' })).toBe(
        '任务 的内容\n{: id="abc"}',
      );
    });

    it('appends suffix after removal', () => {
      expect(
        applyBlockPatch(parts('任务 /done\n{: id="abc"}'), { type: 'removeSlashCommands', filters: ['done'], suffix: '#done' }),
      ).toBe('任务 #done\n{: id="abc"}');
    });

    it('removes with trailing whitespace', () => {
      expect(applyBlockPatch(parts('任务 /p=高 的内容\n{: id="abc"}'), { type: 'removeSlashCommands', filters: ['p=高'], suffix: '' })).toBe(
        '任务 的内容\n{: id="abc"}',
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

    it('applies removeSlashCommands + setPriority', () => {
      const result = applyBlockPatches(parts('任务 /p=高的内容\n{: id="abc"}'), [
        { type: 'removeSlashCommands', filters: ['p=高'], suffix: '' },
        { type: 'setPriority', priority: 'high' },
      ]);
      expect(result).toContain('🔥');
      expect(result).not.toContain('/p=高');
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
  });
});