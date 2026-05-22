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

  if (plan.anchorText) {
    const anchorIndex = textContent.lastIndexOf(plan.anchorText);
    if (anchorIndex >= 0) {
      return anchorIndex + plan.anchorText.length;
    }
  }

  return textContent.length;
}

export async function commitViaProtyle(
  context: Pick<BlockWriteContext, 'protyle'>,
  payload: Extract<PreparedMutationPayload, { kind: 'update' }>,
): Promise<boolean> {
  const { protyle } = context;
  const targetElement = payload.targetElement;
  if (!protyle || !targetElement || typeof protyle.transaction !== 'function') {
    return false;
  }

  const oldHTML = payload.oldDomHtml ?? targetElement.outerHTML;
  if (!renderMarkdownIntoBlockEditable(protyle, targetElement, payload.nextMarkdown)) {
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
  protyle.transaction(
    [{ id: payload.targetBlockId, data: targetElement.outerHTML, action: 'update' }],
    [{ id: payload.targetBlockId, data: oldHTML, action: 'update' }],
  );

  if (payload.caretRestorePlan?.policy === 'wbr' && !focusByWbr(targetElement)) {
    focusByOffset(targetElement, payload.caretRestorePlan.fallbackOffset);
  }

  return true;
}
