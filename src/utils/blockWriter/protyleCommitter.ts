import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { focusByOffset, focusByWbr, injectWbrIntoEditable } from './caretController';
import type { BlockWriteContext, PreparedMutationPayload } from './types';

function formatUpdatedAttr(date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

function resolveWbrOffset(
  editable: HTMLElement,
  plan: Extract<PreparedMutationPayload, { kind: 'update' }>['caretRestorePlan'],
): number | undefined {
  const textContent = editable.textContent ?? '';
  if (!plan) {
    return undefined;
  }

  if (typeof plan.targetOffset === 'number') {
    return Math.max(0, Math.min(plan.targetOffset, textContent.length));
  }

  if (typeof plan.lineIndex === 'number') {
    const lines = textContent.split('\n');
    const safeLineIndex = Math.max(0, Math.min(plan.lineIndex, Math.max(0, lines.length - 1)));
    let lineStartOffset = 0;
    for (let index = 0; index < safeLineIndex; index += 1) {
      lineStartOffset += lines[index].length + 1;
    }
    const targetLine = lines[safeLineIndex] ?? '';

    if (plan.anchorText) {
      const anchorIndex = targetLine.lastIndexOf(plan.anchorText);
      if (anchorIndex >= 0) {
        return lineStartOffset + anchorIndex + plan.anchorText.length;
      }
    }

    if (plan.placement === 'line-end') {
      return lineStartOffset + targetLine.length;
    }
  }

  if (plan.anchorText) {
    const anchorIndex = textContent.lastIndexOf(plan.anchorText);
    if (anchorIndex >= 0) {
      return anchorIndex + plan.anchorText.length;
    }
  }

  return textContent.length;
}

function previewText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').slice(0, 160);
}

export async function commitViaProtyle(
  context: Pick<BlockWriteContext, 'protyle'>,
  payload: Extract<PreparedMutationPayload, { kind: 'update' }>,
): Promise<boolean> {
  const { protyle } = context;
  const targetElement = payload.targetElement;
  if (!protyle || !targetElement || typeof protyle.transaction !== 'function') {
    console.log('[BWDBG][protyleCommitter] unavailable', {
      hasProtyle: Boolean(protyle),
      hasTargetElement: Boolean(targetElement),
      hasTransaction: typeof protyle?.transaction === 'function',
      targetBlockId: payload.targetBlockId,
    });
    return false;
  }

  const oldHTML = payload.oldDomHtml ?? targetElement.outerHTML;
  console.log('[BWDBG][protyleCommitter] before render', {
    targetBlockId: payload.targetBlockId,
    beforePreview: previewText(targetElement.textContent),
    nextMarkdownPreview: previewText(payload.nextMarkdown),
    caretPolicy: payload.caretRestorePlan?.policy ?? 'none',
  });
  if (!renderMarkdownIntoBlockEditable(protyle, targetElement, payload.nextMarkdown)) {
    console.log('[BWDBG][protyleCommitter] render failed', {
      targetBlockId: payload.targetBlockId,
      nextMarkdownPreview: previewText(payload.nextMarkdown),
    });
    return false;
  }

  if (payload.caretRestorePlan?.policy === 'wbr') {
    const editable = targetElement.getAttribute('contenteditable') === 'true'
      ? targetElement
      : targetElement.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (editable) {
      injectWbrIntoEditable(editable, resolveWbrOffset(editable, payload.caretRestorePlan));
    }
  }

  targetElement.setAttribute('updated', formatUpdatedAttr());
  console.log('[BWDBG][protyleCommitter] before transaction', {
    targetBlockId: payload.targetBlockId,
    afterRenderPreview: previewText(targetElement.textContent),
  });
  protyle.transaction(
    [{ id: payload.targetBlockId, data: targetElement.outerHTML, action: 'update' }],
    [{ id: payload.targetBlockId, data: oldHTML, action: 'update' }],
  );

  if (payload.caretRestorePlan?.policy === 'wbr') {
    const restoredByWbr = focusByWbr(targetElement);
    console.log('[BWDBG][protyleCommitter] caret restore', {
      targetBlockId: payload.targetBlockId,
      restoredByWbr,
      fallbackOffset: payload.caretRestorePlan.fallbackOffset,
    });
    if (!restoredByWbr) {
      focusByOffset(targetElement, payload.caretRestorePlan.fallbackOffset);
    }
  }

  return true;
}
