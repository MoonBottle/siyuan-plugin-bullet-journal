import type {
  BatchBlockPatch,
  BlockMutationIntent,
  BlockPatch,
  BlockWriteContext,
  InsertableBlockPatch,
} from '@/utils/blockWriter/shared/types'
import { normalizePatchSequence } from '@/utils/blockWriter/intent/normalizePatchSequence'
import { snapshotStatusBeforeCompletion } from '@/utils/blockWriter/statusSnapshot'

/** 归一化更新意图：将 patch 排序后封装为标准 update 意图 */
export function normalizeUpdateIntent(
  context: BlockWriteContext,
  patches: BlockPatch | BatchBlockPatch,
): Extract<BlockMutationIntent, { kind: 'update' }> {
  const patchArray = normalizePatchSequence(Array.isArray(patches) ? patches : [patches])
  const hasSetStatusCompleted = patchArray.some(
    (p) => p.type === 'setStatus' && p.status === 'completed',
  )
  if (hasSetStatusCompleted && context.blockId) {
    snapshotStatusBeforeCompletion(context.blockId)
  }
  return {
    kind: 'update',
    context,
    patches: patchArray,
  }
}

/** 归一化插入意图：封装为标准 insertAfter 意图，支持选择返回值模式 */
export function normalizeInsertIntent(
  anchorBlockId: string,
  patch: InsertableBlockPatch,
  options?: {
    context?: Partial<BlockWriteContext>
    resultMode?: 'boolean' | 'operations'
  },
): Extract<BlockMutationIntent, { kind: 'insertAfter' }> {
  return {
    kind: 'insertAfter',
    anchorBlockId,
    patch,
    context: options?.context,
    resultMode: options?.resultMode ?? 'boolean',
  }
}
