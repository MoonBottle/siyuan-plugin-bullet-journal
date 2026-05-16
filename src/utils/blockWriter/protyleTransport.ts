import type { BatchBlockPatch, BlockPatch, BlockWriteContext, StatusPatch } from './types';
import { deleteSlashRangeText, getActiveSlashRange } from './slashRange';

interface CursorState {
  node: Node;
  offset: number;
}

function saveCursor(): CursorState | null {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    return { node: range.startContainer, offset: range.startOffset };
  } catch {
    return null;
  }
}

function restoreCursor(saved: CursorState | null): void {
  if (!saved) return;
  try {
    const maxOffset = (saved.node.textContent ?? '').length;
    const safeOffset = Math.min(saved.offset, maxOffset);
    const range = document.createRange();
    range.setStart(saved.node, safeOffset);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch {
    // best-effort cursor restoration
  }
}

function formatUpdatedAttr(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
}

function canCommit(protyle: any): boolean {
  return typeof protyle?.transaction === 'function' || Array.isArray((window as any).siyuan?.transactions);
}

function commitProtyleUpdate(protyle: any, id: string, targetElement: HTMLElement, oldHTML: string): boolean {
  const rawNewHTML = targetElement.outerHTML;
  const newHTML = typeof protyle?.lute?.SpinBlockDOM === 'function'
    ? protyle.lute.SpinBlockDOM(rawNewHTML)
    : rawNewHTML;

  if (newHTML === oldHTML) return true;

  const doOperations = [{
    id,
    data: newHTML,
    action: 'update',
  }];
  const undoOperations = [{
    id,
    data: oldHTML,
    action: 'update',
  }];

  if (typeof protyle?.transaction === 'function') {
    protyle.transaction(doOperations, undoOperations);
    return true;
  }

  const transactions = (window as any).siyuan?.transactions;
  if (Array.isArray(transactions)) {
    transactions.push({
      protyle,
      doOperations,
      undoOperations,
    });
    return true;
  }

  return false;
}

function handleSetStatusViaDOM(protyle: any, nodeElement: HTMLElement, patch: StatusPatch): boolean {
  if (!canCommit(protyle)) return false;

  const li = nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement;
  if (!li) return false;

  const taskAction = li.querySelector('.protyle-action--task') as HTMLElement;
  if (!taskAction) return false;

  const listItemId = li.getAttribute('data-node-id');
  if (!listItemId) return false;

  const oldHTML = li.outerHTML;
  const isDone = patch.status === 'completed';

  if (isDone) {
    li.classList.add('protyle-task--done');
    li.setAttribute('data-task', 'X');
    const useEl = taskAction.querySelector('use');
    if (useEl) useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#iconCheck');
  } else {
    li.classList.remove('protyle-task--done');
    li.setAttribute('data-task', ' ');
    const useEl = taskAction.querySelector('use');
    if (useEl) useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#iconUncheck');
  }

  li.setAttribute('updated', formatUpdatedAttr());

  return commitProtyleUpdate(protyle, listItemId, li, oldHTML);
}

function handleRemoveSlashViaDOM(
  protyle: any,
  nodeElement: HTMLElement,
  blockId: string,
  slashRange: Range,
  slashStartOffset: number,
  patch: Extract<BlockPatch, { type: 'removeSlashCommand' }>,
): boolean {
  if (!canCommit(protyle)) return false;

  const oldHTML = nodeElement.outerHTML;
  deleteSlashRangeText(slashRange, slashStartOffset);

  if (patch.suffix) {
    slashRange.insertNode(document.createTextNode(` ${patch.suffix}`));
    slashRange.collapse(false);
  }

  nodeElement.setAttribute('updated', formatUpdatedAttr());
  return commitProtyleUpdate(protyle, blockId, nodeElement, oldHTML);
}

function resolveSlashContext(context: BlockWriteContext): {
  blockId: string;
  nodeElement: HTMLElement;
  slashRange: Range;
  slashStartOffset: number;
} | null {
  const { blockId, nodeElement, slashRange, slashStartOffset } = context;
  if (!nodeElement) return null;

  if (slashRange && slashStartOffset !== undefined) {
    return {
      blockId,
      nodeElement,
      slashRange,
      slashStartOffset,
    };
  }

  const activeSlash = getActiveSlashRange();
  if (!activeSlash) return null;

  if (
    activeSlash.blockId !== blockId
    && activeSlash.blockElement !== nodeElement
    && !nodeElement.contains(activeSlash.range.startContainer)
  ) {
    return null;
  }

  return {
    blockId: activeSlash.blockId,
    nodeElement: activeSlash.blockElement,
    slashRange: activeSlash.range,
    slashStartOffset: activeSlash.slashStartOffset,
  };
}

export async function writeViaProtyle(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const { protyle, nodeElement } = context;
  if (!protyle || !nodeElement) return false;

  const patchList: BlockPatch[] = Array.isArray(patches) ? patches : [patches];

  const cursor = saveCursor();

  let handled = false;

  for (const patch of patchList) {
    if (patch.type === 'removeSlashCommand') {
      const slashContext = resolveSlashContext(context);
      if (slashContext && handleRemoveSlashViaDOM(
        protyle,
        slashContext.nodeElement,
        slashContext.blockId,
        slashContext.slashRange,
        slashContext.slashStartOffset,
        patch,
      )) {
        handled = true;
      }
    } else if (patch.type === 'setStatus') {
      if (handleSetStatusViaDOM(protyle, nodeElement, patch)) {
        handled = true;
      }
    }
  }

  restoreCursor(cursor);

  return handled;
}
