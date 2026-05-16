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

export function deleteSlashRangeText(range: Range, filter: string, slashStartOffset: number): void {
  const text = range.startContainer.textContent ?? '';
  const actualSlashIdx = text.lastIndexOf('/');
  if (actualSlashIdx === -1 || actualSlashIdx !== slashStartOffset) {
    const offset = text.lastIndexOf(`/${filter}`);
    if (offset === -1) return;
    range.setStart(range.startContainer, offset);
    range.setEnd(range.startContainer, offset + filter.length + 1);
    range.deleteContents();
    return;
  }
  range.setStart(range.startContainer, slashStartOffset);
  range.setEnd(range.startContainer, slashStartOffset + filter.length + 1);
  range.deleteContents();
}