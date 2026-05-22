import { normalizePatchSequence } from '@/utils/blockWriter/intent/normalizePatchSequence';
import type {
  BatchBlockPatch,
  BlockMutationIntent,
  BlockPatch,
  BlockWriteContext,
  InsertableBlockPatch,
} from '@/utils/blockWriter/shared/types';

export function normalizeUpdateIntent(
  context: BlockWriteContext,
  patches: BlockPatch | BatchBlockPatch,
): Extract<BlockMutationIntent, { kind: 'update' }> {
  const patchArray = normalizePatchSequence(Array.isArray(patches) ? patches : [patches]);
  return {
    kind: 'update',
    context,
    patches: patchArray,
  };
}

export function normalizeInsertIntent(
  anchorBlockId: string,
  patch: InsertableBlockPatch,
  options?: {
    context?: Partial<BlockWriteContext>;
    resultMode?: 'boolean' | 'operations';
  },
): Extract<BlockMutationIntent, { kind: 'insertAfter' }> {
  return {
    kind: 'insertAfter',
    anchorBlockId,
    patch,
    context: options?.context,
    resultMode: options?.resultMode ?? 'boolean',
  };
}
