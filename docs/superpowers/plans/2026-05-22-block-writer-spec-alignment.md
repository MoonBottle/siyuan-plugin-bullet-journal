# Block Writer Spec Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对齐 `docs/superpowers/specs/2026-05-20-block-writer-pipeline-design.md` 的剩余 B/C 边界要求，消除仍在生产路径里的 legacy bypass，收紧 helper 边界，落实真正的 `wbr-first` slash 光标恢复。

**Architecture:** 保留现有 `intent -> resolve -> load -> render -> commit` 主干，不再引入新的一套写入抽象。先把仍绕过 orchestration 的业务入口迁回 `writeBlock()`，然后把 `datePatchWriter.ts` / `markdownWriter.ts` 收缩成 helper-only 形态，再把 `protyleCommitter.ts` 的 slash 光标恢复改成 `wbr-first` 主路径。最后统一 `index.ts` 的执行形态，并删掉已经失去生产价值的 legacy transport / resolver 文件与旧测试锚点。

**Tech Stack:** TypeScript, Vitest, happy-dom, existing `blockWriter` pipeline, SiYuan Protyle transaction path, SiYuan kernel `updateBlock` / `insertBlock`, existing `kramdownModifier` and marker helpers.

---

## Scope Check

这份计划只覆盖一个子系统：`src/utils/blockWriter/` 与直接依赖它的业务调用点。

**包含：**

1. `focusPlanDialogSave.ts` 的 ensured date 写回切回统一流水线
2. `datePatchWriter.ts` / `markdownWriter.ts` 的 helper-only 收口
3. `protyleCommitter.ts` 的 `wbr-first` slash 光标恢复
4. `index.ts` 的 orchestration 压薄与 insert/update 执行形态统一
5. `apiTransport.ts` / `protyleTransport.ts` / `blockTargetResolver.ts` 等 legacy 文件清理
6. 对 `/wc`、`/fq`、marker 顺序稳定、slash-in-marker 校验的 spec 回归测试

**不包含：**

1. 新的业务语义 patch 类型
2. 新的 Protyle insert 能力
3. parser 重写或 item/habit 数据模型调整
4. planner 之外的事务回滚机制

这个范围是单一可交付子项目，不需要再拆成多份独立计划。

## File Structure

| 文件                                              | 责任                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/utils/blockWriter/index.ts`                  | 唯一公开 orchestration 入口，统一 update / insert 执行形态             |
| `src/utils/blockWriter/intent.ts`                 | update / insert intent 归一化与 patch 顺序稳定化                       |
| `src/utils/blockWriter/targetResolver.ts`         | 统一 target/source/commit 决策                                         |
| `src/utils/blockWriter/sourceLoader.ts`           | 当前 DOM / API kramdown 源加载与 slash cleanup draft                   |
| `src/utils/blockWriter/updateRenderer.ts`         | `nextMarkdown`、`domHtml`、`caretRestorePlan` 生成                     |
| `src/utils/blockWriter/insertRenderer.ts`         | insert markdown 与 DOM-first payload 生成                              |
| `src/utils/blockWriter/apiCommitter.ts`           | API update/insert 的 DOM-first commit                                  |
| `src/utils/blockWriter/protyleCommitter.ts`       | 当前块 DOM transaction、task checkbox DOM 同步、slash 光标恢复         |
| `src/utils/blockWriter/caretController.ts`        | caret snapshot、`<wbr>` 注入、`focusByWbr()` / `focusByOffset()`       |
| `src/utils/blockWriter/datePatchWriter.ts`        | date source/prepare helper；不再拥有完整写入链路                       |
| `src/utils/blockWriter/markdownWriter.ts`         | 仅保留兼容 helper，最终不再从 `index.ts` 暴露                          |
| `src/utils/focusPlanDialogSave.ts`                | ensured date + focus plan 的业务组合入口，必须通过 `writeBlock()` 提交 |
| `src/utils/fileUtils.ts`                          | 兼容层；保留 deprecated wrapper，但不再成为计划内主路径                |
| `test/utils/focusPlanDialogSave.test.ts`          | 确认业务入口不再调用 legacy date writer                                |
| `test/blockWriter/datePatchWriter.test.ts`        | date prepare helper 测试                                               |
| `test/blockWriter/protyleCommitter.test.ts`       | `wbr-first` slash 恢复、task checkbox DOM 同步                         |
| `test/blockWriter/caretController.test.ts`        | WBR 注入和 offset fallback 单测                                        |
| `test/blockWriter/index.test.ts`                  | orchestration 主路径和 insert/update 统一回归                          |
| `test/blockWriter/updateRenderer.test.ts`         | marker 顺序与 slash payload 回归                                       |
| `test/utils/slashCommands.itemValidation.test.ts` | slash-in-marker 候选语义行与 `/wc` / `/fq` 业务回归                    |

---

### Task 1: 把 `focusPlanDialogSave.ts` 从 `writeDatePatchWithWriter()` 切回统一流水线

**Files:**

- Modify: `src/utils/blockWriter/datePatchWriter.ts`
- Modify: `src/utils/focusPlanDialogSave.ts`
- Modify: `test/utils/focusPlanDialogSave.test.ts`
- Modify: `test/blockWriter/datePatchWriter.test.ts`

- [ ] **Step 1: 先写失败测试，确认业务入口不再依赖 `writeDatePatchWithWriter()`**

把 `test/utils/focusPlanDialogSave.test.ts` 的 mock 改成 helper-only 入口，并断言 `writeBlock()` 仍负责最后一次写入：

```ts
import { prepareDatePatchWrite } from '@/utils/blockWriter/datePatchWriter'

vi.mock('@/utils/blockWriter/datePatchWriter', () => ({
  prepareDatePatchWrite: vi.fn(async (_blockId: string, patch: { date: string }) => ({
    content: `事项 📅2026-05-14, ${patch.date}\n{: id="block-1" }`,
    targetBlockId: 'block-1',
  })),
}))

it('writes one final block update with both ensured date and focus plan when the item does not contain the date', async () => {
  const item = createItem({ date: '2026-05-14' })

  const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' })

  expect(saved).toBe(true)
  expect(prepareDatePatchWrite).toHaveBeenCalledWith(
    'block-1',
    {
      type: 'addDate',
      date: '2026-05-15',
      allDay: true,
      siblingItems: [item],
      status: 'pending',
    },
  )
  expect(writeBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    [
      {
        type: 'replaceMarkdown',
        markdown: '事项 📅2026-05-14, 2026-05-15\n{: id="block-1" }',
        preserveIAL: false,
      },
      {
        type: 'setFocusPlan',
        plan,
      },
    ],
  )
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/utils/focusPlanDialogSave.test.ts test/blockWriter/datePatchWriter.test.ts
```

Expected: FAIL，因为 `focusPlanDialogSave.ts` 仍在 import / 调用 `writeDatePatchWithWriter()`。

- [ ] **Step 3: 增加 helper-only 的 date prepare 入口并切换业务调用**

在 `src/utils/blockWriter/datePatchWriter.ts` 增加一个只做 resolve+prepare 的 helper：

```ts
export async function prepareDatePatchWrite(
  blockId: string,
  patch: DatePatch,
): Promise<PreparedDateWrite | null> {
  if (!blockId) {
    return null
  }

  const source = await resolveDatePatchSource(blockId)
  if (!source) {
    return null
  }

  return prepareDatePatchWriteFromSource(source, patch)
}
```

把 `src/utils/focusPlanDialogSave.ts` 的 ensured date 路径改成先 prepare，再统一交给 `writeBlock()`：

```ts
import { prepareDatePatchWrite } from '@/utils/blockWriter/datePatchWriter'

const prepared = await prepareDatePatchWrite(
  item.blockId ?? '',
  {
    type: 'addDate',
    date: options.ensureDate,
    allDay: true,
    siblingItems: [item, ...(item.siblingItems ?? [])],
    status: item.status,
  },
)

if (!prepared) {
  console.error('[Task Assistant] Failed to add focus review date before saving focus plan', {
    blockId: item.blockId,
    ensureDate: options.ensureDate,
  })
  return false
}

const updated = await writeBlock(
  { blockId: prepared.targetBlockId },
  [
    {
      type: 'replaceMarkdown',
      markdown: prepared.content,
      preserveIAL: false,
    },
    {
      type: 'setFocusPlan',
      plan,
    },
  ],
)
```

同时把 `test/blockWriter/datePatchWriter.test.ts` 的主用例改成 helper 语义：

```ts
it('prepares a same-block date rewrite without committing', async () => {
  const prepared = await prepareDatePatchWrite('block-1', {
    type: 'addDate',
    date: '2026-05-21',
    allDay: true,
  })

  expect(prepared).toEqual({
    content: '事项 📅2026-05-21\n{: id="block-1"}',
    targetBlockId: 'block-1',
  })
  expect(updateBlock).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: 重新跑测试**

Run:

```bash
npx vitest run test/utils/focusPlanDialogSave.test.ts test/blockWriter/datePatchWriter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/datePatchWriter.ts src/utils/focusPlanDialogSave.ts test/utils/focusPlanDialogSave.test.ts test/blockWriter/datePatchWriter.test.ts
git commit -m "refactor(block-writer): route ensured date writes through pipeline helpers"
```

---

### Task 2: 把 `datePatchWriter.ts` 和 `markdownWriter.ts` 收成 helper-only 边界

**Files:**

- Modify: `src/utils/blockWriter/datePatchWriter.ts`
- Modify: `src/utils/blockWriter/markdownWriter.ts`
- Modify: `src/utils/blockWriter/index.ts`
- Modify: `test/blockWriter/datePatchWriter.test.ts`
- Modify: `test/blockWriter/markdownWriter.test.ts`

- [ ] **Step 1: 先改测试，明确 public API 不再暴露 legacy writer**

把 `test/blockWriter/markdownWriter.test.ts` 改成只验证兼容 helper，而不是从 `@/utils/blockWriter` 入口读取：

```ts
import { writeMarkdownToCurrentBlock } from '@/utils/blockWriter/markdownWriter'

it('renders markdown into the current block without going through blockWriter public exports', async () => {
  const result = await writeMarkdownToCurrentBlock(
    { blockId: 'block-1', protyle, nodeElement: div },
    '测试事项 📅2026-05-21',
  )

  expect(result).toBe(true)
  expect(protyle.transaction).toHaveBeenCalledOnce()
})
```

再加一个 index 层导出约束测试：

```ts
import * as blockWriter from '@/utils/blockWriter'

it('does not expose createProtyleMarkdownWriter from the public blockWriter entry', () => {
  expect('createProtyleMarkdownWriter' in blockWriter).toBe(false)
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/markdownWriter.test.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/index.test.ts
```

Expected: FAIL，因为 `index.ts` 仍然 re-export `createProtyleMarkdownWriter`，`datePatchWriter.ts` 仍暴露完整写入链路。

- [ ] **Step 3: 收紧 public API，只保留 helper**

把 `src/utils/blockWriter/index.ts` 的导出去掉：

```ts
// delete this line
export { createProtyleMarkdownWriter } from './markdownWriter'
```

把 `src/utils/blockWriter/datePatchWriter.ts` 收到 helper-only 形态，保留：

```ts
export async function resolveDatePatchSource(blockId: string): Promise<DatePatchSource | null> { ... }

export function prepareDatePatchWriteFromSource(
  source: DatePatchSource,
  patch: DatePatch,
): PreparedDateWrite | null { ... }

export async function prepareDatePatchWrite(
  blockId: string,
  patch: DatePatch,
): Promise<PreparedDateWrite | null> { ... }
```

并删除 / 停止导出这些完整链路函数：

```ts
// remove legacy public entry points
// writeDatePatchWithWriter
// writeDatePatchWithSlashCleanup
// writeDatePatch
```

把 `src/utils/blockWriter/markdownWriter.ts` 明确标成兼容 helper 文件，顶部注释改成：

```ts
/**
 * @deprecated Compat helpers only.
 * New write paths must go through sourceLoader/updateRenderer/committers.
 */
```

- [ ] **Step 4: 跑测试并做一次 import 清理扫描**

Run:

```bash
npx vitest run test/blockWriter/markdownWriter.test.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/index.test.ts
rg -n "createProtyleMarkdownWriter|writeDatePatchWithWriter|writeDatePatchWithSlashCleanup|writeDatePatch\\(" src test
```

Expected:

1. `vitest` PASS
2. `rg` 只剩 legacy test fixture 或计划内兼容文件，不再出现新的生产调用点

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/datePatchWriter.ts src/utils/blockWriter/markdownWriter.ts src/utils/blockWriter/index.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/markdownWriter.test.ts test/blockWriter/index.test.ts
git commit -m "refactor(block-writer): shrink legacy date and markdown writers"
```

---

### Task 3: 把 slash 光标恢复改成真正的 `wbr-first`

**Files:**

- Modify: `src/utils/blockWriter/caretController.ts`
- Modify: `src/utils/blockWriter/protyleCommitter.ts`
- Modify: `test/blockWriter/caretController.test.ts`
- Modify: `test/blockWriter/protyleCommitter.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 `focusByWbr()` 必须先于 offset fallback**

在 `test/blockWriter/protyleCommitter.test.ts` 增加：

```ts
it('restores slash caret by WBR before offset fallback', async () => {
  const focusOrder: string[] = []
  vi.spyOn(caretController, 'focusByWbr').mockImplementation(() => {
    focusOrder.push('wbr')
    return true
  })
  vi.spyOn(caretController, 'focusByOffset').mockImplementation(() => {
    focusOrder.push('offset')
    return true
  })

  const success = await commitViaProtyle(
    { protyle },
    {
      kind: 'update',
      targetBlockId: 'task-1',
      nextMarkdown: '* [x] 任务\n{: id="task-1"}',
      preferredDataType: 'dom',
      domHtml: '<div data-node-id="task-1">任务</div>',
      fallbackMarkdown: '* [x] 任务\n{: id="task-1"}',
      oldDomHtml: targetElement.outerHTML,
      targetElement,
      caretRestorePlan: {
        policy: 'wbr',
        placement: 'line-end',
        fallbackOffset: { start: 2, end: 2 },
      },
    },
  )

  expect(success).toBe(true)
  expect(focusOrder[0]).toBe('wbr')
})
```

再在 `test/blockWriter/caretController.test.ts` 加一个兜底场景：

```ts
it('falls back to the end of editable text when WBR is missing', () => {
  const ok = focusByOffset(block, { start: 999, end: 999 })

  expect(ok).toBe(true)
  expect(window.getSelection()?.anchorOffset).toBe((block.textContent ?? '').length)
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: FAIL，因为当前实现先尝试 `focusByOffset()`，`focusByWbr()` 只是后备路径。

- [ ] **Step 3: 调整 commit 顺序，让 WBR 成为主恢复路径**

把 `src/utils/blockWriter/protyleCommitter.ts` 的恢复逻辑改成：

```ts
let injectedWbr = false
if (payload.caretRestorePlan?.policy === 'wbr') {
  const editable = targetElement.getAttribute('contenteditable') === 'true'
    ? targetElement
    : targetElement.querySelector('[contenteditable="true"]') as HTMLElement | null
  if (editable) {
    const plannedCaretOffset = resolveWbrOffset(editable, payload.caretRestorePlan)
    injectedWbr = injectWbrIntoEditable(editable, plannedCaretOffset)
  }
}

protyle.transaction(
  [{ id: payload.targetBlockId, data: targetElement.outerHTML, action: 'update' }],
  [{ id: payload.targetBlockId, data: oldHTML, action: 'update' }],
)

if (payload.caretRestorePlan?.policy === 'wbr') {
  const liveTargetElement = resolveLiveTargetElement(payload.targetBlockId, targetElement, protyle)
  const restoredByWbr = injectedWbr ? focusByWbr(liveTargetElement) : false
  if (!restoredByWbr) {
    focusByOffset(liveTargetElement, payload.caretRestorePlan.fallbackOffset)
  }
}
```

在 `src/utils/blockWriter/caretController.ts` 保留现有 offset 兜底，但把注释改成主次顺序明确的版本：

```ts
// WBR is the primary slash restore path.
// Offset restore exists only for cases where WBR is dropped by DOM normalization.
```

- [ ] **Step 4: 重新跑测试**

Run:

```bash
npx vitest run test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/caretController.ts src/utils/blockWriter/protyleCommitter.ts test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
git commit -m "fix(block-writer): make slash caret restore wbr-first"
```

---

### Task 4: 压薄 `index.ts`，让 insert / update 共用同一套执行骨架

**Files:**

- Modify: `src/utils/blockWriter/index.ts`
- Modify: `src/utils/blockWriter/mutationPlanner.ts`
- Modify: `test/blockWriter/index.test.ts`
- Modify: `test/blockWriter/mutationPlanner.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 insert 也走 planner 驱动骨架**

在 `test/blockWriter/index.test.ts` 增加：

```ts
it('routes insertBlockAfter through the shared execution shape', async () => {
  const result = await insertBlockAfter('block-1', {
    type: 'replaceMarkdown',
    markdown: '新块内容\n{: id="new-1"}',
    preserveIAL: false,
  })

  expect(result).toBe(true)
  expect(insertBlock).toHaveBeenCalledOnce()
})
```

在 `test/blockWriter/mutationPlanner.test.ts` 增加单 insert 断言：

```ts
it('builds a single insert plan for insertAfter intents', async () => {
  const plannerResult = await buildMutationPlans({
    kind: 'insertAfter',
    anchorBlockId: 'block-1',
    patch: {
      type: 'replaceMarkdown',
      markdown: '新块内容\n{: id="new-1"}',
      preserveIAL: false,
    },
    resultMode: 'boolean',
  })

  expect(plannerResult.plans).toHaveLength(1)
  expect(plannerResult.plans[0]).toMatchObject({
    kind: 'insertAfter',
    anchorBlockId: 'block-1',
    commitKind: 'api-insert',
  })
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts test/blockWriter/mutationPlanner.test.ts
```

Expected: FAIL，因为 `insertBlockAfter()` 仍走 `executeIntent()` 特殊分支，不是统一的 planner-driven 入口。

- [ ] **Step 3: 删掉 `executeIntent()` 特殊分支，统一到 `executePlans()`**

把 `src/utils/blockWriter/index.ts` 的 insert/update 主入口改成同一形态：

```ts
async function executeMutationIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plannerResult = await buildMutationPlans(intent)
  return executePlans(plannerResult.plans)
}

export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' })
  return (await executeMutationIntent(intent)) === true
}

export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' })
  const result = await executeMutationIntent(intent)
  return Array.isArray(result) ? result : null
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches)
  const result = await executeMutationIntent(intent)
  return result === true
}
```

同时把 `mutationPlanner.ts` 的 insert 分支保留成单 plan，不再让 `index.ts` 自己开分叉。

- [ ] **Step 4: 重新跑测试**

Run:

```bash
npx vitest run test/blockWriter/index.test.ts test/blockWriter/mutationPlanner.test.ts test/blockWriter/insertRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockWriter/index.ts src/utils/blockWriter/mutationPlanner.ts test/blockWriter/index.test.ts test/blockWriter/mutationPlanner.test.ts
git commit -m "refactor(block-writer): unify insert and update execution flow"
```

---

### Task 5: 清理 legacy transport / resolver 文件并把测试迁到新模块

**Files:**

- Delete: `src/utils/blockWriter/apiTransport.ts`
- Delete: `src/utils/blockWriter/protyleTransport.ts`
- Delete: `src/utils/blockWriter/blockTargetResolver.ts`
- Modify: `test/blockWriter/apiTransport.test.ts`
- Modify: `test/blockWriter/protyleTransport.test.ts`
- Modify: `test/blockWriter/blockTargetResolver.test.ts`
- Modify: `test/blockWriter/apiCommitter.test.ts`
- Modify: `test/blockWriter/targetResolver.test.ts`

- [ ] **Step 1: 先迁测试目标，避免删除后失去覆盖**

把旧测试文件的 import 改成新模块：

```ts
// test/blockWriter/apiTransport.test.ts -> test/blockWriter/apiCommitter.test.ts
import { commitViaApi } from '@/utils/blockWriter/apiCommitter'

// test/blockWriter/protyleTransport.test.ts -> test/blockWriter/protyleCommitter.test.ts
import { commitViaProtyle } from '@/utils/blockWriter/protyleCommitter'

// test/blockWriter/blockTargetResolver.test.ts -> test/blockWriter/targetResolver.test.ts
import { resolveMutationTarget } from '@/utils/blockWriter/targetResolver'
```

把旧目标解析断言改成新 plan 断言：

```ts
const plan = await resolveMutationTarget({
  kind: 'update',
  context: { blockId: 'child-1' },
  patches: [{ type: 'setStatus', status: 'completed' }],
})

expect(plan).toMatchObject({
  kind: 'update',
  targetBlockId: 'parent-1',
  targetKind: 'task-list-item',
})
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/targetResolver.test.ts
```

Expected: FAIL，直到旧测试内容完全迁到新模块为止。

- [ ] **Step 3: 删除 legacy runtime 文件**

确认 `src` 中没有生产 import 后，删除三份 legacy 文件：

```bash
rg -n "apiTransport|protyleTransport|blockTargetResolver" src
```

Expected: 只剩测试或文档引用。

然后删除：

```text
src/utils/blockWriter/apiTransport.ts
src/utils/blockWriter/protyleTransport.ts
src/utils/blockWriter/blockTargetResolver.ts
```

并把测试中的行为断言迁到新模块专测中，例如：

```ts
it('writes setStatus via API as DOM-first update', async () => {
  const result = await commitViaApi({
    kind: 'update',
    targetBlockId: 'task-1',
    nextMarkdown: '* [x] 任务\n{: id="task-1"}',
    preferredDataType: 'dom',
    domHtml: '<div data-node-id="task-1"></div>',
    fallbackMarkdown: '* [x] 任务\n{: id="task-1"}',
  })

  expect(result).toBe(true)
  expect(updateBlock).toHaveBeenCalledWith('dom', '<div data-node-id="task-1"></div>', 'task-1')
})
```

- [ ] **Step 4: 重新跑迁移后的测试矩阵**

Run:

```bash
npx vitest run test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/targetResolver.test.ts test/blockWriter/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/blockWriter/apiCommitter.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/targetResolver.test.ts test/blockWriter/index.test.ts
git rm src/utils/blockWriter/apiTransport.ts src/utils/blockWriter/protyleTransport.ts src/utils/blockWriter/blockTargetResolver.ts
git commit -m "refactor(block-writer): remove legacy transport and resolver files"
```

---

### Task 6: 补齐 spec 对齐回归测试

**Files:**

- Modify: `test/blockWriter/updateRenderer.test.ts`
- Modify: `test/blockWriter/protyleCommitter.test.ts`
- Modify: `test/blockWriter/index.test.ts`
- Modify: `test/utils/slashCommands.itemValidation.test.ts`
- Modify: `test/utils/focusPlanDialogSave.test.ts`

- [ ] **Step 1: 先写 spec 关键回归测试**

在 `test/blockWriter/updateRenderer.test.ts` 增加 marker 顺序稳定断言：

```ts
it('appends a new priority marker after existing date and time markers', () => {
  const payload = prepareUpdatePayload(
    {
      kind: 'update',
      targetBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'api-kramdown',
      sourceBlockId: 'block-1',
      commitKind: 'api-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'block-1' },
      patches: [{ type: 'setPriority', priority: 'medium' }],
    },
    {
      kind: 'update',
      targetBlockId: 'block-1',
      sourceBlockId: 'block-1',
      currentMarkdown: '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00\n{: id="block-1"}',
    },
  )

  expect(payload.nextMarkdown).toBe('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱\n{: id="block-1"}')
})
```

在 `test/utils/slashCommands.itemValidation.test.ts` 增加 slash-in-marker 校验：

```ts
it('treats marker-interrupted slash text as a valid item during priority validation', async () => {
  const node = document.createElement('div')
  node.setAttribute('data-node-id', 'block-item')
  node.appendChild(document.createTextNode('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0'))

  setCaretToCommandEnd(node, '/yxj')
  setActiveSlashRangeForTest({
    blockId: 'block-item',
    blockElement: node,
    range: window.getSelection()!.getRangeAt(0),
    slashStartOffset: node.textContent!.indexOf('/yxj'),
  })

  const handler = getActionHandler('setPriority', {} as any, ['/yxj'])
  handler({} as any, node)
  await Promise.resolve()
  await Promise.resolve()

  expect(showMessage).not.toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error')
})
```

再保留 `/wc` 回归：

```ts
expect(writeBlock).toHaveBeenCalledWith(
  expect.objectContaining({ blockId: 'block-item', nodeElement: node, protyle }),
  [
    { type: 'removeSlashCommand' },
    { type: 'setStatus', status: 'completed' },
  ],
)
```

- [ ] **Step 2: 跑失败验证**

Run:

```bash
npx vitest run test/blockWriter/updateRenderer.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/index.test.ts test/utils/slashCommands.itemValidation.test.ts test/utils/focusPlanDialogSave.test.ts
```

Expected: 至少一项 FAIL，直到 marker 顺序、slash-in-marker、`/wc` 任务块和 ensured-date 组合路径都被当前实现完整覆盖。

- [ ] **Step 3: 补齐缺口代码或已有测试前提**

如果测试暴露出以下缺口，就在对应模块补齐：

```ts
// updateRenderer.ts
const renderablePatches = plan.patches.filter(patch => patch.type !== 'removeSlashCommand')

// normalizePatchSequence.ts
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
```

重点要求：

1. `/wc` 最终命中 `NodeListItem` 而不是 `✅`
2. slash cleanup 不改变 marker 顺序决策
3. 同一 patch 序列在 API / Protyle 两个 committer 下消费同一份 `nextMarkdown`

- [ ] **Step 4: 跑最终 blockWriter 回归矩阵**

Run:

```bash
npx vitest run test/utils/focusPlanDialogSave.test.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/updateRenderer.test.ts test/blockWriter/index.test.ts test/blockWriter/mutationPlanner.test.ts test/utils/slashCommands.itemValidation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/utils/focusPlanDialogSave.test.ts test/blockWriter/datePatchWriter.test.ts test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts test/blockWriter/updateRenderer.test.ts test/blockWriter/index.test.ts test/blockWriter/mutationPlanner.test.ts test/utils/slashCommands.itemValidation.test.ts
git commit -m "test(block-writer): add spec alignment regressions"
```

---

## Self-Review

### Spec coverage

1. **helper-only writer boundary**: Task 1, Task 2, Task 5
2. **`wbr-first` slash restore**: Task 3
3. **thin orchestration entry**: Task 4
4. **legacy transport cleanup**: Task 5
5. **`/wc`、`/fq`、slash-in-marker、marker 顺序稳定**: Task 6

没有发现 spec 里的剩余要求被这份计划漏掉。

### Placeholder scan

本计划没有使用 `TODO` / `TBD` / “类似 Task N” 之类占位描述；每个代码步骤都附了明确代码片段、文件路径和测试命令。

### Type consistency

统一使用这些名字，不在后续任务里改名：

1. `prepareDatePatchWrite`
2. `resolveMutationTarget`
3. `loadMutationSource`
4. `prepareUpdatePayload`
5. `commitViaProtyle`
6. `commitViaApi`
