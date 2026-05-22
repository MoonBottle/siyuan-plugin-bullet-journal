import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { focusByOffset, focusByWbr } from './caretController';
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

export async function commitViaProtyle(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
  payload: Extract<PreparedMutationPayload, { kind: 'update' }>,
): Promise<boolean> {
  const { protyle, nodeElement, blockId } = context;
  if (!protyle || !nodeElement || payload.targetBlockId !== blockId || typeof protyle.transaction !== 'function') {
    return false;
  }

  const oldHTML = payload.oldDomHtml ?? nodeElement.outerHTML;
  if (!renderMarkdownIntoBlockEditable(protyle, nodeElement, payload.nextMarkdown)) {
    return false;
  }

  nodeElement.setAttribute('updated', formatUpdatedAttr());
  protyle.transaction(
    [{ id: blockId, data: nodeElement.outerHTML, action: 'update' }],
    [{ id: blockId, data: oldHTML, action: 'update' }],
  );

  if (payload.caretRestorePlan?.policy === 'wbr' && !focusByWbr(nodeElement)) {
    const fallbackOffset = payload.targetElement ? undefined : undefined;
    focusByOffset(nodeElement, fallbackOffset);
  }

  return true;
}
