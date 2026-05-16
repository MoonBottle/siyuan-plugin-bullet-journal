import type { BatchBlockPatch, BlockPatch, BlockWriteContext } from './types';
import { deleteSlashRangeText } from './slashRange';
import { writeViaApi } from './apiTransport';

function formatUpdatedAttr(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

function commitProtyleUpdate(protyle: any, id: string, newHTML: string, oldHTML: string): boolean {
  if (newHTML === oldHTML) return true;
  if (!protyle?.transaction) return false;
  protyle.transaction(
    [{ id, data: newHTML, action: 'update' }],
    [{ id, data: oldHTML, action: 'update' }],
  );
  return true;
}

export async function writeViaProtyle(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const { protyle, nodeElement } = context;
  if (!protyle || !nodeElement) return false;

  const patchArray = Array.isArray(patches) ? patches : [patches];

  if (!patchArray.some(p => p.type === 'removeSlashCommands')) {
    return false;
  }

  if (patchArray.length > 2 || patchArray.some(p => p.type === 'setContent')) {
    return false;
  }

  const slashPatch = patchArray.find(p => p.type === 'removeSlashCommands');
  if (slashPatch && context.slashRange && context.slashStartOffset !== undefined) {
    const oldHTML = nodeElement.outerHTML;
    if (context.slashRange) {
      deleteSlashRangeText(context.slashRange, context.slashStartOffset);
    }
    if (slashPatch.suffix) {
      context.slashRange.insertNode(document.createTextNode(` ${slashPatch.suffix}`));
      context.slashRange.collapse(false);
    }
    nodeElement.setAttribute('updated', formatUpdatedAttr(new Date()));
    const spunHTML = protyle.lute?.SpinBlockDOM
      ? protyle.lute.SpinBlockDOM(nodeElement.outerHTML)
      : nodeElement.outerHTML;
    nodeElement.outerHTML = spunHTML;
    const newElement = protyle.wysiwyg?.element?.querySelector(
      `[data-node-id="${context.blockId}"]`,
    ) as HTMLElement | null;
    return commitProtyleUpdate(
      protyle,
      context.blockId,
      newElement?.outerHTML ?? spunHTML,
      oldHTML,
    );
  }

  return false;
}