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

1. 新增一种批量 patch 组合时，往往需要同时修改 `writeBlock()`、某个专用 writer、调用方和测试。
2. “真实写入目标是谁”这一语义没有独立收口，容易在 transport 或调用方重复判断。
3. 当前设计难以稳定保证 `DOM-first` 提交策略，尤其在 Protyle / API 混合路径中更明显。
4. 插入能力仍然以 API 旁路存在，没有与 update 共享统一的编排模型。

本设计将 `blockWriter` 重构为统一的**块变更编排层**，目标是在不破坏现有调用面的前提下，把 `target resolve`、`source loading`、`transform/render`、`commit` 四类职责从现有特判代码中拆开，并按 **B -> C 两阶段** 演进。最终目标不是为 `/fq`、`/jt`、habit 之类的组合持续加分支，而是让任意批量 patch 都走同一套通用规划与提交流程。

## 2. 设计目标

1. `blockWriter` 继续负责 **target resolve**，调用方不需要自己决定最终写入哪个块。
2. `update` 和 `insert` 进入同一套能力模型，不再是两条各自演化的路径。
3. 所有 commit 路径遵守 **DOM-first, markdown fallback**：
   - `protyleCommitter` 优先基于 DOM transaction；
   - `apiCommitter` 优先 `updateBlock('dom', ...)` / `insertBlock('dom', ...)`。
4. `KramdownModifier` 保持纯函数核心，继续负责统一的内容语义变换。
5. B 阶段先落统一流水线骨架，C 阶段再把任意批量 patch 收敛到通用 mutation planner，消除入口特判。
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

### 4.4 任意批量 patch 优先单次 commit

`blockWriter` 对任意批量 patch 都遵守以下规划原则：

1. 先尝试把整批 patch 解析为**同一目标块、同一 source、同一 commit 方式**；
2. 若条件满足，则优先生成**单次 transaction** 或 **单次 API 请求**；
3. 只有出现真实跨目标、source 冲突、commit 能力冲突时，才拆分为多个 sub-plan；
4. 拆分依据是能力边界，而不是 patch 组合名称。

这条原则适用于：

- `slash + status`
- `slash + addDate`
- `habit + slash`
- 任意未来新增的批量 patch 组合

也就是说，设计目标是**消除组合特判**，而不是把更多组合搬进另一套注册表。

### 4.5 斜杠命令写回后的光标恢复统一采用 `wbr-first`

当前项目在 [`src/utils/blockWriter/protyleTransport.ts`](../../../src/utils/blockWriter/protyleTransport.ts) 中，仍以 `saveCursor()` / `restoreCursor()` 的“保存旧节点引用 + 旧 offset”方式做 best-effort 恢复；测试仅覆盖了 slash 删除后的基本恢复（可见 [`test/blockWriter/protyleTransport.test.ts`](../../../test/blockWriter/protyleTransport.test.ts) 中现有 `restores cursor position after slash deletion` 用例）。

这还不够覆盖“斜杠命令删除后又插入内容”的真实场景。B 阶段设计应显式对齐思源 slash 写回主路径，把 `<wbr>` 作为**唯一主恢复方案**：

1. **当前块 slash 写回一律先生成带 `<wbr>` 的最终 DOM**
   - 适用场景：
     - 仅删除 slash 命令文本
     - 删除 slash 后追加新文本 token
     - 删除 slash 后改写既有 marker，例如日期、提醒、重复规则
     - 删除 slash 后插入结构化 inline 内容，如 tag / block-ref / image placeholder
     - `renderMarkdownIntoBlockEditable()` 或其他 DOM 重建路径
   - 设计要求：
     - 在写入前克隆目标块 DOM，并在预期光标位置插入 `<wbr>`
     - 提交后在新 DOM 中统一通过 `focusByWbr()` 恢复
   - 参考：
     - 思源 `selection.ts` 的 `setInsertWbrHTML()`（约 L539）和 `focusByWbr()`（约 L570）
     - 思源 [`app/src/protyle/hint/index.ts`](C:\dev\projects\open-source\siyuan\app\src\protyle\hint\index.ts) 中 slash 写回路径：
       - 通用 slash 插入前先 `range.deleteContents()`（约 L659 以后）
       - `![]()` 等结构性插入会显式插入 `<wbr>` 并再 `focusByWbr()`（约 L772-L780）
       - 普通 slash 插入结束后也以 `focusByWbr()` 作为默认恢复路径（约 L922 附近的主流程收口）

2. **`removeSlashCommand` 只做 cleanup，不再承载内容语义**
   - 新架构中不再保留 `removeSlashCommand.suffix`
   - 也不做"兼容展开"过渡层
   - 所有 slash 命令都必须显式表达为批量 patch：
     - `/rw` -> `removeSlashCommand` + `setTaskTag`
     - `/jt` -> `removeSlashCommand` + `addDate`
     - `/yxj` -> `removeSlashCommand` + `setPriority`
     - 其他命令同理，由真正的语义 patch 决定最终内容与光标落点
   - slash cleanup 必须只精确删除触发片段本身，并保留其左右两侧文本重新拼接
   - 这条规则对 slash 触发位置透明：
     - 可以发生在正文与 marker cluster 之间
     - 也可以发生在已有 marker 内部
   - 前置校验可以复用这套 cleanup 语义，但不能提前执行真正的 writer commit

3. **恢复目标必须与命令语义一致**
   - 追加新语义单元：
     - 例如 `xxx /rw` -> `xxx 📋|`
     - 光标落在新增内容之后
    - 改写既有 marker：
      - 例如 `评审视觉稿 🌱 📅2026-05-15 ⏰14:00 /jt`
      - 执行后 `评审视觉稿 🌱 📅2026-05-15,2026-05-20 ⏰14:00|`
      - 光标落在当前块末尾
    - 对已有 marker 集合新增优先级：
      - 例如 `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 /yxj`
      - 执行后 `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱|`
      - 不应变成 `评审视觉稿 🌱 📅2026-05-15,2026-05-20 ⏰14:00|`
   - slash 触发位置不改变最终语义结果：
     - 在非已有 marker 外触发：
       - `评审视觉稿 /yxj 📅2026-05-15,2026-05-20 ⏰14:00`
       - 执行后 `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱|`
     - 在已有 marker 内触发：
       - `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0`
       - cleanup 后必须先恢复为 `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00`
       - 再按语义结果写成 `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱|`
   - inline 结构：光标位于新 inline 节点之后，或思源约定的可继续输入位置
   - 带占位符的结构（如图片、代码块等）：光标恢复到思源原生 slash 行为对应的位置，而不是简单回到块尾

4. **失败降级策略**
   - `wbr` 恢复失败 -> 尝试 `focusByOffset()` 等价兜底
   - `offset` 兜底失败 -> 折叠到当前块 editable 末尾
   - 恢复失败不应让写入失败，但必须记录 debug 日志

### 4.6 slash 前置校验的语义回退

当前 Protyle 块中触发的 slash 命令，在执行前往往需要回答两个问题：

1. 当前块是否仍然是有效事项
2. 当前块是否已经包含目标日期 / 时间 / metadata marker

现有 pinia / parser 快照可以作为常规读取来源，但**不能作为唯一真相**。  
原因是 slash 触发片段可能临时插入到 marker 内部，短时间破坏展示文本结构，例如：

```text
评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00
```

如果这时只依赖 pinia 中当前轮解析结果，可能会把当前块误判成“非事项”，提前弹出：

```text
当前块不是有效的事项
```

这不是允许的行为。B 阶段应明确以下规则：

1. **当前块 + 活跃 slash context 时，candidate semantic line 优先**
   - 基于当前 slash range
   - 复用 `removeSlashCommand` 的精确 cleanup 语义
   - 只在内存中删除触发片段本身，不做真实 commit
   - 保留左右文本重新拼接，得到 `candidate semantic line`
2. **candidate semantic line 的事项识别复用 `lineParser.ts`**
   - 事项合法性判断
   - 已有日期 / 时间 / priority / reminder / recurring marker 判断
   - 都应以 candidate semantic line 的解析结果为准
3. **pinia/store 快照只作为次级来源**
   - 没有当前 slash context 时，可以直接使用 pinia/store
   - 有当前 slash context 但 candidate line 无法构造时，可以降级参考 pinia/store
4. **只有两条路径都失败时，才允许提示“当前块不是有效的事项”**
   - pinia/store 快照识别失败
   - candidate semantic line 识别也失败

这条规则的复用边界必须写清：

- 可以复用 block writer 的 slash cleanup 语义
- 可以复用 `lineParser.ts` 的事项解析能力
- 不允许为了前置校验提前调用 `writeBlock({ type: 'removeSlashCommand' })`
- 不允许让 `protyleCommitter.ts` / `apiCommitter.ts` 参与这一步判断

例 1：日期 marker 中间触发优先级命令

```text
评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00
```

candidate semantic line 必须先恢复为：

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00
```

因此它仍然是有效事项，后续 `setPriority(🌱)` 的最终语义结果为：

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱
```

例 2：时间 marker 中间触发优先级命令

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0
```

candidate semantic line 必须先恢复为：

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00
```

然后再继续同一套事项语义判断与最终写回。

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
- 对同一业务语义收敛为一致的 patch 序列顺序；
- 不做目标决策，不读源，不改内容。

这里要额外满足一个顺序不变量：

- 若两个不同入口表达的是同一个业务语义动作，则 `Intent Normalize` 后产出的 patch 序列顺序必须一致
- 不允许 A 入口产出 `addDate -> setPriority`，B 入口产出 `setPriority -> addDate`，再把差异留给后续 renderer / planner
- 因为“多新增 marker 的顺序”已经明确绑定到归一化后的 patch 序列顺序，所以这一步必须先完成跨入口收敛

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
- Protyle 场景同时捕获当前选区快照，用于后续 caret restore；
- API 场景读取目标块 kramdown；
- insert 场景读取 anchor 元信息，但不强依赖当前正文内容。

#### D. Transform + Render

职责：

- update：调用 `KramdownModifier` 产出统一的 `nextMarkdown`，再渲染为 DOM payload；
- insert：由 `InsertPayloadRenderer` 直接准备 DOM-first payload，同时保留 markdown fallback。
- 根据写回方式生成 caret restore plan：
  - 当前块 slash 写回 -> `wbr`
  - 非 slash 且无需恢复光标 -> `none`

这里会同时持有：

- 语义结果：`nextMarkdown`
- 提交结果：`domHtml`
- 光标恢复结果：`caretRestorePlan`

#### E. Commit

职责：

- `protyleCommitter`：优先 transaction 提交 DOM；
- `apiCommitter`：优先 `updateBlock('dom', ...)` / `insertBlock('dom', ...)`；
- 在 DOM 提交不可用时，执行 markdown fallback。
- 对当前 Protyle 目标块执行最终 caret restore。

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
      resultMode: 'boolean' | 'operations'
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
      commitKind: 'api-insert' | 'protyle-insert'
      preferDataType: 'dom'
      fallbackDataType: 'markdown'
      patch: InsertableBlockPatch
      context?: Partial<BlockWriteContext>
      resultMode: 'boolean' | 'operations'
    }
```

关键点：

- `targetBlockId` 不再只是 API transport 的概念；
- `sourceKind` 和 `commitKind` 在 resolve 阶段就被明确，不允许后置层再次猜测；
- `preferDataType` 固定为 `'dom'`。

### 6.3 Source 快照

```ts
type CaretSnapshot =
  | {
      policy: 'wbr-first'
      containerBlockId: string
      clonedHtmlWithWbr: string
      fallbackOffset?: {
        start: number
        end: number
      }
    }
  | {
      policy: 'none'
    }

type LoadedMutationSource =
  | {
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

### 6.4 渲染结果

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

type PreparedMutationPayload =
  | {
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

#### 7.1.1 已有 marker 集合的稳定顺序

对于已经包含 metadata marker 的事项行，新 patch 不得因为 commit 路径不同而改变任何**已有 marker** 的相对顺序。

明确规则：

1. 事项正文与其 trailing marker 视为两段：
   - 正文内容
   - metadata marker cluster
2. 对**已存在**的 marker 做 patch 时，应在该 marker 的原位置完成更新，而不是先抽出后重排。
3. 对已存在 marker 的等价规范化允许发生，但只能在**原位置**完成：
   - 允许改“写法”，例如 `@2026-05-15` -> `📅2026-05-15`
   - 允许改“写法”，例如 `#done` -> `✅`
   - 不允许借规范化改变该 marker 与其他已有 marker 的相对顺序
4. 对**不存在**的 marker 做 patch 时，只允许作为新增 marker 追加到当前 marker cluster；追加动作不得改变任何已有 marker 的相对顺序。
5. 若同一次 `writeBlock()` 同时新增多个此前不存在的 marker，则这些**新增 marker** 的相对顺序以归一化后的 patch 序列顺序为准：
   - planner 可以合并多个 patch
   - 但不得改变这些新增 marker 在 patch 序列中的先后
   - 若原行没有任何 marker，则应先在正文尾部创建 marker cluster，再按该顺序依次追加
6. 删除某个 marker 时，也只移除该 marker 本身；其余已有 marker 的相对顺序保持不变。
7. slash 命令的触发位置不参与最终 marker 顺序决策：
   - 触发发生在正文区，只影响 cleanup 的局部删除
   - 触发发生在 marker 内部，也只影响 cleanup 的局部删除
   - cleanup 完成后，最终结果仍按同一套“已有 marker 原位更新、新 marker 追加、已有顺序不变”的规则重建

这是一条通用规则，不是 `setPriority` 特例。

例 1：新增一个此前不存在的 marker

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00
-> setPriority(🌱)
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱
```

而不是：

```text
评审视觉稿 🌱 📅2026-05-15,2026-05-20 ⏰14:00
```

更不允许把任何已有 marker 对调成：

```text
评审视觉稿 ⏰14:00 📅2026-05-15,2026-05-20 🌱
```

例 2：更新一个已存在的 marker

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00
-> updateTime(16:00)
评审视觉稿 📅2026-05-15,2026-05-20 ⏰16:00
```

这里 `⏰` 只是在原位更新，不能因为更新时间而跑到 `📅` 前面，也不能触发其他已有 marker 的重排。

例 3：同一次写入新增多个 marker

```text
评审视觉稿
-> addDate(2026-05-15) + setPriority(🌱)
评审视觉稿 📅2026-05-15 🌱
```

这里 `📅` 与 `🌱` 都是新增 marker，因此两者之间的顺序由 patch 序列顺序决定；一旦生成后，后续更新又必须继续保持这个相对顺序稳定。

例 4：重复事项完成后创建下一条事项

```text
填工时 ⏰17:01 🔁工作日 📅2026-05-18 17:00:00~18:00:00 ✅
-> completeAndCreateNextOccurrence()
填工时 ⏰17:01 🔁工作日 📅2026-05-19 17:00:00~18:00:00
```

这里新生成的 occurrence 虽然推进了日期，并移除了当前完成状态，但其余已有 marker 的相对顺序必须继承源事项：

- `⏰17:01`
- `🔁工作日`
- `📅2026-05-19 17:00:00~18:00:00`

不允许在生成下一条事项时把它们重排成：

```text
填工时 📅2026-05-19 17:00:00~18:00:00 ⏰17:01 🔁工作日
```

也就是说，“重复事项创建下一条 occurrence” 不是重新按某个固定模板拼接 marker，而是基于源事项既有 marker 顺序，做“移除当前完成状态 + 推进日期/时间值”的语义更新。

这条规则同时约束：

- `updateRenderer.ts`
- `protyleCommitter.ts`
- `apiCommitter.ts`

也就是说，marker 顺序必须在语义层先被确定，再由两个 committer 提交同一份结果；不允许某个 committer 再做任何 transport-specific 的 marker 重排、前插、后插、抽出后回填。

这同样意味着：

- `评审视觉稿 /yxj 📅2026-05-15,2026-05-20 ⏰14:00`
- `评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0`

若两者触发的是同一个“设置优先级”为 `🌱` 的语义命令，则最终都必须收敛为同一个结果：

```text
评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:00 🌱
```

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
  caretController.ts
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
- `caretController.ts` 负责 current Protyle 选区快照与恢复，以 `wbr-first` 为主路径并保留 `offset` 兜底；
- `apiTransport.ts` -> `apiCommitter.ts`
- `protyleTransport.ts` -> `protyleCommitter.ts`
- `blockTargetResolver.ts` -> `targetResolver.ts`
- `markdownWriter.ts` 的 source/render 能力分别迁入 `sourceLoader.ts` 与 `updateRenderer.ts`

### 8.3 B 阶段迁移顺序

1. 抽 `intent.ts`，统一 update / insert 意图。
2. 抽 `targetResolver.ts`，先把现有 `resolveApiBlockTarget` 扩成统一 resolver。
3. 抽 `sourceLoader.ts`，收敛当前 DOM / API Kramdown 读取逻辑。
4. 抽 `caretController.ts`，统一 current Protyle 选区快照与恢复。
5. 抽 `updateRenderer.ts` 与 `insertRenderer.ts`，统一准备 DOM-first payload 与 caret restore plan。
6. 把 `apiTransport.ts` / `protyleTransport.ts` 收缩成纯 committer。
7. 让 `index.ts` 仅负责 orchestration。
8. 逐步把 `datePatchWriter.ts` / `statusPatchWriter.ts` 改造成 helper。

## 9. C 阶段摘要

本 spec 以 B 阶段为主，即先完成统一流水线骨架与 DOM-first commit 收口。

C 阶段单独拆分为专用 spec：

- [`docs/superpowers/specs/2026-05-20-block-writer-phase-c-planner-design.md`](./2026-05-20-block-writer-phase-c-planner-design.md)

C 阶段的核心目标不再是“给不同组合 patch 继续加策略分支”，而是：

> 注：`mutationPlanner.ts` 已在 B 阶段实现中提前落地，C 阶段 spec 需据此更新。

1. 引入通用 `mutation planner`
2. 让任意批量 patch 优先合并成单次 transaction / 单次 API
3. 仅在真实跨目标或 source / commit 能力冲突时按最小必要拆分
4. 让 `writeBlock()` 最终退化为 planner 驱动的薄执行入口

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
- 任意批量 patch 是否允许在当前目标块单次 DOM commit

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
- marker 顺序重排

### 10.4 `protyleTransport.ts`

迁移为 `protyleCommitter.ts`。

它只负责：

- 基于 DOM 结果执行 transaction
- 维护旧 HTML / 新 HTML 提交
- 必要的 updated attr / 光标恢复 / DOM 标准化

不再负责：

- 自己决定 patch 类型是否该走它
- 自己从业务层推导真实目标块
- 自己决定 metadata marker 的插入顺序

其中光标恢复要求是：

- 当前块 slash 写回统一优先走 `<wbr>` + `focusByWbr` 等价机制
- `focusByOffset` 仅作为 `wbr` 丢失时的兜底恢复，不再作为主路径
- 当前 `saveCursor()` / `restoreCursor()` 的旧节点引用方式仅视为过渡实现，不作为最终设计

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
2. 其次尽可能合并成单次 commit；
3. 再保证 DOM-first；
4. 最后才是 markdown fallback。

### 11.2 Update fallback

- 当前块 DOM 源不可用 -> 回退 API source
- DOM 渲染失败 -> 回退 markdown commit
- 当前块与目标块不匹配 -> 禁止误用当前 DOM，回退 API
- 任务块结构不满足安全更新条件 -> 回退 API
- 整批 patch 无法共享同一 target/source/commit -> 按最小拆分原则拆成多个 plan

### 11.3 Insert fallback

- DOM payload 生成失败 -> 回退 markdown insert
- 当前阶段无 Protyle insert 能力 -> 直接走 API insert

### 11.4 明确禁止的行为

1. Commit 层根据 patch 类型临时改写 target。
2. Source 层根据提交失败结果反向修改 resolve 决策。
3. 调用方绕过 `blockWriter` 自己处理最终 target，再把半成品结果交给 committer。
4. `protyleCommitter.ts` 与 `apiCommitter.ts` 输出不同的 marker 顺序。

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
- `/yxj`
- `/jt`
- `/wc`
- habit `/dk`
- TodoSidebar / Calendar / Gantt / Pomodoro / FocusWorkbench 等高频入口
- 斜杠删除后追加内容 token 的光标恢复
- 斜杠删除后触发结构性 inline/DOM 写回的光标恢复

### 12.3 关键断言

1. 任务块完成事项仍写 `NodeListItem`，而不是错误追加 `✅`。
2. 任意同目标批量 patch 组合优先单次 transaction / 单次 API。
3. 只有跨目标或 commit/source 能力冲突时，才发生最小必要拆分。
4. 非当前目标块更新不会误用当前 DOM。
5. `removeSlashCommand` 不再携带 `suffix`，slash 命令插入内容必须通过显式语义 patch 表达（如 `setTaskTag`、`setPriority`、`addDate`）。
6. 结构性 slash 插入或 render 后光标按 `wbr` 语义恢复，而不是简单回到旧 text node。
7. 对已存在 marker 的更新只允许原位生效；允许规范化写法，但不允许改变它与其他已有 marker 的相对顺序。
8. 删除某个 marker 时，其余已有 marker 顺序保持不变。
9. 同一次写入新增多个 marker 时，新增 marker 的相对顺序由归一化后的 patch 序列顺序决定。
10. 重复事项完成后创建下一条 occurrence 时，生成的新事项必须继承源事项中 reminder / recurring / date 等已有 marker 的相对顺序；只允许推进日期/时间值并移除当前完成状态，不允许按固定模板重排 marker。
11. `protyleCommitter.ts` 与 `apiCommitter.ts` 对同一 patch 序列产出相同的 marker 顺序。
12. insert 默认走 DOM-first API。
13. DOM 不可用时 markdown fallback 语义不变。

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

进入 C 阶段，按独立 spec 引入通用 mutation planner，替换入口特判。

## 14. 预期结果

重构完成后，`blockWriter` 应表现为：

1. 对调用方暴露稳定、薄的写入 API；
2. 在内部明确区分 intent / resolve / source / render / commit；
3. 对 update 和 insert 使用统一编排模型；
4. 对 Protyle 与 API 提交都保持 DOM-first；
5. 让新写入场景优先通过通用 planner 与能力扩展落地，而不是继续堆叠入口特判。

## 15. 与现有文档关系

本设计是对以下文档的增量收敛与替代：

- [`docs/superpowers/specs/2026-05-14-block-writer-design.md`](./2026-05-14-block-writer-design.md)
- [`docs/block-writer-architecture.html`](../../block-writer-architecture.html)
- [`docs/superpowers/specs/2026-05-20-block-writer-phase-c-planner-design.md`](./2026-05-20-block-writer-phase-c-planner-design.md)

其中：

- `2026-05-14-block-writer-design.md` 主要聚焦“统一块写入入口”的第一轮收口；
- `block-writer-architecture.html` 主要描述当前实现现状与问题分布；
- 本文档负责定义下一轮正式重构的目标边界、核心类型与阶段性迁移方案。
