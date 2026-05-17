import type { BlockPatch, DatePatch, KramdownBlockParts } from './types';
import { rebuildKramdownBlock, replaceContentLines, splitKramdownBlock } from './kramdownBlocks';
import { generatePriorityMarker, isTaskListFormat, statusToLabel, stripPriorityMarker } from './itemLineMarkers';
import { formatFocusPlanMarker, stripFocusPlanMarkers } from '@/parser/focusPlanParser';
import { generatePinnedMarker, parsePinnedFromLine, stripPinnedMarker } from '@/parser/pinParser';
import { generateReminderMarker, stripReminderMarker } from '@/parser/reminderParser';
import {
  generateEndConditionMarker,
  generateRepeatRuleMarker,
  stripRecurringMarkers,
} from '@/parser/recurringParser';

const STATUS_MARKERS_RE = /#已完成|#已放弃|#done|#abandoned|✅|❌/gu;

const DATE_MARKER_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?/g;

function primaryLineIndex(contentLines: string[]): number {
  return 0;
}

function isItemContentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('{:') || trimmed.startsWith('🍅')) {
    return false;
  }
  return (trimmed.includes('@') || trimmed.includes('📅')) && /\d{4}-\d{2}-\d{2}/.test(trimmed);
}

function pinnedTargetLineIndex(contentLines: string[]): number {
  const itemLineIndex = contentLines.findIndex(isItemContentLine);
  if (itemLineIndex >= 0) {
    return itemLineIndex;
  }
  const firstContentLine = contentLines.findIndex(line => line.trim().length > 0 && !line.trim().startsWith('🍅'));
  return firstContentLine >= 0 ? firstContentLine : 0;
}

function applyStatus(line: string, isTaskList: boolean, status: string): string {
  const clean = line
    .replace(STATUS_MARKERS_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (isTaskList) {
    const checked = status === 'completed' ? '[x]' : '[ ]';
    const toggled = clean.replace(/\[\s*[xX]?\s*\]/, checked);
    if (status === 'pending' || status === 'completed') {
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

function applyDate(line: string, patch: DatePatch): string {
  let result = line;
  if (patch.originalDate) {
    result = result.replace(new RegExp(`(?:@|📅)${patch.originalDate.replace(/[-]/g, '\\-')}(?:~[\\d-]+|~\\d{2}-\\d{2})?`), '');
  }
  DATE_MARKER_RE.lastIndex = 0;
  result = result.replace(DATE_MARKER_RE, '').replace(/\s{2,}/g, ' ').trim();
  const startTime = patch.startTime ? ` ${patch.startTime}` : '';
  const endTime = patch.endTime && patch.endTime !== patch.startTime ? `-${patch.endTime}` : '';
  const dateStr = `📅${patch.date}${patch.allDay ? '' : `${startTime}${endTime}`}`;
  if (result) {
    return `${result} ${dateStr}`;
  }
  return dateStr;
}

function applyContent(line: string, suffix?: string, newItemContent?: string): string {
  if (newItemContent !== undefined && newItemContent !== null) {
    const listPrefixMatch = line.match(/^(\s*-(?:\s*\{:[^}]*\}\s*)?)/);
    const listPrefix = listPrefixMatch ? listPrefixMatch[1] : '';
    let rest = listPrefix ? line.slice(listPrefix.length).trimStart() : line;

    const taskCheckboxRe = /^(\[\s*[xX]?\s*\])/;
    const taskMatch = rest.match(taskCheckboxRe);
    const taskMarker = taskMatch ? taskMatch[1] : '';
    if (taskMarker) rest = rest.slice(taskMarker.length).trimStart();

    const markerIdx = findFirstMarker(rest);
    const markers = markerIdx >= 0 ? rest.slice(markerIdx).trim() : '';

    return [listPrefix, taskMarker, newItemContent, markers]
      .filter(s => s.length > 0)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  if (suffix) {
    if (line.includes(suffix)) return line;
    return `${line} ${suffix}`.replace(/\s{2,}/g, ' ').trim();
  }
  return line;
}

function findFirstMarker(line: string): number {
  const candidates: number[] = [];
  const dateIdx = line.search(DATE_MARKER_RE);
  if (dateIdx >= 0) candidates.push(dateIdx);
  const durationIdx = line.indexOf('⏳');
  if (durationIdx >= 0) candidates.push(durationIdx);
  const pomodoroIdx = line.search(/🍅x\d+/);
  if (pomodoroIdx >= 0) candidates.push(pomodoroIdx);
  for (const tag of ['#已完成', '#已放弃', '#done', '#abandoned', '✅', '❌']) {
    const idx = line.indexOf(tag);
    if (idx >= 0) candidates.push(idx);
  }
  for (const pri of ['🔥', '🌱', '🍃']) {
    const idx = line.indexOf(pri);
    if (idx >= 0) candidates.push(idx);
  }
  return candidates.length > 0 ? Math.min(...candidates) : -1;
}

function applyFocusPlan(line: string, patch: Extract<BlockPatch, { type: 'setFocusPlan' }>): string {
  const clean = stripFocusPlanMarkers(line)
    .replace(/\s{2,}/g, ' ')
    .trim();
  const marker = patch.plan ? formatFocusPlanMarker(patch.plan) : '';
  return marker ? `${clean} ${marker}`.trim() : clean;
}

function applyReminder(line: string, patch: Extract<BlockPatch, { type: 'setReminder' }>): string {
  const clean = stripReminderMarker(line)
    .replace(/\s{2,}/g, ' ')
    .trim();
  const marker = patch.reminder?.enabled ? generateReminderMarker(patch.reminder) : '';
  return marker ? `${clean} ${marker}`.trim() : clean;
}

function applyRecurring(line: string, patch: Extract<BlockPatch, { type: 'setRecurring' }>): string {
  const clean = stripRecurringMarkers(line)
    .replace(/\s{2,}/g, ' ')
    .trim();
  const markers = [
    patch.repeatRule ? generateRepeatRuleMarker(patch.repeatRule) : '',
    patch.endCondition ? generateEndConditionMarker(patch.endCondition) : '',
  ].filter(Boolean);
  return markers.length > 0 ? `${clean} ${markers.join(' ')}`.trim() : clean;
}

function applyPinned(
  contentLines: string[],
  patch: Extract<BlockPatch, { type: 'togglePinned' }>,
): string[] {
  const nextLines = [...contentLines];
  const index = pinnedTargetLineIndex(nextLines);
  const line = nextLines[index] ?? '';
  const shouldPin = patch.pinned ?? !parsePinnedFromLine(line);
  const clean = stripPinnedMarker(line)
    .replace(/\s{2,}/g, ' ')
    .trim();
  nextLines[index] = shouldPin
    ? `${clean} ${generatePinnedMarker()}`.trim()
    : clean;
  return nextLines;
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

  if (patch.type === 'removeSlashCommand') {
    throw new Error('removeSlashCommand requires an active Protyle Range');
  }

  if (patch.type === 'addDate') {
    contentLines[index] = applyDate(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setContent') {
    contentLines[index] = applyContent(line, patch.suffix, patch.newItemContent);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setFocusPlan') {
    contentLines[index] = applyFocusPlan(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setReminder') {
    contentLines[index] = applyReminder(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setRecurring') {
    contentLines[index] = applyRecurring(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'togglePinned') {
    return replaceContentLines(parts, applyPinned(contentLines, patch));
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
