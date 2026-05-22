import { LineParser } from '@/parser/lineParser';
import { useProjectStore } from '@/stores';
import type { Item } from '@/types/models';
import { getSharedPinia } from '@/utils/sharedPinia';
import { deleteSlashRangeText, getActiveSlashRange } from '@/utils/blockWriter/shared/slashRange';

export interface ResolveSlashItemOptions {
  blockId: string;
  nodeElement?: HTMLElement | null;
}

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

function buildCandidateSemanticLine(
  nodeElement: HTMLElement,
  slashRange: Range,
  slashStartOffset: number,
): string | null {
  const editable = nodeElement.querySelector('[contenteditable="true"]') as HTMLElement | null;
  const root = editable ?? nodeElement;
  const path = getNodePath(root, slashRange.startContainer);
  if (!path) {
    return null;
  }

  const draftRoot = root.cloneNode(true) as HTMLElement;
  const draftStartNode = getNodeByPath(draftRoot, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const draftRange = document.createRange();
  draftRange.setStart(draftStartNode, slashRange.startOffset);
  draftRange.collapse(true);
  deleteSlashRangeText(draftRange, slashStartOffset);

  return draftRoot.textContent?.trim() ?? null;
}

function parseCandidateLine(candidateLine: string | null, blockId: string): Item | null {
  if (!candidateLine) {
    return null;
  }

  const parsed = LineParser.parseItemLine(candidateLine, 0)[0];
  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    id: parsed.id || blockId,
    blockId,
    docId: parsed.docId || '',
  };
}

function lookupItemFromStore(blockId: string): Item | null {
  const pinia = getSharedPinia();
  if (!pinia) {
    return null;
  }

  const projectStore = useProjectStore(pinia);
  return projectStore.getItemByBlockId(blockId) ?? null;
}

function resolveTaskListMetadata(nodeElement?: HTMLElement | null): Pick<Item, 'isTaskList' | 'listItemBlockId'> {
  const listItemElement = nodeElement?.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement | null;
  const listItemBlockId = listItemElement?.getAttribute('data-node-id') || undefined;
  return {
    isTaskList: Boolean(listItemBlockId),
    listItemBlockId,
  };
}

function mergeResolvedItemMetadata(
  candidate: Item,
  storeItem: Item | null,
  nodeElement?: HTMLElement | null,
): Item {
  const taskListMetadata = resolveTaskListMetadata(nodeElement);
  const preserveStoreId = candidate.id === candidate.blockId ? storeItem?.id : undefined;
  const preserveStoreDocId = candidate.docId || storeItem?.docId || '';

  return {
    ...(storeItem ?? {}),
    ...candidate,
    id: preserveStoreId || candidate.id,
    docId: preserveStoreDocId,
    isTaskList: candidate.isTaskList || storeItem?.isTaskList || taskListMetadata.isTaskList,
    listItemBlockId: taskListMetadata.listItemBlockId || storeItem?.listItemBlockId || candidate.listItemBlockId,
  };
}

export async function resolveItemForSlashCommand(options: ResolveSlashItemOptions): Promise<Item | null> {
  const { blockId, nodeElement } = options;
  const activeSlash = getActiveSlashRange();
  const storeItem = lookupItemFromStore(blockId);

  if (
    nodeElement
    && activeSlash
    && (activeSlash.blockId === blockId || nodeElement.contains(activeSlash.range.startContainer))
  ) {
    const candidate = parseCandidateLine(
      buildCandidateSemanticLine(nodeElement, activeSlash.range, activeSlash.slashStartOffset),
      blockId,
    );
    if (candidate) {
      return mergeResolvedItemMetadata(candidate, storeItem, nodeElement);
    }
  }

  if (storeItem) {
    const taskListMetadata = resolveTaskListMetadata(nodeElement);
    return {
      ...storeItem,
      isTaskList: storeItem.isTaskList || taskListMetadata.isTaskList,
      listItemBlockId: taskListMetadata.listItemBlockId || storeItem.listItemBlockId,
    };
  }

  return null;
}
