export interface ActiveSlashRange {
  blockId: string;
  blockElement: HTMLElement;
  range: Range;
  slashStartOffset: number;
}

const SLASH_COMMAND_START_CHARS = ['/', '、'] as const;

function isSlashCommandStartChar(char: string | undefined): boolean {
  return SLASH_COMMAND_START_CHARS.some(candidate => candidate === char);
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

  range.setStart(range.startContainer, slashStartOffset);
  range.deleteContents();
}
