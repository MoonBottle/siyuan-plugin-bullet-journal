import type { BlockPatch, DatePatch, InsertableBlockPatch, KramdownBlockParts } from '@/utils/blockWriter/shared/types';
import { rebuildKramdownBlock, replaceContentLines, splitKramdownBlock } from '@/utils/blockWriter/shared/kramdownBlocks';
import { generatePriorityMarker, isTaskListFormat, statusToLabel } from '@/utils/blockWriter/shared/itemLineMarkers';
import { formatFocusPlanMarker } from '@/parser/focusPlanParser';
import { buildHabitDefinitionMarkdown } from '@/parser/habitParser';
import { generatePinnedMarker, parsePinnedFromLine, stripPinnedMarker } from '@/parser/pinParser';
import { generateReminderMarker } from '@/parser/reminderParser';
import {
  generateEndConditionMarker,
  generateRepeatRuleMarker,
} from '@/parser/recurringParser';
import { buildHabitRecordMarkdown } from '@/utils/habitMarkdown';
import { normalizeMarkerLine, parseMarkerLine, removeMarker, upsertMarker } from '@/utils/blockWriter/render/markerCluster';

const STATUS_MARKERS_RE = /#已完成|#已放弃|#done|#abandoned|✅|❌/gu;

const DATE_MARKER_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?/g;
const DATE_MARKER_START_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?/u;
const PRIORITY_MARKER_RE = /(?:^|\s)[🔥🌱🍃](?=\s|$)/u;
const STATUS_MARKER_RE = /(?:^|\s)(?:#已完成|#已放弃|#done|#abandoned|✅|❌)(?=\s|$)/iu;
const PINNED_MARKER_RE = /(?:^|\s)📌(?=\s|$)/u;
const FOCUS_PLAN_MARKER_RE = /(?:^|\s)(?:⏳\S+|🍅x\d+)(?=\s|$)/u;
const REMINDER_MARKER_RE = /(?:^|\s)⏰(?:\d{2}:\d{2}(?::\d{2})?|提前\d+(?:分钟|小时|天)|结束前\d+(?:分钟|小时|天)|\d+\s*(?:minutes?|hours?|days?|m|h|d)\s*before(?:\s*end)?)(?=\s|$)/iu;
const RECURRING_MARKER_RE = /(?:^|\s)🔁(?:每天|每周|每月|每年|工作日|daily|weekly|monthly|yearly|workday)/iu;
const END_CONDITION_MARKER_RE = /(?:^|\s)(?:截止到\d{4}-\d{2}-\d{2}|until\s+\d{4}-\d{2}-\d{2}|剩余\s*\d+\s*次|\d+\s*(?:times?\s*)?remaining)(?=\s|$)/iu;
const HABIT_ARCHIVE_MARKER_RE = /(?:^|\s)📦\d{4}-\d{2}-\d{2}(?=\s|$)/gu;

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
  const parsed = parseMarkerLine(line);
  if (!priority || priority === '') {
    return normalizeMarkerLine(removeMarker(parsed, 'priority'));
  }
  return normalizeMarkerLine(upsertMarker(parsed, 'priority', generatePriorityMarker(priority as any)));
}

function applyTaskTag(line: string, patch: Extract<BlockPatch, { type: 'setTaskTag' }>): string {
  const parsed = parseMarkerLine(line);
  if (!patch.tag) {
    return normalizeMarkerLine(removeMarker(parsed, 'taskTag'));
  }
  return normalizeMarkerLine(upsertMarker(parsed, 'taskTag', patch.tag));
}

function applyDate(line: string, patch: DatePatch): string {
  const startTime = patch.startTime ? ` ${patch.startTime}` : '';
  const endTime = patch.endTime && patch.endTime !== patch.startTime ? `-${patch.endTime}` : '';
  const parsed = parseMarkerLine(line);
  const dateStr = `📅${patch.date}${patch.allDay ? '' : `${startTime}${endTime}`}`;
  return normalizeMarkerLine(upsertMarker(parsed, 'date', dateStr));
}

function applyContent(line: string, newItemContent?: string): string {
  if (newItemContent !== undefined && newItemContent !== null) {
    const listPrefixMatch = line.match(/^(\s*-(?:\s*\{:[^}]*\}\s*)?)/);
    const listPrefix = listPrefixMatch ? listPrefixMatch[1] : '';
    const headingPrefixMatch = !listPrefix ? line.match(/^(\s{0,3}#{1,6})(?=\s|$)/) : null;
    const headingPrefix = headingPrefixMatch ? headingPrefixMatch[1] : '';
    const structuralPrefix = listPrefix || headingPrefix;
    let rest = structuralPrefix ? line.slice(structuralPrefix.length).trimStart() : line;

    const taskCheckboxRe = /^(\[\s*[xX]?\s*\])/;
    const taskMatch = rest.match(taskCheckboxRe);
    const taskMarker = taskMatch ? taskMatch[1] : '';
    if (taskMarker) rest = rest.slice(taskMarker.length).trimStart();

    const markerIdx = findFirstMarker(rest);
    const markers = markerIdx >= 0 ? rest.slice(markerIdx).trim() : '';

    return [structuralPrefix, taskMarker, newItemContent, markers]
      .filter(s => s.length > 0)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return line;
}

function findFirstMarker(line: string): number {
  const candidates: number[] = [];
  const dateIdx = line.search(DATE_MARKER_START_RE);
  if (dateIdx >= 0) candidates.push(dateIdx);

  const markerRegexes = [
    PRIORITY_MARKER_RE,
    STATUS_MARKER_RE,
    PINNED_MARKER_RE,
    FOCUS_PLAN_MARKER_RE,
    REMINDER_MARKER_RE,
    RECURRING_MARKER_RE,
    END_CONDITION_MARKER_RE,
  ];

  for (const regex of markerRegexes) {
    const idx = findPatternStart(line, regex);
    if (idx >= 0) candidates.push(idx);
  }

  return candidates.length > 0 ? Math.min(...candidates) : -1;
}

function findPatternStart(line: string, regex: RegExp): number {
  regex.lastIndex = 0;
  const match = regex.exec(line);
  if (!match || match.index === undefined) {
    return -1;
  }
  const relativeStart = match[0].search(/\S/u);
  return relativeStart >= 0 ? match.index + relativeStart : match.index;
}

function applyFocusPlan(line: string, patch: Extract<BlockPatch, { type: 'setFocusPlan' }>): string {
  const marker = patch.plan ? formatFocusPlanMarker(patch.plan) : '';
  const parsed = parseMarkerLine(line);
  return marker
    ? normalizeMarkerLine(upsertMarker(parsed, 'focusPlan', marker))
    : normalizeMarkerLine(removeMarker(parsed, 'focusPlan'));
}

function applyReminder(line: string, patch: Extract<BlockPatch, { type: 'setReminder' }>): string {
  const marker = patch.reminder?.enabled ? generateReminderMarker(patch.reminder) : '';
  const parsed = parseMarkerLine(line);
  return marker
    ? normalizeMarkerLine(upsertMarker(parsed, 'reminder', marker))
    : normalizeMarkerLine(removeMarker(parsed, 'reminder'));
}

function applyRecurring(line: string, patch: Extract<BlockPatch, { type: 'setRecurring' }>): string {
  let parsed = parseMarkerLine(line);
  parsed = patch.repeatRule
    ? upsertMarker(parsed, 'recurring', generateRepeatRuleMarker(patch.repeatRule))
    : removeMarker(parsed, 'recurring');
  parsed = patch.endCondition
    ? upsertMarker(parsed, 'endCondition', generateEndConditionMarker(patch.endCondition))
    : removeMarker(parsed, 'endCondition');
  return normalizeMarkerLine(parsed);
}

function applyPinned(
  contentLines: string[],
  patch: Extract<BlockPatch, { type: 'togglePinned' }>,
): string[] {
  const nextLines = [...contentLines];
  const index = pinnedTargetLineIndex(nextLines);
  const line = nextLines[index] ?? '';
  const shouldPin = patch.pinned ?? !parsePinnedFromLine(line);
  const parsed = parseMarkerLine(line);
  nextLines[index] = shouldPin
    ? normalizeMarkerLine(upsertMarker(parsed, 'pinned', generatePinnedMarker()))
    : normalizeMarkerLine(removeMarker(parsed, 'pinned'));
  return nextLines;
}

function applyHabitDefinition(
  patch: Extract<BlockPatch, { type: 'setHabitDefinition' }>,
): string {
  return buildHabitDefinitionMarkdown(patch.habit);
}

function applyHabitRecord(
  patch: Extract<BlockPatch, { type: 'setHabitRecord' }>,
): string {
  return buildHabitRecordMarkdown(patch.record);
}

function applyHabitArchive(
  line: string,
  patch: Extract<BlockPatch, { type: 'setHabitArchive' }>,
): string {
  const clean = line
    .replace(HABIT_ARCHIVE_MARKER_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!patch.archivedAt) {
    return clean;
  }

  return `${clean} 📦${patch.archivedAt}`.trim();
}

function applyReplaceMarkdown(
  parts: KramdownBlockParts,
  patch: Extract<BlockPatch, { type: 'replaceMarkdown' }>,
): string {
  const nextParts = splitKramdownBlock(patch.markdown);
  return rebuildKramdownBlock({
    ...nextParts,
    ialLines: patch.preserveIAL === false ? nextParts.ialLines : parts.ialLines,
  });
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

  if (patch.type === 'setTaskTag') {
    contentLines[index] = applyTaskTag(line, patch);
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
    contentLines[index] = applyContent(line, patch.newItemContent);
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

  if (patch.type === 'setHabitDefinition') {
    contentLines[index] = applyHabitDefinition(patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setHabitRecord') {
    contentLines[index] = applyHabitRecord(patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setHabitArchive') {
    contentLines[index] = applyHabitArchive(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'replaceMarkdown') {
    return applyReplaceMarkdown(parts, patch);
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

export function renderInsertableBlockPatch(patch: InsertableBlockPatch): string {
  if (patch.type === 'setHabitDefinition') {
    return applyHabitDefinition(patch);
  }

  if (patch.type === 'setHabitRecord') {
    return applyHabitRecord(patch);
  }

  if (patch.type === 'replaceMarkdown') {
    return patch.markdown;
  }

  throw new Error(`Patch type '${(patch as any).type}' is not insertable`);
}
