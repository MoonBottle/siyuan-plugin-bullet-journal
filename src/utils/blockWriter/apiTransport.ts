import { updateBlock } from '@/api';
import type { BatchBlockPatch, BlockPatch } from './types';
import { resolveApiBlockTarget } from './blockTargetResolver';
import { applyBlockPatch, applyBlockPatches } from './kramdownModifier';

export async function writeViaApi(blockId: string, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  try {
    const patchArray = Array.isArray(patches) ? patches : [patches];
    if (patchArray.some((patch) => patch.type === 'removeSlashCommand')) {
      return false;
    }
    const firstPatch = patchArray[0];
    const target = await resolveApiBlockTarget(blockId, firstPatch);
    const markdown = patchArray.length === 1
      ? applyBlockPatch(target.parts, firstPatch)
      : applyBlockPatches(target.parts, patchArray);
    const result = await updateBlock('markdown', markdown, target.targetBlockId);
    return Array.isArray(result);
  }
  catch (error) {
    console.error('[BlockWriter] writeViaApi failed:', error);
    return false;
  }
}
