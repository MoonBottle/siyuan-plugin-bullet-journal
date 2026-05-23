// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { deleteSlashRangeText, getActiveSlashRange } from '@/utils/blockWriter/shared/slashRange';

describe('slashRange', () => {
  it('finds the slash before the cursor instead of the last slash in the block', () => {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block-1');
    div.textContent = 'keep /first then /second';
    document.body.appendChild(div);

    const textNode = div.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 'keep /first'.length);
    range.collapse(true);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const slash = getActiveSlashRange();

    expect(slash?.slashStartOffset).toBe('keep '.length);
    expect(slash?.slashEndOffset).toBe('keep /first'.length);

    document.body.removeChild(div);
  });

  it('finds the Chinese punctuation command trigger before the cursor', () => {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block-1');
    div.textContent = 'keep 、wc';
    document.body.appendChild(div);

    const textNode = div.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, div.textContent.length);
    range.collapse(true);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const slash = getActiveSlashRange();

    expect(slash?.slashStartOffset).toBe('keep '.length);
    expect(slash?.slashEndOffset).toBe(div.textContent.length);

    document.body.removeChild(div);
  });

  it('deletes from slash start to the explicit command end', () => {
    const textNode = document.createTextNode('keep /bwtest then /bwtest');
    const range = document.createRange();
    range.setStart(textNode, 'keep /bwtest then /bwtest'.length);
    range.collapse(true);

    deleteSlashRangeText(
      range,
      'keep /bwtest then '.length,
      'keep /bwtest then /bwtest'.length,
    );

    expect(textNode.textContent).toBe('keep /bwtest then ');
  });

  it('deletes from Chinese punctuation command trigger to the current range end', () => {
    const textNode = document.createTextNode('keep 、wc');
    const range = document.createRange();
    range.setStart(textNode, 'keep 、wc'.length);
    range.collapse(true);

    deleteSlashRangeText(range, 'keep '.length, 'keep 、wc'.length);

    expect(textNode.textContent).toBe('keep ');
  });

  it('deletes the matched slash command even when the selection is collapsed at command start', () => {
    const textNode = document.createTextNode('测试 📅2026-05-21 08:43 /fq\u200B');
    const range = document.createRange();
    range.setStart(textNode, '测试 📅2026-05-21 08:43 '.length);
    range.collapse(true);

    deleteSlashRangeText(range, '测试 📅2026-05-21 08:43 '.length);

    expect(textNode.textContent).toBe('测试 📅2026-05-21 08:43 ');
  });

  it('deletes only the slash command and preserves trailing marker text for infix triggers', () => {
    const textNode = document.createTextNode('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0');
    const range = document.createRange();
    range.setStart(textNode, '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0'.length);
    range.collapse(true);

    deleteSlashRangeText(
      range,
      '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0'.length,
      '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj'.length,
    );

    expect(textNode.textContent).toBe('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00');
  });
});
