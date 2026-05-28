import type { BlockWriteContext } from '@/utils/blockWriter/shared/types'
import { updateBlock } from '@/api'
import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer'
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom'

/**
 * @deprecated Compat helpers only.
 * New write paths must go through sourceLoader/updateRenderer/committers.
 */
function formatUpdatedAttr(date = new Date()): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${mo}${d}${h}${mi}${s}`
}

export async function waitForProtyleTransactionsFlush(timeout = 3000): Promise<void> {
  const start = Date.now()
  const siyuanWin = window as any
  while (siyuanWin.siyuan?.transactions?.length > 0 && Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  await new Promise((resolve) => setTimeout(resolve, 200))
}

export async function writeMarkdownToCurrentBlock(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
  content: string,
  options?: {
    oldHTML?: string
  },
): Promise<boolean> {
  const {
    blockId,
    protyle,
    nodeElement,
  } = context
  if (!blockId || !protyle || !nodeElement) {
    return false
  }

  const oldHTML = options?.oldHTML ?? nodeElement.outerHTML
  const textContent = content.replace(/\n\{:[^}]*\}/g, '').trim()
  if (!renderMarkdownIntoBlockEditable(protyle, nodeElement, textContent)) {
    return false
  }

  nodeElement.setAttribute('updated', formatUpdatedAttr())

  const newHTML = nodeElement.outerHTML
  if (newHTML !== oldHTML && typeof protyle.transaction === 'function') {
    protyle.transaction(
      [{
        id: blockId,
        data: newHTML,
        action: 'update',
      }],
      [{
        id: blockId,
        data: oldHTML,
        action: 'update',
      }],
    )
  }
  return true
}

export function createProtyleMarkdownWriter(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
): ((content: string, targetBlockId: string) => Promise<boolean>) | undefined {
  const {
    blockId: currentBlockId,
    protyle,
    nodeElement,
  } = context
  if (!currentBlockId || !protyle || !nodeElement) {
    return undefined
  }

  const oldHTML = nodeElement.outerHTML

  return async (content: string, targetBlockId: string): Promise<boolean> => {
    try {
      const isSameBlock = targetBlockId === currentBlockId
      const canRenderInline = isSameBlock

      if (canRenderInline && await writeMarkdownToCurrentBlock(
        context,
        content,
        { oldHTML },
      )) {
        return true
      }

      await waitForProtyleTransactionsFlush()
      const blockDOM = markdownToBlockDOM(content)
      await updateBlock(blockDOM ? 'dom' : 'markdown', blockDOM ?? content, targetBlockId)
      return true
    }
    catch {
      const blockDOM = markdownToBlockDOM(content)
      await updateBlock(blockDOM ? 'dom' : 'markdown', blockDOM ?? content, targetBlockId)
      return true
    }
  }
}
