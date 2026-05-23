/**
 * Date patch helpers.
 *
 * Resolve and prepare logic has been migrated to targetResolver and updateRenderer.
 * This file only retains helper functions for non-pipeline callers.
 *
 * DO NOT add new commit/write logic here. Use writeBlock() instead.
 */

import { parseKramdownBlocks } from '@/parser/core';
import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender';
import { resolveDatePatchSource } from '@/utils/blockWriter/resolve/targetResolver';
import type { DatePatchSource } from '@/utils/blockWriter/resolve/targetResolver';
import type { DatePatch } from '@/utils/blockWriter/shared/types';

export interface PreparedDateWrite {
  content: string;
  targetBlockId: string;
}

function resolveTargetBlockId(source: DatePatchSource, content: string): string {
  const { originalBlockId, targetBlockId, targetItemBlockRaw, usedParentDocumentContext } = source;
  let finalTargetBlockId = source.finalTargetBlockId ?? targetBlockId;
  if (usedParentDocumentContext && targetItemBlockRaw) {
    const updatedBlocks = parseKramdownBlocks(content);
    const updatedItemBlock = updatedBlocks.find(candidate => candidate.blockId === originalBlockId);
    if (updatedItemBlock) {
      finalTargetBlockId = source.finalTargetBlockId ?? originalBlockId;
    }
  }
  return finalTargetBlockId;
}

/**
 * @deprecated Render logic has been migrated to `datePatchRender.ts`.
 * Core pipeline callers should use `renderDatePatch()` directly.
 * This function remains for compat entries that need `PreparedDateWrite`.
 */
export function prepareDatePatchWriteFromSource(
  source: DatePatchSource,
  patch: DatePatch,
): PreparedDateWrite | null {
  const content = renderDatePatch(source.kramdown, patch, {
    originalBlockId: source.originalBlockId,
    sourceBlockId: source.targetBlockId,
    targetItemBlockRaw: source.targetItemBlockRaw,
    usedParentDocumentContext: source.usedParentDocumentContext,
    finalTargetBlockId: source.finalTargetBlockId ?? source.targetBlockId,
  });

  const targetBlockId = resolveTargetBlockId(source, content);

  return { content, targetBlockId };
}

export async function prepareDatePatchWrite(
  blockId: string,
  patch: DatePatch,
): Promise<PreparedDateWrite | null> {
  if (!blockId) {
    return null;
  }

  try {
    const source = await resolveDatePatchSource(blockId);
    if (!source) {
      return null;
    }

    return prepareDatePatchWriteFromSource(source, patch);
  } catch (error) {
    console.error('[BlockWriter] Failed to prepare addDate patch:', error);
    return null;
  }
}
