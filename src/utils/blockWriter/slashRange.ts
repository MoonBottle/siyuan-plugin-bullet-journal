export interface ActiveSlashRange {
  blockId: string;
  blockElement: HTMLElement;
  range: Range;
  slashStartOffset: number;
}

export function getActiveSlashRange(): ActiveSlashRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer;

  let blockElement: HTMLElement | null = null;
  if (startNode.nodeType === Node.TEXT_NODE) {
    blockElement = startNode.parentElement?.closest('[data-node-id]') as HTMLElement | null;
  } else {
    blockElement = (startNode as Element).closest('[data-node-id]') as HTMLElement | null;
  }

  if (!blockElement) return null;

  const blockId = blockElement.getAttribute('data-node-id');
  if (!blockId) return null;

  const textContent = range.startContainer.textContent ?? '';
  const fullText = blockElement.textContent ?? '';
  const slashIdx = fullText.lastIndexOf('/');

  if (slashIdx === -1) return null;

  return {
    blockId,
    blockElement,
    range,
    slashStartOffset: slashIdx,
  };
}

export function deleteSlashRangeText(range: Range, slashStartOffset: number): void {
  range.setStart(range.startContainer, slashStartOffset);
  range.deleteContents();
}