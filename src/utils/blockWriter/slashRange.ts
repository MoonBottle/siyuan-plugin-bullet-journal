import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';
import { generateSlashPatterns } from '@/utils/stringUtils';

export interface ActiveSlashRange {
  blockId: string;
  blockElement: HTMLElement;
  range: Range;
  slashStartOffset: number;
}

const SLASH_COMMAND_START_CHARS = ['/', '、'] as const;
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/u;
const KNOWN_SLASH_PATTERNS = Array.from(generateSlashPatterns(ALL_SLASH_COMMAND_FILTERS))
  .sort((a, b) => b.length - a.length);

function isSlashCommandStartChar(char: string | undefined): boolean {
  return SLASH_COMMAND_START_CHARS.some(candidate => candidate === char);
}

function resolveSlashCommandEndOffset(
  text: string,
  slashStartOffset: number,
  currentEndOffset: number,
): number {
  if (currentEndOffset > slashStartOffset) {
    return currentEndOffset;
  }

  const trailingText = text.slice(slashStartOffset);
  const matchedPattern = KNOWN_SLASH_PATTERNS.find(pattern => trailingText.startsWith(pattern));
  if (matchedPattern) {
    let endOffset = slashStartOffset + matchedPattern.length;
    while (endOffset < text.length && ZERO_WIDTH_CHARS.test(text[endOffset])) {
      endOffset += 1;
    }
    return endOffset;
  }

  let endOffset = slashStartOffset + 1;
  while (endOffset < text.length) {
    const char = text[endOffset];
    if (!char || /\s/u.test(char) || ZERO_WIDTH_CHARS.test(char)) {
      break;
    }
    endOffset += 1;
  }
  while (endOffset < text.length && ZERO_WIDTH_CHARS.test(text[endOffset])) {
    endOffset += 1;
  }
  return endOffset;
}

export function findSlashCommandStartOffset(textContent: string, cursorOffset: number): number {
  let startOffset = -1;

  for (const marker of SLASH_COMMAND_START_CHARS) {
    const markerOffset = textContent.lastIndexOf(marker, cursorOffset);
    if (markerOffset > startOffset) {
      startOffset = markerOffset;
    }
  }

  return startOffset;
}

export function getActiveSlashRange(): ActiveSlashRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer;

  if (startNode.nodeType !== Node.TEXT_NODE) return null;

  const blockElement = startNode.parentElement?.closest('[data-node-id]') as HTMLElement | null;

  if (!blockElement) return null;

  const blockId = blockElement.getAttribute('data-node-id');
  if (!blockId) return null;

  const textContent = startNode.textContent ?? '';
  const slashIdx = findSlashCommandStartOffset(textContent, range.startOffset);

  if (slashIdx === -1) return null;

  return {
    blockId,
    blockElement,
    range,
    slashStartOffset: slashIdx,
  };
}

export function deleteSlashRangeText(range: Range, slashStartOffset: number): void {
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    throw new Error('Slash range must start in a text node');
  }
  if (slashStartOffset < 0 || slashStartOffset > range.startOffset) {
    throw new Error(`Invalid slashStartOffset ${slashStartOffset}`);
  }
  const text = range.startContainer.textContent ?? '';
  if (!isSlashCommandStartChar(text[slashStartOffset])) return;

  const slashEndOffset = resolveSlashCommandEndOffset(
    text,
    slashStartOffset,
    range.endContainer === range.startContainer ? range.endOffset : range.startOffset,
  );

  range.setStart(range.startContainer, slashStartOffset);
  range.setEnd(range.startContainer, Math.max(slashStartOffset, slashEndOffset));
  range.deleteContents();
}
