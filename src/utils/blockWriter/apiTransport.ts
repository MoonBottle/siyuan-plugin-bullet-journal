import { insertBlock, updateBlock } from '@/api';
import type { BatchBlockPatch, BlockPatch, InsertableBlockPatch } from './types';
import { resolveApiBlockTarget } from './blockTargetResolver';
import { markdownToBlockDOM } from './domSerializer';
import { applyBlockPatch, applyBlockPatches, renderInsertableBlockPatch } from './kramdownModifier';

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
    const blockDOM = markdownToBlockDOM(markdown);
    const result = blockDOM
      ? await updateBlock('dom', blockDOM, target.targetBlockId)
      : await updateBlock('markdown', markdown, target.targetBlockId);
    return Array.isArray(result);
  }
  catch (error) {
    console.error('[BlockWriter] writeViaApi failed:', error);
    return false;
  }
}

export async function insertViaApi(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  try {
    const markdown = renderInsertableBlockPatch(patch);
    const blockDOM = markdownToBlockDOM(markdown);
    const result = blockDOM
      ? await insertBlock('dom', blockDOM, undefined, previousBlockId, undefined)
      : await insertBlock('markdown', markdown, undefined, previousBlockId, undefined);
    return Array.isArray(result);
  }
  catch (error) {
    console.error('[BlockWriter] insertViaApi failed:', error);
    return false;
  }
}
