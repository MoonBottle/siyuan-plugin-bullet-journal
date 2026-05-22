import type { CaretSnapshot } from './types';

function findEditable(nodeElement: HTMLElement): HTMLElement | null {
  if (nodeElement.getAttribute('contenteditable') === 'true') {
    return nodeElement;
  }
  return nodeElement.querySelector('[contenteditable="true"]') as HTMLElement | null;
}

function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function computeOffsetWithin(root: Node, targetNode: Node, targetOffset: number): number | undefined {
  const textNodes = collectTextNodes(root);
  let total = 0;

  for (const textNode of textNodes) {
    if (textNode === targetNode) {
      return total + Math.min(targetOffset, textNode.textContent?.length ?? 0);
    }
    total += textNode.textContent?.length ?? 0;
  }

  return undefined;
}

export function captureCaretSnapshot(nodeElement: HTMLElement): CaretSnapshot {
  const editable = findEditable(nodeElement);
  if (!editable) {
    return { policy: 'none' };
  }

  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const fallbackStart = range ? computeOffsetWithin(editable, range.startContainer, range.startOffset) : undefined;
  const fallbackEnd = range ? computeOffsetWithin(editable, range.endContainer, range.endOffset) : undefined;

  return {
    policy: 'wbr-first',
    containerBlockId: nodeElement.getAttribute('data-node-id') ?? '',
    fallbackOffset: fallbackStart === undefined || fallbackEnd === undefined
      ? undefined
      : { start: fallbackStart, end: fallbackEnd },
  };
}

export function injectWbrIntoEditable(editable: HTMLElement, offset?: number): boolean {
  const textNodes = collectTextNodes(editable);
  if (textNodes.length === 0) {
    editable.appendChild(document.createElement('wbr'));
    return true;
  }

  const targetOffset = offset ?? textNodes.reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0);
  let remaining = targetOffset;

  for (const textNode of textNodes) {
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      range.insertNode(document.createElement('wbr'));
      return true;
    }
    remaining -= length;
  }

  editable.appendChild(document.createElement('wbr'));
  return true;
}

export function focusByWbr(nodeElement: HTMLElement): boolean {
  const wbr = nodeElement.querySelector('wbr');
  if (!wbr) {
    return false;
  }

  const range = document.createRange();
  range.setStartAfter(wbr);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  wbr.remove();
  return true;
}

export function focusByOffset(nodeElement: HTMLElement, offset?: { start: number; end: number }): boolean {
  const editable = findEditable(nodeElement);
  if (!editable) {
    return false;
  }

  const textNodes = collectTextNodes(editable);
  if (textNodes.length === 0) {
    return false;
  }

  let remaining = offset?.start ?? textNodes.reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0);

  for (const textNode of textNodes) {
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    remaining -= length;
  }

  const lastNode = textNodes[textNodes.length - 1];
  const range = document.createRange();
  range.setStart(lastNode, lastNode.textContent?.length ?? 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}
