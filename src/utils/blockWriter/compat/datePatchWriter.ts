import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';
import { getBlockKramdown, updateBlock } from '@/api';
import { parseKramdownBlocks } from '@/parser/core';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { processLineText } from '@/utils/slashCommandUtils';
import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer';
import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender';
import { createProtyleMarkdownWriter, writeMarkdownToCurrentBlock } from '@/utils/blockWriter/compat/markdownWriter';
import type { BlockWriteContext, DatePatch } from '@/utils/blockWriter/shared/types';
import { deleteSlashRangeText, getActiveSlashRange } from '@/utils/blockWriter/shared/slashRange';
import { resolveDatePatchSource } from '@/utils/blockWriter/resolve/targetResolver';
import type { DatePatchSource } from '@/utils/blockWriter/resolve/targetResolver';

export type DatePatchWriter = (
  content: string,
  targetBlockId: string,
) => Promise<boolean>;

export interface PreparedDateWrite {
  content: string;
  targetBlockId: string;
}

function stripSlashCommandsFromMarkdownContent(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('{:')) {
        return line;
      }
      return processLineText(line, ALL_SLASH_COMMAND_FILTERS);
    })
    .join('\n');
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = target;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) {
      return null;
    }
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function getNodeByPath(root: Node, path: number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    current = current?.childNodes?.[index] ?? null;
    if (!current) {
      return null;
    }
  }
  return current;
}

function resolveSlashContext(context: Pick<BlockWriteContext, 'blockId' | 'nodeElement' | 'slashRange' | 'slashStartOffset' | 'slashEndOffset'>): {
  blockId: string;
  nodeElement: HTMLElement;
  slashRange: Range;
  slashStartOffset: number;
  slashEndOffset: number;
} | null {
  const { blockId, nodeElement, slashRange, slashStartOffset, slashEndOffset } = context;
  if (!nodeElement) {
    return null;
  }

  if (slashRange && slashStartOffset !== undefined && slashEndOffset !== undefined) {
    return {
      blockId,
      nodeElement,
      slashRange,
      slashStartOffset,
      slashEndOffset,
    };
  }

  const activeSlash = getActiveSlashRange();
  if (!activeSlash) {
    return null;
  }

  if (
    activeSlash.blockId !== blockId
    && activeSlash.blockElement !== nodeElement
    && !nodeElement.contains(activeSlash.range.startContainer)
  ) {
    return null;
  }

  return {
    blockId: activeSlash.blockId,
    nodeElement: activeSlash.blockElement,
    slashRange: activeSlash.range,
    slashStartOffset: activeSlash.slashStartOffset,
    slashEndOffset: activeSlash.slashEndOffset,
  };
}

async function persistDateContent(
  content: string,
  targetBlockId: string,
  writer?: DatePatchWriter,
): Promise<boolean> {
  if (writer) {
    return await writer(content, targetBlockId);
  }
  const blockDOM = markdownToBlockDOM(content);
  await updateBlock(blockDOM ? 'dom' : 'markdown', blockDOM ?? content, targetBlockId);
  return true;
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

/**
 * @deprecated Compat entry only.
 * New callers should prepare content via `prepareDatePatchWrite()` or use `writeBlock()`.
 */
export async function writeDatePatchWithWriter(
  blockId: string,
  patch: DatePatch,
  writer?: DatePatchWriter,
): Promise<boolean> {
  if (!blockId) return false;

  try {
    const source = await resolveDatePatchSource(blockId);
    if (!source) {
      return false;
    }

    const prepared = prepareDatePatchWriteFromSource(source, patch);
    if (!prepared) {
      return false;
    }

    return await persistDateContent(prepared.content, prepared.targetBlockId, writer);
  } catch (error) {
    console.error('[BlockWriter] Failed to write addDate patch:', error);
    return false;
  }
}

/**
 * @deprecated Compat entry only.
 * New slash writes should go through the unified block writer pipeline.
 */
export async function writeDatePatchWithSlashCleanup(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement' | 'slashRange' | 'slashStartOffset' | 'slashEndOffset'>,
  patch: DatePatch,
): Promise<boolean> {
  const { blockId, protyle, nodeElement } = context;
  if (!blockId || !protyle || !nodeElement) {
    return false;
  }

  const previewSource = await resolveDatePatchSource(blockId);
  if (!previewSource) {
    return false;
  }

  const preview = prepareDatePatchWriteFromSource(previewSource, patch);
  if (!preview || preview.targetBlockId !== blockId) {
    return false;
  }

  const slashContext = resolveSlashContext(context);
  if (!slashContext || slashContext.blockId !== blockId) {
    return false;
  }

  const rangeStartNode = slashContext.slashRange.startContainer;
  const path = getNodePath(nodeElement, rangeStartNode);
  if (!path) {
    return false;
  }

  const draftBlock = nodeElement.cloneNode(true) as HTMLElement;
  const draftStartNode = getNodeByPath(draftBlock, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    return false;
  }

  const draftRange = document.createRange();
  draftRange.setStart(draftStartNode, slashContext.slashRange.startOffset);
  draftRange.collapse(true);
  deleteSlashRangeText(draftRange, slashContext.slashStartOffset, slashContext.slashEndOffset);

  const currentMarkdown = blockElementToMarkdownContent(protyle, draftBlock);
  if (!currentMarkdown) {
    return false;
  }

  const prepared = prepareDatePatchWriteFromSource({
    originalBlockId: blockId,
    kramdown: currentMarkdown,
    targetBlockId: blockId,
    targetItemBlockRaw: null,
    usedParentDocumentContext: false,
  }, patch);

  if (!prepared || prepared.targetBlockId !== blockId) {
    return false;
  }

  return writeMarkdownToCurrentBlock(context, stripSlashCommandsFromMarkdownContent(prepared.content), {
    oldHTML: nodeElement.outerHTML,
  });
}

/**
 * @deprecated Compat entry only.
 * New callers should route addDate writes through `writeBlock()`.
 */
export async function writeDatePatch(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
  patch: DatePatch,
): Promise<boolean> {
  const writer = context.protyle && context.nodeElement
    ? createProtyleMarkdownWriter(context)
    : undefined;
  return await writeDatePatchWithWriter(context.blockId, patch, writer);
}
