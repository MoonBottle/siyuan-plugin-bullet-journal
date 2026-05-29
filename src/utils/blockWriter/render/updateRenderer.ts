import type {
  CaretRestorePlan,
  LoadedMutationSource,
  PreparedMutationPayload,
  ResolvedMutationPlan,
} from '@/utils/blockWriter/shared/types'
import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender'
/**
 * 更新渲染器：将 patch 应用到 markdown，生成最终提交载荷
 *
 * 核心流程：
 * 1. Markdown Transform — 逐个应用 patch 到源 markdown，生成 nextMarkdown
 * 2. DOM Render — 将 nextMarkdown 渲染为 DOM HTML（用于 API 提交）
 * 3. Transaction Render — 在克隆 DOM 上渲染并注入 <wbr>（用于 protyle transaction）
 * 4. Caret Plan — 根据光标策略生成光标恢复计划
 */
import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer'
import { applyBlockPatch } from '@/utils/blockWriter/render/kramdownModifier'
import { injectWbrIntoEditable } from '@/utils/blockWriter/shared/caretController'
import { isTaskListFormat } from '@/utils/blockWriter/shared/itemLineMarkers'
import { splitKramdownBlock } from '@/utils/blockWriter/shared/kramdownBlocks'
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom'

interface CaretRestoreOptions {
  caretOwner?: boolean
  caretPolicy?: 'none' | 'wbr'
}

function findEditableTextContent(element?: HTMLElement): string {
  if (!element) {
    return ''
  }

  const editable = findEditableElement(element)
  return editable?.textContent ?? ''
}

function findEditableElement(element?: HTMLElement): HTMLElement | null {
  if (!element) {
    return null
  }
  return element.getAttribute('contenteditable') === 'true'
    ? element
    : element.querySelector('[contenteditable="true"]') as HTMLElement | null
}

/** 根据光标快照的 fallbackOffset 计算光标所在行索引 */
function resolveCaretLineIndex(source: Extract<LoadedMutationSource, { kind: 'update' }>): number | undefined {
  const fallbackStart = source.caretSnapshot?.policy === 'wbr-first'
    ? source.caretSnapshot.fallbackOffset?.start
    : undefined
  if (typeof fallbackStart !== 'number') {
    return undefined
  }

  const textContent = findEditableTextContent(source.targetElement)
  if (!textContent) {
    return undefined
  }

  const safeOffset = Math.max(0, Math.min(fallbackStart, textContent.length))
  return textContent.slice(0, safeOffset).split('\n').length - 1
}

/** 构建光标恢复计划：根据 caretPolicy 和光标快照决定恢复策略 */
function buildCaretRestorePlan(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  options?: CaretRestoreOptions,
): CaretRestorePlan {
  const effectivePolicy = options?.caretPolicy
    ?? (plan.patches.some((patch) => patch.type === 'removeSlashCommand') ? 'wbr' : 'none')
  if (options?.caretOwner === false || effectivePolicy !== 'wbr') {
    return { policy: 'none' }
  }

  const lineIndex = resolveCaretLineIndex(source)

  return {
    policy: 'wbr',
    placement: typeof lineIndex === 'number' ? 'line-end' : 'block-end',
    lineIndex,
    fallbackOffset: source.caretSnapshot?.policy === 'wbr-first'
      ? source.caretSnapshot.fallbackOffset
      : undefined,
  }
}

/** 根据 CaretRestorePlan 计算 <wbr> 应注入的文本偏移量 */
function resolveWbrOffset(
  editable: HTMLElement,
  plan: CaretRestorePlan,
): number | undefined {
  const textContent = editable.textContent ?? ''

  if (typeof plan.targetOffset === 'number') {
    return Math.max(0, Math.min(plan.targetOffset, textContent.length))
  }

  if (typeof plan.lineIndex === 'number') {
    const lines = textContent.split('\n')
    const safeLineIndex = Math.max(0, Math.min(plan.lineIndex, Math.max(0, lines.length - 1)))
    let lineStartOffset = 0
    for (let index = 0; index < safeLineIndex; index += 1) {
      lineStartOffset += lines[index].length + 1
    }
    const targetLine = lines[safeLineIndex] ?? ''

    if (plan.anchorText) {
      const anchorIndex = targetLine.lastIndexOf(plan.anchorText)
      if (anchorIndex >= 0) {
        return lineStartOffset + anchorIndex + plan.anchorText.length
      }
    }

    if (plan.placement === 'line-end') {
      return lineStartOffset + targetLine.length
    }
  }

  if (plan.anchorText) {
    const anchorIndex = textContent.lastIndexOf(plan.anchorText)
    if (anchorIndex >= 0) {
      return anchorIndex + plan.anchorText.length
    }
  }

  return textContent.length
}

function resolvePrimaryMarkdownLine(markdown: string): string {
  const lines = markdown.split('\n')
  return lines.find((line) => line.trim().length > 0 && !line.trim().startsWith('{:')) ?? ''
}

/** 同步任务列表的完成状态到 DOM（class、data-task、图标） */
function syncTaskListStatusFromMarkdown(targetElement: HTMLElement, markdown: string): void {
  const listItemElement = targetElement.matches('[data-type="NodeListItem"][data-subtype="t"]')
    ? targetElement
    : targetElement.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement | null
  if (!listItemElement) {
    return
  }

  const primaryLine = resolvePrimaryMarkdownLine(markdown)
  if (!isTaskListFormat(primaryLine)) {
    return
  }

  const isDone = TASK_DONE_CHECK_RE.test(primaryLine)
  listItemElement.classList.toggle('protyle-task--done', isDone)
  listItemElement.setAttribute('data-task', isDone ? 'X' : ' ')

  const useEl = listItemElement.querySelector('.protyle-action--task use')
  if (useEl) {
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', isDone ? '#iconCheck' : '#iconUncheck')
  }
}

/**
 * 构建 protyle transaction 所需的 DOM HTML：
 * 克隆目标元素 → 渲染 markdown → 同步任务状态 → 注入 <wbr>
 * 返回的 HTML 将作为 protyle.transaction 的 do 操作数据
 */
function buildProtyleTransactionHtml(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  nextMarkdown: string,
  caretRestorePlan: CaretRestorePlan,
): string | undefined {
  const targetElement = source.targetElement
  if (!targetElement || !plan.context.protyle) {
    return undefined
  }

  const draftTarget = targetElement.cloneNode(true) as HTMLElement
  if (!renderMarkdownIntoBlockEditable(plan.context.protyle, draftTarget, nextMarkdown)) {
    return undefined
  }

  syncTaskListStatusFromMarkdown(draftTarget, nextMarkdown)

  if (caretRestorePlan.policy === 'wbr') {
    const editable = findEditableElement(draftTarget)
    if (editable) {
      injectWbrIntoEditable(editable, resolveWbrOffset(editable, caretRestorePlan))
    }
  }

  return draftTarget.outerHTML
}

/**
 * 准备更新载荷：应用 patch 到源 markdown，生成 DOM HTML、transaction HTML 和光标恢复计划
 * removeSlashCommand patch 不参与 markdown 变换（已在源加载阶段处理）
 */
export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  options?: CaretRestoreOptions,
): Extract<PreparedMutationPayload, { kind: 'update' }> {
  const renderablePatches = plan.patches.filter((patch) => patch.type !== 'removeSlashCommand')
  let nextMarkdown = source.currentMarkdown
  const sourceBlockId = plan.sourceBlockId ?? source.sourceBlockId ?? source.targetBlockId

  for (const patch of renderablePatches) {
    if (patch.type === 'addDate') {
      nextMarkdown = renderDatePatch(nextMarkdown, patch, plan.datePatchSource
        ? {
            originalBlockId: plan.datePatchSource.originalBlockId,
            sourceBlockId: plan.datePatchSource.sourceBlockId,
            targetItemBlockRaw: plan.datePatchSource.targetItemBlockRaw,
            usedParentDocumentContext: plan.datePatchSource.usedParentDocumentContext,
            finalTargetBlockId: plan.datePatchSource.finalTargetBlockId,
          }
        : undefined)
      continue
    }

    nextMarkdown = applyBlockPatch(splitKramdownBlock(nextMarkdown), patch)
  }

  const caretRestorePlan = buildCaretRestorePlan(plan, source, options)
  const transactionDomHtml = plan.commitKind === 'protyle-update'
    ? buildProtyleTransactionHtml(plan, source, nextMarkdown, caretRestorePlan)
    : undefined

  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    transactionDomHtml,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan,
  }
}
