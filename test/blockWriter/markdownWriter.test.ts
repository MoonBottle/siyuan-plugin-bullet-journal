// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  updateBlock: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  renderMarkdownIntoBlockEditable: vi.fn(),
}));

import { updateBlock } from '@/api';
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { createProtyleMarkdownWriter } from '@/utils/blockWriter';

function createBlock(blockId = 'block-1', text = '原始事项 /jt'): HTMLElement {
  const block = document.createElement('div');
  block.setAttribute('data-node-id', blockId);
  block.setAttribute('data-type', 'NodeParagraph');
  block.className = 'p';
  block.innerHTML = `
    <div contenteditable="true" spellcheck="false">${text}</div>
    <div class="protyle-attr" contenteditable="false">\u200b</div>
  `;
  document.body.appendChild(block);
  return block;
}

describe('createProtyleMarkdownWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('uses the protyle fast path for same-block single-line markdown', async () => {
    const block = createBlock();
    const protyle = {
      transaction: vi.fn(),
    };
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]');
      if (!editable) return false;
      editable.textContent = markdown;
      return true;
    });

    const writer = createProtyleMarkdownWriter({
      blockId: 'block-1',
      nodeElement: block,
      protyle,
    });

    const ok = await writer?.('更新后的事项 📅2026-05-14\n{: id="block-1"}', 'block-1');

    expect(ok).toBe(true);
    expect(renderMarkdownIntoBlockEditable).toHaveBeenCalledWith(
      protyle,
      block,
      '更新后的事项 📅2026-05-14',
    );
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('falls back to API markdown writes for complex updates', async () => {
    const block = createBlock();
    const protyle = {
      transaction: vi.fn(),
    };

    const writer = createProtyleMarkdownWriter({
      blockId: 'block-1',
      nodeElement: block,
      protyle,
    });

    const content = '[ ] 多行事项 📅2026-05-14\n  🍅2026-05-14 09:00:00~09:25:00\n{: id="block-1"}';
    const ok = await writer?.(content, 'parent-1');

    expect(ok).toBe(true);
    expect(protyle.transaction).not.toHaveBeenCalled();
    expect(updateBlock).toHaveBeenCalledWith('markdown', content, 'parent-1');
  });
});
