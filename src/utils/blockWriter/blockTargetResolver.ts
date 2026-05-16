import { getBlockKramdown } from '@/api';
import type { BlockPatch, KramdownBlockParts, ResolvedBlockTarget } from './types';
import { splitKramdownBlock } from './kramdownBlocks';
import { isTaskListFormat } from './itemLineMarkers';

export async function resolveApiBlockTarget(blockId: string, _patch: BlockPatch): Promise<ResolvedBlockTarget> {
  const kramdown = await getBlockKramdown(blockId);
  const parts = splitKramdownBlock(kramdown ?? '');

  const primaryLine = parts.contentLines[0] ?? '';
  const isTaskList = isTaskListFormat(primaryLine);

  return {
    originalBlockId: blockId,
    targetBlockId: blockId,
    targetType: isTaskList ? 'NodeListItem' : 'NodeParagraph',
    targetSubType: isTaskList ? 't' : undefined,
    fullKramdown: kramdown ?? '',
    targetRaw: kramdown ?? '',
    parts,
    replaceMode: 'whole-block',
  };
}