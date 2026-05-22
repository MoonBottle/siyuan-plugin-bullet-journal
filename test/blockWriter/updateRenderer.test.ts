// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/blockWriter/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}));

import { prepareUpdatePayload } from '@/utils/blockWriter/updateRenderer';

describe('updateRenderer', () => {
  it('prepares nextMarkdown and domHtml for api updates', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        targetKind: 'paragraph',
        sourceKind: 'api-kramdown',
        commitKind: 'api-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1' },
        patches: [{ type: 'setPriority', priority: 'high' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        currentMarkdown: '任务\n{: id="block-1"}',
      },
    );

    expect(payload.kind).toBe('update');
    expect(payload.nextMarkdown).toContain('🔥');
    expect(payload.domHtml).toContain('🔥');
  });

  it('marks slash cleanup payloads as wbr-restored updates', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        targetKind: 'paragraph',
        sourceKind: 'protyle-dom',
        commitKind: 'protyle-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1', protyle: {}, nodeElement: document.createElement('div') as any },
        patches: [{ type: 'removeSlashCommand' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        currentMarkdown: '任务 /jt\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /jt</div></div>',
        targetElement: document.createElement('div'),
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1' },
      },
    );

    expect(payload.caretRestorePlan?.policy).toBe('wbr');
  });
});
