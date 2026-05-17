// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { deleteSlashRangeText, getActiveSlashRange } from '@/utils/blockWriter/slashRange';

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

    document.body.removeChild(div);
  });

  it('deletes from slash start to the current range end', () => {
    const textNode = document.createTextNode('keep /bwtest then /bwtest');
    const range = document.createRange();
    range.setStart(textNode, 'keep /bwtest then /bwtest'.length);
    range.collapse(true);

    deleteSlashRangeText(range, 'keep /bwtest then '.length);

    expect(textNode.textContent).toBe('keep /bwtest then ');
  });

  it('deletes from Chinese punctuation command trigger to the current range end', () => {
    const textNode = document.createTextNode('keep 、wc');
    const range = document.createRange();
    range.setStart(textNode, 'keep 、wc'.length);
    range.collapse(true);

    deleteSlashRangeText(range, 'keep '.length);

    expect(textNode.textContent).toBe('keep ');
  });
});
