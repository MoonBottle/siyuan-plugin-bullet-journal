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

  if (startNode.nodeType !== Node.TEXT_NODE) return null;

  const blockElement = startNode.parentElement?.closest('[data-node-id]') as HTMLElement | null;

  if (!blockElement) return null;

  const blockId = blockElement.getAttribute('data-node-id');
  if (!blockId) return null;

  const textContent = startNode.textContent ?? '';
  const slashIdx = textContent.lastIndexOf('/', range.startOffset);

  if (slashIdx === -1) return null;

  return {
    blockId,
    blockElement,
    range,
    slashStartOffset: slashIdx,
  };
}

export function deleteSlashRangeText(range: Range, filter: string, slashStartOffset: number): void {
  void filter;
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    throw new Error('Slash range must start in a text node');
  }
  if (slashStartOffset < 0 || slashStartOffset > range.startOffset) {
    throw new Error(`Invalid slashStartOffset ${slashStartOffset}`);
  }
  const text = range.startContainer.textContent ?? '';
  if (text[slashStartOffset] !== '/') return;

  range.setStart(range.startContainer, slashStartOffset);
  range.deleteContents();
}
