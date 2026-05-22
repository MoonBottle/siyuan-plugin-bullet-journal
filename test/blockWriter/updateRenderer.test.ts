// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/blockWriter/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}));

vi.mock('@/utils/blockWriter/datePatchWriter', () => ({
  prepareDatePatchWriteFromSource: vi.fn((source: { kramdown: string; finalTargetBlockId?: string; targetBlockId: string }, patch: { date: string }) => ({
    content: `${source.kramdown}\n@${patch.date}`,
    targetBlockId: source.finalTargetBlockId ?? source.targetBlockId,
  })),
}));

import { prepareDatePatchWriteFromSource } from '@/utils/blockWriter/datePatchWriter';
import { prepareUpdatePayload } from '@/utils/blockWriter/updateRenderer';

describe('updateRenderer', () => {
  it('prepares nextMarkdown and domHtml for api updates', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
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
        sourceBlockId: 'block-1',
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
        sourceBlockId: 'block-1',
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
        sourceBlockId: 'block-1',
        currentMarkdown: '任务 /jt\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /jt</div></div>',
        targetElement: document.createElement('div'),
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1' },
      },
    );

    expect(payload.caretRestorePlan?.policy).toBe('wbr');
    expect(payload.caretRestorePlan?.placement).toBe('block-end');
  });

  it('anchors caret after inserted suffix content when slash cleanup and setContent share one plan', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        targetKind: 'paragraph',
        sourceKind: 'protyle-dom',
        commitKind: 'protyle-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1', protyle: {}, nodeElement: document.createElement('div') as any },
        patches: [
          { type: 'removeSlashCommand' },
          { type: 'setContent', suffix: '📋' },
        ],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        currentMarkdown: '任务 /rw\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /rw</div></div>',
        targetElement: document.createElement('div'),
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1' },
      },
    );

    expect(payload.nextMarkdown).toContain('📋');
    expect(payload.caretRestorePlan).toMatchObject({
      policy: 'wbr',
      placement: 'after-inserted-text',
      anchorText: '📋',
    });
  });

  it('keeps target block while rendering date patches from a different source block', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'parent-1',
        targetKind: 'paragraph',
        sourceKind: 'api-kramdown',
        commitKind: 'api-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1' },
        patches: [{ type: 'addDate', date: '2026-05-21', allDay: true }],
        datePatchSource: {
          originalBlockId: 'block-1',
          sourceBlockId: 'parent-1',
          targetItemBlockRaw: '任务\n{: id="block-1"}',
          usedParentDocumentContext: true,
          finalTargetBlockId: 'block-1',
        },
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'parent-1',
        currentMarkdown: '任务\n{: id="block-1"}',
      },
    );

    expect(payload.targetBlockId).toBe('block-1');
    expect(payload.nextMarkdown).toContain('@2026-05-21');
    expect(vi.mocked(prepareDatePatchWriteFromSource)).toHaveBeenCalledWith(
      expect.objectContaining({
        originalBlockId: 'block-1',
        targetBlockId: 'parent-1',
        finalTargetBlockId: 'block-1',
      }),
      { type: 'addDate', date: '2026-05-21', allDay: true },
    );
  });
});
