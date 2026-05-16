import type { BlockPatch, KramdownBlockParts } from './types';
import { rebuildKramdownBlock, replaceContentLines, splitKramdownBlock } from './kramdownBlocks';
import { generatePriorityMarker, isTaskListFormat, statusToLabel, stripPriorityMarker } from './itemLineMarkers';

const STATUS_LABEL_DONE = '#已完成';
const STATUS_LABEL_ABANDONED = '#已放弃';

function primaryLineIndex(contentLines: string[]): number {
  return 0;
}

function applyStatus(line: string, isTaskList: boolean, status: string): string {
  const clean = line
    .replace(STATUS_LABEL_DONE, '')
    .replace(STATUS_LABEL_ABANDONED, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (isTaskList) {
    const checked = status === 'completed' ? '[x]' : '[ ]';
    const toggled = clean.replace(/\[\s*[xX]?\s*\]/, checked);
    if (status === 'pending') {
      return toggled;
    }
    return `${toggled} ${statusToLabel(status)}`;
  }

  if (status === 'pending') {
    return clean;
  }
  return `${clean} ${statusToLabel(status)}`;
}

function applyPriority(line: string, priority: string | undefined): string {
  let clean = stripPriorityMarker(line);
  if (!priority || priority === '') {
    return clean;
  }
  const marker = generatePriorityMarker(priority as any);
  const dateIdx = clean.indexOf('📅');
  if (dateIdx > -1) {
    return `${clean.slice(0, dateIdx).trimEnd()} ${marker} ${clean.slice(dateIdx)}`;
  }
  return `${clean} ${marker}`;
}

function applySlash(line: string, filters: string[], suffix: string): string {
  for (const filter of filters) {
    const idx = line.indexOf(`/${filter}`);
    if (idx === -1) continue;
    const endIdx = idx + filter.length + 1;
    const before = line.slice(0, idx);
    const after = line.slice(endIdx);
    const result = (before + (suffix ? ` ${suffix} ` : ' ') + after)
      .replace(/\s{2,}/g, ' ')
      .trim();
    return result;
  }
  return line;
}

export function applyBlockPatch(parts: KramdownBlockParts, patch: BlockPatch): string {
  const contentLines = [...parts.contentLines];
  const index = primaryLineIndex(contentLines);
  const line = contentLines[index] ?? '';

  if (patch.type === 'setStatus') {
    const isTaskList = isTaskListFormat(line);
    contentLines[index] = applyStatus(line, isTaskList, patch.status);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setPriority') {
    contentLines[index] = applyPriority(line, patch.priority);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'removeSlashCommands') {
    contentLines[index] = applySlash(line, patch.filters, patch.suffix ?? '');
    return replaceContentLines(parts, contentLines);
  }

  throw new Error(`Patch type '${(patch as any).type}' is not implemented yet`);
}

export function applyBlockPatches(parts: KramdownBlockParts, patches: BlockPatch[]): string {
  let currentParts = parts;
  for (const patch of patches) {
    const result = applyBlockPatch(currentParts, patch);
    currentParts = splitKramdownBlock(result);
  }
  return rebuildKramdownBlock(currentParts);
}