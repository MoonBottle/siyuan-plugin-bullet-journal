import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';
import { getBlockByID, getBlockKramdown, updateBlock } from '@/api';
import { stripListAndBlockAttr, parseKramdownBlocks } from '@/parser/core';
import { isStandaloneBlockRefLine } from '@/parser/lineParser';
import type { ItemDateTimeInfo, ItemStatus, TimePrecision } from '@/types/models';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { processLineText } from '@/utils/slashCommandUtils';
import { markdownToBlockDOM } from './domSerializer';
import { createProtyleMarkdownWriter, writeMarkdownToCurrentBlock } from './markdownWriter';
import { isTaskListFormat, statusToLabel } from './itemLineMarkers';
import type { BlockWriteContext, DatePatch } from './types';
import { deleteSlashRangeText, getActiveSlashRange } from './slashRange';

const TIME_PART_PATTERN = '\\d{2}:\\d{2}(?::\\d{2})?';
const TIME_RANGE_PATTERN = `${TIME_PART_PATTERN}(?:~${TIME_PART_PATTERN})?`;
const DATE_MARKER_PATTERN = `(?:@|📅)\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`;
const DATE_MARKER_REGEX = new RegExp(DATE_MARKER_PATTERN, 'g');
const RESIDUAL_DATE_MARKER_REGEX = new RegExp(`[，,]\\s*\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`, 'g');
const COMPLETED_MARKERS_RE = /#done|#已完成|✅/u;
const ABANDONED_MARKERS_RE = /#abandoned|#已放弃|❌/u;

export type DatePatchWriter = (
  content: string,
  targetBlockId: string,
) => Promise<boolean>;

interface DatePatchSource {
  originalBlockId: string;
  kramdown: string;
  targetBlockId: string;
  targetItemBlockRaw: string | null;
  usedParentDocumentContext: boolean;
}

interface PreparedDateWrite {
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

function resolveSlashContext(context: Pick<BlockWriteContext, 'blockId' | 'nodeElement' | 'slashRange' | 'slashStartOffset'>): {
  blockId: string;
  nodeElement: HTMLElement;
  slashRange: Range;
  slashStartOffset: number;
} | null {
  const { blockId, nodeElement, slashRange, slashStartOffset } = context;
  if (!nodeElement) {
    return null;
  }

  if (slashRange && slashStartOffset !== undefined) {
    return {
      blockId,
      nodeElement,
      slashRange,
      slashStartOffset,
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
  };
}

function addOneHour(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const seconds = match[3] || '00';

  hours = (hours + 1) % 24;
  const hoursStr = hours.toString().padStart(2, '0');

  return `${hoursStr}:${minutes}:${seconds}`;
}

function formatTimeToSeconds(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeStr;

  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  const seconds = match[3] || '00';

  return `${hours}:${minutes}:${seconds}`;
}

function formatTimeForPrecision(timeStr: string, precision: TimePrecision = 'second'): string {
  const normalized = formatTimeToSeconds(timeStr);
  return precision === 'minute' ? normalized.slice(0, 5) : normalized;
}

function getTimePrecisionFromItem(item: ItemDateTimeInfo): TimePrecision {
  return item.timePrecision ?? 'second';
}

function findPrimaryItemLineIndex(lines: string[]): number {
  let fallbackIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith('{:') || trimmedLine.startsWith('🍅')) {
      continue;
    }

    const strippedLine = stripListAndBlockAttr(rawLine);
    if (!strippedLine || isStandaloneBlockRefLine(strippedLine)) {
      continue;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = i;
    }

    if (/(?:@|📅)\d{4}-\d{2}-\d{2}/.test(strippedLine)) {
      return i;
    }
  }

  return fallbackIndex;
}

function isListItemLine(line: string): boolean {
  return /^\s*([-]|\d+\.)\s+/.test(line);
}

function findBlockStartLineIndex(lines: string[], blockRaw: string): number {
  const rawLines = blockRaw.split('\n');
  if (rawLines.length === 0 || rawLines.length > lines.length) {
    return -1;
  }

  for (let start = 0; start <= lines.length - rawLines.length; start++) {
    let matches = true;
    for (let offset = 0; offset < rawLines.length; offset++) {
      if (lines[start + offset] !== rawLines[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return start;
    }
  }

  return -1;
}

function buildDateTimeMark(date: string, timeKey?: string): string {
  if (!timeKey) {
    return `📅${date}`;
  }
  return `📅${date} ${timeKey}`;
}

function buildDateRangeMark(startDate: string, endDate: string, timeKey?: string): string {
  const startParts = startDate.split('-');
  const endParts = endDate.split('-');

  let datePart: string;
  if (startParts[0] === endParts[0] && startParts[1] === endParts[1]) {
    datePart = `${startDate}~${endParts[1]}-${endParts[2]}`;
  } else {
    datePart = `${startDate}~${endDate}`;
  }

  if (timeKey) {
    return `📅${datePart} ${timeKey}`;
  }

  return `📅${datePart}`;
}

function groupDatesIntoRanges(dates: string[]): string[][] {
  if (dates.length === 0) return [];

  const sortedDates = [...dates].sort();
  const ranges: string[][] = [];
  let currentRange: string[] = [sortedDates[0]];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentRange.push(sortedDates[i]);
    } else {
      ranges.push(currentRange);
      currentRange = [sortedDates[i]];
    }
  }

  ranges.push(currentRange);
  return ranges;
}

function buildTimeKey(item: ItemDateTimeInfo): string {
  const precision = getTimePrecisionFromItem(item);
  const startTime = item.startDateTime?.split(' ')[1];
  const endTime = item.endDateTime?.split(' ')[1];

  if (!startTime) return '';
  if (!endTime) return formatTimeForPrecision(startTime, precision);
  return `${formatTimeForPrecision(startTime, precision)}~${formatTimeForPrecision(endTime, precision)}`;
}

function optimizeDateTimeExpressions(items: ItemDateTimeInfo[]): string {
  if (items.length === 0) return '';

  const sortedItems = [...items].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const timeGroups = new Map<string, typeof sortedItems>();
  for (const item of sortedItems) {
    const timeKey = buildTimeKey(item);
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, []);
    }
    timeGroups.get(timeKey)!.push(item);
  }

  const expressionList: Array<{ expr: string; startDate: string }> = [];
  for (const [timeKey, groupItems] of timeGroups) {
    const dates = groupItems.map(i => i.date);
    const ranges = groupDatesIntoRanges(dates);

    for (const range of ranges) {
      const expr = range.length === 1
        ? buildDateTimeMark(range[0], timeKey || undefined)
        : buildDateRangeMark(range[0], range[range.length - 1], timeKey || undefined);

      expressionList.push({
        expr,
        startDate: range[0],
      });
    }
  }

  expressionList.sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const expressions = expressionList.map(item => item.expr);
  if (expressions.length === 0) return '';

  const firstExpr = expressions[0];
  const restExprs = expressions.slice(1).map(expr => expr.replace(/^(?:@|📅)/, ''));
  return [firstExpr, ...restExprs].join(', ');
}

function inferStatus(line: string, fallback?: ItemStatus): ItemStatus {
  if (fallback) {
    return fallback;
  }
  if (ABANDONED_MARKERS_RE.test(line)) {
    return 'abandoned';
  }
  if (/\[\s*[xX]\s*\]/.test(line) || COMPLETED_MARKERS_RE.test(line)) {
    return 'completed';
  }
  return 'pending';
}

function buildTaskListMarker(status: ItemStatus): string {
  return status === 'completed' ? '[x] ' : '[ ] ';
}

function buildStatusSuffix(status: ItemStatus, taskList: boolean): string {
  if (status === 'pending') {
    return '';
  }
  if (taskList && status === 'completed') {
    return '';
  }
  const label = statusToLabel(status);
  return label ? ` ${label}` : '';
}

function buildUpdatedDateItems(
  patch: DatePatch,
  formattedStartTime?: string,
  formattedEndTime?: string,
): ItemDateTimeInfo[] {
  const allItems: ItemDateTimeInfo[] = patch.siblingItems ? [...patch.siblingItems] : [];
  const updatedItem = {
    date: patch.date,
    startDateTime: patch.allDay ? undefined : (formattedStartTime ? `${patch.date} ${formattedStartTime}` : undefined),
    endDateTime: patch.allDay ? undefined : (formattedEndTime ? `${patch.date} ${formattedEndTime}` : undefined),
    timePrecision: patch.allDay ? undefined : patch.timePrecision,
  };

  if (patch.originalDate) {
    const itemIndex = allItems.findIndex(item => item.date === patch.originalDate);
    if (itemIndex >= 0) {
      allItems[itemIndex] = updatedItem;
    } else {
      allItems.push(updatedItem);
    }
  } else {
    allItems.push(updatedItem);
  }

  const uniqueItems = new Map<string, ItemDateTimeInfo>();
  for (const item of allItems) {
    uniqueItems.set(item.date, item);
  }
  return Array.from(uniqueItems.values());
}

function rebuildSingleLineContent(
  content: string,
  patch: DatePatch,
  formattedStartTime?: string,
  formattedEndTime?: string,
): string {
  let itemContent = processLineText(content, ALL_SLASH_COMMAND_FILTERS);
  itemContent = stripListAndBlockAttr(itemContent)
    .replace(DATE_MARKER_REGEX, '')
    .replace(/#done|#abandoned|#已完成|#已放弃|[✅❌]/g, '')
    .replace(RESIDUAL_DATE_MARKER_REGEX, '')
    .trim();

  const dedupedItems = buildUpdatedDateItems(patch, formattedStartTime, formattedEndTime);
  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);
  const taskList = isTaskListFormat(content);
  const status = inferStatus(content, patch.status);
  const taskListMarker = taskList ? buildTaskListMarker(status) : '';
  const statusSuffix = buildStatusSuffix(status, taskList);

  return `${taskListMarker}${itemContent} ${optimizedExpr}${statusSuffix}`.trim();
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

async function resolveDatePatchSource(blockId: string): Promise<DatePatchSource | null> {
  let kramdown: string | null = null;
  let targetBlockId = blockId;
  let targetItemBlockRaw: string | null = null;
  let usedParentDocumentContext = false;
  const block = await getBlockByID(blockId);

  if (block?.parent_id) {
    const parentResult = await getBlockKramdown(block.parent_id);
    if (parentResult?.kramdown) {
      const blocks = parseKramdownBlocks(parentResult.kramdown);
      const itemBlockIndex = blocks.findIndex(candidate => candidate.blockId === blockId);
      const itemBlock = itemBlockIndex >= 0 ? blocks[itemBlockIndex] : null;
      usedParentDocumentContext = blocks.length > 1;
      if (itemBlock) {
        targetItemBlockRaw = itemBlock.raw;
      }

      const blocksToCheck = itemBlock
        ? (itemBlockIndex > 0 ? [itemBlock, blocks[itemBlockIndex - 1]] : [itemBlock])
        : [];

      for (const checkBlock of blocksToCheck) {
        const linesToCheck = checkBlock.content.split('\n');
        for (const line of linesToCheck) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{:') || trimmed.startsWith('🍅')) {
            continue;
          }
          const hasDateMarker = trimmed.includes('@') || trimmed.includes('📅');
          const hasDateValue = /\d{4}-\d{2}-\d{2}/.test(trimmed);
          if (hasDateMarker && hasDateValue && (isTaskListFormat(trimmed) || isListItemLine(line))) {
            kramdown = parentResult.kramdown;
            targetBlockId = block.parent_id;
            break;
          }
        }
        if (kramdown) break;
      }
    }
  }

  if (!kramdown) {
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[BlockWriter] Failed to get block kramdown for addDate patch');
      return null;
    }
    kramdown = result.kramdown;
  }

  return {
    originalBlockId: blockId,
    kramdown,
    targetBlockId,
    targetItemBlockRaw,
    usedParentDocumentContext,
  };
}

export function prepareDatePatchWriteFromSource(
  source: DatePatchSource,
  patch: DatePatch,
): PreparedDateWrite | null {
  const {
    originalBlockId,
    kramdown,
    targetBlockId,
    targetItemBlockRaw,
    usedParentDocumentContext,
  } = source;

  const lines = kramdown.split('\n');
  const hasTomatoClock = lines.some(line => line.trim().startsWith('🍅'));
  const contentLineCount = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('{:');
  }).length;
  const useMultiLineForStructure = (targetBlockId !== originalBlockId && lines.length > 1) || contentLineCount > 1;

  const formattedStartTime = patch.startTime ? formatTimeToSeconds(patch.startTime) : undefined;
  const formattedEndTime = patch.endTime
    ? formatTimeToSeconds(patch.endTime)
    : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

  if (!hasTomatoClock && !useMultiLineForStructure) {
    const attrSuffix = (kramdown.match(/\n\{:[^}]*\}/g) || []).join('');
    const content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
    return {
      content: rebuildSingleLineContent(
        content,
        patch,
        formattedStartTime,
        formattedEndTime,
      ) + attrSuffix,
      targetBlockId,
    };
  }

  let itemLineIndex = findPrimaryItemLineIndex(lines);
  if (targetBlockId !== originalBlockId && targetItemBlockRaw) {
    const targetBlockStartLineIndex = findBlockStartLineIndex(lines, targetItemBlockRaw);
    if (targetBlockStartLineIndex >= 0) {
      const targetBlockRelativeLineIndex = findPrimaryItemLineIndex(targetItemBlockRaw.split('\n'));
      if (targetBlockRelativeLineIndex >= 0) {
        itemLineIndex = targetBlockStartLineIndex + targetBlockRelativeLineIndex;
      }
    }
  }

  if (itemLineIndex === -1) {
    const attrSuffix = (kramdown.match(/\n\{:[^}]*\}/g) || []).join('');
    const content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
    return {
      content: rebuildSingleLineContent(
        content,
        patch,
        formattedStartTime,
        formattedEndTime,
      ) + attrSuffix,
      targetBlockId,
    };
  }

  const itemLine = lines[itemLineIndex];
  const cleanedItemLine = stripListAndBlockAttr(itemLine);
  let itemContent = cleanedItemLine
    .replace(DATE_MARKER_REGEX, '')
    .replace(/#done|#abandoned|#已完成|#已放弃|[✅❌]/g, '')
    .replace(RESIDUAL_DATE_MARKER_REGEX, '')
    .trim();
  itemContent = processLineText(itemContent, ALL_SLASH_COMMAND_FILTERS);

  const dedupedItems = buildUpdatedDateItems(patch, formattedStartTime, formattedEndTime);
  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);
  const taskList = isTaskListFormat(itemLine);
  const status = inferStatus(itemLine, patch.status);

  let newItemLine: string;
  if (targetBlockId !== originalBlockId) {
    const dateExpr = new RegExp(`${DATE_MARKER_PATTERN}(?:\\s*[,，]\\s*\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?)*`, 'g');
    const cleanedLine = processLineText(itemLine, ALL_SLASH_COMMAND_FILTERS);
    newItemLine = cleanedLine.replace(dateExpr, optimizedExpr);
  } else {
    const taskListMarker = taskList ? buildTaskListMarker(status) : '';
    const statusSuffix = buildStatusSuffix(status, taskList);
    newItemLine = `${taskListMarker}${itemContent} ${optimizedExpr}${statusSuffix}`.trim();
  }

  lines[itemLineIndex] = newItemLine;

  let content = lines.join('\n');
  let finalTargetBlockId = targetBlockId;
  if (usedParentDocumentContext && targetItemBlockRaw) {
    const updatedBlocks = parseKramdownBlocks(content);
    const updatedItemBlock = updatedBlocks.find(candidate => candidate.blockId === originalBlockId);
    if (updatedItemBlock) {
      content = updatedItemBlock.raw;
      finalTargetBlockId = originalBlockId;
    }
  }

  return {
    content,
    targetBlockId: finalTargetBlockId,
  };
}

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

export async function writeDatePatchWithSlashCleanup(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement' | 'slashRange' | 'slashStartOffset'>,
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
  deleteSlashRangeText(draftRange, slashContext.slashStartOffset);

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

export async function writeDatePatch(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
  patch: DatePatch,
): Promise<boolean> {
  const writer = context.protyle && context.nodeElement
    ? createProtyleMarkdownWriter(context)
    : undefined;
  return await writeDatePatchWithWriter(context.blockId, patch, writer);
}
