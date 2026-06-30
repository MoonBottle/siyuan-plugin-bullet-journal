# Block Writer Phase B Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 `blockWriter` 的 B 阶段统一流水线骨架，让 `writeBlock()` / `insertBlockAfter()` / `insertBlockAfterWithResult()` 统一走 `intent -> resolve -> load -> render -> commit`，并把 `DOM-first, markdown fallback`、`insert 纳入同一套能力模型`、`wbr-first 光标恢复` 这些 B 阶段要求落地。

**Architecture:** 先把当前误入 runtime 的 C 阶段 planner 草稿停在边上，不再继续扩展。然后按 spec 的 B 阶段顺序引入 `intent.ts`、`targetResolver.ts`、`sourceLoader.ts`、`caretController.ts`、`updateRenderer.ts`、`insertRenderer.ts`、`apiCommitter.ts`、`protyleCommitter.ts`。现有 `apiTransport.ts` / `protyleTransport.ts` / `markdownWriter.ts` / `datePatchWriter.ts` / `statusPatchWriter.ts` 不会在这一阶段被一把删掉，而是逐步下沉成 helper，最终让 `index.ts` 只保留 orchestration 薄入口。

**Tech Stack:** TypeScript, Vitest, happy-dom, existing `blockWriter` helpers, SiYuan Kernel `updateBlock` / `insertBlock`, SiYuan Protyle transaction path, existing `Lute` DOM serializer.

---

## Scope Check

这个计划只覆盖 **B 阶段剩余实现**，不再继续往 C 阶段 planner 收口推进。

**包含：**

1. 统一意图模型：update / insert 的公共入口归一化
2. 统一目标解析：真实写入目标、sourceKind、commitKind、DOM-first 声明
3. 统一 source loading：当前 DOM / API kramdown / insert anchor
4. 统一 render：update / insert 都产生 `domHtml + fallbackMarkdown`
5. 统一 commit：Protyle / API 都优先 DOM，再 fallback markdown
6. `wbr-first` 光标恢复主路径
7. `datePatchWriter.ts` / `statusPatchWriter.ts` / `markdownWriter.ts` 降级为 helper

**不包含：**

1. `mutationPlanner.ts` 的继续扩展
2. 任意批量 patch 的通用 planner / split reason / multi-plan 执行
3. 跨目标多 plan 的伪事务回滚
4. Protyle 相邻块 insert 能力
5. 所有 legacy slash 命令兼容路径的一次性清空

## File Structure

| 文件                                         | 职责                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/utils/blockWriter/intent.ts`            | 统一公开入口语义，归一化 update / insert intent                                     |
| `src/utils/blockWriter/targetResolver.ts`    | 统一真实目标解析：targetBlockId / sourceKind / commitKind / preferDataType          |
| `src/utils/blockWriter/sourceLoader.ts`      | 统一加载当前 DOM / API kramdown / insert anchor 信息                                |
| `src/utils/blockWriter/caretController.ts`   | 当前 Protyle 选区快照、`<wbr>` 主恢复、offset 兜底                                  |
| `src/utils/blockWriter/updateRenderer.ts`    | update 路径：`nextMarkdown`、`domHtml`、`caretRestorePlan`                          |
| `src/utils/blockWriter/insertRenderer.ts`    | insert 路径：`fallbackMarkdown`、`domHtml`                                          |
| `src/utils/blockWriter/apiCommitter.ts`      | API update / insert 的 DOM-first 提交                                               |
| `src/utils/blockWriter/protyleCommitter.ts`  | 当前块 Protyle transaction 提交与光标恢复                                           |
| `src/utils/blockWriter/index.ts`             | 统一 orchestration 入口                                                             |
| `src/utils/blockWriter/types.ts`             | B 阶段新类型：intent、resolved plan、loaded source、prepared payload、commit result |
| `src/utils/blockWriter/apiTransport.ts`      | 过渡 helper，逐步下沉到 `apiCommitter.ts`                                           |
| `src/utils/blockWriter/protyleTransport.ts`  | 过渡 helper，逐步下沉到 `protyleCommitter.ts`                                       |
| `src/utils/blockWriter/markdownWriter.ts`    | 过渡 helper，逐步拆到 source/render/commit                                          |
| `src/utils/blockWriter/datePatchWriter.ts`   | 过渡 helper，只保留 date 语义 helper                                                |
| `src/utils/blockWriter/statusPatchWriter.ts` | 过渡 helper，只保留 status 语义 helper                                              |
| `test/blockWriter/intent.test.ts`            | intent 归一化单测                                                                   |
| `test/blockWriter/targetResolver.test.ts`    | 目标解析单测                                                                        |
| `test/blockWriter/sourceLoader.test.ts`      | source loading 单测                                                                 |
| `test/blockWriter/caretController.test.ts`   | `wbr-first` / offset fallback 单测                                                  |
| `test/blockWriter/updateRenderer.test.ts`    | update render 单测                                                                  |
| `test/blockWriter/insertRenderer.test.ts`    | insert render 单测                                                                  |
| `test/blockWriter/apiCommitter.test.ts`      | API committer 单测                                                                  |
| `test/blockWriter/protyleCommitter.test.ts`  | Protyle committer 单测                                                              |
| `test/blockWriter/index.test.ts`             | orchestration 集成回归                                                              |

---

### Task 1: 先把 C 阶段 planner 草稿从 runtime 路径里停掉，恢复 B 阶段基线

**Files:**

- Modify: `src/utils/blockWriter/index.ts`
- Modify: `test/blockWriter/index.test.ts`
- Keep detached: `src/utils/blockWriter/mutationPlanner.ts`
- Keep detached: `test/blockWriter/mutationPlanner.test.ts`

- [ ] **Step 1: 先跑当前 blockWriter 基线测试**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts test/blockWriter/apiTransport.test.ts test/blockWriter/protyleTransport.test.ts
```

Expected: 记录当前 worktree 基线；如果失败，先只修复当前 planner 草稿造成的偏移，不在这一任务里追加新架构。

- [ ] **Step 2: 把 `index.ts` 恢复成 B 阶段入口，不再引用 planner**

把 `src/utils/blockWriter/index.ts` 恢复到只依赖现有 transport / writer 的状态，至少满足下面的边界：

```ts
import { insertViaApi, insertViaApiWithResult, writeViaApi } from './apiTransport'
import { writeDatePatch, writeDatePatchWithSlashCleanup } from './datePatchWriter'
import { normalizePatchSequence } from './normalizePatchSequence'
import { writeViaProtyle } from './protyleTransport'
import { writeStatusWithSlashCleanup } from './statusPatchWriter'

// 不导入 mutationPlanner，不导入 planExecutor
```

要求：

1. `src/utils/blockWriter/mutationPlanner.ts` 可以保留在工作区作为草稿；
2. 但 B 阶段 runtime path 里不允许再 import 它；
3. `test/blockWriter/mutationPlanner.test.ts` 也不属于 B 阶段默认测试矩阵。

- [ ] **Step 3: 把 `index.test.ts` 调整回 B 阶段断言**

保留下面这些 B 阶段已经需要的行为断言：

```ts
it('writes batch patches via API', async () => {
  const result = await writeBlock(
    { blockId: 'block123' },
    [
      { type: 'setPriority', priority: 'high' },
      { type: 'setStatus', status: 'completed' },
    ],
  )

  expect(result).toBe(true)
  const call = vi.mocked(updateBlock).mock.calls.at(-1)!
  expect(call[1]).toContain('🔥')
})

it('uses a single protyle transaction for same-block multiline removeSlashCommand + addDate', async () => {
  const result = await writeBlock(
    { blockId: 'block123', protyle, nodeElement: div },
    [
      { type: 'removeSlashCommand' },
      { type: 'addDate', date: '2026-05-16', allDay: true },
    ],
  )

  expect(result).toBe(true)
  expect(protyle.transaction).toHaveBeenCalledOnce()
})
```

删掉仅服务 C 阶段 planner 的测试前提，不要求在这一任务里删除草稿文件。

- [ ] **Step 4: 重新跑 B 阶段基线测试**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts test/blockWriter/apiTransport.test.ts test/blockWriter/protyleTransport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/index.ts test/blockWriter/index.test.ts
git commit -m "refactor(block-writer): restore phase-b baseline entry"
```

---

### Task 2: 引入 `intent.ts`，统一 update / insert 的入口语义

**Files:**

- Create: `src/utils/blockWriter/intent.ts`
- Modify: `src/utils/blockWriter/types.ts`
- Create: `test/blockWriter/intent.test.ts`
- Modify: `src/utils/blockWriter/index.ts`

- [ ] **Step 1: 先写 intent 归一化失败测试**

新建 `test/blockWriter/intent.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeInsertIntent,
  normalizeUpdateIntent,
} from '@/utils/blockWriter/intent'

describe('intent', () => {
  it('normalizes a single update patch into an update intent', () => {
    const intent = normalizeUpdateIntent(
      { blockId: 'block-1' },
      { type: 'setPriority', priority: 'high' },
    )

    expect(intent).toEqual({
      kind: 'update',
      context: { blockId: 'block-1' },
      patches: [{ type: 'setPriority', priority: 'high' }],
    })
  })

  it('normalizes update batches with stable patch ordering', () => {
    const intent = normalizeUpdateIntent(
      { blockId: 'block-1' },
      [
        { type: 'setPriority', priority: 'medium' },
        { type: 'addDate', date: '2026-05-21', allDay: true },
      ],
    )

    expect(intent.patches.map(patch => patch.type)).toEqual(['addDate', 'setPriority'])
  })

  it('normalizes insertAfter into an insert intent', () => {
    const intent = normalizeInsertIntent('block-1', {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-05-21',
        type: 'count',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    })

    expect(intent.kind).toBe('insertAfter')
    expect(intent.anchorBlockId).toBe('block-1')
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/intent.test.ts
```

Expected: FAIL because `intent.ts` 还不存在。

- [ ] **Step 3: 实现 `intent.ts` 与 B 阶段 intent 类型**

在 `src/utils/blockWriter/types.ts` 增加：

```ts
export type BlockMutationIntent
  = | {
    kind: 'update'
    context: BlockWriteContext
    patches: BlockPatch[]
  }
  | {
    kind: 'insertAfter'
    anchorBlockId: string
    patch: InsertableBlockPatch
    context?: Partial<BlockWriteContext>
    resultMode: 'boolean' | 'operations'
  }
```

新增 `src/utils/blockWriter/intent.ts`：

```ts
import type {
  BatchBlockPatch,
  BlockMutationIntent,
  BlockPatch,
  BlockWriteContext,
  InsertableBlockPatch,
} from './types'
import { normalizePatchSequence } from './normalizePatchSequence'

export function normalizeUpdateIntent(
  context: BlockWriteContext,
  patches: BlockPatch | BatchBlockPatch,
): Extract<BlockMutationIntent, { kind: 'update' }> {
  const patchArray = normalizePatchSequence(Array.isArray(patches) ? patches : [patches])
  return {
    kind: 'update',
    context,
    patches: patchArray,
  }
}

export function normalizeInsertIntent(
  anchorBlockId: string,
  patch: InsertableBlockPatch,
  options?: {
    context?: Partial<BlockWriteContext>
    resultMode?: 'boolean' | 'operations'
  },
): Extract<BlockMutationIntent, { kind: 'insertAfter' }> {
  return {
    kind: 'insertAfter',
    anchorBlockId,
    patch,
    context: options?.context,
    resultMode: options?.resultMode ?? 'boolean',
  }
}
```

- [ ] **Step 4: 让 `index.ts` 先接入 intent，而不直接接入后续模块**

此时 `index.ts` 只做第一层收口：

```ts
const intent = normalizeUpdateIntent(context, patches)
// 后续任务再把 intent 继续传给 resolve/load/render/commit
```

以及：

```ts
const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' })
const intentWithResult = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' })
```

- [ ] **Step 5: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/intent.test.ts test/blockWriter/index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/blockWriter/intent.ts src/utils/blockWriter/types.ts src/utils/blockWriter/index.ts test/blockWriter/intent.test.ts
git commit -m "feat(block-writer): add unified mutation intents"
```

---

### Task 3: 引入 `targetResolver.ts`，统一真实目标与提交能力解析

**Files:**

- Create: `src/utils/blockWriter/targetResolver.ts`
- Modify: `src/utils/blockWriter/types.ts`
- Create: `test/blockWriter/targetResolver.test.ts`
- Keep helper: `src/utils/blockWriter/blockTargetResolver.ts`

- [ ] **Step 1: 先写 target resolve 失败测试**

新建 `test/blockWriter/targetResolver.test.ts`：

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBlockByID } from '@/api'
import { resolveMutationTarget } from '@/utils/blockWriter/targetResolver'

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
}))

describe('targetResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves status updates on task paragraphs to the task-list item block', async () => {
    vi.mocked(getBlockByID)
      .mockResolvedValueOnce({ id: 'paragraph-1', parent_id: 'task-1', type: 'NodeParagraph' } as any)
      .mockResolvedValueOnce({ id: 'task-1', type: 'NodeListItem', subtype: 't' } as any)

    const result = await resolveMutationTarget({
      kind: 'update',
      context: { blockId: 'paragraph-1' },
      patches: [{ type: 'setStatus', status: 'completed' }],
    })

    expect(result.kind).toBe('update')
    expect(result.targetBlockId).toBe('task-1')
    expect(result.commitKind).toBe('api-update')
  })

  it('resolves current protyle updates to protyle-dom source when the edited block matches the target', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'paragraph-1', type: 'NodeParagraph' } as any)

    const result = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'paragraph-1',
        protyle: {},
        nodeElement: Object.assign(document.createElement('div'), {
          getAttribute: (name: string) => name === 'data-node-id' ? 'paragraph-1' : null,
        }),
      } as any,
      patches: [{ type: 'setPriority', priority: 'high' }],
    })

    expect(result.kind).toBe('update')
    expect(result.sourceKind).toBe('protyle-dom')
    expect(result.commitKind).toBe('protyle-update')
  })

  it('resolves insert intents to api-insert with dom preferred', async () => {
    const result = await resolveMutationTarget({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      patch: {
        type: 'setHabitDefinition',
        habit: {
          name: '喝水',
          startDate: '2026-05-21',
          type: 'count',
          target: 8,
          unit: '杯',
          frequency: { type: 'daily' },
        },
      },
      resultMode: 'boolean',
    })

    expect(result.kind).toBe('insertAfter')
    expect(result.commitKind).toBe('api-insert')
    expect(result.preferDataType).toBe('dom')
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/targetResolver.test.ts
```

Expected: FAIL because `targetResolver.ts` 还不存在。

- [ ] **Step 3: 实现 `ResolvedMutationPlan` 与 `resolveMutationTarget()`**

在 `src/utils/blockWriter/types.ts` 增加：

```ts
export type ResolvedMutationPlan
  = | {
    kind: 'update'
    targetBlockId: string
    targetKind: 'paragraph' | 'task-list-item' | 'block'
    sourceKind: 'protyle-dom' | 'api-kramdown'
    commitKind: 'protyle-update' | 'api-update'
    preferDataType: 'dom'
    fallbackDataType: 'markdown'
    context: BlockWriteContext
    patches: BlockPatch[]
  }
  | {
    kind: 'insertAfter'
    anchorBlockId: string
    commitKind: 'api-insert'
    preferDataType: 'dom'
    fallbackDataType: 'markdown'
    patch: InsertableBlockPatch
    context?: Partial<BlockWriteContext>
    resultMode: 'boolean' | 'operations'
  }
```

新增 `src/utils/blockWriter/targetResolver.ts`，核心结构：

```ts
import type { BlockMutationIntent, ResolvedMutationPlan } from './types'
import { getBlockByID } from '@/api'

function resolveUpdateTargetBlockId(intent: Extract<BlockMutationIntent, { kind: 'update' }>): string {
  if (intent.patches.some(patch => patch.type === 'setStatus')) {
    return intent.context.listItemBlockId || intent.context.blockId
  }
  return intent.context.blockId
}

function canUseCurrentProtyleDom(intent: Extract<BlockMutationIntent, { kind: 'update' }>, targetBlockId: string): boolean {
  const nodeBlockId = intent.context.nodeElement?.getAttribute?.('data-node-id')
  return Boolean(intent.context.protyle && intent.context.nodeElement && nodeBlockId === targetBlockId)
}

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

  const targetBlockId = resolveUpdateTargetBlockId(intent)
  const block = await getBlockByID(targetBlockId)
  return {
    kind: 'update',
    targetBlockId,
    targetKind: block?.type === 'NodeListItem' ? 'task-list-item' : 'paragraph',
    sourceKind: canUseCurrentProtyleDom(intent, targetBlockId) ? 'protyle-dom' : 'api-kramdown',
    commitKind: canUseCurrentProtyleDom(intent, targetBlockId) ? 'protyle-update' : 'api-update',
    preferDataType: 'dom',
    fallbackDataType: 'markdown',
    context: intent.context,
    patches: intent.patches,
  }
}
```

说明：

1. 这里可以复用 `blockTargetResolver.ts` 里已有的 task-list 解析细节；
2. 但最终对外统一出口必须是 `resolveMutationTarget()`；
3. 不要在这一任务里引入 planner 或多 plan。

- [ ] **Step 4: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/targetResolver.test.ts test/blockWriter/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/targetResolver.ts src/utils/blockWriter/types.ts test/blockWriter/targetResolver.test.ts
git commit -m "feat(block-writer): add unified mutation target resolver"
```

---

### Task 4: 引入 `sourceLoader.ts` 和 `caretController.ts`，统一 source 快照与 `wbr-first`

**Files:**

- Create: `src/utils/blockWriter/sourceLoader.ts`
- Create: `src/utils/blockWriter/caretController.ts`
- Modify: `src/utils/blockWriter/types.ts`
- Create: `test/blockWriter/sourceLoader.test.ts`
- Create: `test/blockWriter/caretController.test.ts`
- Reuse helper: `src/utils/blockWriter/markdownWriter.ts`
- Reuse helper: `src/utils/blockWriter/slashRange.ts`

- [ ] **Step 1: 先写 source/caret 失败测试**

新建 `test/blockWriter/sourceLoader.test.ts`：

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBlockKramdown } from '@/api'
import { loadMutationSource } from '@/utils/blockWriter/sourceLoader'

vi.mock('@/api', () => ({
  getBlockKramdown: vi.fn(),
}))

describe('sourceLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('loads current block dom and caret snapshot for protyle updates', async () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>'
    document.body.appendChild(node)

    const editable = node.querySelector('[contenteditable="true"]')!
    const textNode = editable.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, textNode.textContent!.length)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const source = await loadMutationSource({
      kind: 'update',
      targetBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'protyle-dom',
      commitKind: 'protyle-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'block-1', protyle: {}, nodeElement: node as any },
      patches: [{ type: 'removeSlashCommand' }],
    })

    expect(source.kind).toBe('update')
    expect(source.targetElement).toBe(node)
    expect(source.caretSnapshot?.policy).toBe('wbr-first')
  })

  it('loads kramdown for api updates', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '任务\n{: id="block-1"}',
    } as any)

    const source = await loadMutationSource({
      kind: 'update',
      targetBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'api-kramdown',
      commitKind: 'api-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'block-1' },
      patches: [{ type: 'setPriority', priority: 'high' }],
    })

    expect(source.kind).toBe('update')
    expect(source.currentMarkdown).toContain('任务')
  })
})
```

新建 `test/blockWriter/caretController.test.ts`：

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  captureCaretSnapshot,
  focusByWbr,
  injectWbrIntoEditable,
} from '@/utils/blockWriter/caretController'

describe('caretController', () => {
  it('captures a wbr-first snapshot for the current editable selection', () => {
    const root = document.createElement('div')
    root.setAttribute('data-node-id', 'block-1')
    root.innerHTML = '<div contenteditable="true">任务 /jt</div>'
    const editable = root.querySelector('[contenteditable="true"]')!
    document.body.appendChild(root)

    const textNode = editable.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, textNode.textContent!.length)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const snapshot = captureCaretSnapshot(root as any)

    expect(snapshot.policy).toBe('wbr-first')
    expect(snapshot.containerBlockId).toBe('block-1')
  })

  it('restores selection from a rendered wbr marker', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div contenteditable="true">任务<wbr></div>'
    document.body.appendChild(root)

    const restored = focusByWbr(root)
    expect(restored).toBe(true)
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/sourceLoader.test.ts test/blockWriter/caretController.test.ts
```

Expected: FAIL because `sourceLoader.ts` / `caretController.ts` 还不存在。

- [ ] **Step 3: 实现 `caretController.ts`**

新增 `src/utils/blockWriter/caretController.ts`，至少提供：

```ts
export type LoadedMutationSource =
  | {
      kind: 'update';
      targetBlockId: string;
      currentMarkdown: string;
      currentDomHtml?: string;
      targetElement?: HTMLElement;
      caretSnapshot?: CaretSnapshot;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
    };

export type CaretSnapshot =
  | {
      policy: 'wbr-first';
      containerBlockId: string;
      fallbackOffset?: {
        start: number;
        end: number;
      };
    }
  | {
      policy: 'none';
    };

export function captureCaretSnapshot(nodeElement: HTMLElement): CaretSnapshot { ... }
export function injectWbrIntoEditable(editable: HTMLElement, offset?: number): boolean { ... }
export function focusByWbr(nodeElement: HTMLElement): boolean { ... }
export function focusByOffset(nodeElement: HTMLElement, offset?: { start: number; end: number }): boolean { ... }
```

要求：

1. 当前块 slash 写回默认使用 `wbr-first`；
2. `focusByOffset()` 只作为 `wbr` 丢失时兜底；
3. 这里不和 planner 绑在一起，只服务 B 阶段 source/render/commit。

- [ ] **Step 4: 实现 `sourceLoader.ts`**

新增 `src/utils/blockWriter/sourceLoader.ts`，至少提供：

```ts
import type { LoadedMutationSource, ResolvedMutationPlan } from './types'
import { getBlockKramdown } from '@/api'
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom'
import { captureCaretSnapshot } from './caretController'

export async function loadMutationSource(plan: ResolvedMutationPlan): Promise<LoadedMutationSource> {
  if (plan.kind === 'insertAfter') {
    return {
      kind: 'insertAfter',
      anchorBlockId: plan.anchorBlockId,
    }
  }

  if (plan.sourceKind === 'protyle-dom') {
    const targetElement = plan.context.nodeElement!
    return {
      kind: 'update',
      targetBlockId: plan.targetBlockId,
      currentMarkdown: blockElementToMarkdownContent(plan.context.protyle, targetElement) ?? '',
      currentDomHtml: targetElement.outerHTML,
      targetElement,
      caretSnapshot: captureCaretSnapshot(targetElement),
    }
  }

  const result = await getBlockKramdown(plan.targetBlockId)
  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    currentMarkdown: result?.kramdown ?? '',
  }
}
```

- [ ] **Step 5: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/sourceLoader.test.ts test/blockWriter/caretController.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/blockWriter/sourceLoader.ts src/utils/blockWriter/caretController.ts src/utils/blockWriter/types.ts test/blockWriter/sourceLoader.test.ts test/blockWriter/caretController.test.ts
git commit -m "feat(block-writer): add source loader and caret controller"
```

---

### Task 5: 引入 `updateRenderer.ts` / `insertRenderer.ts`，统一准备 DOM-first payload

**Files:**

- Create: `src/utils/blockWriter/updateRenderer.ts`
- Create: `src/utils/blockWriter/insertRenderer.ts`
- Modify: `src/utils/blockWriter/types.ts`
- Create: `test/blockWriter/updateRenderer.test.ts`
- Create: `test/blockWriter/insertRenderer.test.ts`
- Reuse helper: `src/utils/blockWriter/kramdownModifier.ts`
- Reuse helper: `src/utils/blockWriter/domSerializer.ts`

- [ ] **Step 1: 先写 renderer 失败测试**

新建 `test/blockWriter/updateRenderer.test.ts`：

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import { prepareUpdatePayload } from '@/utils/blockWriter/updateRenderer'

vi.mock('@/utils/blockWriter/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}))

describe('updateRenderer', () => {
  it('prepares nextMarkdown and domHtml for api updates', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        targetKind: 'paragraph',
        sourceKind: 'api-kramdown',
        commitKind: 'api-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1' },
        patches: [{ type: 'setPriority', priority: 'high' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        currentMarkdown: '任务\n{: id="block-1"}',
      },
    )

    expect(payload.kind).toBe('update')
    expect(payload.nextMarkdown).toContain('🔥')
    expect(payload.domHtml).toContain('🔥')
  })

  it('marks slash cleanup payloads as wbr-restored updates', () => {
    const payload = prepareUpdatePayload(
      {
        kind: 'update',
        targetBlockId: 'block-1',
        targetKind: 'paragraph',
        sourceKind: 'protyle-dom',
        commitKind: 'protyle-update',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        context: { blockId: 'block-1', protyle: {}, nodeElement: document.createElement('div') as any },
        patches: [{ type: 'removeSlashCommand' }],
      },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        currentMarkdown: '任务 /jt\n{: id="block-1"}',
        currentDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /jt</div></div>',
        targetElement: document.createElement('div'),
        caretSnapshot: { policy: 'wbr-first', containerBlockId: 'block-1' },
      },
    )

    expect(payload.caretRestorePlan?.policy).toBe('wbr')
  })
})
```

新建 `test/blockWriter/insertRenderer.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'

import { prepareInsertPayload } from '@/utils/blockWriter/insertRenderer'

vi.mock('@/utils/blockWriter/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}))

describe('insertRenderer', () => {
  it('prepares domHtml and markdown for insert payloads', () => {
    const payload = prepareInsertPayload(
      {
        kind: 'insertAfter',
        anchorBlockId: 'block-1',
        commitKind: 'api-insert',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        patch: {
          type: 'setHabitDefinition',
          habit: {
            name: '喝水',
            startDate: '2026-05-21',
            type: 'count',
            target: 8,
            unit: '杯',
            frequency: { type: 'daily' },
          },
        },
        resultMode: 'boolean',
      },
      {
        kind: 'insertAfter',
        anchorBlockId: 'block-1',
      },
    )

    expect(payload.kind).toBe('insertAfter')
    expect(payload.fallbackMarkdown).toContain('喝水')
    expect(payload.domHtml).toContain('喝水')
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/updateRenderer.test.ts test/blockWriter/insertRenderer.test.ts
```

Expected: FAIL because renderer 文件还不存在。

- [ ] **Step 3: 实现 `PreparedMutationPayload`、`prepareUpdatePayload()`、`prepareInsertPayload()`**

在 `src/utils/blockWriter/types.ts` 增加：

```ts
export interface CaretRestorePlan {
  policy: 'none' | 'wbr'
  placement?: 'after-inserted-text' | 'after-inline' | 'placeholder-anchor' | 'block-end'
}

export type PreparedMutationPayload
  = | {
    kind: 'update'
    targetBlockId: string
    nextMarkdown: string
    preferredDataType: 'dom'
    domHtml?: string
    fallbackMarkdown: string
    oldDomHtml?: string
    targetElement?: HTMLElement
    caretRestorePlan?: CaretRestorePlan
  }
  | {
    kind: 'insertAfter'
    anchorBlockId: string
    preferredDataType: 'dom'
    domHtml?: string
    fallbackMarkdown: string
    resultMode: 'boolean' | 'operations'
    caretRestorePlan?: CaretRestorePlan
  }
```

新增 `src/utils/blockWriter/updateRenderer.ts`：

```ts
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types'
import { markdownToBlockDOM } from './domSerializer'
import { splitKramdownBlock } from './kramdownBlocks'
import { applyBlockPatch, applyBlockPatches } from './kramdownModifier'

export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
): Extract<PreparedMutationPayload, { kind: 'update' }> {
  const nextMarkdown = plan.patches.length === 1
    ? applyBlockPatch(splitKramdownBlock(source.currentMarkdown), plan.patches[0])
    : applyBlockPatches(splitKramdownBlock(source.currentMarkdown), plan.patches)

  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan: plan.patches.some(patch => patch.type === 'removeSlashCommand')
      ? { policy: 'wbr', placement: 'block-end' }
      : { policy: 'none' },
  }
}
```

新增 `src/utils/blockWriter/insertRenderer.ts`：

```ts
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types'
import { markdownToBlockDOM } from './domSerializer'
import { renderInsertableBlockPatch } from './kramdownModifier'

export function prepareInsertPayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'insertAfter' }>,
  _source: Extract<LoadedMutationSource, { kind: 'insertAfter' }>,
): Extract<PreparedMutationPayload, { kind: 'insertAfter' }> {
  const fallbackMarkdown = renderInsertableBlockPatch(plan.patch)
  return {
    kind: 'insertAfter',
    anchorBlockId: plan.anchorBlockId,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(fallbackMarkdown) ?? undefined,
    fallbackMarkdown,
    resultMode: plan.resultMode,
  }
}
```

- [ ] **Step 4: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/updateRenderer.test.ts test/blockWriter/insertRenderer.test.ts test/blockWriter/kramdownModifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/updateRenderer.ts src/utils/blockWriter/insertRenderer.ts src/utils/blockWriter/types.ts test/blockWriter/updateRenderer.test.ts test/blockWriter/insertRenderer.test.ts
git commit -m "feat(block-writer): add update and insert renderers"
```

---

### Task 6: 引入 `apiCommitter.ts` / `protyleCommitter.ts`，统一 DOM-first commit

**Files:**

- Create: `src/utils/blockWriter/apiCommitter.ts`
- Create: `src/utils/blockWriter/protyleCommitter.ts`
- Create: `test/blockWriter/apiCommitter.test.ts`
- Create: `test/blockWriter/protyleCommitter.test.ts`
- Reuse helper: `src/utils/blockWriter/apiTransport.ts`
- Reuse helper: `src/utils/blockWriter/protyleTransport.ts`
- Reuse helper: `src/utils/blockWriter/markdownWriter.ts`

- [ ] **Step 1: 先写 committer 失败测试**

新建 `test/blockWriter/apiCommitter.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'

import { insertBlock, updateBlock } from '@/api'
import { commitViaApi } from '@/utils/blockWriter/apiCommitter'

vi.mock('@/api', () => ({
  insertBlock: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn().mockResolvedValue([]),
}))

describe('apiCommitter', () => {
  it('prefers dom payload for update commits', async () => {
    const ok = await commitViaApi({
      kind: 'update',
      targetBlockId: 'block-1',
      nextMarkdown: '任务 🔥\n{: id="block-1"}',
      preferredDataType: 'dom',
      domHtml: '<div data-node-id="block-1">任务 🔥</div>',
      fallbackMarkdown: '任务 🔥\n{: id="block-1"}',
    })

    expect(ok).toBe(true)
    expect(updateBlock).toHaveBeenCalledWith('dom', '<div data-node-id="block-1">任务 🔥</div>', 'block-1')
  })

  it('prefers dom payload for insert commits and can return operations', async () => {
    const result = await commitViaApi({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      preferredDataType: 'dom',
      domHtml: '<div>喝水</div>',
      fallbackMarkdown: '喝水 🎯2026-05-21 8杯 🔄每天',
      resultMode: 'operations',
    })

    expect(Array.isArray(result)).toBe(true)
    expect(insertBlock).toHaveBeenCalledWith('dom', '<div>喝水</div>', undefined, 'block-1', undefined)
  })
})
```

新建 `test/blockWriter/protyleCommitter.test.ts`：

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { commitViaProtyle } from '@/utils/blockWriter/protyleCommitter'

describe('protyleCommitter', () => {
  it('commits current block dom through one transaction', async () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>'
    document.body.appendChild(node)

    const protyle = { transaction: vi.fn() }
    const ok = await commitViaProtyle(
      { blockId: 'block-1', protyle, nodeElement: node },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        nextMarkdown: '任务 📅2026-05-21\n{: id="block-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="block-1"><div contenteditable="true">任务<wbr> 📅2026-05-21</div></div>',
        fallbackMarkdown: '任务 📅2026-05-21\n{: id="block-1"}',
        oldDomHtml: node.outerHTML,
        targetElement: node,
        caretRestorePlan: { policy: 'wbr', placement: 'after-inline' },
      },
    )

    expect(ok).toBe(true)
    expect(protyle.transaction).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: FAIL because committer 文件还不存在。

- [ ] **Step 3: 实现 `commitViaApi()`**

新增 `src/utils/blockWriter/apiCommitter.ts`：

```ts
import type { PreparedMutationPayload } from './types'
import { insertBlock, updateBlock } from '@/api'

export async function commitViaApi(payload: PreparedMutationPayload): Promise<boolean | IResdoOperations[] | null> {
  if (payload.kind === 'update') {
    const result = payload.domHtml
      ? await updateBlock('dom', payload.domHtml, payload.targetBlockId)
      : await updateBlock('markdown', payload.fallbackMarkdown, payload.targetBlockId)
    return Array.isArray(result)
  }

  const result = payload.domHtml
    ? await insertBlock('dom', payload.domHtml, undefined, payload.anchorBlockId, undefined)
    : await insertBlock('markdown', payload.fallbackMarkdown, undefined, payload.anchorBlockId, undefined)
  return payload.resultMode === 'operations' ? result : Array.isArray(result)
}
```

- [ ] **Step 4: 实现 `commitViaProtyle()`**

新增 `src/utils/blockWriter/protyleCommitter.ts`：

```ts
import type { BlockWriteContext, PreparedMutationPayload } from './types'
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom'
import { focusByOffset, focusByWbr } from './caretController'

function formatUpdatedAttr(date = new Date()): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`
}

export async function commitViaProtyle(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
  payload: Extract<PreparedMutationPayload, { kind: 'update' }>,
): Promise<boolean> {
  const { protyle, nodeElement, blockId } = context
  if (!protyle || !nodeElement || payload.targetBlockId !== blockId) {
    return false
  }

  const oldHTML = payload.oldDomHtml ?? nodeElement.outerHTML
  if (!renderMarkdownIntoBlockEditable(protyle, nodeElement, payload.nextMarkdown)) {
    return false
  }

  nodeElement.setAttribute('updated', formatUpdatedAttr())
  protyle.transaction(
    [{ id: blockId, data: nodeElement.outerHTML, action: 'update' }],
    [{ id: blockId, data: oldHTML, action: 'update' }],
  )

  if (payload.caretRestorePlan?.policy === 'wbr' && !focusByWbr(nodeElement)) {
    focusByOffset(nodeElement)
  }

  return true
}
```

要求：

1. Protyle committer 只处理当前 DOM 真实目标块；
2. 不允许它自己重算 target；
3. `wbr` 恢复失败后才走 offset fallback。

- [ ] **Step 5: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/blockWriter/apiCommitter.ts src/utils/blockWriter/protyleCommitter.ts test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts
git commit -m "feat(block-writer): add dom-first committers"
```

---

### Task 7: 把 `index.ts` 收口成统一 orchestration 入口，并让旧 writer 降级为 helper

**Files:**

- Modify: `src/utils/blockWriter/index.ts`
- Modify: `src/utils/blockWriter/markdownWriter.ts`
- Modify: `src/utils/blockWriter/datePatchWriter.ts`
- Modify: `src/utils/blockWriter/statusPatchWriter.ts`
- Modify: `src/utils/blockWriter/apiTransport.ts`
- Modify: `src/utils/blockWriter/protyleTransport.ts`
- Modify: `test/blockWriter/index.test.ts`

- [ ] **Step 1: 先写 orchestration 集成回归**

在 `test/blockWriter/index.test.ts` 至少增加两类断言：

```ts
it('routes writeBlock through intent -> resolve -> load -> render -> commit', async () => {
  const result = await writeBlock(
    { blockId: 'block123' },
    { type: 'setPriority', priority: 'high' },
  )

  expect(result).toBe(true)
  expect(updateBlock).toHaveBeenCalled()
})

it('routes insertBlockAfterWithResult through the same pipeline and returns operations', async () => {
  vi.mocked(insertBlock).mockResolvedValue([{ doOperations: [], undoOperations: [] }] as any)

  const result = await insertBlockAfterWithResult('block123', {
    type: 'setHabitDefinition',
    habit: {
      name: '喝水',
      startDate: '2026-05-21',
      type: 'count',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
    },
  })

  expect(Array.isArray(result)).toBe(true)
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts
```

Expected: FAIL because `index.ts` 还没有统一 orchestration。

- [ ] **Step 3: 把 `index.ts` 改成真正的薄入口**

目标结构：

```ts
import { commitViaApi } from './apiCommitter'
import { prepareInsertPayload } from './insertRenderer'
import { normalizeInsertIntent, normalizeUpdateIntent } from './intent'
import { commitViaProtyle } from './protyleCommitter'
import { loadMutationSource } from './sourceLoader'
import { resolveMutationTarget } from './targetResolver'
import { prepareUpdatePayload } from './updateRenderer'

async function executeIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plan = await resolveMutationTarget(intent)
  const source = await loadMutationSource(plan)

  if (plan.kind === 'insertAfter') {
    const payload = prepareInsertPayload(plan, source)
    return commitViaApi(payload)
  }

  const payload = prepareUpdatePayload(plan, source)
  if (plan.commitKind === 'protyle-update') {
    const ok = await commitViaProtyle(plan.context, payload)
    if (ok)
      return true
  }
  return commitViaApi(payload)
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches)
  const result = await executeIntent(intent)
  return result === true
}

export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' })
  return (await executeIntent(intent)) === true
}

export async function insertBlockAfterWithResult(previousBlockId: string, patch: InsertableBlockPatch): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' })
  const result = await executeIntent(intent)
  return Array.isArray(result) ? result : null
}
```

- [ ] **Step 4: 把旧 writer 收口成 helper**

要求：

1. `markdownWriter.ts` 只保留 markdown 渲染 helper，不再负责 target 决策；
2. `apiTransport.ts` / `protyleTransport.ts` 若仍保留，只作为对新 committer 的兼容 wrapper；
3. `datePatchWriter.ts` / `statusPatchWriter.ts` 只保留 date/status 语义 helper，不再是完整写入链路拥有者；
4. 不要求这一任务删除旧文件，但不允许它们继续成为主路径 orchestrator。

- [ ] **Step 5: 跑通过验证**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/blockWriter/index.ts src/utils/blockWriter/markdownWriter.ts src/utils/blockWriter/datePatchWriter.ts src/utils/blockWriter/statusPatchWriter.ts src/utils/blockWriter/apiTransport.ts src/utils/blockWriter/protyleTransport.ts test/blockWriter/index.test.ts
git commit -m "refactor(block-writer): unify orchestration pipeline"
```

---

### Task 8: 跑 B 阶段回归矩阵，确认可以进入 C

**Files:**

- No code changes required.

- [ ] **Step 1: 跑新增的 B 阶段模块测试**

Run:

```bash
npx vitest run test/blockWriter/intent.test.ts test/blockWriter/targetResolver.test.ts test/blockWriter/sourceLoader.test.ts test/blockWriter/caretController.test.ts test/blockWriter/updateRenderer.test.ts test/blockWriter/insertRenderer.test.ts test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: PASS.

- [ ] **Step 2: 跑现有 blockWriter 回归**

Run:

```bash
npx vitest run test/blockWriter/apiTransport.test.ts test/blockWriter/blockTargetResolver.test.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/index.test.ts test/blockWriter/kramdownBlocks.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/markdownWriter.test.ts test/blockWriter/protyleTransport.test.ts test/blockWriter/slashRange.test.ts
```

Expected: PASS.

- [ ] **Step 3: 跑 slash / recurring 邻近回归**

Run:

```bash
npx vitest run test/utils/slashCommandItemResolver.test.ts test/utils/slashCommands.itemValidation.test.ts test/utils/slashCommands.habit.test.ts test/utils/slashCommands.protyleWriter.test.ts test/services/recurringService.test.ts
```

Expected: PASS.

- [ ] **Step 4: 跑项目标准测试命令**

Run:

```bash
npm test
```

Expected: PASS，包括项目里的 pre-test 检查。

- [ ] **Step 5: 人工验证 B 阶段出口条件**

人工确认以下结果后，才算 B 阶段结束、可以进入 C：

1. `writeBlock()` / `insertBlockAfter()` / `insertBlockAfterWithResult()` 都进入统一流水线
2. `apiCommitter.ts` / `protyleCommitter.ts` 都优先 `dom`，仅在不可用时 fallback `markdown`
3. slash 写回主路径使用 `wbr-first`
4. `datePatchWriter.ts` / `statusPatchWriter.ts` / `markdownWriter.ts` 已经降级为 helper
5. `index.ts` 只剩 orchestration，不再直接堆积 target/source/commit 特判
6. `mutationPlanner.ts` 仍未接入 runtime path

---

## Self-Review Checklist

### Spec Coverage

- `blockWriter` 负责 target resolve：Task 3, Task 7
- commit 一律 DOM-first：Task 5, Task 6, Task 7
- insert 进入同一套流水线：Task 2, Task 3, Task 5, Task 7
- `wbr-first` 光标恢复：Task 4, Task 6, Task 8
- B 阶段模块化骨架：Task 2, Task 3, Task 4, Task 5, Task 6
- 旧 writer 降级 helper：Task 7
- 暂停 C 阶段 planner 扩展：Task 1, Task 8

### Placeholder Scan

- 没有 `TODO` / `TBD`
- 所有新增文件和修改文件都给了明确路径
- 所有验证步骤都给了具体命令

### Type Consistency

- 公开入口统一归一化为 `BlockMutationIntent`
- 解析输出统一为 `ResolvedMutationPlan`
- source loading 输出统一为 `LoadedMutationSource`
- render 输出统一为 `PreparedMutationPayload`
- insert 的 `boolean` / `operations` 返回模式在 intent 与 payload 两层保持一致
