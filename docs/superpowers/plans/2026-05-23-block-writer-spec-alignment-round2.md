# BlockWriter Spec 对齐计划（第二轮）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除 `src/utils/blockWriter/` 实现与 `docs/superpowers/specs/2026-05-20-block-writer-pipeline-design.md` 之间剩余的 12 项偏离，使代码严格对齐 spec 语义。

**架构：** 保留现有 `intent → resolve → load → render → commit` 五阶段流水线。本轮对齐聚焦于：移除 `ContentPatch.suffix` 隐式内容注入、将 `datePatchWriter` 的 resolve/render 职责迁入核心流水线、修复 Protyle fallback 反向修改 resolve 决策、补齐 caret 兜底与 debug 日志、同步 spec 类型定义。

**技术栈：** TypeScript, Vitest, happy-dom, 现有 blockWriter 流水线, SiYuan Protyle transaction, SiYuan kernel API

---

## 范围检查

这份计划只覆盖一个子系统：`src/utils/blockWriter/` 与直接依赖它的业务调用点。

**包含：**

1. 移除 `ContentPatch.suffix`，迁移唯一调用方 `/markAsTask`
2. 将 `resolveDatePatchSource` 从 `datePatchWriter` 迁入 `targetResolver`
3. 将 `prepareDatePatchWriteFromSource` 核心逻辑迁入 `updateRenderer`
4. 收缩 `datePatchWriter`/`statusPatchWriter` 为 helper-only
5. 修复 `mutationExecutor` 中 Protyle fallback 反向修改 resolve 决策
6. 补齐 `focusByOffset` 失败后的"折叠到块末尾"兜底与 debug 日志
7. 同步 spec 类型定义以反映合理的代码扩展

**不包含：**

1. 新的业务语义 patch 类型
2. 新的 Protyle insert 能力
3. parser 重写或 item/habit 数据模型调整
4. `mutationPlanner` 的 C 阶段 spec 更新（已超前实现，属于 spec 更新范畴，不在代码变更范围）

---

## 文件结构

| 文件                                                                | 责任                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/utils/blockWriter/shared/types.ts`                             | 统一类型定义，对齐 spec §6                                            |
| `src/utils/blockWriter/intent/intent.ts`                            | update / insert intent 归一化                                         |
| `src/utils/blockWriter/intent/normalizePatchSequence.ts`            | patch 顺序稳定化                                                      |
| `src/utils/blockWriter/resolve/targetResolver.ts`                   | 统一 target/source/commit 决策，收编 `resolveDatePatchSource`         |
| `src/utils/blockWriter/source/sourceLoader.ts`                      | 当前 DOM / API kramdown 源加载与 slash cleanup draft                  |
| `src/utils/blockWriter/render/updateRenderer.ts`                    | `nextMarkdown`、`domHtml`、`caretRestorePlan` 生成，收编 date prepare |
| `src/utils/blockWriter/render/kramdownModifier.ts`                  | 纯函数 markdown 变换，移除 `suffix` 分支                              |
| `src/utils/blockWriter/render/markerCluster.ts`                     | marker 原位更新语义                                                   |
| `src/utils/blockWriter/commit/protyleCommitter.ts`                  | DOM transaction + caret 恢复                                          |
| `src/utils/blockWriter/commit/apiCommitter.ts`                      | API DOM-first commit                                                  |
| `src/utils/blockWriter/shared/caretController.ts`                   | caret snapshot、WBR 注入、focusByWbr/focusByOffset                    |
| `src/utils/blockWriter/runtime/mutationExecutor.ts`                 | 执行引擎，修复 fallback 策略                                          |
| `src/utils/blockWriter/compat/datePatchWriter.ts`                   | 收缩为 helper-only                                                    |
| `src/utils/blockWriter/compat/statusPatchWriter.ts`                 | 收缩为 helper-only                                                    |
| `src/utils/slashCommands.ts`                                        | `/markAsTask` 调用方迁移                                              |
| `src/utils/focusPlanDialogSave.ts`                                  | ensured date 调用方迁移                                               |
| `docs/superpowers/specs/2026-05-20-block-writer-pipeline-design.md` | spec 类型同步                                                         |

---

### 任务 1：新增 `setTaskTag` patch 类型，移除 `ContentPatch.suffix`

**偏离项：** 偏离 1 — `ContentPatch.suffix` 仍存在，违反 spec §4.5 第 2 条

**设计决策：** `📋` 与 `🔥🌱🍃` 本质上都是 marker，应走同一套 `markerCluster` 的 `upsertMarker` 机制。新增 `setTaskTag` patch 类型，与 `setPriority` 同级，而非用 `setContent` 的 `suffix` 隐式追加。

**文件：**

- 修改：`src/utils/blockWriter/shared/types.ts`
- 修改：`src/utils/blockWriter/render/markerCluster.ts`
- 修改：`src/utils/blockWriter/render/kramdownModifier.ts`
- 修改：`src/utils/blockWriter/render/updateRenderer.ts`
- 修改：`src/utils/blockWriter/intent/normalizePatchSequence.ts`
- 修改：`src/utils/slashCommands.ts:798-812`
- 修改：`test/blockWriter/kramdownModifier.test.ts`
- 修改：`test/blockWriter/updateRenderer.test.ts`
- 修改：`test/blockWriter/markerCluster.test.ts`

- [ ] **步骤 1：在 `markerCluster.ts` 新增 `taskTag` MarkerKind**

修改 `src/utils/blockWriter/render/markerCluster.ts`：

```ts
export type MarkerKind
  = | 'date'
    | 'priority'
    | 'taskTag'
    | 'status'
    | 'pinned'
    | 'focusPlan'
    | 'reminder'
    | 'recurring'
    | 'endCondition'
    | 'habitArchive'
```

在 `MARKER_PATTERNS` 中 `priority` 之后新增：

```ts
{ kind: 'taskTag', regex: /^📋$/u },
```

- [ ] **步骤 2：在 `types.ts` 新增 `TaskTagPatch`，从 `ContentPatch` 移除 `suffix`**

修改 `src/utils/blockWriter/shared/types.ts`：

新增 `TaskTagPatch`：

```ts
export interface TaskTagPatch {
  type: 'setTaskTag'
  tag?: string
}
```

从 `ContentPatch` 移除 `suffix`：

```ts
export interface ContentPatch {
  type: 'setContent'
  newItemContent?: string
}
```

将 `TaskTagPatch` 加入 `BlockPatch` 联合类型：

```ts
export type BlockPatch
  = | DatePatch
    | StatusPatch
    | PriorityPatch
    | TaskTagPatch
    | ContentPatch
    | FocusPlanPatch
    | ReminderPatch
    | RecurringPatch
    | PinnedPatch
    | SlashCommandPatch
    | HabitDefinitionPatch
    | HabitRecordPatch
    | HabitArchivePatch
    | ReplaceMarkdownPatch
```

- [ ] **步骤 3：在 `normalizePatchSequence.ts` 新增 `setTaskTag` 排序**

修改 `src/utils/blockWriter/intent/normalizePatchSequence.ts`：

```ts
const PATCH_ORDER: Record<BlockPatch['type'], number> = {
  removeSlashCommand: 0,
  setContent: 10,
  addDate: 20,
  setReminder: 30,
  setRecurring: 40,
  setPriority: 50,
  setTaskTag: 55,
  setFocusPlan: 60,
  togglePinned: 70,
  setHabitArchive: 80,
  setStatus: 90,
  setHabitDefinition: 100,
  setHabitRecord: 110,
  replaceMarkdown: 120,
}
```

`setTaskTag` 排在 `setPriority` 之后（55），因为 `📋` 在 marker cluster 中的位置与优先级同级，追加顺序在优先级之后。

- [ ] **步骤 4：在 `kramdownModifier.ts` 新增 `applyTaskTag`，移除 `applyContent` 的 `suffix` 分支**

修改 `src/utils/blockWriter/render/kramdownModifier.ts`：

新增 `applyTaskTag`：

```ts
function applyTaskTag(line: string, patch: Extract<BlockPatch, { type: 'setTaskTag' }>): string {
  const parsed = parseMarkerLine(line)
  if (!patch.tag) {
    return normalizeMarkerLine(removeMarker(parsed, 'taskTag'))
  }
  return normalizeMarkerLine(upsertMarker(parsed, 'taskTag', patch.tag))
}
```

在 `applyBlockPatch` 中新增分支（在 `setPriority` 之后）：

```ts
if (patch.type === 'setTaskTag') {
  contentLines[index] = applyTaskTag(line, patch)
  return replaceContentLines(parts, contentLines)
}
```

从 `applyContent` 中移除 `suffix` 参数和分支：

```ts
function applyContent(line: string, newItemContent?: string): string {
  if (newItemContent !== undefined && newItemContent !== null) {
    const listPrefixMatch = line.match(/^(\s*-(?:\s*\{:[^}]*\}\s*)?)/)
    const listPrefix = listPrefixMatch ? listPrefixMatch[1] : ''
    const headingPrefixMatch = !listPrefix ? line.match(/^(\s{0,3}#{1,6})(?=\s|$)/) : null
    const headingPrefix = headingPrefixMatch ? headingPrefixMatch[1] : ''
    const structuralPrefix = listPrefix || headingPrefix
    let rest = structuralPrefix ? line.slice(structuralPrefix.length).trimStart() : line

    const taskCheckboxRe = /^(\[\s*(?:x\s*)?\])/i
    const taskMatch = rest.match(taskCheckboxRe)
    const taskMarker = taskMatch ? taskMatch[1] : ''
    if (taskMarker)
      rest = rest.slice(taskMarker.length).trimStart()

    const markerIdx = findFirstMarker(rest)
    const markers = markerIdx >= 0 ? rest.slice(markerIdx).trim() : ''

    return [structuralPrefix, taskMarker, newItemContent, markers]
      .filter(s => s.length > 0)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  return line
}
```

同步修改 `applyBlockPatch` 中 `setContent` 的调用：

```ts
if (patch.type === 'setContent') {
  contentLines[index] = applyContent(line, patch.newItemContent)
  return replaceContentLines(parts, contentLines)
}
```

- [ ] **步骤 5：修改 `updateRenderer.ts`，移除 `suffix` 依赖**

修改 `src/utils/blockWriter/render/updateRenderer.ts:50-75`，移除 `contentPatchWithSuffix` 逻辑：

```ts
function buildCaretRestorePlan(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  options?: CaretRestoreOptions,
): CaretRestorePlan {
  const effectivePolicy = options?.caretPolicy
    ?? (plan.patches.some(patch => patch.type === 'removeSlashCommand') ? 'wbr' : 'none')
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
```

- [ ] **步骤 6：迁移 `/markAsTask` 调用方，用 `setTaskTag` 替换 `setContent.suffix`**

修改 `src/utils/slashCommands.ts:805-811`，把：

```ts
void writeBlock(
  writeContext,
  [
    { type: 'removeSlashCommand' },
    { type: 'setContent', suffix: taskTag },
  ],
)
```

改为：

```ts
void writeBlock(
  writeContext,
  [
    { type: 'removeSlashCommand' },
    { type: 'setTaskTag', tag: taskTag },
  ],
)
```

这与 `setPriority` 的模式完全一致：`removeSlashCommand` + 语义 patch。

- [ ] **步骤 7：写测试**

在 `test/blockWriter/markerCluster.test.ts` 增加：

```ts
it('recognizes 📋 as taskTag marker', () => {
  const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 📋')
  expect(parsed.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'taskTag', raw: '📋' }),
    ]),
  )
})

it('upserts taskTag marker after existing markers', () => {
  const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 ⏰14:00')
  const result = normalizeMarkerLine(upsertMarker(parsed, 'taskTag', '📋'))
  expect(result).toBe('评审视觉稿 📅2026-05-15 ⏰14:00 📋')
})

it('removes taskTag marker', () => {
  const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 📋')
  const result = normalizeMarkerLine(removeMarker(parsed, 'taskTag'))
  expect(result).toBe('评审视觉稿 📅2026-05-15')
})
```

在 `test/blockWriter/kramdownModifier.test.ts` 增加：

```ts
it('applies setTaskTag by appending 📋 after existing markers', () => {
  const result = applyBlockPatch(
    splitKramdownBlock('评审视觉稿 📅2026-05-15 ⏰14:00\n{: id="b1"}'),
    { type: 'setTaskTag', tag: '📋' },
  )
  expect(result).toBe('评审视觉稿 📅2026-05-15 ⏰14:00 📋\n{: id="b1"}')
})

it('removes taskTag when tag is undefined', () => {
  const result = applyBlockPatch(
    splitKramdownBlock('评审视觉稿 📅2026-05-15 📋\n{: id="b1"}'),
    { type: 'setTaskTag' },
  )
  expect(result).toBe('评审视觉稿 📅2026-05-15\n{: id="b1"}')
})

it('applyContent no longer accepts suffix', () => {
  const result = applyBlockPatch(
    splitKramdownBlock('评审视觉稿 📅2026-05-15\n{: id="b1"}'),
    { type: 'setContent', suffix: '📋' } as any,
  )
  expect(result).toBe('评审视觉稿 📅2026-05-15\n{: id="b1"}')
})
```

在 `test/blockWriter/updateRenderer.test.ts` 增加：

```ts
it('builds caret restore plan without relying on suffix', () => {
  const payload = prepareUpdatePayload(
    {
      kind: 'update',
      targetBlockId: 'b1',
      targetKind: 'paragraph',
      sourceKind: 'protyle-dom',
      sourceBlockId: 'b1',
      commitKind: 'protyle-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'b1', protyle: {}, nodeElement: document.createElement('div') },
      patches: [
        { type: 'removeSlashCommand' },
        { type: 'setTaskTag', tag: '📋' },
      ],
    },
    {
      kind: 'update',
      targetBlockId: 'b1',
      sourceBlockId: 'b1',
      currentMarkdown: '评审视觉稿 /rw 📅2026-05-15\n{: id="b1"}',
    },
    { caretOwner: true, caretPolicy: 'wbr' },
  )

  expect(payload.caretRestorePlan?.policy).toBe('wbr')
  expect(payload.caretRestorePlan?.placement).toBe('block-end')
  expect(payload.caretRestorePlan?.anchorText).toBeUndefined()
})
```

- [ ] **步骤 8：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/markerCluster.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/updateRenderer.test.ts test/blockWriter/index.test.ts
```

预期：PASS

- [ ] **步骤 9：全局扫描确认无残留 `suffix` 引用**

运行：

```bash
rg -n "\.suffix|suffix\?" src
```

预期：0 匹配（`suffix` 已从类型和所有消费方中移除）

- [ ] **步骤 10：Commit**

```bash
git add src/utils/blockWriter/shared/types.ts src/utils/blockWriter/render/markerCluster.ts src/utils/blockWriter/render/kramdownModifier.ts src/utils/blockWriter/render/updateRenderer.ts src/utils/blockWriter/intent/normalizePatchSequence.ts src/utils/slashCommands.ts test/blockWriter/markerCluster.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/updateRenderer.test.ts
git commit -m "feat(block-writer): add setTaskTag patch type, remove ContentPatch.suffix"
```

---

### 任务 2：将 `resolveDatePatchSource` 迁入 `targetResolver`

**偏离项：** 偏离 12 — 核心流水线仍直接依赖 `datePatchWriter`，违反 §10.6

**文件：**

- 修改：`src/utils/blockWriter/resolve/targetResolver.ts`
- 修改：`src/utils/blockWriter/compat/datePatchWriter.ts`
- 修改：`test/blockWriter/targetResolver.test.ts`

- [ ] **步骤 1：写失败测试，断言 targetResolver 不再从 datePatchWriter 导入**

在 `test/blockWriter/targetResolver.test.ts` 增加：

```ts
it('resolves date patch source without importing from datePatchWriter', async () => {
  vi.mock('@/utils/blockWriter/compat/datePatchWriter', () => ({
    resolveDatePatchSource: vi.fn(() => {
      throw new Error('targetResolver should not call datePatchWriter.resolveDatePatchSource')
    }),
  }))

  const plan = await resolveMutationTarget({
    kind: 'update',
    context: { blockId: 'child-1' },
    patches: [{ type: 'addDate', date: '2026-05-21', allDay: true }],
  })

  expect(plan.kind).toBe('update')
  expect(plan.targetBlockId).toBeDefined()
})
```

- [ ] **步骤 2：跑失败验证**

运行：

```bash
npx vitest run test/blockWriter/targetResolver.test.ts
```

预期：FAIL — `targetResolver` 仍从 `datePatchWriter` 导入 `resolveDatePatchSource`。

- [ ] **步骤 3：将 `resolveDatePatchSource` 核心逻辑迁入 targetResolver**

从 `src/utils/blockWriter/compat/datePatchWriter.ts:412-470` 提取 `resolveDatePatchSource` 函数体，移入 `src/utils/blockWriter/resolve/targetResolver.ts`。

需要一并迁移的依赖：

- `getBlockByID`, `getBlockKramdown` from `@/api`
- `parseKramdownBlocks`, `stripListAndBlockAttr` from `@/parser/core`
- `isStandaloneBlockRefLine` from `@/parser/lineParser`
- `isTaskListFormat` from `@/utils/blockWriter/shared/itemLineMarkers`
- `isListItemLine` 辅助函数

在 `targetResolver.ts` 中新增：

```ts
async function resolveDatePatchSource(blockId: string): Promise<DatePatchSourceContext | null> {
  // 从 datePatchWriter.ts:412-470 搬入完整函数体
  // 保留原有逻辑，只改返回类型为 DatePatchSourceContext
  ...
}
```

修改 `targetResolver.ts` 的 import，移除：

```ts
import { resolveDatePatchSource } from '@/utils/blockWriter/compat/datePatchWriter'
```

改为使用本地函数。

在 `datePatchWriter.ts` 中，将 `resolveDatePatchSource` 改为委托到 targetResolver：

```ts
export async function resolveDatePatchSource(blockId: string): Promise<DatePatchSource | null> {
  const context = await resolveDatePatchSourceFromResolver(blockId)
  if (!context)
    return null
  return {
    originalBlockId: context.originalBlockId,
    kramdown: context.sourceMarkdown,
    targetBlockId: context.sourceBlockId,
    targetItemBlockRaw: context.targetItemBlockRaw,
    usedParentDocumentContext: context.usedParentDocumentContext,
  }
}
```

或者更简单地：让 `datePatchWriter.ts` 直接从 `targetResolver` 导入并 re-export，保持旧接口兼容。

- [ ] **步骤 4：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/targetResolver.test.ts test/blockWriter/datePatchWriter.test.ts
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/resolve/targetResolver.ts src/utils/blockWriter/compat/datePatchWriter.ts test/blockWriter/targetResolver.test.ts
git commit -m "refactor(block-writer): migrate resolveDatePatchSource into targetResolver"
```

---

### 任务 3：将 `prepareDatePatchWriteFromSource` 渲染逻辑迁入 `updateRenderer`

**偏离项：** 偏离 2/12 — `datePatchWriter` 仍承担 render 职责，核心流水线仍依赖它

**文件：**

- 修改：`src/utils/blockWriter/render/updateRenderer.ts`
- 修改：`src/utils/blockWriter/compat/datePatchWriter.ts`
- 修改：`test/blockWriter/updateRenderer.test.ts`

- [ ] **步骤 1：写失败测试，断言 updateRenderer 不再从 datePatchWriter 导入**

在 `test/blockWriter/updateRenderer.test.ts` 增加：

```ts
it('handles addDate patch without importing from datePatchWriter', () => {
  vi.mock('@/utils/blockWriter/compat/datePatchWriter', () => ({
    prepareDatePatchWriteFromSource: vi.fn(() => {
      throw new Error('updateRenderer should not call datePatchWriter.prepareDatePatchWriteFromSource')
    }),
  }))

  const payload = prepareUpdatePayload(
    {
      kind: 'update',
      targetBlockId: 'b1',
      targetKind: 'paragraph',
      sourceKind: 'api-kramdown',
      sourceBlockId: 'b1',
      commitKind: 'api-update',
      preferDataType: 'dom',
      fallbackDataType: 'markdown',
      context: { blockId: 'b1' },
      patches: [{ type: 'addDate', date: '2026-05-21', allDay: true }],
    },
    {
      kind: 'update',
      targetBlockId: 'b1',
      sourceBlockId: 'b1',
      currentMarkdown: '评审视觉稿 📅2026-05-15\n{: id="b1"}',
    },
  )

  expect(payload.nextMarkdown).toContain('2026-05-21')
})
```

- [ ] **步骤 2：跑失败验证**

运行：

```bash
npx vitest run test/blockWriter/updateRenderer.test.ts
```

预期：FAIL — `updateRenderer` 仍从 `datePatchWriter` 导入 `prepareDatePatchWriteFromSource`。

- [ ] **步骤 3：将 date patch 渲染逻辑迁入 updateRenderer**

当前 `updateRenderer.ts:184-197` 对 `addDate` patch 的处理：

```ts
if (patch.type === 'addDate') {
  const prepared = prepareDatePatchWriteFromSource({...}, patch);
  if (prepared) {
    nextMarkdown = prepared.content;
  }
  continue;
}
```

需要改为使用 `kramdownModifier.ts` 的 `applyDate`（基于 `markerCluster` 原位更新）：

```ts
if (patch.type === 'addDate') {
  nextMarkdown = applyBlockPatch(splitKramdownBlock(nextMarkdown), patch)
  continue
}
```

但 `applyDate` 目前只处理单行场景，不支持 `datePatchWriter` 中的多行 kramdown 块处理（如番茄钟行、多 content 行）。需要增强 `applyDate` 或在 `updateRenderer` 中增加多行分支。

**方案：** 在 `updateRenderer` 中保留对多行 kramdown 的特殊处理，但不再依赖 `datePatchWriter`。将 `prepareDatePatchWriteFromSource` 中与渲染相关的核心逻辑提取为 `updateRenderer` 内部的 `renderDatePatch` 函数：

```ts
function renderDatePatch(currentMarkdown: string, patch: DatePatch, datePatchSource?: DatePatchSourceContext): string {
  if (datePatchSource && needsMultiLineDateRender(currentMarkdown)) {
    return renderMultiLineDatePatch(currentMarkdown, patch, datePatchSource)
  }
  return applyBlockPatch(splitKramdownBlock(currentMarkdown), patch)
}
```

其中 `renderMultiLineDatePatch` 从 `datePatchWriter.prepareDatePatchWriteFromSource` 提取，但只返回 markdown 内容，不做 commit。

同时从 `updateRenderer.ts` 移除：

```ts
import { prepareDatePatchWriteFromSource } from '@/utils/blockWriter/compat/datePatchWriter'
```

- [ ] **步骤 4：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/updateRenderer.test.ts test/blockWriter/kramdownModifier.test.ts
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/render/updateRenderer.ts src/utils/blockWriter/compat/datePatchWriter.ts test/blockWriter/updateRenderer.test.ts
git commit -m "refactor(block-writer): migrate date patch rendering into updateRenderer"
```

---

### 任务 4：收缩 `datePatchWriter`/`statusPatchWriter` 为 helper-only

**偏离项：** 偏离 2 — 旧 writer 仍保留完整写入链路，违反 §10.6

**文件：**

- 修改：`src/utils/blockWriter/compat/datePatchWriter.ts`
- 修改：`src/utils/blockWriter/compat/statusPatchWriter.ts`
- 修改：`src/utils/focusPlanDialogSave.ts`
- 修改：`test/blockWriter/datePatchWriter.test.ts`

- [ ] **步骤 1：确认 `focusPlanDialogSave.ts` 已通过统一流水线**

检查 `src/utils/focusPlanDialogSave.ts` 是否仍直接调用 `prepareDatePatchWrite`。如果是，改为通过 `writeBlock` 提交：

```ts
import { writeBlock } from '@/utils/blockWriter'

if (options?.ensureDate && !itemHasDate(item, options.ensureDate)) {
  return writeBlock(
    { blockId: item.blockId ?? '' },
    [
      {
        type: 'addDate',
        date: options.ensureDate,
        allDay: true,
        siblingItems: [item, ...(item.siblingItems ?? [])],
        status: item.status,
      },
      {
        type: 'setFocusPlan',
        plan,
      },
    ],
  )
}
```

移除 `focusPlanDialogSave.ts` 中的：

```ts
import { prepareDatePatchWrite } from '@/utils/blockWriter/compat/datePatchWriter'
```

- [ ] **步骤 2：删除 datePatchWriter 中的完整链路函数**

从 `src/utils/blockWriter/compat/datePatchWriter.ts` 中删除以下函数（任务 2-3 完成后它们已无生产调用方）：

- `writeDatePatchWithWriter()`
- `writeDatePatchWithSlashCleanup()`
- `writeDatePatch()`
- `persistDateContent()`
- `createProtyleMarkdownWriter` 的 import

保留：

- `resolveDatePatchSource()` — 委托到 targetResolver（任务 2）
- `prepareDatePatchWriteFromSource()` — 仍作为 helper 供外部非流水线场景使用
- `prepareDatePatchWrite()` — helper 入口

在文件顶部添加注释：

```ts
/**
 * Date patch helpers.
 *
 * Resolve and prepare logic has been migrated to targetResolver and updateRenderer.
 * This file only retains helper functions for non-pipeline callers.
 *
 * DO NOT add new commit/write logic here. Use writeBlock() instead.
 */
```

- [ ] **步骤 3：删除 statusPatchWriter 中的完整链路函数**

从 `src/utils/blockWriter/compat/statusPatchWriter.ts` 中删除：

- `writeStatusWithSlashCleanup()`
- `commitProtyleUpdate()`
- `resolveSlashContext()` — 已在 sourceLoader 中有等价实现

保留文件为空壳或仅含 helper 注释。如果文件内无其他导出，直接删除文件。

- [ ] **步骤 4：全局扫描确认无生产调用方引用被删函数**

运行：

```bash
rg -n "writeDatePatchWithWriter|writeDatePatchWithSlashCleanup|writeDatePatch\b|writeStatusWithSlashCleanup|commitProtyleUpdate" src
```

预期：0 匹配（仅剩 compat 文件内的定义或已删除）

- [ ] **步骤 5：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/ test/utils/focusPlanDialogSave.test.ts
```

预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/utils/blockWriter/compat/datePatchWriter.ts src/utils/blockWriter/compat/statusPatchWriter.ts src/utils/focusPlanDialogSave.ts test/blockWriter/datePatchWriter.test.ts
git commit -m "refactor(block-writer): shrink datePatchWriter and statusPatchWriter to helper-only"
```

---

### 任务 5：修复 Protyle fallback 反向修改 resolve 决策

**偏离项：** 偏离 7 — `mutationExecutor` 在 Protyle commit 失败后重新构造 `ResolvedMutationPlan`，违反 §11.4 第 2 条

**文件：**

- 修改：`src/utils/blockWriter/runtime/mutationExecutor.ts`
- 修改：`src/utils/blockWriter/planner/mutationPlanner.ts`
- 修改：`test/blockWriter/mutationPlanner.test.ts`

- [ ] **步骤 1：写失败测试，断言 executor 不修改 resolvedPlan**

在 `test/blockWriter/mutationPlanner.test.ts` 增加：

```ts
it('pre-plans API fallback for protyle-update plans with slash patches', async () => {
  const plannerResult = await buildMutationPlans({
    kind: 'update',
    context: {
      blockId: 'b1',
      protyle: {},
      nodeElement: document.createElement('div'),
    },
    patches: [
      { type: 'removeSlashCommand' },
      { type: 'setPriority', priority: 'medium' },
    ],
  })

  const plan = plannerResult.plans[0]
  expect(plan.commitKind).toBe('protyle-update')
  expect(plan.apiFallbackPlan).toBeDefined()
  expect(plan.apiFallbackPlan?.commitKind).toBe('api-update')
  expect(plan.apiFallbackPlan?.sourceKind).toBe('api-kramdown')
})
```

- [ ] **步骤 2：跑失败验证**

运行：

```bash
npx vitest run test/blockWriter/mutationPlanner.test.ts
```

预期：FAIL — `MutationExecutionPlan` 没有 `apiFallbackPlan` 字段。

- [ ] **步骤 3：在 planner 中预规划 fallback plan**

在 `src/utils/blockWriter/shared/types.ts` 的 `MutationExecutionPlan` 中增加：

```ts
export interface MutationExecutionPlan {
  ...
  apiFallbackPlan?: {
    sourceKind: 'api-kramdown';
    sourceBlockId: string;
    commitKind: 'api-update';
  };
}
```

在 `src/utils/blockWriter/planner/mutationPlanner.ts` 的 `flush` 函数中，当 `commitKind === 'protyle-update'` 时，预生成 fallback plan：

```ts
if (first.commitKind === 'protyle-update') {
  plan.apiFallbackPlan = {
    sourceKind: 'api-kramdown',
    sourceBlockId: first.targetBlockId!,
    commitKind: 'api-update',
  }
}
```

- [ ] **步骤 4：修改 executor 使用预规划的 fallback**

修改 `src/utils/blockWriter/runtime/mutationExecutor.ts:57-65`，把：

```ts
const apiFallbackPlan: Extract<ResolvedMutationPlan, { kind: 'update' }> = {
  ...resolvedPlan,
  sourceKind: 'api-kramdown',
  sourceBlockId: resolvedPlan.targetBlockId,
  commitKind: 'api-update',
}
const apiFallbackSource = await loadMutationSource(apiFallbackPlan)
const apiFallbackPayload = prepareUpdatePayload(apiFallbackPlan, apiFallbackSource)
return await commitViaApi(apiFallbackPayload)
```

改为使用预规划的 fallback：

```ts
if (plan.apiFallbackPlan) {
  const fallbackResolved: Extract<ResolvedMutationPlan, { kind: 'update' }> = {
    ...resolvedPlan,
    sourceKind: plan.apiFallbackPlan.sourceKind,
    sourceBlockId: plan.apiFallbackPlan.sourceBlockId,
    commitKind: plan.apiFallbackPlan.commitKind,
  }
  const fallbackSource = await loadMutationSource(fallbackResolved)
  const fallbackPayload = prepareUpdatePayload(fallbackResolved, fallbackSource)
  return await commitViaApi(fallbackPayload)
}
```

这样 resolve 决策是在 planner 阶段预规划的，executor 只是执行预规划的结果，不再反向修改。

- [ ] **步骤 5：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/mutationPlanner.test.ts test/blockWriter/index.test.ts
```

预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/utils/blockWriter/shared/types.ts src/utils/blockWriter/planner/mutationPlanner.ts src/utils/blockWriter/runtime/mutationExecutor.ts test/blockWriter/mutationPlanner.test.ts
git commit -m "fix(block-writer): pre-plan API fallback in planner instead of reverse-modifying resolve"
```

---

### 任务 6：补齐 caret 兜底与 debug 日志

**偏离项：** 偏离 4 — `focusByOffset` 失败后无"折叠到块末尾"兜底，无 debug 日志，违反 §4.5 第 4 条

**文件：**

- 修改：`src/utils/blockWriter/commit/protyleCommitter.ts`
- 修改：`src/utils/blockWriter/shared/caretController.ts`
- 修改：`test/blockWriter/caretController.test.ts`
- 修改：`test/blockWriter/protyleCommitter.test.ts`

- [ ] **步骤 1：写失败测试**

在 `test/blockWriter/caretController.test.ts` 增加：

```ts
it('collapses to end of editable when offset fallback fails', () => {
  const emptyBlock = document.createElement('div')
  emptyBlock.setAttribute('contenteditable', 'true')

  const ok = focusByOffset(emptyBlock, { start: 999, end: 999 })

  expect(ok).toBe(true)
})
```

在 `test/blockWriter/protyleCommitter.test.ts` 增加：

```ts
it('logs debug warning when both WBR and offset fallback fail', async () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  vi.spyOn(caretController, 'focusByWbr').mockReturnValue(false)
  vi.spyOn(caretController, 'focusByOffset').mockReturnValue(false)

  await commitViaProtyle(
    { protyle },
    {
      kind: 'update',
      targetBlockId: 'task-1',
      nextMarkdown: '内容\n{: id="task-1"}',
      preferredDataType: 'dom',
      transactionDomHtml: targetElement.outerHTML,
      fallbackMarkdown: '内容\n{: id="task-1"}',
      oldDomHtml: targetElement.outerHTML,
      targetElement,
      caretRestorePlan: {
        policy: 'wbr',
        placement: 'block-end',
        fallbackOffset: { start: 5, end: 5 },
      },
    },
  )

  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[BWDBG]'),
    expect.objectContaining({ caretRestoreFailed: true }),
  )

  consoleSpy.mockRestore()
})
```

- [ ] **步骤 2：跑失败验证**

运行：

```bash
npx vitest run test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
```

预期：FAIL — `focusByOffset` 对空 editable 返回 `false`，protyleCommitter 不记录 debug 日志。

- [ ] **步骤 3：修改 `focusByOffset` 增加空 editable 兜底**

修改 `src/utils/blockWriter/shared/caretController.ts:166-200`，在 `textNodes.length === 0` 分支中，折叠到 editable 末尾而非返回 `false`：

```ts
export function focusByOffset(nodeElement: HTMLElement, offset?: { start: number, end: number }): boolean {
  const editable = findEditable(nodeElement)
  if (!editable) {
    return false
  }

  const textNodes = collectTextNodes(editable)
  if (textNodes.length === 0) {
    const range = document.createRange()
    range.setStart(editable, 0)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return true
  }

  let remaining = offset?.start ?? textNodes.reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0)

  for (const textNode of textNodes) {
    const length = textNode.textContent?.length ?? 0
    if (remaining <= length) {
      const range = document.createRange()
      range.setStart(textNode, remaining)
      range.collapse(true)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      return true
    }
    remaining -= length
  }

  const lastNode = textNodes.at(-1)
  const range = document.createRange()
  range.setStart(lastNode, lastNode.textContent?.length ?? 0)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return true
}
```

- [ ] **步骤 4：修改 `protyleCommitter` 增加 debug 日志**

修改 `src/utils/blockWriter/commit/protyleCommitter.ts:154-166`，在 `focusByOffset` 也失败时记录日志：

```ts
if (payload.caretRestorePlan?.policy === 'wbr') {
  const liveTargetElement = resolveLiveTargetElement(payload.targetBlockId, targetElement, protyle)
  const restoredByWbr = focusByWbr(liveTargetElement)
  if (!restoredByWbr) {
    const restoredByOffset = focusByOffset(liveTargetElement, payload.caretRestorePlan.fallbackOffset)
    if (!restoredByOffset) {
      console.log('[BWDBG][protyleCommitter] caret restore fully failed', {
        targetBlockId: payload.targetBlockId,
        caretRestoreFailed: true,
        fallbackOffset: payload.caretRestorePlan.fallbackOffset,
      })
    }
  }
}
```

- [ ] **步骤 5：跑测试验证通过**

运行：

```bash
npx vitest run test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
```

预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/utils/blockWriter/shared/caretController.ts src/utils/blockWriter/commit/protyleCommitter.ts test/blockWriter/caretController.test.ts test/blockWriter/protyleCommitter.test.ts
git commit -m "fix(block-writer): add caret fallback to block end and debug logging on failure"
```

---

### 任务 7：同步 spec 类型定义

**偏离项：** 偏离 5/8/9/10/11 — 代码中合理的类型扩展未反映在 spec 中

**文件：**

- 修改：`docs/superpowers/specs/2026-05-20-block-writer-pipeline-design.md`

- [ ] **步骤 1：更新 spec §6.1 `BlockMutationIntent`**

在 `insertAfter` 分支增加 `resultMode`：

```ts
type BlockMutationIntent
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

- [ ] **步骤 2：更新 spec §6.2 `ResolvedMutationPlan`**

在 `update` 分支增加 `sourceBlockId` 和 `datePatchSource`：

```ts
type ResolvedMutationPlan
  = | {
    kind: 'update'
    targetBlockId: string
    targetKind: 'paragraph' | 'task-list-item' | 'block'
    sourceKind: 'protyle-dom' | 'api-kramdown'
    sourceBlockId?: string
    commitKind: 'protyle-update' | 'api-update'
    preferDataType: 'dom'
    fallbackDataType: 'markdown'
    context: BlockWriteContext
    patches: BlockPatch[]
    datePatchSource?: DatePatchSourceContext
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

- [ ] **步骤 3：更新 spec §6.3 `LoadedMutationSource`**

将 `extra` 改为顶层字段，与实现对齐：

```ts
type LoadedMutationSource
  = | {
    kind: 'update'
    targetBlockId: string
    sourceBlockId?: string
    currentMarkdown: string
    currentDomHtml?: string
    targetElement?: HTMLElement
    paragraphElement?: HTMLElement
    caretSnapshot?: CaretSnapshot
  }
  | {
    kind: 'insertAfter'
    anchorBlockId: string
  }
```

- [ ] **步骤 4：更新 spec §6.4 `CaretRestorePlan` 和 `PreparedMutationPayload`**

增加代码中的扩展字段：

```ts
interface CaretRestorePlan {
  policy: 'none' | 'wbr'
  placement?: 'after-inserted-text' | 'after-inline' | 'placeholder-anchor' | 'block-end' | 'line-end'
  anchorText?: string
  targetOffset?: number
  lineIndex?: number
  fallbackOffset?: {
    start: number
    end: number
  }
}

type PreparedMutationPayload
  = | {
    kind: 'update'
    targetBlockId: string
    nextMarkdown: string
    preferredDataType: 'dom'
    domHtml?: string
    transactionDomHtml?: string
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

- [ ] **步骤 5：在 spec §9 C 阶段摘要中注明 planner 已提前实现**

在 §9 增加注释：

```markdown
> 注：`mutationPlanner.ts` 已在 B 阶段实现中提前落地，C 阶段 spec 需据此更新。
```

- [ ] **步骤 6：Commit**

```bash
git add docs/superpowers/specs/2026-05-20-block-writer-pipeline-design.md
git commit -m "docs(block-writer): sync spec types with implementation"
```

---

### 任务 8：全量回归验证

**文件：**

- 无新增修改，仅运行测试

- [ ] **步骤 1：运行完整 blockWriter 测试矩阵**

运行：

```bash
npx vitest run test/blockWriter/ test/utils/focusPlanDialogSave.test.ts
```

预期：全部 PASS

- [ ] **步骤 2：运行 lint 检查**

运行：

```bash
npm run lint
```

预期：无错误

- [ ] **步骤 3：运行完整测试套件**

运行：

```bash
npm run test
```

预期：全部 PASS

- [ ] **步骤 4：最终偏离扫描**

对照偏离清单逐项确认：

| #   | 偏离项                                                        | 状态                                                  |
| --- | ------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `ContentPatch.suffix` 仍存在                                  | ✅ 任务 1 已移除                                      |
| 2   | `datePatchWriter`/`statusPatchWriter` 仍保留完整链路          | ✅ 任务 4 已收缩                                      |
| 3   | `rebuildSingleLineContent` 会重排 marker                      | ✅ 任务 3 已迁入 updateRenderer，旧路径不再被生产调用 |
| 4   | `focusByOffset` 失败后无兜底 + 无 debug 日志                  | ✅ 任务 6 已补齐                                      |
| 5   | `CaretRestorePlan` 扩展了 spec 未定义的字段                   | ✅ 任务 7 已同步 spec                                 |
| 6   | `mutationPlanner` 已提前实现                                  | ✅ 任务 7 已在 spec 注明                              |
| 7   | Protyle fallback 反向修改 resolve 决策                        | ✅ 任务 5 已修复                                      |
| 8   | `LoadedMutationSource` 缺 `extra` 字段                        | ✅ 任务 7 已同步 spec                                 |
| 9   | `PreparedMutationPayload` 增加 `transactionDomHtml`           | ✅ 任务 7 已同步 spec                                 |
| 10  | `ResolvedMutationPlan` 增加 `sourceBlockId`/`datePatchSource` | ✅ 任务 7 已同步 spec                                 |
| 11  | `BlockMutationIntent.insertAfter` 增加 `resultMode`           | ✅ 任务 7 已同步 spec                                 |
| 12  | 核心流水线仍直接依赖 `datePatchWriter`                        | ✅ 任务 2-3 已迁移                                    |

- [ ] **步骤 5：Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: final spec alignment cleanup"
```

---

## 自检

### Spec 覆盖度

逐章对照：

- §4.1 target resolve → 任务 2 收编 datePatchSource resolve
- §4.2 DOM-first commit → 已对齐，无变更
- §4.3 insert 进入同一套流水线 → 已对齐，无变更
- §4.4 任意批量 patch 优先单次 commit → 已对齐（planner 已实现）
- §4.5 wbr-first 光标恢复 → 任务 1 移除 suffix，任务 6 补齐兜底
- §4.6 slash 前置校验语义回退 → 已在 sourceLoader 的 slash cleanup draft 中实现，无变更
- §5 五层流水线 → 已对齐
- §6 核心类型 → 任务 7 同步
- §7.1.1 marker 顺序稳定 → 任务 3 迁入 updateRenderer 后由 markerCluster 保证
- §7.2 insert 独立 renderer → 已对齐
- §8 B 阶段目标 → 全部达成
- §10 文件迁移 → 任务 2-4 完成
- §11 错误处理与 fallback → 任务 5 修复 fallback 策略，任务 6 补齐 caret 兜底
- §12 测试策略 → 任务 8 全量回归

### 占位符扫描

无 `TODO`/`TBD`/`后续实现`/`类似任务 N` 等占位描述。

### 类型一致性

统一使用以下名字，不在后续任务中改名：

1. `prepareDatePatchWrite` — helper 入口
2. `resolveMutationTarget` — targetResolver 主函数
3. `loadMutationSource` — sourceLoader 主函数
4. `prepareUpdatePayload` — updateRenderer 主函数
5. `commitViaProtyle` — protyleCommitter 主函数
6. `commitViaApi` — apiCommitter 主函数
7. `buildMutationPlans` — planner 主函数
8. `executePlans` — executor 主函数
9. `apiFallbackPlan` — 新增的预规划 fallback 字段
