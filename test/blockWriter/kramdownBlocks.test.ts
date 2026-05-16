import { describe, expect, it } from 'vitest';
import { replaceContentLines, splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';

describe('kramdownBlocks', () => {
  it('splits content and trailing IAL', () => {
    const raw = '任务内容 📅2026-05-14\n{: id="abc" custom-reminder="yes"}';
    expect(splitKramdownBlock(raw)).toEqual({
      contentLines: ['任务内容 📅2026-05-14'],
      ialLines: ['{: id="abc" custom-reminder="yes"}'],
      raw,
    });
  });

  it('keeps pomodoro lines as content', () => {
    const raw = '任务内容 📅2026-05-14\n🍅 3/3\n{: id="abc"}';
    expect(splitKramdownBlock(raw).contentLines).toEqual(['任务内容 📅2026-05-14', '🍅 3/3']);
  });

  it('rebuilds with original IAL', () => {
    const parts = splitKramdownBlock('- [ ] 任务\n{: id="abc" custom-x="1"}');
    expect(replaceContentLines(parts, ['- [x] 任务'])).toBe('- [x] 任务\n{: id="abc" custom-x="1"}');
  });
});