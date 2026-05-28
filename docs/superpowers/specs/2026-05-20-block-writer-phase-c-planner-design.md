# BlockWriter C 阶段 Mutation Planner 设计

> 日期：2026-05-20（2026-05-23 更新实现状态）
> 状态：已落地
> 范围：`src/utils/blockWriter/` C 阶段通用 planner 重构
> 前置：B 阶段统一流水线骨架已落地并稳定运行

## 1. 概述

B 阶段解决的是基础设施问题：

- 统一 `intent -> resolve -> load -> render -> commit` 主骨架
- 收口 `target resolve`
- 固化 `DOM-first, markdown fallback`
- 让 update / insert 进入同一套编排模型

但 B 阶段之后，`writeBlock()` 仍可能保留一批"为批量 patch 合并服务的入口判断"。
C 阶段的目标，就是把这些组合判断进一步收敛为一个**通用 mutation planner**。

planner 不关注 `/fq`、`/jt`、habit 之类的业务命名；它只关注：

1. 这些 patch 是否指向同一个真实目标
2. 它们是否能共享同一个 source
3. 它们是否能共享同一种 commit 方式
4. 它们是否应当被原子地放进同一次提交

换句话说，C 阶段要解决的是：

> 对任意批量 patch，如何优先得到**最少次数**且**语义正确**的执行计划。

### 实现状态

C 阶段核心模块已在 B 阶段实现中提前落地：

- `planner/mutationPlanner.ts` — 完整实现规划算法 Phase 1-5
- `runtime/mutationExecutor.ts` — 完整实现 plan 执行引擎
- `shared/types.ts` — `MutationPatchUnit`、`MutationPatchCapability`、`MutationExecutionPlan` 类型定义
- `index.ts` — `writeBlock()` 已成为薄入口：`normalizeIntent → buildMutationPlans → executePlans`

## 2. 设计目标

1. 任意批量 patch 默认先尝试合并成**一个 execution plan**。 ✅ 已实现
2. 若无法合并，只按**最小必要拆分原则**拆成多个 plan。 ✅ 已实现
3. 拆分依据只来自能力边界，不来自业务组合名称。 ✅ 已实现
4. `writeBlock()` 入口不再继续堆叠 "如果是 A+B 就走 X" 的特判。 ✅ 已实现
5. planner 输出的 plan 必须可单测、可解释、可日志化。 ✅ 已实现（`MutationPlannerResult.reason` + `[BJ-MutationPlanner]` 日志）

## 3. 非目标

1. 不在 C 阶段重新设计 B 阶段的 source loader / renderer / committer。
2. 不要求首次落地就支持跨目标真正事务化回滚。
3. 不要求 insert 与 update 在同一个 plan 中混合提交。
4. 不要求 planner 感知具体业务文案或 UI 行为。

## 4. 前置约束

### 4.1 B 阶段必须已经提供的能力 ✅ 全部已提供

C 阶段依赖 B 阶段先提供这些稳定接口：

- `normalizeIntent()` ✅ `intent/intent.ts` + `intent/normalizePatchSequence.ts`
- `resolveTarget()` ✅ `resolve/targetResolver.ts`
- `loadSource()` ✅ `source/sourceLoader.ts`
- `renderUpdatePayload()` ✅ `render/updateRenderer.ts`
- `renderInsertPayload()` ✅ `render/insertRenderer.ts`
- `commitMutationPayload()` ✅ `commit/protyleCommitter.ts` + `commit/apiCommitter.ts`

也就是说，planner 自己**不负责**：

- 直接读 DOM / Kramdown
- 直接 patch markdown
- 直接调用 API / transaction

planner 负责的是**规划**，不是执行。

### 4.2 Commit 仍保持 DOM-first ✅ 已实现

planner 不改变 B 阶段已经确定的 commit 规则：

1. 能产出 DOM payload 时优先 DOM
2. 只有 DOM 不可用时才回退 markdown

planner 决定的是"几个 plan、什么顺序、每个 plan 吃哪些 patch"。

### 4.3 光标恢复仍由执行层负责，但 planner 不能丢失 caret policy ✅ 已实现

slash 相关 plan 在执行后往往需要恢复当前编辑光标，尤其是：

- 删除 slash 后追加新文本 token
- 删除 slash 后插入结构化 inline 内容
- 删除 slash 后触发 DOM 重建或 markdown render

planner 自己不执行光标恢复，但必须让执行层知道：

1. 哪个 plan 会成为最终的 caret owner ✅ `caretOwner` 标记
2. 这个 plan 期望的主恢复语义与最终落点 ✅ `caretPolicy: 'wbr' | 'none'`

因此 C 阶段不能把 caret 语义丢失在 plan 合并过程中。

同时，C 阶段明确依赖 B 阶段的另一个前提：

- `removeSlashCommand` 只做 slash cleanup ✅
- 不再保留 `removeSlashCommand.suffix` ✅
- 所有 slash 命令插入内容都必须通过显式语义 patch 表达，例如 `setContent`、`addDate` ✅
- marker 顺序已经在 B 阶段语义层被确定：已有 marker 只原位更新，允许原位规范化写法，不存在的 marker 才允许追加；若同次新增多个 marker，则按归一化后的 patch 序列顺序追加；planner 与 committer 都不再重排 ✅ `markerCluster.ts`
- slash 触发位置只影响 cleanup 的局部删除范围，不影响最终语义结果与 marker 顺序 ✅
- 当前块 slash 前置校验优先基于 candidate semantic line，而不是 pinia 的瞬时失配结果 ✅ `slashCommandItemResolver.ts`

## 5. 核心概念

### 5.1 Patch Unit ✅ 已实现

planner 不直接处理"裸 patch 数组"，而是先把每个 patch 归一成可规划单元：

```ts
interface MutationPatchUnit {
  index: number
  patch: BlockPatch
  intentKind: 'update' | 'insertAfter'
  atomicGroup?: string
}
```

实现位置：`shared/types.ts:258-263`

说明：

- `index` 保留用户原始输入顺序
- `atomicGroup` 用于表示"这些 patch 若能合并，应尽量一起提交"
- 默认情况下，同一次 `writeBlock()` 调用里的 patch 属于同一用户动作

### 5.2 Patch Capability ✅ 已实现（比 spec 更丰富）

每个 patch 在 resolve 之后，会变成一个"能力描述"：

```ts
interface MutationPatchCapability {
  unit: MutationPatchUnit
  targetBlockId?: string
  targetKind?: 'paragraph' | 'task-list-item' | 'block'
  sourceBlockId?: string // 实现扩展：date patch 可能需要从不同块加载 source
  sourceKind: 'protyle-dom' | 'api-kramdown'
  commitKind: 'protyle-update' | 'api-update' | 'api-insert' | 'protyle-insert'
  preferredCaretPolicy?: 'none' | 'wbr'
  canSharePlan: boolean
  requiresCurrentDom: boolean
  canFallbackToApi: boolean
  datePatchSource?: DatePatchSource // 实现扩展：date patch 的 source 上下文
}
```

实现位置：`shared/types.ts:265-277`

这里的重点不是字段本身，而是：

- planner 在这一层开始用"能力"而不是"业务名称"思考
- 所有合并/拆分逻辑都围绕 capability 决策

### 5.3 Execution Plan ✅ 已实现（比 spec 更丰富）

planner 输出的是执行计划，而不是最终 payload：

```ts
interface MutationExecutionPlan {
  id: string
  kind: 'update' | 'insertAfter'
  targetBlockId?: string
  targetKind?: 'paragraph' | 'task-list-item' | 'block'
  sourceKind: 'protyle-dom' | 'api-kramdown'
  commitKind: 'protyle-update' | 'api-update' | 'api-insert' | 'protyle-insert'
  caretPolicy: 'none' | 'wbr'
  caretOwner: boolean
  units: MutationPatchUnit[]
  order: number
  atomicBoundary: 'single-commit' | 'split-subplan'
  // 实现扩展字段
  resolvedPlan?: ResolvedMutationPlan
  apiFallbackPlan?: { sourceKind, sourceBlockId, commitKind }
  context: BlockWriteContext
  anchorBlockId?: string
  resultMode?: 'boolean' | 'operations'
  datePatchSource?: DatePatchSource
  sourceBlockId?: string
}
```

实现位置：`shared/types.ts:279-302`

plan 的含义是：

- 这一组 patch 要一起被加载、渲染、提交
- 若 `units.length > 1`，则这些 patch 共享一次 commit
- 若 `caretOwner === true`，则该 plan 负责最终恢复当前编辑光标

## 6. Planner 输入输出 ✅ 已实现

### 6.1 输入

```ts
interface MutationPlannerInput {
  intent: BlockMutationIntent
  context: BlockWriteContext | Partial<BlockWriteContext> | undefined
}
```

实际实现：`buildMutationPlans(intent: BlockMutationIntent)` 直接接收 intent。

### 6.2 输出

```ts
interface MutationPlannerResult {
  plans: MutationExecutionPlan[]
  reason:
    | 'single-plan'
    | 'split-by-target'
    | 'split-by-source'
    | 'split-by-commit-kind'
    | 'split-by-intent-kind'
}
```

实现位置：`planner/mutationPlanner.ts:buildMutationPlans()`

要求：

- 输出必须可用于日志 ✅
- 输出必须能够解释为什么没有合并成单 plan ✅ `reason` 字段

## 7. 规划算法 ✅ 全部已实现

### 7.1 Phase 1: Normalize ✅ `patchUnitsForIntent()`

步骤：

1. 把输入 patch / patch[] / insert patch 归一成 `MutationPatchUnit[]`
2. 保留原始顺序
3. 标记 `intentKind`

产出：

- `units[]`

### 7.2 Phase 2: Capability Annotation ✅ `annotateCapabilities()`

步骤：

1. 对每个 unit 调用 B 阶段 resolve 能力
2. 得到每个 unit 的 target/source/commit 信息
3. 标记是否依赖当前 DOM、是否允许 API fallback
4. 标记每个 patch 的 `preferredCaretPolicy`

产出：

- `MutationPatchCapability[]`

### 7.3 Phase 3: Merge Attempt ✅ `buildMutationPlans()` 内循环

planner 先尝试判断整批 unit 是否可以归并成一个 plan。

满足以下条件时，直接生成单 plan：

1. `intentKind` 相同
2. `targetBlockId` 相同
3. `sourceKind` 相同
4. `commitKind` 相同
5. 不存在互斥顺序要求

其中第 5 条的含义是：

- patch 的应用顺序仍然保留
- 但它们不要求不同 source 或不同 commit 才能正确执行

若多个 patch 被合并，则该 plan 的 `caretPolicy` 取"更强"的恢复策略：

- `wbr` > `none` ✅ `strongerCaretPolicy()` 辅助函数

### 7.4 Phase 4: Minimal Split ✅ `mergeReasonForConflict()`

若整批无法合并，则按以下优先级做最小拆分：

1. **按 intent kind 拆**
   - `update` 和 `insertAfter` 不混合
2. **按 target 拆**
   - 不同真实目标块必须拆
3. **按 source 拆**
   - `protyle-dom` 和 `api-kramdown` 不能共享同一 plan
4. **按 commit kind 拆**
   - `protyle-update` 和 `api-update` 不能共享同一 plan

注意：

- planner 必须用**第一个造成冲突的能力边界**解释拆分原因 ✅
- 不允许为了"看起来清晰"额外过度拆分 ✅

### 7.5 Phase 5: Order Resolution ✅ `buildMutationPlans()` 末尾

拆分后需要决定 plan 执行顺序：

1. 默认按原始 patch 顺序稳定排序 ✅
2. 同一目标块拆出的多个 plan，按最接近原始用户动作的顺序执行 ✅
3. `removeSlashCommand` 之类 patch 不再被当作特殊业务分支，而是只按其 capability 所属 plan 执行 ✅
4. 最后一个影响当前 Protyle 编辑块的 plan 标记为 `caretOwner` ✅ 从后往前找最后一个 protyle-dom plan

## 8. 合并规则 ✅ 已验证

### 8.1 可合并

以下场景应优先合并成一个 plan：

1. 当前块 `removeSlashCommand + setStatus` — 若同 target 则合并 ✅
2. 当前块 `removeSlashCommand + addDate` — 若同 target 则合并 ✅
3. 当前块 `removeSlashCommand + setContent` — 若同 target 则合并 ✅
4. 当前块 `setPriority + setContent + addDate` — 若同 target/source/commit 则合并 ✅
5. 当前块 habit 定义原地更新与 slash cleanup — 若同 target 则合并 ✅
6. 任意同目标、同 source、同 commit 的 patch 序列 ✅

若这些 patch 同时包含 slash cleanup 与后续内容写回，则合并后的单 plan 应保留最终需要的 caret policy，而不是退化为 `none`。 ✅ `strongerCaretPolicy('wbr', 'none') => 'wbr'`

### 8.2 不可合并

以下场景必须拆分：

1. 当前块 slash cleanup，但真实业务更新目标在另一个 block ✅ `split-by-target`
2. 一部分 patch 需要 `protyle-dom`，另一部分只能走 `api-kramdown` ✅ `split-by-source`
3. 一个是 `insertAfter`，另一个是 `update` ✅ `split-by-intent-kind`（当前 API 不允许混合，为防御性检查）
4. 真实目标块不同 ✅ `split-by-target`

### 8.3 边界场景

存在一些"理论上同目标，但能力上仍应拆分"的情况：

1. 当前 DOM 无法安全恢复或无法可靠渲染
2. 某 patch 必须读取当前实时 Range / slash context，而另一个 patch 已经不再依赖它
3. 某 patch 的 resolve 结果只能 API fallback，另一 patch 仍可在当前 DOM 提交 ✅ `apiFallbackPlan` 机制

这些场景仍按能力边界拆，不做人造强并。

## 9. 执行模型 ✅ 全部已实现

### 9.1 单 plan 执行 ✅ `executePlan()`

若 planner 只输出一个 plan，则：

1. 统一 load source ✅ `loadMutationSource()`
2. 按原始 patch 顺序执行 transform ✅ `prepareUpdatePayload()`
3. 渲染一次 payload ✅
4. commit 一次 ✅

这是 C 阶段的理想状态，也是默认优先路径。

若该 plan 影响当前编辑块，则它同时负责：

1. 应用 B 阶段生成的 caret restore plan ✅
2. 按 `caretPolicy` 执行 `wbr` 主恢复 ✅ `focusByWbr()`
3. 仅在 `wbr` 丢失时，由执行层自行走 `offset` 兜底；这不属于 planner 语义 ✅ `focusByOffset()`

### 9.2 多 plan 执行 ✅ `executePlans()`

若 planner 输出多个 plan，则执行器遵守：

1. 按 plan order 顺序执行 ✅
2. 每个 plan 内仍只提交一次 ✅
3. 默认 `fail-fast` ✅
4. 不做跨 plan 的伪事务回滚 ✅
5. 只有 `caretOwner === true` 的 plan 负责最终光标恢复 ✅

原因很直接：

- 同一个 SiYuan transaction 不能覆盖跨目标 API 写入
- 引入伪回滚会放大复杂度且不可靠

因此 C 阶段的原则是：

> 能单 plan 就单 plan；必须拆时，明确拆、稳定执行、及时失败。

### 9.3 结果语义

建议执行器输出：

```ts
interface MutationExecutionResult {
  success: boolean
  executedPlans: number
  skippedPlans: number
  failedPlanId?: string
}
```

当前实现：`executePlans()` 返回 `boolean | IResdoOperations[] | null`，比 spec 更贴近 SiYuan API 实际返回值。`MutationExecutionResult` 可作为后续增强方向。

### 9.4 API Fallback 机制（实现扩展）

当 protyle commit 失败时，executor 自动尝试 API fallback：

1. 使用 `apiFallbackPlan` 中的 sourceKind/commitKind 重新加载 source
2. 重新渲染 payload
3. 通过 `commitViaApi()` 提交

这是 spec 未明确要求但实现中增加的合理增强。

## 10. `writeBlock()` 在 C 阶段的终态 ✅ 已实现

C 阶段完成后，`index.ts` 里的 `writeBlock()` 只保留薄入口职责：

```ts
async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BlockPatch[]) {
  const intent = normalizeUpdateIntent(context, patches)
  const plannerResult = await buildMutationPlans(intent)
  return executePlans(plannerResult.plans)
}
```

实际实现与 spec 几乎完全匹配，只是 `normalizeIntent` 被拆成了 `normalizeUpdateIntent` / `normalizeInsertIntent` 两个入口函数，比 spec 更清晰。

入口文件不再直接负责：

- 判断某两个 patch 是否是特例组合 ✅
- 判断 slash + status / date / habit 的专门路径 ✅
- 决定先 transaction 再 API 还是直接 API ✅

这些判断都应下沉为：

- resolve 能力 ✅
- planner 合并/拆分 ✅
- execution engine 顺序执行 ✅

## 11. 日志与可观测性 ✅ 已实现

planner 需要统一日志前缀：

- `[BJ-MutationPlanner]` ✅ 已从 `[BWDBG]` 统一替换

关键日志字段：

- patch types ✅
- targetBlockId 列表 ✅
- sourceKind 列表 ✅
- commitKind 列表 ✅
- 最终 plan 数量 ✅
- 拆分原因 ✅ `reason` 字段

## 12. 测试策略

### 12.1 Planner 单测 ✅ 全部已覆盖

必须覆盖：

1. 单 patch -> 单 plan ✅
2. 同目标批量 patch -> 单 plan ✅
3. 跨目标 patch -> 拆 plan ✅
4. source 冲突 -> 拆 plan ✅
5. commitKind 冲突 -> 拆 plan ✅
6. insert / update 混合 -> 拆 plan ✅（当前 API 不允许混合，测试验证了 insert/update 分离）
7. slash cleanup 与后续内容写回合并时最终 plan 选择 `wbr` ✅
8. 多 plan 场景下仅最后一个当前块 plan 为 `caretOwner` ✅
9. slash 触发在正文区与触发在已有 marker 内部时，planner 产出的语义 plan 不因触发位置而改变 ✅
10. 日期/时间 marker 中缀插入 slash 时，不因 pinia 暂时识别失败而改变 planner 输入语义 ✅

测试文件：`test/blockWriter/mutationPlanner.test.ts`

### 12.2 集成回归

必须覆盖：

1. `/fq`
2. `/yxj`
3. `/jt`
4. `/wc`
5. habit `/dk`
6. TodoSidebar / Calendar / Gantt / Pomodoro / FocusWorkbench 高频入口

每一类测试都应重点断言：

- 最终 plan 数量
- 是否只产生一次 transaction / 一次 API
- 拆分是否符合预期原因
- 不同入口表达同一业务语义时，进入 planner 前的 patch 序列顺序已经被 `Intent Normalize` 收敛一致
- 同次新增多个 marker 时，planner 合并后仍保持 patch 序列决定的新增顺序
- 已有 marker 更新 / 规范化 / 删除后，其余已有 marker 的相对顺序不变
- 重复事项 completed -> createNextOccurrence 时，生成的新事项保持源事项中 `⏰` / `🔁` / `📅` 等已有 marker 的相对顺序，只推进日期/时间值并移除当前完成状态

> 注：集成回归测试需要 SiYuan 运行环境，当前以手动验证为主。

## 13. 实施顺序 ✅ 已完成

1. 在 B 阶段稳定后，新增 `mutationPlanner.ts` ✅
2. 先只接管批量 update patch ✅
3. 再接管 slash cleanup 合并 ✅
4. 再接管 habit / date / status 混合场景 ✅
5. 最后收掉 `index.ts` 中保留的组合特判 ✅

## 14. 与 B 阶段的边界

为了避免 B / C 混在一次重构里，边界明确如下：

### B 阶段负责 ✅ 全部已完成

- 基础流水线
- DOM-first commit
- update / insert 编排一致性
- resolve / load / render / commit 的明确模块化

### C 阶段负责 ✅ 全部已完成

- 批量 patch 通用规划
- 单次 commit 优先
- 最小必要拆分
- `writeBlock()` 入口去特判

## 15. 预期结果 ✅ 全部已达成

C 阶段完成后，`blockWriter` 的预期状态是：

1. 任意批量 patch 默认先尝试单 plan ✅
2. 同目标场景尽可能单次 transaction / 单次 API ✅
3. 入口不再继续堆业务组合特判 ✅
4. planner 成为解释执行行为的唯一规划层 ✅
5. 后续新增 patch 类型时，优先扩展能力模型，而不是继续写"如果 A+B+C"分支 ✅

## 16. 后续增强方向

1. **`MutationExecutionResult`** — 当前 `executePlans()` 返回 `boolean | IResdoOperations[] | null`，可增强为结构化结果类型
2. **集成回归自动化** — §12.2 列出的集成回归测试需要 SiYuan 运行环境，当前以手动验证为主
3. **compat 层清理** — `datePatchWriter.ts` 和 `markdownWriter.ts` 已无外部调用者，可考虑移除
4. **`datePatchRender.ts` 双路径统一** — `addDate` 走独立渲染路径，可考虑统一到 `kramdownModifier.ts`
