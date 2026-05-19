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
    vi.unstubAllGlobals();
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

  it('uses the protyle fast path for same-block multiline markdown', async () => {
    const block = createBlock('block-1', '第一行\n第二行 /jt');
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

    const ok = await writer?.('第一行 📅2026-05-14\n第二行\n{: id="block-1"}', 'block-1');

    expect(ok).toBe(true);
    expect(renderMarkdownIntoBlockEditable).toHaveBeenCalledWith(
      protyle,
      block,
      '第一行 📅2026-05-14\n第二行',
    );
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('falls back to API dom writes for complex updates when Lute is available', async () => {
    const block = createBlock();
    const protyle = {
      transaction: vi.fn(),
    };
    vi.stubGlobal('window', {
      ...window,
      Lute: {
        New: vi.fn(() => ({
          Md2BlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
          SetHTMLTag2TextMark: vi.fn(),
          SetTextMark: vi.fn(),
          SetProtyleWYSIWYG: vi.fn(),
          SetBlockRef: vi.fn(),
          SetFileAnnotationRef: vi.fn(),
          SetKramdownIAL: vi.fn(),
          SetTag: vi.fn(),
          SetSuperBlock: vi.fn(),
          SetImgPathAllowSpace: vi.fn(),
          SetGitConflict: vi.fn(),
          SetMark: vi.fn(),
          SetSup: vi.fn(),
          SetSub: vi.fn(),
          SetInlineMathAllowDigitAfterOpenMarker: vi.fn(),
          SetFootnotes: vi.fn(),
          SetToC: vi.fn(),
          SetIndentCodeBlock: vi.fn(),
          SetParagraphBeginningSpace: vi.fn(),
          SetAutoSpace: vi.fn(),
          SetHeadingID: vi.fn(),
          SetSetext: vi.fn(),
          SetYamlFrontMatter: vi.fn(),
          SetLinkRef: vi.fn(),
          SetCodeSyntaxHighlight: vi.fn(),
          SetSanitize: vi.fn(),
        })),
      },
    });

    const writer = createProtyleMarkdownWriter({
      blockId: 'block-1',
      nodeElement: block,
      protyle,
    });

    const content = '[ ] 多行事项 📅2026-05-14\n  🍅2026-05-14 09:00:00~09:25:00\n{: id="block-1"}';
    const ok = await writer?.(content, 'parent-1');

    expect(ok).toBe(true);
    expect(protyle.transaction).not.toHaveBeenCalled();
    expect(updateBlock).toHaveBeenCalledWith(
      'dom',
      `<div data-type="NodeParagraph">${content}</div>`,
      'parent-1',
    );
  });
});
