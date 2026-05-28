import type {
  BlockWriteContext,
  PreparedMutationPayload,
} from '@/utils/blockWriter/shared/types'
/**
 * Protyle 提交器：通过 SiYuan 的 protyle.transaction 机制提交变更
 *
 * Transaction 机制：
 * - do 操作：新 DOM HTML（含 <wbr> 标记）
 * - undo 操作：旧 DOM HTML（用于撤销）
 * protyle.transaction 会将变更写入内核并更新编辑器视图
 *
 * 光标恢复：
 * 1. 优先通过 <wbr> 标记定位（focusByWbr）
 * 2. wbr 定位失败时通过 fallbackOffset 定位（focusByOffset）
 */
import {
  focusByOffset,
  focusByWbr,
} from '@/utils/blockWriter/shared/caretController'

function formatUpdatedAttr(date = new Date()): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${mo}${d}${h}${mi}${s}`
}

function previewText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').slice(0, 160)
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function resolveSearchRoot(protyle: any, fallback: HTMLElement): ParentNode {
  const protyleRoot = protyle?.wysiwyg?.element
  if (protyleRoot && typeof protyleRoot.querySelector === 'function') {
    return protyleRoot
  }

  const fallbackRoot = fallback.closest('.protyle-wysiwyg')
  if (fallbackRoot && typeof fallbackRoot.querySelector === 'function') {
    return fallbackRoot
  }

  return fallback.ownerDocument ?? document
}

function resolveLiveTargetElement(targetBlockId: string, fallback: HTMLElement, protyle: any): HTMLElement {
  if (fallback.isConnected && fallback.getAttribute('data-node-id') === targetBlockId) {
    return fallback
  }

  const searchRoot = resolveSearchRoot(protyle, fallback)
  const liveTarget = searchRoot.querySelector(`[data-node-id="${escapeAttributeValue(targetBlockId)}"]`) as HTMLElement | null
  return liveTarget ?? fallback
}

function resolvePrimaryMarkdownLine(markdown: string): string {
  const lines = markdown.split('\n')
  return lines.find((line) => line.trim().length > 0 && !line.trim().startsWith('{:')) ?? ''
}

function findEditableElement(element: HTMLElement): HTMLElement | null {
  return element.getAttribute('contenteditable') === 'true'
    ? element
    : element.querySelector('[contenteditable="true"]') as HTMLElement | null
}

function syncElementAttributes(targetElement: HTMLElement, renderedElement: HTMLElement): void {
  const nextAttributeNames = new Set(renderedElement.getAttributeNames())
  for (const attributeName of targetElement.getAttributeNames()) {
    if (!nextAttributeNames.has(attributeName)) {
      targetElement.removeAttribute(attributeName)
    }
  }
  for (const attributeName of nextAttributeNames) {
    const attributeValue = renderedElement.getAttribute(attributeName)
    if (attributeValue === null) {
      targetElement.removeAttribute(attributeName)
      continue
    }
    targetElement.setAttribute(attributeName, attributeValue)
  }
}

function syncTaskActionIcon(targetElement: HTMLElement, renderedElement: HTMLElement): void {
  const targetUse = targetElement.querySelector('.protyle-action--task use')
  const renderedUse = renderedElement.querySelector('.protyle-action--task use')
  if (!targetUse || !renderedUse) {
    return
  }

  const href = renderedUse.getAttribute('href')
    ?? renderedUse.getAttribute('xlink:href')
    ?? renderedUse.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
  if (href) {
    targetUse.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href)
  }
}

/** 将渲染后的 DOM HTML 应用到目标元素：同步属性、替换内容、更新任务图标 */
function applyTransactionDomHtml(targetElement: HTMLElement, transactionDomHtml: string): boolean {
  const template = document.createElement('template')
  template.innerHTML = transactionDomHtml.trim()
  const renderedElement = template.content.firstElementChild as HTMLElement | null
  if (!renderedElement) {
    return false
  }

  syncElementAttributes(targetElement, renderedElement)
  const targetEditable = findEditableElement(targetElement)
  const renderedEditable = findEditableElement(renderedElement)
  if (targetEditable && renderedEditable) {
    syncElementAttributes(targetEditable, renderedEditable)
    targetEditable.innerHTML = renderedEditable.innerHTML
    syncTaskActionIcon(targetElement, renderedElement)
    return true
  }

  targetElement.innerHTML = renderedElement.innerHTML
  return true
}

/**
 * 通过 protyle transaction 提交更新：
 * 1. 将 transactionDomHtml 应用到目标元素
 * 2. 调用 protyle.transaction 提交 do/undo 操作
 * 3. 恢复光标位置
 * 返回 false 表示 protyle 不可用或应用失败，调用方应回退到 API 提交
 */
export async function commitViaProtyle(
  context: Pick<BlockWriteContext, 'protyle'>,
  payload: Extract<PreparedMutationPayload, { kind: 'update' }>,
): Promise<boolean> {
  const { protyle } = context
  const targetElement = payload.targetElement
  if (!protyle || !targetElement || typeof protyle.transaction !== 'function' || !payload.transactionDomHtml) {
    console.log('[BJ-MutationPlanner][protyleCommitter] unavailable', {
      hasProtyle: Boolean(protyle),
      hasTargetElement: Boolean(targetElement),
      hasTransaction: typeof protyle?.transaction === 'function',
      hasTransactionDomHtml: Boolean(payload.transactionDomHtml),
      targetBlockId: payload.targetBlockId,
    })
    return false
  }

  const oldHTML = payload.oldDomHtml ?? targetElement.outerHTML
  console.log('[BJ-MutationPlanner][protyleCommitter] before render', {
    targetBlockId: payload.targetBlockId,
    beforePreview: previewText(targetElement.textContent),
    nextMarkdownPreview: previewText(payload.nextMarkdown),
    caretPolicy: payload.caretRestorePlan?.policy ?? 'none',
  })

  if (!applyTransactionDomHtml(targetElement, payload.transactionDomHtml)) {
    console.log('[BJ-MutationPlanner][protyleCommitter] apply transaction html failed', {
      targetBlockId: payload.targetBlockId,
      transactionPreview: previewText(resolvePrimaryMarkdownLine(payload.nextMarkdown)),
    })
    return false
  }

  targetElement.setAttribute('updated', formatUpdatedAttr())
  console.log('[BJ-MutationPlanner][protyleCommitter] before transaction', {
    targetBlockId: payload.targetBlockId,
    afterRenderPreview: previewText(targetElement.textContent),
  })
  protyle.transaction(
    [{
      id: payload.targetBlockId,
      data: targetElement.outerHTML,
      action: 'update',
    }],
    [{
      id: payload.targetBlockId,
      data: oldHTML,
      action: 'update',
    }],
  )

  if (payload.caretRestorePlan?.policy === 'wbr') {
    const liveTargetElement = resolveLiveTargetElement(payload.targetBlockId, targetElement, protyle)
    const restoredByWbr = focusByWbr(liveTargetElement)
    console.log('[BJ-MutationPlanner][protyleCommitter] caret restore', {
      targetBlockId: payload.targetBlockId,
      liveTargetPreview: previewText(liveTargetElement.textContent),
      restoredByWbr,
      fallbackOffset: payload.caretRestorePlan.fallbackOffset,
    })
    if (!restoredByWbr) {
      const restoredByOffset = focusByOffset(liveTargetElement, payload.caretRestorePlan.fallbackOffset)
      if (!restoredByOffset) {
        console.log('[BJ-MutationPlanner][protyleCommitter] caret restore fully failed', {
          targetBlockId: payload.targetBlockId,
          caretRestoreFailed: true,
          fallbackOffset: payload.caretRestorePlan.fallbackOffset,
        })
      }
    }
  }

  return true
}
