/**
 * Protyle 块 DOM 辅助：writer 单行快路径仅适用于「整块一个可见文本节点」，
 * 否则块引用等行内结构会拆成多个 Text，不能只改首节点。
 */

function acceptProtyleVisibleTextNode(node: Node): number {
  const parent = (node as Text).parentElement;
  if (!parent || parent.closest('.protyle-attr')) {
    return NodeFilter.FILTER_REJECT;
  }
  // 忽略仅空白 / ZWSP（模板缩进、思源占位等），与「一个可见文本节点」语义一致
  const text = (node.textContent ?? '').replace(/\u200b/g, '').trim();
  return text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
}

function countVisibleTextNodesExcludingAttr(element: HTMLElement): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: acceptProtyleVisibleTextNode,
  });
  let n = 0;
  while (walker.nextNode()) {
    n++;
  }
  return n;
}

/**
 * Protyle 块是否适合 writer 单行快路径：整块仅一个可见文本节点（无块引用等行内拆分）。
 */
export function isProtyleBlockSafeForWriterFastPath(element: HTMLElement): boolean {
  return countVisibleTextNodesExcludingAttr(element) === 1;
}

/**
 * 查找块元素内第一个可见文本节点（排除 .protyle-attr）。
 */
export function findFirstProtyleVisibleTextNode(element: HTMLElement): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: acceptProtyleVisibleTextNode,
  });
  return walker.nextNode() as Text | null;
}

function findEditableElement(element: HTMLElement): HTMLElement | null {
  if (element.getAttribute('contenteditable') === 'true') {
    return element;
  }
  return element.querySelector('[contenteditable="true"]') as HTMLElement | null;
}

export function blockElementToMarkdownContent(protyle: any, element: HTMLElement): string | null {
  const converter = protyle?.lute?.BlockDOM2Content;
  if (typeof converter !== 'function') {
    return null;
  }
  const content = converter(element.outerHTML);
  return typeof content === 'string' ? content.trim() : null;
}

export function renderMarkdownIntoBlockEditable(protyle: any, element: HTMLElement, markdown: string): boolean {
  const editable = findEditableElement(element);
  const md2BlockDOM = protyle?.lute?.Md2BlockDOM;
  if (!editable || typeof md2BlockDOM !== 'function') {
    return false;
  }

  const template = document.createElement('template');
  template.innerHTML = md2BlockDOM(markdown);
  const renderedBlock = template.content.firstElementChild as HTMLElement | null;
  const renderedEditable = renderedBlock ? findEditableElement(renderedBlock) : null;
  if (!renderedEditable) {
    return false;
  }

  editable.innerHTML = renderedEditable.innerHTML;
  return true;
}
