// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockKramdown: vi.fn(),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  blockElementToMarkdownContent: vi.fn(),
}));

import { getBlockKramdown } from '@/api';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { loadMutationSource } from '@/utils/blockWriter/sourceLoader';

describe('sourceLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    vi.mocked(blockElementToMarkdownContent).mockImplementation((_, element) => {
      return (element as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
    });
  });

  it('loads current block dom and caret snapshot for protyle updates', async () => {
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>';
    document.body.appendChild(node);

    const editable = node.querySelector('[contenteditable="true"]')!;
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const source = await loadMutationSource({
      kind: 'update',
      targetBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'protyle-dom',
      commitKind: 'protyle-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
      patches: [{ type: 'removeSlashCommand' }],
    });

    expect(source.kind).toBe('update');
    expect(source.targetElement).toBe(node);
    expect(source.currentMarkdown).toBe('任务');
    expect(source.caretSnapshot?.policy).toBe('wbr-first');
  });

  it('uses preserved slashRange when selection is already lost', async () => {
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.innerHTML = '<div contenteditable="true">任务 /rq</div>';
    document.body.appendChild(node);

    const editable = node.querySelector('[contenteditable="true"]')!;
    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);
    const savedRange = range.cloneRange();

    window.getSelection()?.removeAllRanges();

    const source = await loadMutationSource({
      kind: 'update',
      targetBlockId: 'block-1',
      sourceBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'protyle-dom',
      commitKind: 'protyle-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: {
        blockId: 'block-1',
        protyle: {},
        nodeElement: node as any,
        slashRange: savedRange,
        slashStartOffset: textNode.textContent!.indexOf('/rq'),
      },
      patches: [{ type: 'removeSlashCommand' }],
    });

    expect(source.kind).toBe('update');
    expect(source.currentMarkdown).toBe('任务');
    expect(source.caretSnapshot?.policy).toBe('wbr-first');
  });

  it('loads kramdown for api updates', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'parent-1',
      kramdown: '任务\n{: id="block-1"}',
    } as any);

    const source = await loadMutationSource({
      kind: 'update',
      targetBlockId: 'block-1',
      sourceBlockId: 'parent-1',
      targetKind: 'paragraph',
      sourceKind: 'api-kramdown',
      commitKind: 'api-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'block-1' },
      patches: [{ type: 'setPriority', priority: 'high' }],
    });

    expect(source.kind).toBe('update');
    expect(source.sourceBlockId).toBe('parent-1');
    expect(source.currentMarkdown).toContain('任务');
    expect(getBlockKramdown).toHaveBeenCalledWith('parent-1');
  });
});
