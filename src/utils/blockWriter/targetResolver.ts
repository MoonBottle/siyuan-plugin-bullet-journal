import { getBlockByID } from '@/api';
import type { BlockMutationIntent, ResolvedMutationPlan } from './types';

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
): boolean {
  const nodeBlockId = intent.context.nodeElement?.getAttribute?.('data-node-id');
  return Boolean(intent.context.protyle && intent.context.nodeElement && nodeBlockId === targetBlockId);
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

  const targetBlockId = await resolveUpdateTargetBlockId(intent);
  const block = await getBlockByID(targetBlockId);
  const useCurrentProtyle = canUseCurrentProtyleDom(intent, targetBlockId);

  return {
    kind: 'update',
    targetBlockId,
    targetKind: resolveTargetKind(block),
    sourceKind: useCurrentProtyle ? 'protyle-dom' : 'api-kramdown',
    commitKind: useCurrentProtyle ? 'protyle-update' : 'api-update',
    preferDataType: 'dom',
    fallbackDataType: 'markdown',
    context: intent.context,
    patches: intent.patches,
  };
}
