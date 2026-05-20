# BlockWriter 流水线重构设计

> 日期：2026-05-20
> 状态：待评审
> 范围：`src/utils/blockWriter/` 架构重构

## 1. 概述

当前 `blockWriter` 已经承担了项目内大部分块写入职责，但其职责边界仍然混杂：

- `writeBlock()` 同时承担公开入口、组合 patch 特判、Protyle/API 路由；
- `datePatchWriter.ts`、`statusPatchWriter.ts`、`markdownWriter.ts`、`protyleTransport.ts`、`apiTransport.ts` 都带有不同程度的目标块决策与提交逻辑；
- `update` 与 `insert` 没有纳入同一套能力模型；
- 任务块、普通段落、habit 记录、slash 命令、跨块写入的差异处理散落在多个层级。

这导致几个直接问题：

1. 新增一种组合 patch 时，往往需要同时修改 `writeBlock()`、某个专用 writer、调用方和测试。
2. “真实写入目标是谁”这一语义没有独立收口，容易在 transport 或调用方重复判断。
3. 当前设计难以稳定保证 `DOM-first` 提交策略，尤其在 Protyle / API 混合路径中更明显。
4. 插入能力仍然以 API 旁路存在，没有与 update 共享统一的编排模型。

本设计将 `blockWriter` 重构为统一的**块变更编排层**，目标是在不破坏现有调用面的前提下，把 `target resolve`、`source loading`、`transform/render`、`commit` 四类职责从现有特判代码中拆开，并按 **B -> C 两阶段** 演进。

## 2. 设计目标

1. `blockWriter` 继续负责 **target resolve**，调用方不需要自己决定最终写入哪个块。
2. `update` 和 `insert` 进入同一套能力模型，不再是两条各自演化的路径。
3. 所有 commit 路径遵守 **DOM-first, markdown fallback**：
   - `protyleCommitter` 优先基于 DOM transaction；
   - `apiCommitter` 优先 `updateBlock('dom', ...)` / `insertBlock('dom', ...)`。
4. `KramdownModifier` 保持纯函数核心，继续负责统一的内容语义变换。
5. B 阶段先落统一流水线骨架，C 阶段再把入口特判迁移到策略注册表。
6. 新架构需要同时覆盖事项与习惯写入，而不是只服务某一类业务对象。

## 3. 非目标

1. 本次设计不要求在 B 阶段一次性删除所有专用 writer。
2. 本次设计不要求在 B 阶段实现 Protyle 相邻块插入能力。
3. 本次设计不改变外部业务语义，例如完成事项、放弃事项、日期追加、habit 打卡的最终表现。
4. 本次设计不重写 parser，不调整既有事项/习惯的数据模型。
5. 不在第一阶段追求“零 fallback”；markdown fallback 仍然保留，用于 DOM 渲染失败或上下文不足场景。

## 4. 约束与已确认决策

### 4.1 `blockWriter` 负责 target resolve

`blockWriter` 必须统一决定：

- 真实目标块 ID；
- 目标块类型（paragraph / task-list-item / block）；
- 源内容从当前 Protyle DOM 还是 API Kramdown 获取；
- 提交走 Protyle transaction 还是 API；
- 是否允许 DOM-first 提交。

调用方不再显式传递“最终要写的父块/列表项块”，除非场景本身天然就是 insert anchor。

### 4.2 Commit 一律 DOM-first

无论是 update 还是 insert，都遵守以下优先级：

1. 先准备 DOM payload；
2. 如果 DOM payload 可用，则优先提交 DOM；
3. 只有 DOM payload 缺失或渲染失败时才回退 markdown。

这条规则同时约束：

- `protyleCommitter.ts`
- `apiCommitter.ts`
- `insert` 与 `update` 两类变更

### 4.3 Insert 进入同一套流水线

插入能力不是附属工具，而是 `blockWriter` 编排能力的一部分。

但在 B 阶段，插入仍以 API commit 为主，不额外扩展 Protyle 相邻块插入。也就是说：

- `insert` 会纳入统一的 intent / resolve / render / commit 模型；
- 其默认 commit 目标仍然是 API insert；
- 未来若补 Protyle insert，只扩 Commit 层，不重写前置层。

## 5. 总体架构

### 5.1 统一流水线

```text
Public API
  -> Intent Normalize
  -> Resolve Target
  -> Load Source
  -> Transform + Render
  -> Commit (DOM-first)
```

相较于“Transport / Core / Commit”的三段式，这里显式增加了两个独立阶段：

- `Intent Normalize`：统一 update / insert 的内部语义；
- `Resolve Target`：把真实写入目标决策从 transport 中剥离出来。

### 5.2 五层职责说明

#### A. Intent Normalize

职责：

- 收敛公开调用入口；
- 把单 patch、批量 patch、insert request 标准化为统一意图模型；
- 不做目标决策，不读源，不改内容。

#### B. Resolve Target

职责：

- 决定真实写入目标；
- 决定使用 `protyle-dom` 还是 `api-kramdown` 作为 source；
- 决定当前提交应走 `protyle-update`、`api-update` 还是 `api-insert`；
- 输出 `DOM-first` / `markdown fallback` 能力声明。

这是整个设计里最重要的新增边界。

#### C. Load Source

职责：

- 基于 resolve 结果加载可变更的源内容；
- Protyle 场景读取当前 DOM、旧 HTML、当前 markdown；
- API 场景读取目标块 kramdown；
- insert 场景读取 anchor 元信息，但不强依赖当前正文内容。

#### D. Transform + Render

职责：

- update：调用 `KramdownModifier` 产出统一的 `nextMarkdown`，再渲染为 DOM payload；
- insert：由 `InsertPayloadRenderer` 直接准备 DOM-first payload，同时保留 markdown fallback。

这里会同时持有：

- 语义结果：`nextMarkdown`
- 提交结果：`domHtml`

#### E. Commit

职责：

- `protyleCommitter`：优先 transaction 提交 DOM；
- `apiCommitter`：优先 `updateBlock('dom', ...)` / `insertBlock('dom', ...)`；
- 在 DOM 提交不可用时，执行 markdown fallback。

Commit 层只关心“如何提交”，不再负责业务判断。

## 6. 核心类型设计

### 6.1 统一意图

```ts
type BlockMutationIntent =
  | {
      kind: 'update'
      context: BlockWriteContext
      patches: BlockPatch[]
    }
  | {
      kind: 'insertAfter'
      anchorBlockId: string
      patch: InsertableBlockPatch
      context?: Partial<BlockWriteContext>
    }
```

保留现有公开 API：

- `writeBlock(context, patchOrPatches)`
- `insertBlockAfter(anchorBlockId, patch)`
- `insertBlockAfterWithResult(anchorBlockId, patch)`

但内部都先归一到 `BlockMutationIntent`。

### 6.2 Resolve 结果

```ts
type ResolvedMutationPlan =
  | {
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
      commitKind: 'api-insert' | 'protyle-insert'
      preferDataType: 'dom'
      fallbackDataType: 'markdown'
      patch: InsertableBlockPatch
      context?: Partial<BlockWriteContext>
    }
```

关键点：

- `targetBlockId` 不再只是 API transport 的概念；
- `sourceKind` 和 `commitKind` 在 resolve 阶段就被明确，不允许后置层再次猜测；
- `preferDataType` 固定为 `'dom'`。

### 6.3 Source 快照

```ts
type LoadedMutationSource =
  | {
      kind: 'update'
      targetBlockId: string
      currentMarkdown: string
      currentDomHtml?: string
      targetElement?: HTMLElement
      extra?: {
        listItemElement?: HTMLElement
        paragraphElement?: HTMLElement
      }
    }
  | {
      kind: 'insertAfter'
      anchorBlockId: string
    }
```

### 6.4 渲染结果

```ts
type PreparedMutationPayload =
  | {
      kind: 'update'
      targetBlockId: string
      nextMarkdown: string
      preferredDataType: 'dom'
      domHtml?: string
      fallbackMarkdown: string
      oldDomHtml?: string
      targetElement?: HTMLElement
    }
  | {
      kind: 'insertAfter'
      anchorBlockId: string
      preferredDataType: 'dom'
      domHtml?: string
      fallbackMarkdown: string
    }
```

这个类型明确体现了“语义层结果”和“提交层结果”是两个概念：

- `nextMarkdown` 是 update 的 canonical 语义结果；
- `domHtml` 是 commit 的优先提交载荷。

## 7. Update 与 Insert 的分工

### 7.1 Update：Kramdown 语义统一，DOM 提交优先

update 路径分为两类：

#### 当前 Protyle 目标块

1. 从 DOM 读取当前 markdown；
2. 应用 patch 得到 `nextMarkdown`；
3. 渲染回 DOM；
4. 通过 Protyle transaction 提交。

#### API-only 或非当前目标块

1. 从 `getBlockKramdown` 读取 `currentMarkdown`；
2. 应用 patch 得到 `nextMarkdown`；
3. 尽可能生成 `domHtml`；
4. 优先 `updateBlock('dom', domHtml, id)`；
5. 失败时回退 `updateBlock('markdown', nextMarkdown, id)`。

因此 update 的语义核心仍然是 markdown，但提交形式统一是 DOM-first。

### 7.2 Insert：独立 renderer，DOM-first

insert 不进入 `KramdownModifier`。

原因：

- update 是“已有块内容变更”；
- insert 是“新块载荷构建”；
- 两者在 transform 语义上不同，不应强行共用同一实现。

insert 采用独立 `InsertPayloadRenderer`：

1. 根据 `InsertableBlockPatch` 生成 markdown；
2. 尽可能同步生成 DOM payload；
3. commit 时优先 `insertBlock('dom', domHtml, ...)`；
4. 失败时回退 `insertBlock('markdown', markdown, ...)`。

## 8. B 阶段设计

### 8.1 目标

B 阶段只做“统一流水线骨架”，不急于把所有逻辑一次性平铺。

达成标准：

1. `writeBlock` / `insertBlockAfter` 共享同一套 orchestration 主骨架；
2. `target resolve` 从 transport 和专用 writer 中抽出；
3. `apiCommitter` / `protyleCommitter` 变成纯提交层；
4. 专用 writer 降级为 helper，而不是完整链路拥有者。

### 8.2 建议模块

```text
src/utils/blockWriter/
  index.ts
  intent.ts
  targetResolver.ts
  sourceLoader.ts
  updateRenderer.ts
  insertRenderer.ts
  apiCommitter.ts
  protyleCommitter.ts
  kramdownModifier.ts
  kramdownBlocks.ts
  types.ts
  datePatchWriter.ts
  statusPatchWriter.ts
```

说明：

- `datePatchWriter.ts`、`statusPatchWriter.ts` 在 B 阶段可以保留；
- 但它们应只保留特殊 helper 逻辑，不再同时承担 resolve/source/commit；
- `apiTransport.ts` -> `apiCommitter.ts`
- `protyleTransport.ts` -> `protyleCommitter.ts`
- `blockTargetResolver.ts` -> `targetResolver.ts`
- `markdownWriter.ts` 的 source/render 能力分别迁入 `sourceLoader.ts` 与 `updateRenderer.ts`

### 8.3 B 阶段迁移顺序

1. 抽 `intent.ts`，统一 update / insert 意图。
2. 抽 `targetResolver.ts`，先把现有 `resolveApiBlockTarget` 扩成统一 resolver。
3. 抽 `sourceLoader.ts`，收敛当前 DOM / API Kramdown 读取逻辑。
4. 抽 `updateRenderer.ts` 与 `insertRenderer.ts`，统一准备 DOM-first payload。
5. 把 `apiTransport.ts` / `protyleTransport.ts` 收缩成纯 committer。
6. 让 `index.ts` 仅负责 orchestration。
7. 逐步把 `datePatchWriter.ts` / `statusPatchWriter.ts` 改造成 helper。

## 9. C 阶段设计

### 9.1 目标

C 阶段的目标是去掉 `writeBlock()` 中不断增长的 if/else 特判，把组合逻辑迁入策略注册表。

### 9.2 策略注册表

```ts
interface BlockMutationStrategy {
  name: string
  matches(intent: BlockMutationIntent): boolean
  execute(intent: BlockMutationIntent): Promise<boolean>
}
```

策略示例：

- `slashStatusStrategy`
- `slashDateStrategy`
- `statusStrategy`
- `dateStrategy`
- `habitStrategy`
- `insertStrategy`

### 9.3 C 阶段收益

1. `/fq`、`/jt`、`/wc`、habit 等组合特判不再堆在入口文件。
2. 新增组合 patch 不再必须直接修改 `writeBlock()` 主分支。
3. 策略的匹配条件和执行行为能被单独测试。

## 10. 现有文件迁移策略

### 10.1 `index.ts`

目标：

- 从“复杂路由器”变成“薄 orchestration 入口”
- 只做：
  - normalize intent
  - resolve target
  - load source
  - transform/render
  - commit

### 10.2 `blockTargetResolver.ts`

迁移为 `targetResolver.ts`，成为统一的真实目标解析器。

它需要收编的语义包括：

- `setStatus` 对任务块写 `NodeListItem`
- paragraph / list item / block 的真实目标识别
- 当前 Protyle 块与目标块是否一致
- slash/habit/date/status 组合路径是否允许当前块 DOM commit

### 10.3 `apiTransport.ts`

迁移为 `apiCommitter.ts`。

它只负责：

- `updateBlock('dom', ...)`
- `updateBlock('markdown', ...)`
- `insertBlock('dom', ...)`
- `insertBlock('markdown', ...)`

不再负责：

- target resolve
- patch 语义推断
- 业务级 fallback 策略判断

### 10.4 `protyleTransport.ts`

迁移为 `protyleCommitter.ts`。

它只负责：

- 基于 DOM 结果执行 transaction
- 维护旧 HTML / 新 HTML 提交
- 必要的 updated attr / 光标恢复 / DOM 标准化

不再负责：

- 自己决定 patch 类型是否该走它
- 自己从业务层推导真实目标块

### 10.5 `markdownWriter.ts`

拆分为两部分：

- 当前块 source 读取逻辑 -> `sourceLoader.ts`
- markdown -> DOM draft 的更新渲染逻辑 -> `updateRenderer.ts`

### 10.6 `datePatchWriter.ts` / `statusPatchWriter.ts`

阶段性保留，但在 B 阶段后应该只保留：

- 特殊 source 选择 helper
- 特殊 slash context helper
- 特殊 date/status 语义 helper

它们不再各自拥有完整写入链路。

## 11. 错误处理与 fallback 规则

### 11.1 总原则

1. 优先保证目标正确；
2. 其次保证 DOM-first；
3. 最后才是 markdown fallback。

### 11.2 Update fallback

- 当前块 DOM 源不可用 -> 回退 API source
- DOM 渲染失败 -> 回退 markdown commit
- 当前块与目标块不匹配 -> 禁止误用当前 DOM，回退 API
- 任务块结构不满足安全更新条件 -> 回退 API

### 11.3 Insert fallback

- DOM payload 生成失败 -> 回退 markdown insert
- 当前阶段无 Protyle insert 能力 -> 直接走 API insert

### 11.4 明确禁止的行为

1. Commit 层根据 patch 类型临时改写 target。
2. Source 层根据提交失败结果反向修改 resolve 决策。
3. 调用方绕过 `blockWriter` 自己处理最终 target，再把半成品结果交给 committer。

## 12. 测试策略

### 12.1 单元测试

重点覆盖：

- `intent.ts`
- `targetResolver.ts`
- `sourceLoader.ts`
- `updateRenderer.ts`
- `insertRenderer.ts`
- `apiCommitter.ts`
- `protyleCommitter.ts`

### 12.2 策略/回归测试

重点覆盖：

- `/fq`
- `/jt`
- `/wc`
- habit `/dk`
- TodoSidebar / Calendar / Gantt / Pomodoro / FocusWorkbench 等高频入口

### 12.3 关键断言

1. 任务块完成事项仍写 `NodeListItem`，而不是错误追加 `✅`。
2. 当前块 slash + status/date 组合路径优先单次 transaction。
3. 非当前目标块更新不会误用当前 DOM。
4. insert 默认走 DOM-first API。
5. DOM 不可用时 markdown fallback 语义不变。

## 13. 实施顺序建议

### 第一批

先完成 B 阶段基础设施：

1. `intent.ts`
2. `targetResolver.ts`
3. `sourceLoader.ts`
4. `updateRenderer.ts`
5. `insertRenderer.ts`
6. `apiCommitter.ts`
7. `protyleCommitter.ts`

### 第二批

接入现有 update/insert 入口：

1. `writeBlock()`
2. `insertBlockAfter()`
3. `insertBlockAfterWithResult()`

### 第三批

逐步下沉旧 writer：

1. `statusPatchWriter.ts`
2. `datePatchWriter.ts`
3. `markdownWriter.ts`

### 第四批

进入 C 阶段，替换入口特判为策略注册表。

## 14. 预期结果

重构完成后，`blockWriter` 应表现为：

1. 对调用方暴露稳定、薄的写入 API；
2. 在内部明确区分 intent / resolve / source / render / commit；
3. 对 update 和 insert 使用统一编排模型；
4. 对 Protyle 与 API 提交都保持 DOM-first；
5. 让新组合写入场景以“新增策略或 helper”的方式扩展，而不是继续堆叠入口特判。

## 15. 与现有文档关系

本设计是对以下文档的增量收敛与替代：

- [`docs/superpowers/specs/2026-05-14-block-writer-design.md`](./2026-05-14-block-writer-design.md)
- [`docs/block-writer-architecture.html`](../../block-writer-architecture.html)

其中：

- `2026-05-14-block-writer-design.md` 主要聚焦“统一块写入入口”的第一轮收口；
- `block-writer-architecture.html` 主要描述当前实现现状与问题分布；
- 本文档负责定义下一轮正式重构的目标边界、核心类型与阶段性迁移方案。
