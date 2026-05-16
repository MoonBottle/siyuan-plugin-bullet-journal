import { describe, expect, it } from 'vitest';
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';
import { isTaskListFormat } from '@/utils/blockWriter/itemLineMarkers';

describe('splitKramdownBlock (TDD)', () => {
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
});

describe('isTaskListFormat', () => {
  it('detects task list checkbox', () => {
    expect(isTaskListFormat('- [ ] 任务')).toBe(true);
    expect(isTaskListFormat('- [x] 任务')).toBe(true);
    expect(isTaskListFormat('- [X] 任务')).toBe(true);
    expect(isTaskListFormat('普通文本')).toBe(false);
  });
});