# Block Writer Slash Validation and Marker Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地当前已确认的 block writer 语义切片：slash 前置校验优先走 candidate semantic line，metadata marker 的更新遵守“已有原位、新增追加、跨入口顺序一致”的规则，并让重复事项创建下一条 occurrence 时继承源事项的 marker 顺序。

**Architecture:** 先把 slash 事项校验从 `slashCommands.ts` 中抽成独立 helper，复用现有 `slashRange` 和 `LineParser`，避免在 marker 中缀触发 slash 时误判“非事项”。然后给 `kramdownModifier.ts` 增加一个最小 marker cluster 抽象，让 update patch 以“原位更新 / 末尾追加”的方式重建 marker，而不是继续做 ad hoc 字符串拼接。接着在 `writeBlock()` 入口增加一个小型 patch 顺序归一化层，确保不同入口对同一业务语义产出一致的 batch 顺序。最后让 `recurringService.ts` 生成下一条 occurrence 时复用这套顺序规则，而不是重新按固定模板拼接 markdown。

**Tech Stack:** TypeScript, Vitest, happy-dom, existing `LineParser`, existing `slashRange` / `blockWriter` modules.

---

## Scope Check

当前 `2026-05-20-block-writer-pipeline-design.md` 和 `2026-05-20-block-writer-phase-c-planner-design.md` 覆盖的范围明显大于一个安全实现批次。这个计划只实现其中最紧耦合、可以独立交付的一个切片：

1. slash 前置校验的 candidate semantic line 回退
2. marker 顺序稳定化
3. `writeBlock()` 级别的 batch patch 顺序归一化
4. 重复事项创建下一条 occurrence 时的 marker 顺序继承

本计划**不包含**以下内容，它们应该在后续单独计划中推进：

1. `removeSlashCommand.suffix` 在所有非事项 slash 命令中的彻底移除
2. `sourceLoader.ts` / `updateRenderer.ts` / `apiCommitter.ts` / `protyleCommitter.ts` 的模块化拆分
3. C 阶段 `mutationPlanner.ts` 的通用规划与多 plan 拆分

## File Structure

| 文件                                              | 职责                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/utils/slashCommandItemResolver.ts`           | 统一 slash 事项校验：candidate line 构造、`LineParser` 复用、store fallback                                                    |
| `src/utils/slashCommands.ts`                      | 所有 item-only slash 命令统一接入新的校验 helper                                                                               |
| `src/utils/blockWriter/markerCluster.ts`          | 解析 / 更新 / 重建 primary line marker cluster，保持已有顺序稳定                                                               |
| `src/utils/blockWriter/kramdownModifier.ts`       | 基于 marker cluster 应用 `setPriority` / `addDate` / `setReminder` / `setRecurring` / `togglePinned` / `setFocusPlan` 等 patch |
| `src/utils/blockWriter/normalizePatchSequence.ts` | 对混合 update patch 做最小顺序归一化                                                                                           |
| `src/utils/blockWriter/index.ts`                  | 在 `writeBlock()` 入口接入 patch 顺序归一化                                                                                    |
| `src/services/recurringService.ts`                | 生成下一条 recurring occurrence 时继承源事项 marker 顺序，而不是按固定模板重拼                                                 |
| `test/utils/slashCommandItemResolver.test.ts`     | candidate line / store fallback / 非事项误判回归                                                                               |
| `test/utils/slashCommands.itemValidation.test.ts` | `/yxj` 等 item-only slash 命令的入口回归                                                                                       |
| `test/blockWriter/markerCluster.test.ts`          | marker cluster 原位更新 / 追加 / 删除 / 规范化回归                                                                             |
| `test/blockWriter/kramdownModifier.test.ts`       | `kramdownModifier` 规则回归                                                                                                    |
| `test/blockWriter/index.test.ts`                  | `writeBlock()` batch 顺序归一化回归                                                                                            |
| `test/services/recurringService.test.ts`          | recurring next occurrence 保持源事项 marker 顺序的回归                                                                         |

---

### Task 1: Add a Candidate Semantic Line Resolver for Slash Validation

**Files:**

- Create: `src/utils/slashCommandItemResolver.ts`
- Test: `test/utils/slashCommandItemResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveItemForSlashCommand } from '@/utils/slashCommandItemResolver'

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}))

vi.mock('@/stores', () => ({
  useProjectStore: vi.fn(() => ({
    getItemByBlockId: vi.fn(() => null),
  })),
}))

function mountParagraph(text: string, blockId = 'block-1') {
  const node = document.createElement('div')
  node.setAttribute('data-node-id', blockId)
  node.setAttribute('data-type', 'NodeParagraph')
  node.className = 'p'
  const editable = document.createElement('div')
  editable.setAttribute('contenteditable', 'true')
  editable.textContent = text
  node.appendChild(editable)
  document.body.appendChild(node)
  return { node, editable, textNode: editable.firstChild as Text }
}

function placeCursor(textNode: Text, offset: number) {
  const range = document.createRange()
  range.setStart(textNode, offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('resolveItemForSlashCommand', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('parses a valid item from a date-marker infix slash command', async () => {
    const text = '评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00'
    const { node, textNode } = mountParagraph(text)
    placeCursor(textNode, text.indexOf('/yxj') + '/yxj'.length)

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    })

    expect(item?.content).toBe('评审视觉稿')
    expect(item?.date).toBe('2026-05-15')
    expect(item?.siblingItems?.[0]?.date).toBe('2026-05-20')
  })

  it('parses a valid item from a time-marker infix slash command', async () => {
    const text = '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0'
    const { node, textNode } = mountParagraph(text)
    placeCursor(textNode, text.indexOf('/yxj') + '/yxj'.length)

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    })

    expect(item?.content).toBe('评审视觉稿')
    expect(item?.reminder?.type).toBe('absolute')
    expect(item?.reminder?.time).toBe('14:00')
  })

  it('falls back to store lookup when there is no active slash context', async () => {
    const { useProjectStore } = await import('@/stores')
    vi.mocked(useProjectStore).mockReturnValue({
      getItemByBlockId: vi.fn(() => ({
        blockId: 'block-1',
        content: '来自 store 的事项',
        date: '2026-05-20',
      })),
    } as any)

    const { node } = mountParagraph('普通事项文本')

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    })

    expect(item?.content).toBe('来自 store 的事项')
  })

  it('returns null when both candidate line and store lookup fail', async () => {
    const { node, textNode } = mountParagraph('普通文本 /yxj')
    placeCursor(textNode, '普通文本 /yxj'.length)

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    })

    expect(item).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/slashCommandItemResolver.test.ts`

Expected: FAIL because `@/utils/slashCommandItemResolver` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
import type { Item } from '@/types/models'
import { LineParser } from '@/parser/lineParser'
import { useProjectStore } from '@/stores'
import { deleteSlashRangeText, getActiveSlashRange } from '@/utils/blockWriter/slashRange'
import { getSharedPinia } from '@/utils/sharedPinia'

export interface ResolveSlashItemOptions {
  blockId: string
  nodeElement?: HTMLElement | null
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = []
  let current: Node | null = target

  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) {
      return null
    }
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current))
    current = parent
  }

  return current === root ? path : null
}

function getNodeByPath(root: Node, path: number[]): Node | null {
  let current: Node | null = root
  for (const index of path) {
    current = current?.childNodes?.[index] ?? null
    if (!current) {
      return null
    }
  }
  return current
}

function buildCandidateSemanticLine(nodeElement: HTMLElement, slashRange: Range, slashStartOffset: number): string | null {
  const editable = nodeElement.querySelector('[contenteditable="true"]') as HTMLElement | null
  const root = editable ?? nodeElement
  const path = getNodePath(root, slashRange.startContainer)
  if (!path) {
    return null
  }

  const draftRoot = root.cloneNode(true) as HTMLElement
  const draftStartNode = getNodeByPath(draftRoot, path)
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    return null
  }

  const draftRange = document.createRange()
  draftRange.setStart(draftStartNode, slashRange.startOffset)
  draftRange.collapse(true)
  deleteSlashRangeText(draftRange, slashStartOffset)

  return draftRoot.textContent?.trim() ?? null
}

function parseCandidateLine(candidateLine: string | null): Item | null {
  if (!candidateLine) {
    return null
  }
  return LineParser.parseItemLine(candidateLine, 0)[0] ?? null
}

function lookupItemFromStore(blockId: string): Item | null {
  const pinia = getSharedPinia()
  if (!pinia) {
    return null
  }
  return useProjectStore(pinia).getItemByBlockId(blockId) ?? null
}

export async function resolveItemForSlashCommand(options: ResolveSlashItemOptions): Promise<Item | null> {
  const { blockId, nodeElement } = options
  const activeSlash = getActiveSlashRange()

  if (
    nodeElement
    && activeSlash
    && (activeSlash.blockId === blockId || nodeElement.contains(activeSlash.range.startContainer))
  ) {
    const candidate = parseCandidateLine(
      buildCandidateSemanticLine(nodeElement, activeSlash.range, activeSlash.slashStartOffset),
    )
    if (candidate) {
      return candidate
    }
  }

  return lookupItemFromStore(blockId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/utils/slashCommandItemResolver.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/slashCommandItemResolver.ts test/utils/slashCommandItemResolver.test.ts
git commit -m "feat(slash): resolve items from candidate semantic lines"
```

---

### Task 2: Route Item-Only Slash Commands Through the New Resolver

**Files:**

- Modify: `src/utils/slashCommands.ts`
- Modify: `test/utils/slashCommands.itemValidation.test.ts`

- [ ] **Step 1: Extend the failing slash validation tests**

```ts
it('/yxj 在日期 marker 中缀触发时仍应打开优先级弹框', async () => {
  vi.mocked(extractItemFromBlock).mockResolvedValue(null)
  const handler = getActionHandler('setPriority', {} as any, ['/yxj'])
  const node = document.createElement('div')
  node.setAttribute('data-node-id', 'block-item')
  const textNode = document.createTextNode('评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00')
  node.appendChild(textNode)
  document.body.appendChild(node)

  const range = document.createRange()
  range.setStart(textNode, textNode.textContent!.indexOf('/yxj') + '/yxj'.length)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  const protyle = {
    wysiwyg: { element: node },
    toolbar: { setInlineMark: vi.fn() },
    transaction: vi.fn(),
  }

  handler(protyle as any, node)
  await Promise.resolve()
  await Promise.resolve()

  expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalledOnce()
  expect(vi.mocked(showMessage)).not.toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error')
})

it('/yxj 在时间 marker 中缀触发时仍应打开优先级弹框', async () => {
  vi.mocked(extractItemFromBlock).mockResolvedValue(null)
  const handler = getActionHandler('setPriority', {} as any, ['/yxj'])
  const node = document.createElement('div')
  node.setAttribute('data-node-id', 'block-item')
  const textNode = document.createTextNode('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0')
  node.appendChild(textNode)
  document.body.appendChild(node)

  const range = document.createRange()
  range.setStart(textNode, textNode.textContent!.indexOf('/yxj') + '/yxj'.length)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  const protyle = {
    wysiwyg: { element: node },
    toolbar: { setInlineMark: vi.fn() },
    transaction: vi.fn(),
  }

  handler(protyle as any, node)
  await Promise.resolve()
  await Promise.resolve()

  expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalledOnce()
  expect(vi.mocked(showMessage)).not.toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/slashCommands.itemValidation.test.ts`

Expected: FAIL because `slashCommands.ts` still trusts `extractItemFromBlock()` alone and reports a false negative.

- [ ] **Step 3: Wire the new resolver into `slashCommands.ts`**

```ts
import { resolveItemForSlashCommand } from '@/utils/slashCommandItemResolver'

async function getValidatedItemFromNode(
  nodeElement: HTMLElement,
  protyle?: any,
): Promise<Item | null> {
  const blockId = nodeElement.getAttribute('data-node-id')
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error')
    return null
  }

  const item = await resolveItemForSlashCommand({
    blockId,
    nodeElement,
  })

  if (!item) {
    if (protyle) {
      void removeSlashCommandViaWriter(protyle, nodeElement, { blockId })
    }
    showMessage('当前块不是有效的事项', 2000, 'error')
    return null
  }

  return item
}

async function setPriorityForBlock(nodeElement: HTMLElement, item?: Item) {
  const blockId = nodeElement.getAttribute('data-node-id')
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error')
    return
  }

  const targetItem = item || await resolveItemForSlashCommand({
    blockId,
    nodeElement,
  })
  if (!targetItem) {
    showMessage('当前块不是有效的事项', 2000, 'error')
    return
  }

  const blockContent = nodeElement.textContent || targetItem.content || ''
  const currentPriority = parsePriorityFromLine(blockContent)

  showPrioritySettingDialog(currentPriority, async (priority) => {
    const success = await writeBlock({ blockId }, { type: 'setPriority', priority })
    showMessage(success ? (priority ? '优先级已设置' : '优先级已清除') : '设置优先级失败', 2000, success ? 'info' : 'error')
  })
}
```

Apply the same `resolveItemForSlashCommand({ blockId, nodeElement })` fallback to:

- `startFocusFromSlash`
- `setReminderForBlock`
- `setFocusPlanForBlock`
- `setRecurringForBlock`

Do not change habit-only or non-item slash commands in this task.

- [ ] **Step 4: Run the focused validation suite**

Run: `npx vitest run test/utils/slashCommands.itemValidation.test.ts test/utils/slashCommandItemResolver.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/slashCommands.ts test/utils/slashCommands.itemValidation.test.ts
git commit -m "feat(slash): validate items from candidate semantic lines"
```

---

### Task 3: Add a Marker Cluster Primitive That Preserves Existing Order

**Files:**

- Create: `src/utils/blockWriter/markerCluster.ts`
- Test: `test/blockWriter/markerCluster.test.ts`

- [ ] **Step 1: Write the failing marker cluster tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeMarkerLine,
  parseMarkerLine,
  removeMarker,
  upsertMarker,
} from '@/utils/blockWriter/markerCluster'

describe('markerCluster', () => {
  it('preserves existing date/time order when appending a new priority marker', () => {
    const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00')
    const next = upsertMarker(parsed, 'priority', '🌱')
    expect(normalizeMarkerLine(next)).toBe('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱')
  })

  it('updates an existing date marker in place while allowing canonical normalization', () => {
    const parsed = parseMarkerLine('评审视觉稿 @2026-05-15 🔥')
    const next = upsertMarker(parsed, 'date', '📅2026-05-20')
    expect(normalizeMarkerLine(next)).toBe('评审视觉稿 📅2026-05-20 🔥')
  })

  it('removes only the requested marker and keeps neighbors stable', () => {
    const parsed = parseMarkerLine('评审视觉稿 📌 📅2026-05-15 ⏰14:00 🌱')
    const next = removeMarker(parsed, 'pinned')
    expect(normalizeMarkerLine(next)).toBe('评审视觉稿 📅2026-05-15 ⏰14:00 🌱')
  })

  it('appends multiple new markers in the order they are applied', () => {
    const parsed = parseMarkerLine('评审视觉稿')
    const withDate = upsertMarker(parsed, 'date', '📅2026-05-15')
    const withPriority = upsertMarker(withDate, 'priority', '🌱')
    expect(normalizeMarkerLine(withPriority)).toBe('评审视觉稿 📅2026-05-15 🌱')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/blockWriter/markerCluster.test.ts`

Expected: FAIL because `@/utils/blockWriter/markerCluster` does not exist.

- [ ] **Step 3: Implement the marker cluster primitive**

```ts
export type MarkerKind
  = | 'date'
    | 'priority'
    | 'status'
    | 'pinned'
    | 'focusPlan'
    | 'reminder'
    | 'recurring'
    | 'endCondition'
    | 'habitArchive'

export interface MarkerToken {
  kind: MarkerKind
  raw: string
}

export interface ParsedMarkerLine {
  content: string
  markers: MarkerToken[]
}

const MARKER_PATTERNS: Array<{ kind: MarkerKind, regex: RegExp }> = [
  { kind: 'date', regex: /(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}(?::\d{2})?(?:-\d{2}:\d{2}(?::\d{2})?)?)?/u },
  { kind: 'priority', regex: /[🔥🌱🍃]/u },
  { kind: 'status', regex: /(?:#已完成|#已放弃|#done|#abandoned|✅|❌)/u },
  { kind: 'pinned', regex: /📌/u },
  { kind: 'focusPlan', regex: /(?:⏳\S+|🍅x\d+)/u },
  { kind: 'reminder', regex: /⏰(?:\d{2}:\d{2}(?::\d{2})?|提前\d+(?:分钟|小时|天)|结束前\d+(?:分钟|小时|天))/u },
  { kind: 'recurring', regex: /🔁(?:每天|每周|每月|每年|工作日|daily|weekly|monthly|yearly|workday)/iu },
  { kind: 'endCondition', regex: /(?:截止到\d{4}-\d{2}-\d{2}|剩余\s*\d+\s*次|until\s+\d{4}-\d{2}-\d{2}|\d+\s*(?:times?\s*)?remaining)/iu },
  { kind: 'habitArchive', regex: /📦\d{4}-\d{2}-\d{2}/u },
]

function detectMarkerKind(raw: string): MarkerKind | null {
  for (const candidate of MARKER_PATTERNS) {
    candidate.regex.lastIndex = 0
    if (candidate.regex.test(raw)) {
      return candidate.kind
    }
  }
  return null
}

export function parseMarkerLine(line: string): ParsedMarkerLine {
  const parts = line.trim().split(/\s+/)
  const contentParts: string[] = []
  const markers: MarkerToken[] = []
  let inMarkers = false

  for (const part of parts) {
    const kind = detectMarkerKind(part)
    if (kind) {
      inMarkers = true
      markers.push({ kind, raw: part.startsWith('@') ? part.replace('@', '📅') : part })
      continue
    }

    if (inMarkers) {
      const previous = markers.at(-1)
      if (previous?.kind === 'date' && /^\d{2}:\d{2}(?::\d{2})?(?:-\d{2}:\d{2}(?::\d{2})?)?$/.test(part)) {
        previous.raw = `${previous.raw} ${part}`
        continue
      }
    }

    if (inMarkers) {
      contentParts.push(part)
      continue
    }

    contentParts.push(part)
  }

  return {
    content: contentParts.join(' ').trim(),
    markers,
  }
}

export function upsertMarker(parsed: ParsedMarkerLine, kind: MarkerKind, raw?: string): ParsedMarkerLine {
  const markers = [...parsed.markers]
  const existingIndex = markers.findIndex(marker => marker.kind === kind)

  if (!raw) {
    return {
      ...parsed,
      markers: existingIndex >= 0 ? markers.filter((_, index) => index !== existingIndex) : markers,
    }
  }

  if (existingIndex >= 0) {
    markers[existingIndex] = { kind, raw }
    return { ...parsed, markers }
  }

  markers.push({ kind, raw })
  return { ...parsed, markers }
}

export function removeMarker(parsed: ParsedMarkerLine, kind: MarkerKind): ParsedMarkerLine {
  return {
    ...parsed,
    markers: parsed.markers.filter(marker => marker.kind !== kind),
  }
}

export function normalizeMarkerLine(parsed: ParsedMarkerLine): string {
  return [parsed.content, ...parsed.markers.map(marker => marker.raw)]
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/blockWriter/markerCluster.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/markerCluster.ts test/blockWriter/markerCluster.test.ts
git commit -m "feat(block-writer): add stable marker cluster parser"
```

---

### Task 4: Refactor `kramdownModifier` and Normalize Mixed Patch Order in `writeBlock()`

**Files:**

- Create: `src/utils/blockWriter/normalizePatchSequence.ts`
- Modify: `src/utils/blockWriter/kramdownModifier.ts`
- Modify: `src/utils/blockWriter/index.ts`
- Modify: `test/blockWriter/kramdownModifier.test.ts`
- Modify: `test/blockWriter/index.test.ts`

- [ ] **Step 1: Add the failing regression tests**

```ts
it('appends a new priority marker after existing date/time markers', () => {
  expect(applyBlockPatch(parts('任务 📅2026-05-14 ⏰14:00\n{: id="abc"}'), {
    type: 'setPriority',
    priority: 'medium',
  })).toBe(
    '任务 📅2026-05-14 ⏰14:00 🌱\n{: id="abc"}',
  )
})

it('keeps priority after an updated date marker when the original line already used @ syntax', () => {
  expect(applyBlockPatch(parts('任务 @2026-05-14 🌱\n{: id="abc"}'), {
    type: 'addDate',
    date: '2026-05-16',
  })).toBe(
    '任务 📅2026-05-16 🌱\n{: id="abc"}',
  )
})

it('normalizes mixed update patch order before applying the batch', async () => {
  vi.mocked(getBlockKramdown).mockResolvedValue({
    id: 'abc',
    kramdown: '任务\n{: id="abc"}',
  } as any)

  await writeBlock({ blockId: 'block123' }, [
    { type: 'setPriority', priority: 'medium' },
    { type: 'addDate', date: '2026-05-16', allDay: true },
  ])

  expect(updateBlock).toHaveBeenCalledWith(
    'markdown',
    '任务 📅2026-05-16 🌱\n{: id="abc"}',
    'block123',
  )
})

it('keeps removeSlashCommand first while normalizing later marker-producing patches', async () => {
  const result = await writeBlock(
    { blockId: 'block123', protyle: { transaction: vi.fn() }, nodeElement: document.createElement('div') },
    [
      { type: 'removeSlashCommand' },
      { type: 'setPriority', priority: 'medium' },
      { type: 'addDate', date: '2026-05-16', allDay: true },
    ],
  )

  expect(result).toBeTypeOf('boolean')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/blockWriter/kramdownModifier.test.ts test/blockWriter/index.test.ts`

Expected: FAIL because `setPriority()` still inserts before `📅`, and `writeBlock()` still trusts caller order for mixed update batches.

- [ ] **Step 3: Implement marker-cluster-based updates and batch order normalization**

```ts
// src/utils/blockWriter/normalizePatchSequence.ts
import type { BlockPatch } from './types'

const PATCH_ORDER: Record<BlockPatch['type'], number> = {
  removeSlashCommand: 0,
  setContent: 10,
  addDate: 20,
  setReminder: 30,
  setRecurring: 40,
  setPriority: 50,
  setFocusPlan: 60,
  togglePinned: 70,
  setHabitArchive: 80,
  setStatus: 90,
  setHabitDefinition: 100,
  setHabitRecord: 110,
  replaceMarkdown: 120,
}

export function normalizePatchSequence(patches: BlockPatch[]): BlockPatch[] {
  return patches
    .map((patch, index) => ({ patch, index }))
    .sort((a, b) => {
      const orderDelta = PATCH_ORDER[a.patch.type] - PATCH_ORDER[b.patch.type]
      return orderDelta !== 0 ? orderDelta : a.index - b.index
    })
    .map(entry => entry.patch)
}
```

```ts
// src/utils/blockWriter/kramdownModifier.ts
import { normalizeMarkerLine, parseMarkerLine, removeMarker, upsertMarker } from './markerCluster'

function applyPriority(line: string, priority: string | undefined): string {
  const parsed = parseMarkerLine(stripPriorityMarker(line).trim())
  if (!priority) {
    return normalizeMarkerLine(removeMarker(parsed, 'priority'))
  }
  return normalizeMarkerLine(upsertMarker(parsed, 'priority', generatePriorityMarker(priority as any)))
}

function applyDate(line: string, patch: DatePatch): string {
  const parsed = parseMarkerLine(line)
  const startTime = patch.startTime ? ` ${patch.startTime}` : ''
  const endTime = patch.endTime && patch.endTime !== patch.startTime ? `-${patch.endTime}` : ''
  const dateMarker = `📅${patch.date}${patch.allDay ? '' : `${startTime}${endTime}`}`
  return normalizeMarkerLine(upsertMarker(parsed, 'date', dateMarker))
}

function applyReminder(line: string, patch: Extract<BlockPatch, { type: 'setReminder' }>): string {
  const parsed = parseMarkerLine(stripReminderMarker(line).trim())
  const marker = patch.reminder?.enabled ? generateReminderMarker(patch.reminder) : undefined
  return marker
    ? normalizeMarkerLine(upsertMarker(parsed, 'reminder', marker))
    : normalizeMarkerLine(removeMarker(parsed, 'reminder'))
}
```

```ts
// src/utils/blockWriter/index.ts
import { normalizePatchSequence } from './normalizePatchSequence'

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const patchArray = normalizePatchSequence(Array.isArray(patches) ? patches : [patches])
  const payload = Array.isArray(patches) ? patchArray : patchArray[0]

  const addDatePatch = patchArray.length === 1 && patchArray[0]?.type === 'addDate'
    ? patchArray[0]
    : undefined
  const batchedAddDatePatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'addDate' }> => patch.type === 'addDate')
  const batchedRemoveSlashPatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'removeSlashCommand' }> => patch.type === 'removeSlashCommand')
  const batchedStatusPatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'setStatus' }> => patch.type === 'setStatus')
  const hasStatusPatch = patchArray.some(patch => patch.type === 'setStatus')
  const requiresProtyle = patchArray.some(patch => patch.type === 'removeSlashCommand')
  const statusTargetBlockId = context.listItemBlockId || context.blockId

  if (addDatePatch) {
    return writeDatePatch(context, addDatePatch)
  }

  if (context.protyle && context.nodeElement) {
    const ok = await writeViaProtyle(context, payload)
    if (ok)
      return true
  }
  if (requiresProtyle)
    return false
  return writeViaApi(hasStatusPatch ? statusTargetBlockId : context.blockId, payload)
}
```

Apply the same marker-cluster strategy to:

- `setPriority`
- `addDate`
- `setReminder`
- `setRecurring`
- `togglePinned`
- `setFocusPlan`
- `setHabitArchive`

For `setStatus`, keep the current checkbox handling for task list lines, but when the line resolves to metadata markers, update or remove only the status marker token instead of rebuilding the whole suffix by position guessing.

- [ ] **Step 4: Run the focused block writer suite**

Run: `npx vitest run test/blockWriter/markerCluster.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/normalizePatchSequence.ts src/utils/blockWriter/kramdownModifier.ts src/utils/blockWriter/index.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/index.test.ts
git commit -m "feat(block-writer): stabilize marker order for mixed update patches"
```

---

### Task 5: Preserve Marker Order When Creating the Next Recurring Occurrence

**Files:**

- Modify: `src/services/recurringService.ts`
- Modify: `test/services/recurringService.test.ts`

- [ ] **Step 1: Add the failing recurring occurrence regression**

```ts
it('preserves marker order when creating the next workday occurrence after completion', async () => {
  mockInsertBlockAfter.mockResolvedValue(true)

  const item: Item = {
    id: '1',
    content: '填工时',
    date: '2026-05-18',
    status: 'completed',
    lineNumber: 1,
    docId: 'doc1',
    blockId: 'block123',
    repeatRule: { type: 'workday' },
    reminder: {
      enabled: true,
      type: 'absolute',
      time: '17:01',
      alertMode: { type: 'ontime' },
    },
    startDateTime: '2026-05-18 17:00:00',
    endDateTime: '2026-05-18 18:00:00',
  }

  const result = await createNextOccurrence({} as any, item)

  expect(result).toBe(true)
  expect(mockInsertBlockAfter).toHaveBeenCalledWith(
    'block123',
    {
      type: 'replaceMarkdown',
      markdown: '填工时 ⏰17:01 🔁工作日 📅2026-05-19 17:00:00~18:00:00',
    },
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/recurringService.test.ts`

Expected: FAIL because `buildNextOccurrenceBlock()` currently assembles markdown as `content + date + reminder + recurring`, which reorders the source marker sequence.

- [ ] **Step 3: Refactor recurring occurrence generation to reuse source marker order**

```ts
import { getBlockKramdown } from '@/api'
import { extractTimePart } from '@/utils/blockWriter/itemPatches'
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks'
import { applyBlockPatch } from '@/utils/blockWriter/kramdownModifier'

function decrementEndCondition(endCondition?: Item['endCondition']) {
  if (!endCondition) {
    return undefined
  }

  if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
    const nextCount = endCondition.maxCount - 1
    return nextCount > 0 ? { ...endCondition, maxCount: nextCount } : undefined
  }

  return endCondition
}

async function buildNextOccurrenceBlock(item: Item, nextDate: string): Promise<string> {
  const raw = item.blockId
    ? (await getBlockKramdown(item.blockId))?.kramdown ?? null
    : null

  if (!raw) {
    throw new Error('buildNextOccurrenceBlock requires source kramdown to preserve marker order')
  }

  const nextEndCondition = decrementEndCondition(item.endCondition)

  let markdown = applyBlockPatch(
    splitKramdownBlock(raw),
    { type: 'setStatus', status: 'pending' },
  )

  markdown = applyBlockPatch(
    splitKramdownBlock(markdown),
    {
      type: 'addDate',
      date: nextDate,
      originalDate: item.date,
      startTime: extractTimePart(item.startDateTime),
      endTime: extractTimePart(item.endDateTime),
      allDay: !item.startDateTime && !item.endDateTime,
    },
  )

  markdown = applyBlockPatch(
    splitKramdownBlock(markdown),
    {
      type: 'setReminder',
      reminder: item.reminder?.enabled ? item.reminder : undefined,
    },
  )

  markdown = applyBlockPatch(
    splitKramdownBlock(markdown),
    {
      type: 'setRecurring',
      repeatRule: item.repeatRule,
      endCondition: nextEndCondition,
    },
  )

  return markdown
}
```

Use the same async `buildNextOccurrenceBlock()` path in `skipCurrentOccurrence()` so both recurring flows preserve marker order.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/recurringService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/recurringService.ts test/services/recurringService.test.ts
git commit -m "feat(recurring): preserve marker order in next occurrences"
```

---

### Task 6: Run the Regression Sweep for the Slice

**Files:**

- No file changes required.

- [ ] **Step 1: Run the slash-focused regression suite**

Run:

```bash
npx vitest run test/utils/slashCommandItemResolver.test.ts test/utils/slashCommands.itemValidation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the block writer regression suite**

Run:

```bash
npx vitest run test/blockWriter/markerCluster.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/index.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the nearby parser and utility suite**

Run:

```bash
npx vitest run test/parser/lineParser.test.ts test/utils/slashCommandUtils.test.ts test/blockWriter/*.test.ts test/services/recurringService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the project test command**

Run:

```bash
npm test
```

Expected: PASS with the standard pre-test checks (`check:deprecated-fileutils-imports`, `check:direct-updateblock-imports`) and the full Vitest suite.

---

## Self-Review Checklist

### Spec Coverage

- candidate semantic line 优先于 pinia/store：Task 1, Task 2
- slash 触发位置不应改变最终语义：Task 1, Task 2
- 已有 marker 原位更新、允许规范化但不改位置：Task 3, Task 4
- 新增 marker 追加到 cluster 末尾：Task 3, Task 4
- 同次新增多个 marker 的顺序由归一化 patch 序列决定：Task 4
- 不同入口同一业务语义的 patch 顺序收敛一致：Task 4
- 重复事项创建下一条 occurrence 时继承源事项 marker 顺序：Task 5
- 回归测试补齐 `/yxj`、block writer 顺序断言与 recurring occurrence 顺序断言：Task 2, Task 4, Task 5, Task 6

### Placeholder Scan

- 无 `TODO` / `TBD`
- 所有新增文件和测试文件都给了明确路径
- 所有验证步骤都给了具体命令

### Type Consistency

- slash 校验 helper 统一命名为 `resolveItemForSlashCommand`
- marker 顺序 helper 统一命名为 `normalizePatchSequence`
- marker cluster 入口统一使用 `parseMarkerLine` / `upsertMarker` / `removeMarker` / `normalizeMarkerLine`
