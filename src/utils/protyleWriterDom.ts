/**
 * Protyle 块 DOM 辅助：writer 单行快路径仅适用于「整块一个可见文本节点」，
 * 否则块引用等行内结构会拆成多个 Text，不能只改首节点。
 */
import { createApiLute } from '@/utils/blockWriter/render/domSerializer'

const ZWSP_RE = /[\u200B\u200C\u200D\uFEFF]/gu

const PROTYLE_WRITER_LOG_PREFIX = '[BJ-ProtyleWriter]'

function acceptProtyleVisibleTextNode(node: Node): number {
  const parent = (node as Text).parentElement
  if (!parent || parent.closest('.protyle-attr')) {
    return NodeFilter.FILTER_REJECT
  }
  // 忽略仅空白 / ZWSP（模板缩进、思源占位等），与「一个可见文本节点」语义一致
  const text = (node.textContent ?? '').replace(ZWSP_RE, '').trim()
  return text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
}

function countVisibleTextNodesExcludingAttr(element: HTMLElement): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: acceptProtyleVisibleTextNode,
  })
  let n = 0
  while (walker.nextNode()) {
    n++
  }
  return n
}

/**
 * Protyle 块是否适合 writer 单行快路径：整块仅一个可见文本节点（无块引用等行内拆分）。
 */
export function isProtyleBlockSafeForWriterFastPath(element: HTMLElement): boolean {
  return countVisibleTextNodesExcludingAttr(element) === 1
}

/**
 * 查找块元素内第一个可见文本节点（排除 .protyle-attr）。
 */
export function findFirstProtyleVisibleTextNode(element: HTMLElement): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: acceptProtyleVisibleTextNode,
  })
  return walker.nextNode() as Text | null
}

function findEditableElement(element: HTMLElement): HTMLElement | null {
  if (element.getAttribute('contenteditable') === 'true') {
    return element
  }
  return element.querySelector('[contenteditable="true"]') as HTMLElement | null
}

function normalizeBlockMarkdown(markdown: string): string {
  return markdown
    .replace(ZWSP_RE, '')
    .trimEnd()
}

function resolveBlockDOMToMarkdown(
  protyle: any,
  blockId: string | null,
): ((html: string) => string) | null {
  if (typeof protyle?.lute?.BlockDOM2StdMd === 'function') {
    return (html: string) => protyle.lute.BlockDOM2StdMd(html)
  }

  if (typeof protyle?.lute?.BlockDOM2Md === 'function') {
    return (html: string) => protyle.lute.BlockDOM2Md(html)
  }

  const lute = createApiLute()
  if (lute && typeof lute.BlockDOM2StdMd === 'function') {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} using createApiLute BlockDOM2StdMd fallback`, {
      blockId,
    })
    return (html: string) => lute.BlockDOM2StdMd(html)
  }

  if (lute && typeof lute.BlockDOM2Md === 'function') {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} using createApiLute BlockDOM2Md fallback`, {
      blockId,
    })
    return (html: string) => lute.BlockDOM2Md(html)
  }

  if (typeof protyle?.lute?.BlockDOM2Content === 'function') {
    return (html: string) => protyle.lute.BlockDOM2Content(html)
  }

  if (typeof window !== 'undefined' && typeof window.Lute?.BlockDOM2Content === 'function') {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} using lossy window.Lute.BlockDOM2Content fallback`, {
      blockId,
    })
    return (html: string) => window.Lute.BlockDOM2Content(html)
  }

  if (lute && typeof lute.BlockDOM2Content === 'function') {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} using createApiLute BlockDOM2Content fallback`, {
      blockId,
    })
    return (html: string) => lute.BlockDOM2Content(html)
  }

  return null
}

function resolveMd2BlockDOM(
  protyle: any,
  blockId: string | null,
): ((markdown: string) => string) | null {
  if (typeof protyle?.lute?.Md2BlockDOM === 'function') {
    return (markdown: string) => protyle.lute.Md2BlockDOM(markdown)
  }

  const lute = createApiLute()
  if (lute && typeof lute.Md2BlockDOM === 'function') {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} using createApiLute Md2BlockDOM fallback`, {
      blockId,
    })
    return (markdown: string) => lute.Md2BlockDOM(markdown)
  }

  return null
}

export function blockElementToMarkdownContent(protyle: any, element: HTMLElement): string | null {
  const blockId = element.getAttribute('data-node-id')
  const converter = resolveBlockDOMToMarkdown(protyle, blockId)
  if (!converter) {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} BlockDOM2Content unavailable`, {
      blockId,
    })
    return null
  }

  try {
    const content = converter(element.outerHTML)
    return typeof content === 'string' ? normalizeBlockMarkdown(content) : null
  } catch (error) {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} BlockDOM2Content failed`, {
      blockId,
      error,
    })
    return null
  }
}

export function renderMarkdownIntoBlockEditable(protyle: any, element: HTMLElement, markdown: string): boolean {
  const editable = findEditableElement(element)
  const blockId = element.getAttribute('data-node-id')
  const md2BlockDOM = resolveMd2BlockDOM(protyle, blockId)
  if (!editable || !md2BlockDOM) {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} Md2BlockDOM unavailable`, {
      blockId,
      hasEditable: Boolean(editable),
    })
    return false
  }

  const template = document.createElement('template')
  try {
    template.innerHTML = md2BlockDOM(markdown)
  } catch (error) {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} Md2BlockDOM failed`, {
      blockId,
      markdown,
      error,
    })
    return false
  }
  const renderedBlock = template.content.firstElementChild as HTMLElement | null
  const renderedEditable = renderedBlock ? findEditableElement(renderedBlock) : null
  if (!renderedEditable) {
    console.debug(`${PROTYLE_WRITER_LOG_PREFIX} rendered editable missing`, {
      blockId,
      markdown,
    })
    return false
  }

  editable.innerHTML = renderedEditable.innerHTML
  return true
}
