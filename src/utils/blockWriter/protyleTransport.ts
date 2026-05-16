import type { BatchBlockPatch, BlockPatch, BlockWriteContext, SlashCommandPatch, StatusPatch } from './types';
import { deleteSlashRangeText } from './slashRange';

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

function handleSetStatusViaDOM(protyle: any, nodeElement: HTMLElement, blockId: string, patch: StatusPatch): boolean {
  const li = nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement;
  if (!li) return false;

  const taskAction = li.querySelector('.protyle-action--task') as HTMLElement;
  if (!taskAction) return false;

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

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  li.setAttribute('updated', ts);

  return true;
}

export async function writeViaProtyle(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const { blockId, protyle, nodeElement, slashRange, slashStartOffset } = context;
  if (!protyle || !nodeElement) return false;

  const patchList: BlockPatch[] = Array.isArray(patches) ? patches : [patches];

  const cursor = saveCursor();

  let handled = false;

  for (const patch of patchList) {
    if (patch.type === 'removeSlashCommands' && slashRange && slashStartOffset !== undefined) {
      for (const filter of patch.filters) {
        deleteSlashRangeText(slashRange, filter, slashStartOffset);
      }
      handled = true;
    } else if (patch.type === 'setStatus') {
      if (handleSetStatusViaDOM(protyle, nodeElement, blockId, patch)) {
        handled = true;
      }
    }
  }

  restoreCursor(cursor);

  return handled;
}