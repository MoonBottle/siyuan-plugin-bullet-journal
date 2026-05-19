import { getBlockByID, getBlockKramdown } from '@/api';
import type { BlockPatch, KramdownBlockParts, ResolvedBlockTarget } from './types';
import { splitKramdownBlock } from './kramdownBlocks';
import { isTaskListFormat } from './itemLineMarkers';

const BLOCK_TARGET_RESOLVER_LOG_PREFIX = '[BJ-BlockTargetResolver]';

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

function normalizeResolvedType(block: any): string | undefined {
  if (!block?.type) return undefined;
  if (block.type === 'i') return 'NodeListItem';
  if (block.type === 'p') return 'NodeParagraph';
  return block.type;
}

async function findNearestTaskListAncestor(block: any): Promise<{
  taskListBlock: any | null;
  chain: Array<{ id?: string; type?: string; subtype?: string; parentId?: string }>;
}> {
  const chain: Array<{ id?: string; type?: string; subtype?: string; parentId?: string }> = [];
  const visited = new Set<string>();
  let current = block;

  for (let depth = 0; current && depth < 8; depth += 1) {
    chain.push({
      id: current?.id,
      type: current?.type,
      subtype: subtypeOf(current),
      parentId: parentIdOf(current),
    });
    if (isTaskListNode(current)) {
      return { taskListBlock: current, chain };
    }

    const parentId = parentIdOf(current);
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    current = await getBlockByID(parentId);
  }

  return { taskListBlock: null, chain };
}

export async function resolveApiBlockTarget(blockId: string, patch: BlockPatch): Promise<ResolvedBlockTarget> {
  let targetBlockId = blockId;
  let targetType: string | undefined;
  let targetSubType: string | undefined;
  let replaceMode: 'whole-block' | 'raw-within-parent' = 'whole-block';

  const block = await getBlockByID(blockId);

  if (patch.type === 'setStatus' && block) {
    const { taskListBlock, chain } = await findNearestTaskListAncestor(block);
    if (taskListBlock) {
      targetBlockId = taskListBlock.id;
      targetType = normalizeResolvedType(taskListBlock);
      targetSubType = subtypeOf(taskListBlock);
      if (taskListBlock.id !== blockId) {
        console.debug(`${BLOCK_TARGET_RESOLVER_LOG_PREFIX} resolved status target to ancestor task list item`, {
          originalBlockId: blockId,
          targetBlockId,
          chain,
        });
      }
    } else {
      console.debug(`${BLOCK_TARGET_RESOLVER_LOG_PREFIX} no task-list ancestor for status patch`, {
        originalBlockId: blockId,
        chain,
      });
    }
  }

  const kramdownResp = await getBlockKramdown(targetBlockId);
  const kramdown = kramdownResp ? (typeof kramdownResp === 'string' ? kramdownResp : (kramdownResp as any).kramdown ?? '') : '';
  const parts = splitKramdownBlock(kramdown);

  const primaryLine = parts.contentLines[0] ?? '';
  const isTaskList = isTaskListFormat(primaryLine);

  if (!targetType) {
    targetType = isTaskList ? 'NodeListItem' : 'NodeParagraph';
  }
  if (!targetSubType) {
    targetSubType = isTaskList ? 't' : undefined;
  }

  return {
    originalBlockId: blockId,
    targetBlockId,
    targetType,
    targetSubType,
    fullKramdown: kramdown,
    targetRaw: kramdown,
    parts,
    replaceMode,
  };
}
