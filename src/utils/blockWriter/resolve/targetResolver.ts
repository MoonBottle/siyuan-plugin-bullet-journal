import type {
  BlockMutationIntent,
  DatePatchSourceContext,
  ResolvedMutationPlan,
} from '@/utils/blockWriter/shared/types'
/**
 * 目标解析器：确定变更的实际目标块、数据来源和提交方式
 *
 * DOM-first 策略：优先使用 protyle 中的 DOM 作为数据源（保留内联样式和光标），
 * 仅在 DOM 不可用时回退到 API 获取 kramdown。
 *
 * 日期 patch 的特殊处理：
 * 日期标记可能位于父文档中而非当前块，需要向上查找包含日期的父块作为源，
 * 同时记录 originalBlockId → sourceBlockId 的映射关系。
 */
import {
  getBlockByID,
  getBlockKramdown,
} from '@/api'
import { parseKramdownBlocks } from '@/parser/core'
import { isTaskListFormat } from '@/utils/blockWriter/shared/itemLineMarkers'

/** 日期 patch 源解析结果 */
export interface DatePatchSource {
  originalBlockId: string
  kramdown: string
  targetBlockId: string
  targetItemBlockRaw: string | null
  usedParentDocumentContext: boolean
  finalTargetBlockId?: string
}

function isListItemLine(line: string): boolean {
  return /^\s*(-|\d+\.)\s+/.test(line)
}

/**
 * 解析日期 patch 的源块：向上查找包含日期标记的父文档
 * 如果父文档中包含日期标记，则用父文档 kramdown 作为源；
 * 否则回退到当前块自身的 kramdown
 */
export async function resolveDatePatchSource(blockId: string): Promise<DatePatchSource | null> {
  let kramdown: string | null = null
  let targetBlockId = blockId
  let targetItemBlockRaw: string | null = null
  let usedParentDocumentContext = false
  const block = await getBlockByID(blockId)

  if (block?.parent_id) {
    const parentResult = await getBlockKramdown(block.parent_id)
    if (parentResult?.kramdown) {
      const blocks = parseKramdownBlocks(parentResult.kramdown)
      const itemBlockIndex = blocks.findIndex((candidate) => candidate.blockId === blockId)
      const itemBlock = itemBlockIndex >= 0 ? blocks[itemBlockIndex] : null
      usedParentDocumentContext = blocks.length > 1
      if (itemBlock) {
        targetItemBlockRaw = itemBlock.raw
      }

      const blocksToCheck = itemBlock
        ? (itemBlockIndex > 0 ? [itemBlock, blocks[itemBlockIndex - 1]] : [itemBlock])
        : []

      for (const checkBlock of blocksToCheck) {
        const linesToCheck = checkBlock.content.split('\n')
        for (const line of linesToCheck) {
          const trimmed = line.trim()
          if (trimmed.startsWith('{:') || trimmed.startsWith('🍅')) {
            continue
          }
          const hasDateMarker = trimmed.includes('@') || trimmed.includes('📅')
          const hasDateValue = /\d{4}-\d{2}-\d{2}/.test(trimmed)
          if (hasDateMarker && hasDateValue && (isTaskListFormat(trimmed) || isListItemLine(line))) {
            kramdown = parentResult.kramdown
            targetBlockId = block.parent_id
            break
          }
        }
        if (kramdown) break
      }
    }
  }

  if (!kramdown) {
    const result = await getBlockKramdown(blockId)
    if (!result?.kramdown) {
      console.error('[BlockWriter] Failed to get block kramdown for addDate patch')
      return null
    }
    kramdown = result.kramdown
  }

  return {
    originalBlockId: blockId,
    kramdown,
    targetBlockId,
    targetItemBlockRaw,
    usedParentDocumentContext,
  }
}

function subtypeOf(block: any): string | undefined {
  return block?.subtype ?? block?.subType
}

function parentIdOf(block: any): string | undefined {
  return block?.parent_id ?? block?.parentId
}

function isTaskListNode(block: any): boolean {
  const type = block?.type
  return (type === 'NodeListItem' || type === 'i') && subtypeOf(block) === 't'
}

/** 解析 update 意图的实际目标块 ID：日期 patch 取日期源，状态/优先级/内容 patch 向上查找任务列表祖先 */
async function resolveUpdateTargetBlockId(intent: Extract<BlockMutationIntent, { kind: 'update' }>): Promise<string> {
  const datePatchSource = await resolveDateSourceContext(intent)
  if (datePatchSource) {
    return datePatchSource.finalTargetBlockId
  }

  const shouldResolveTaskListAncestor = intent.patches.some((patch) => {
    return patch.type === 'setStatus' || patch.type === 'setPriority' || patch.type === 'setContent'
  })

  if (!shouldResolveTaskListAncestor) {
    return intent.context.listItemBlockId || intent.context.blockId
  }

  const startBlockId = intent.context.blockId
  let current = await getBlockByID(startBlockId)
  const visited = new Set<string>()

  for (let depth = 0; current && depth < 8; depth += 1) {
    if (isTaskListNode(current)) {
      return current.id
    }

    const parentId = parentIdOf(current)
    if (!parentId || visited.has(parentId)) {
      break
    }
    visited.add(parentId)
    current = await getBlockByID(parentId)
  }

  return intent.context.listItemBlockId || startBlockId
}

/** 构建 DatePatchSourceContext：仅当意图包含 addDate patch 时才解析 */
async function resolveDateSourceContext(
  intent: Extract<BlockMutationIntent, { kind: 'update' }>,
): Promise<DatePatchSourceContext | null> {
  if (!intent.patches.some((patch) => patch.type === 'addDate')) {
    return null
  }

  const resolved = await resolveDatePatchSource(intent.context.blockId)
  if (!resolved) {
    return null
  }

  return {
    originalBlockId: resolved.originalBlockId,
    sourceBlockId: resolved.targetBlockId,
    sourceMarkdown: resolved.kramdown,
    targetItemBlockRaw: resolved.targetItemBlockRaw,
    usedParentDocumentContext: resolved.usedParentDocumentContext,
    finalTargetBlockId: resolved.usedParentDocumentContext && resolved.targetItemBlockRaw
      ? resolved.originalBlockId
      : resolved.targetBlockId,
  }
}

function resolveTargetKind(block: any): 'paragraph' | 'task-list-item' | 'block' {
  if (isTaskListNode(block)) {
    return 'task-list-item'
  }
  if (block?.type === 'NodeParagraph' || block?.type === 'p') {
    return 'paragraph'
  }
  return 'block'
}

/** 判断当前 protyle DOM 是否可用作数据源：需要 protyle 实例和匹配的 nodeElement */
function canUseCurrentProtyleDom(
  intent: Extract<BlockMutationIntent, { kind: 'update' }>,
  targetBlockId: string,
  sourceBlockId: string,
): boolean {
  const nodeElement = intent.context.nodeElement
  if (!intent.context.protyle || !nodeElement || sourceBlockId !== targetBlockId) {
    return false
  }

  if (nodeElement.getAttribute?.('data-node-id') === targetBlockId) {
    return true
  }

  return Boolean(nodeElement.closest?.(`[data-node-id="${targetBlockId}"]`))
}

/** 目标解析主入口：根据意图类型和 patch 内容确定目标块、来源和提交方式 */
export async function resolveMutationTarget(intent: BlockMutationIntent): Promise<ResolvedMutationPlan> {
  if (intent.kind === 'insertAfter') {
    return {
      kind: 'insertAfter',
      anchorBlockId: intent.anchorBlockId,
      commitKind: 'api-insert',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      patch: intent.patch,
      context: intent.context,
      resultMode: intent.resultMode,
    }
  }

  const datePatchSource = await resolveDateSourceContext(intent)
  const targetBlockId = datePatchSource?.finalTargetBlockId ?? await resolveUpdateTargetBlockId(intent)
  const block = await getBlockByID(targetBlockId)
  const sourceBlockId = datePatchSource?.sourceBlockId ?? targetBlockId
  const useCurrentProtyle = canUseCurrentProtyleDom(intent, targetBlockId, sourceBlockId)

  return {
    kind: 'update',
    targetBlockId,
    targetKind: resolveTargetKind(block),
    sourceKind: useCurrentProtyle ? 'protyle-dom' : 'api-kramdown',
    sourceBlockId,
    commitKind: useCurrentProtyle ? 'protyle-update' : 'api-update',
    preferDataType: 'dom',
    fallbackDataType: 'markdown',
    context: intent.context,
    patches: intent.patches,
    datePatchSource: datePatchSource ?? undefined,
  }
}
