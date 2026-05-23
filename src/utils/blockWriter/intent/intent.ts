/**
 * 意图归一化：将外部调用转化为内部标准意图
 *
 * 两种入口：
 * - normalizeUpdateIntent：更新已有块，patch 序列经排序后生成 update 意图
 * - normalizeInsertIntent：在锚点块后插入新块，生成 insertAfter 意图
 */
import { normalizePatchSequence } from '@/utils/blockWriter/intent/normalizePatchSequence';
import type {
  BatchBlockPatch,
  BlockMutationIntent,
  BlockPatch,
  BlockWriteContext,
  InsertableBlockPatch,
} from '@/utils/blockWriter/shared/types';

/** 归一化更新意图：将 patch 排序后封装为标准 update 意图 */
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

/** 归一化插入意图：封装为标准 insertAfter 意图，支持选择返回值模式 */
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
