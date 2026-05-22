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

function createClonedHtmlWithWbr(nodeElement: HTMLElement, range: Range): string | undefined {
  const path = getNodePath(nodeElement, range.startContainer);
  if (!path) {
    return undefined;
  }

  const clone = nodeElement.cloneNode(true) as HTMLElement;
  const clonedStartNode = getNodeByPath(clone, path);
  if (!clonedStartNode || clonedStartNode.nodeType !== Node.TEXT_NODE) {
    return undefined;
  }

  const wbrRange = document.createRange();
  wbrRange.setStart(
    clonedStartNode,
    Math.min(range.startOffset, clonedStartNode.textContent?.length ?? 0),
  );
  wbrRange.collapse(true);
  wbrRange.insertNode(document.createElement('wbr'));
  return clone.outerHTML;
}

export function captureCaretSnapshot(nodeElement: HTMLElement, range?: Range | null): CaretSnapshot {
  const editable = findEditable(nodeElement);
  if (!editable) {
    return { policy: 'none' };
  }

  const selection = window.getSelection();
  const activeRange = range ?? (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
  const fallbackStart = activeRange ? computeOffsetWithin(editable, activeRange.startContainer, activeRange.startOffset) : undefined;
  const fallbackEnd = activeRange ? computeOffsetWithin(editable, activeRange.endContainer, activeRange.endOffset) : undefined;

  return {
    policy: 'wbr-first',
    containerBlockId: nodeElement.getAttribute('data-node-id') ?? '',
    clonedHtmlWithWbr: activeRange ? createClonedHtmlWithWbr(nodeElement, activeRange) : undefined,
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
  const previousTextNode = wbr.previousSibling?.nodeType === Node.TEXT_NODE
    ? wbr.previousSibling as Text
    : null;
  const nextTextNode = wbr.nextSibling?.nodeType === Node.TEXT_NODE
    ? wbr.nextSibling as Text
    : null;

  if (previousTextNode) {
    range.setStart(previousTextNode, previousTextNode.textContent?.length ?? 0);
  }
  else if (nextTextNode) {
    range.setStart(nextTextNode, 0);
  }
  else {
    range.setStartAfter(wbr);
  }
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
