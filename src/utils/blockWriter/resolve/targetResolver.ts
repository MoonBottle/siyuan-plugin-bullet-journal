import { getBlockByID } from '@/api';
import type { BlockMutationIntent, DatePatchSourceContext, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';
import { resolveDatePatchSource } from '@/utils/blockWriter/compat/datePatchWriter';

function subtypeOf(block: any): string | undefined {
  return block?.subtype ?? block?.subType;
}

function parentIdOf(block: any): string | undefined {
  return block?.parent_id ?? block?.parentId;
}

function isTaskListNode(block: any): boolean {
  const type = block?.type;
  return (type === 'NodeListItem' || type === 'i') && subtypeOf(block) === 't';
}

async function resolveUpdateTargetBlockId(intent: Extract<BlockMutationIntent, { kind: 'update' }>): Promise<string> {
  const datePatchSource = await resolveDateSourceContext(intent);
  if (datePatchSource) {
    return datePatchSource.finalTargetBlockId;
  }

  if (!intent.patches.some(patch => patch.type === 'setStatus')) {
    return intent.context.listItemBlockId || intent.context.blockId;
  }

  const startBlockId = intent.context.blockId;
  let current = await getBlockByID(startBlockId);
  const visited = new Set<string>();

  for (let depth = 0; current && depth < 8; depth += 1) {
    if (isTaskListNode(current)) {
      return current.id;
    }

    const parentId = parentIdOf(current);
    if (!parentId || visited.has(parentId)) {
      break;
    }
    visited.add(parentId);
    current = await getBlockByID(parentId);
  }

  return intent.context.listItemBlockId || startBlockId;
}

async function resolveDateSourceContext(
  intent: Extract<BlockMutationIntent, { kind: 'update' }>,
): Promise<DatePatchSourceContext | null> {
  if (!intent.patches.some(patch => patch.type === 'addDate')) {
    return null;
  }

  const resolved = await resolveDatePatchSource(intent.context.blockId);
  if (!resolved) {
    return null;
  }

  return {
    originalBlockId: resolved.originalBlockId,
    sourceBlockId: resolved.targetBlockId,
    sourceMarkdown: resolved.kramdown,
    targetItemBlockRaw: resolved.targetItemBlockRaw,
    usedParentDocumentContext: resolved.usedParentDocumentContext,
    finalTargetBlockId: resolved.usedParentDocumentContext && resolved.targetItemBlockRaw
      ? resolved.originalBlockId
      : resolved.targetBlockId,
  };
}

function resolveTargetKind(block: any): 'paragraph' | 'task-list-item' | 'block' {
  if (isTaskListNode(block)) {
    return 'task-list-item';
  }
  if (block?.type === 'NodeParagraph' || block?.type === 'p') {
    return 'paragraph';
  }
  return 'block';
}

function canUseCurrentProtyleDom(
  intent: Extract<BlockMutationIntent, { kind: 'update' }>,
  targetBlockId: string,
  sourceBlockId: string,
): boolean {
  const nodeElement = intent.context.nodeElement;
  if (!intent.context.protyle || !nodeElement || sourceBlockId !== targetBlockId) {
    return false;
  }

  if (nodeElement.getAttribute?.('data-node-id') === targetBlockId) {
    return true;
  }

  return Boolean(nodeElement.closest?.(`[data-node-id="${targetBlockId}"]`));
}

export async function resolveMutationTarget(intent: BlockMutationIntent): Promise<ResolvedMutationPlan> {
  if (intent.kind === 'insertAfter') {
    return {
      kind: 'insertAfter',
      anchorBlockId: intent.anchorBlockId,
      commitKind: 'api-insert',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      patch: intent.patch,
      context: intent.context,
      resultMode: intent.resultMode,
    };
  }

  const datePatchSource = await resolveDateSourceContext(intent);
  const targetBlockId = datePatchSource?.finalTargetBlockId ?? await resolveUpdateTargetBlockId(intent);
  const block = await getBlockByID(targetBlockId);
  const sourceBlockId = datePatchSource?.sourceBlockId ?? targetBlockId;
  const useCurrentProtyle = canUseCurrentProtyleDom(intent, targetBlockId, sourceBlockId);

  return {
    kind: 'update',
    targetBlockId,
    targetKind: resolveTargetKind(block),
    sourceKind: useCurrentProtyle ? 'protyle-dom' : 'api-kramdown',
    sourceBlockId,
    commitKind: useCurrentProtyle ? 'protyle-update' : 'api-update',
    preferDataType: 'dom',
    fallbackDataType: 'markdown',
    context: intent.context,
    patches: intent.patches,
    datePatchSource: datePatchSource ?? undefined,
  };
}
