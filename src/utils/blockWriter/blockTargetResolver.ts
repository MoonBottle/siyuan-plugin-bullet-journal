import { getBlockByID, getBlockKramdown } from '@/api';
import type { BlockPatch, KramdownBlockParts, ResolvedBlockTarget } from './types';
import { splitKramdownBlock } from './kramdownBlocks';
import { isTaskListFormat } from './itemLineMarkers';

function subtypeOf(block: any): string | undefined {
  return block?.subtype ?? block?.subType;
}

export async function resolveApiBlockTarget(blockId: string, patch: BlockPatch): Promise<ResolvedBlockTarget> {
  let targetBlockId = blockId;
  let targetType: string | undefined;
  let targetSubType: string | undefined;
  let replaceMode: 'whole-block' | 'raw-within-parent' = 'whole-block';

  const block = await getBlockByID(blockId);

  if (patch.type === 'setStatus' && block?.parent_id) {
    const parent = await getBlockByID(block.parent_id);
    if (parent?.type === 'NodeListItem' && subtypeOf(parent) === 't') {
      targetBlockId = parent.id;
      targetType = parent.type;
      targetSubType = subtypeOf(parent);
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