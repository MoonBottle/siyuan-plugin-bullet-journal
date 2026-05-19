import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';
import { processLineText } from '@/utils/slashCommandUtils';
import { blockElementToMarkdownContent, renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { applyBlockPatch } from './kramdownModifier';
import { splitKramdownBlock } from './kramdownBlocks';
import { deleteSlashRangeText, getActiveSlashRange } from './slashRange';
import type { BlockWriteContext, StatusPatch } from './types';

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = target;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) {
      return null;
    }
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function getNodeByPath(root: Node, path: number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    current = current?.childNodes?.[index] ?? null;
    if (!current) {
      return null;
    }
  }
  return current;
}

function resolveSlashContext(context: Pick<BlockWriteContext, 'blockId' | 'nodeElement' | 'slashRange' | 'slashStartOffset'>): {
  blockId: string;
  nodeElement: HTMLElement;
  slashRange: Range;
  slashStartOffset: number;
} | null {
  const { blockId, nodeElement, slashRange, slashStartOffset } = context;
  if (!nodeElement) {
    return null;
  }

  if (slashRange && slashStartOffset !== undefined) {
    return {
      blockId,
      nodeElement,
      slashRange,
      slashStartOffset,
    };
  }

  const activeSlash = getActiveSlashRange();
  if (!activeSlash) {
    return null;
  }

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

export async function writeTaskListStatusWithSlashCleanup(
  context: Pick<BlockWriteContext, 'blockId' | 'listItemBlockId' | 'protyle' | 'nodeElement' | 'slashRange' | 'slashStartOffset'>,
  patch: StatusPatch,
): Promise<boolean> {
  if (patch.status !== 'abandoned') {
    return false;
  }

  const { protyle, nodeElement } = context;
  if (!protyle || !nodeElement) {
    return false;
  }

  const listItemElement = nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement | null;
  if (!listItemElement) {
    return false;
  }

  const listItemId = context.listItemBlockId || listItemElement.getAttribute('data-node-id');
  if (!listItemId) {
    return false;
  }

  const slashContext = resolveSlashContext(context);
  if (!slashContext) {
    return false;
  }

  const paragraphId = slashContext.nodeElement.getAttribute('data-node-id');
  if (!paragraphId) {
    return false;
  }

  const path = getNodePath(slashContext.nodeElement, slashContext.slashRange.startContainer);
  if (!path) {
    return false;
  }

  const draftListItem = listItemElement.cloneNode(true) as HTMLElement;
  const draftParagraph = draftListItem.querySelector(`[data-node-id="${paragraphId}"]`) as HTMLElement | null;
  if (!draftParagraph) {
    return false;
  }

  const draftStartNode = getNodeByPath(draftParagraph, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    return false;
  }

  const draftRange = document.createRange();
  draftRange.setStart(draftStartNode, slashContext.slashRange.startOffset);
  draftRange.collapse(true);
  deleteSlashRangeText(draftRange, slashContext.slashStartOffset);

  const currentMarkdown = blockElementToMarkdownContent(protyle, draftListItem);
  if (!currentMarkdown) {
    return false;
  }

  const nextMarkdown = applyBlockPatch(
    splitKramdownBlock(
      currentMarkdown
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('{:')) {
            return line;
          }
          return processLineText(line, ALL_SLASH_COMMAND_FILTERS);
        })
        .join('\n'),
    ),
    patch,
  );

  const oldHTML = listItemElement.outerHTML;
  if (!renderMarkdownIntoBlockEditable(protyle, listItemElement, nextMarkdown)) {
    return false;
  }

  const updated = formatUpdatedAttr();
  listItemElement.setAttribute('updated', updated);
  nodeElement.setAttribute('updated', updated);

  const rawNewHTML = listItemElement.outerHTML;
  const newHTML = typeof protyle?.lute?.SpinBlockDOM === 'function'
    ? protyle.lute.SpinBlockDOM(rawNewHTML)
    : rawNewHTML;

  if (newHTML === oldHTML) {
    return true;
  }

  const doOperations = [{
    id: listItemId,
    data: newHTML,
    action: 'update',
  }];
  const undoOperations = [{
    id: listItemId,
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
