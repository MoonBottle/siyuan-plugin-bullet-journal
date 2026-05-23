// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/blockWriter/render/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  renderMarkdownIntoBlockEditable: vi.fn((_: unknown, targetElement: HTMLElement, markdown: string) => {
    const editable = targetElement.getAttribute('contenteditable') === 'true'
      ? targetElement
      : targetElement.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!editable) {
      return false;
    }
    editable.textContent = markdown.replace(/\n\{:[^}]*\}/g, '');
    return true;
  }),
}));

vi.mock('@/utils/blockWriter/render/datePatchRender', () => ({
  renderDatePatch: vi.fn((kramdown: string, patch: { date: string }) => `${kramdown}\n@${patch.date}`),
}));

import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender';
import { prepareUpdatePayload } from '@/utils/blockWriter/render/updateRenderer';

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
    const node = document.createElement('div');
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>';
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
        context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
        patches: [{ type: 'removeSlashCommand' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        currentMarkdown: '任务 /jt\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /jt</div></div>',
        targetElement: node,
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1', fallbackOffset: { start: 4, end: 4 } },
      },
    );

    expect(payload.caretRestorePlan?.policy).toBe('wbr');
    expect(payload.caretRestorePlan?.placement).toBe('line-end');
    expect(payload.caretRestorePlan?.lineIndex).toBe(0);
    expect(payload.transactionDomHtml).toContain('<wbr>');
  });

  it('suppresses caret restoration when the execution plan is not the caret owner', () => {
    const node = document.createElement('div');
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>';
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
        context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
        patches: [{ type: 'removeSlashCommand' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        currentMarkdown: '任务 /jt\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /jt</div></div>',
        targetElement: node,
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1', fallbackOffset: { start: 4, end: 4 } },
      },
      {
        caretOwner: false,
        caretPolicy: 'wbr',
      },
    );

    expect(payload.caretRestorePlan).toEqual({ policy: 'none' });
  });

  it('anchors caret at line end for slash cleanup with setTaskTag', () => {
    const node = document.createElement('div');
    node.innerHTML = '<div contenteditable="true">任务 /rw</div>';
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
        context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
        patches: [
          { type: 'removeSlashCommand' },
          { type: 'setTaskTag', tag: '📋' },
        ],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        currentMarkdown: '任务 /rw\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /rw</div></div>',
        targetElement: node,
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1', fallbackOffset: { start: 4, end: 4 } },
      },
    );

    expect(payload.nextMarkdown).toContain('📋');
    expect(payload.caretRestorePlan).toMatchObject({
      policy: 'wbr',
      placement: 'line-end',
      lineIndex: 0,
    });
    expect(payload.caretRestorePlan?.anchorText).toBeUndefined();
    expect(payload.transactionDomHtml).toContain('📋');
    expect(payload.transactionDomHtml).toContain('<wbr>');
  });

  it('targets the slash line end for multiline slash cleanup payloads', () => {
    const node = document.createElement('div');
    node.innerHTML = '<div contenteditable="true">测试任务列表事项236 /fq\n测试换行</div>';
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
        context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
        patches: [
          { type: 'removeSlashCommand' },
          { type: 'setStatus', status: 'abandoned' },
        ],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        sourceBlockId: 'block-1',
        currentMarkdown: '测试任务列表事项236\n测试换行\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">测试任务列表事项236 /fq\n测试换行</div></div>',
        targetElement: node,
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1', fallbackOffset: { start: 13, end: 13 } },
      },
    );

    expect(payload.caretRestorePlan).toMatchObject({
      policy: 'wbr',
      placement: 'line-end',
      lineIndex: 0,
    });
    expect(payload.nextMarkdown).toContain('❌');
  });

  it('restores caret on a split follow-up plan when planner assigns wbr ownership', () => {
    const node = document.createElement('div');
    node.innerHTML = '<div contenteditable="true">测试任务列表事项235 /fq\n测试换行</div>';
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'task-1',
        sourceBlockId: 'task-1',
        targetKind: 'task-list-item',
        sourceKind: 'protyle-dom',
        commitKind: 'protyle-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1', listItemBlockId: 'task-1', protyle: {}, nodeElement: node as any },
        patches: [{ type: 'setStatus', status: 'abandoned' }],
      },
      {
        kind: 'update',
        targetBlockId: 'task-1',
        sourceBlockId: 'task-1',
        currentMarkdown: '测试任务列表事项235\n测试换行\n{: id="task-1"}',
        currentDomHtml: '<div data-node-id="task-1"><div contenteditable="true">测试任务列表事项235\n测试换行</div></div>',
        targetElement: node,
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'task-1', fallbackOffset: { start: 13, end: 13 } },
      },
      {
        caretOwner: true,
        caretPolicy: 'wbr',
      },
    );

    expect(payload.caretRestorePlan).toMatchObject({
      policy: 'wbr',
      placement: 'line-end',
      lineIndex: 0,
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
          sourceMarkdown: '任务\n{: id="block-1"}',
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
    expect(vi.mocked(renderDatePatch)).toHaveBeenCalledWith(
      '任务\n{: id="block-1"}',
      { type: 'addDate', date: '2026-05-21', allDay: true },
      expect.objectContaining({
        originalBlockId: 'block-1',
        sourceBlockId: 'parent-1',
        targetItemBlockRaw: '任务\n{: id="block-1"}',
        usedParentDocumentContext: true,
        finalTargetBlockId: 'block-1',
      }),
    );
  });
});
