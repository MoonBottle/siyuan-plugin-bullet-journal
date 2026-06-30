# BlockWriter：统一块写入层设计

## 1. 背景与问题

Task Assistant 当前有三类写入路径混用：

| 路径                    | 位置                                                                                           | 特点                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| DOM 直接修改            | `src/utils/slashCommands.ts` 的 `deleteSlashCommandContent`                                    | 直接改当前文本节点，再提交 `protyle.transaction()`                |
| ProtyleWriter 快/慢路径 | `src/utils/slashCommands.ts` 的 `createProtyleWriter`                                          | 单行同块走 DOM 快路径，复杂情况等待事务队列后走 `updateBlock` API |
| API 写入                | `src/utils/fileUtils.ts` 的 `updateBlockDateTime`、`updateBlockContent`、`updateBlockPriority` | 读取 kramdown，按行重建后调用 `/api/block/updateBlock`            |

这些路径已经累积出几个具体问题：

1. 父块/列表项定位逻辑在日期、内容、优先级更新中重复实现。
2. kramdown 字符串修改分散，容易丢失块属性、番茄钟附属行、任务列表状态。
3. Protyle 正在累积事务时直接调 `updateBlock` API，可能与编辑器事务队列发生 write-after-write 竞争。
4. 斜杠命令删除依赖全局文本替换，和思源原生基于 Range 的精确删除语义不一致。

## 2. 思源源码约束

本设计必须显式遵守以下思源源码约束，而不是只按当前插件代码抽象。

### 2.1 任务列表状态更新目标是 `NodeListItem`

思源 checkbox 点击逻辑位于 [`app/src/protyle/wysiwyg/index.ts`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/wysiwyg/index.ts#L3009-L3067)。当点击任务列表 checkbox 时，源码更新的是 `actionElement.parentElement`，即任务列表项 DOM (`<li>`)，并以 `actionId` 提交事务：

```ts
// L3054: actionElement.classList.contains("protyle-action--task")
// L3056: const html = actionElement.parentElement.outerHTML  (旧值快照)
// L3060/L3064: actionElement.parentElement.setAttribute("data-task", " "/"X")
// L3066: actionElement.parentElement.setAttribute("updated", ...)
// L3067: updateTransaction(protyle, actionId, actionElement.parentElement.outerHTML, html)
```

关键发现：

- `data-task` 取值：`" "` (空格) = `[ ]` 未完成，`"X"` = `[x]` 已完成
- CSS 类 `protyle-task--done` 同步切换（L3057-L3064）
- `actionId` 来自 L3020: `actionElement.parentElement.getAttribute("data-node-id")` — 即 `<li>` 的块 ID

因此 `setStatus` 在任务列表场景必须写 `NodeListItem`，不能只写其内部 paragraph。

### 2.2 `updateBlock(markdown)` 对 `NodeListItem` 有特殊处理

思源 kernel 的 [`kernel/api/block_op.go`](file:///C:/dev/projects/open-source/siyuan/kernel/api/block_op.go#L786-L885) `updateBlock` 函数（L786-L885），在目标块是 `NodeListItem` 且 markdown 解析结果是 `NodeList` 时，会剥离 list wrapper（L850-L856）：

```go
// L850-L856: 解决 GitHub issue #4658
if "NodeListItem" == block.Type && ast.NodeList == tree.Root.FirstChild.Type {
    tree.Root.AppendChild(tree.Root.FirstChild.FirstChild) // 列表项提到 Root 下
    tree.Root.FirstChild.Unlink()                          // 删除 NodeList 容器
    if nil != tree.Root.FirstChild && ast.NodeKramdownBlockIAL == tree.Root.FirstChild.Type {
        tree.Root.FirstChild.Unlink()                      // 删除残留列表 IAL
    }
}
// L859-L864: 只强制保留目标块 id，其他自定义 IAL 属性由 markdown 中携带
tree.Root.FirstChild.SetIALAttr("id", id)
```

结论：

- API Transport 可以更新 `NodeListItem`，但 kernel 剥离 list wrapper 的逻辑意味着传入 markdown **不应**包含 `<ul>/<ol>` 容器层。
- kernel 只强制保留目标块 `id`（L859-L864），其他自定义 IAL 属性（`custom-reminder` 等）**必须由插件保留在传入的 markdown 中**。

### 2.3 `getBlockKramdown` 输出包含目标节点与其 IAL

思源 [`kernel/model/block.go`](file:///C:/dev/projects/open-source/siyuan/kernel/model/block.go#L1039-L1055) `getBlockKramdown0`（L1039-L1055）会先调用 `addBlockIALNodes`（位于 [`kernel/model/template.go`](file:///C:/dev/projects/open-source/siyuan/kernel/model/template.go#L501-L533)，L501-L533），然后把目标节点和其后的 IAL 节点挂到临时 root 导出：

```go
// L1039-L1055: getBlockKramdown0
addBlockIALNodes(tree, false)                          // → template.go L501-L533
node := treenode.GetNodeInTree(tree, id)
root := &ast.Node{Type: ast.NodeDocument}
root.AppendChild(node.Next) // IAL node (sibling, inserted by addBlockIALNodes)
root.PrependChild(node)     // target node
ret = treenode.ExportNodeStdMd(root, luteEngine)       // → node.go L155-L162
```

`addBlockIALNodes` 的内部逻辑（template.go L501-L533）：

1. AST Walk 遍历所有块节点
2. 对有 `KramdownIAL` 的节点，通过 `InsertAfter()` 在其后插入 `NodeKramdownBlockIAL` sibling
3. IAL tokens 由 `parse.IAL2Tokens(block.KramdownIAL)` 序列化，格式为 `{: key1="val1" key2="val2"}`

结论：

- 设计不能假设 IAL 总是行内 `- {: id="..."}[ ] 内容`。`getBlockKramdown` 的真实输出是：**内容行 + trailing IAL 行**。
- Modifier 必须支持并优先测试真实形态：

```markdown
- [ ] 任务内容 📅2026-05-14
      {: id="20260514120000-abc" custom-reminder="..."}

```

### 2.4 Protyle DOM 写入应优先沿用 `SpinBlockDOM`

思源前端在大量现有块 DOM 修改后提交事务的路径中使用 `protyle.lute.SpinBlockDOM(nodeElement.outerHTML)` 规范化 DOM，再调用 `updateTransaction`。在 [`app/src/protyle/hint/index.ts`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts) 中至少 7 处调用 `SpinBlockDOM`：

| 行号                                                                                  | 场景                    |
| ------------------------------------------------------------------------------------- | ----------------------- |
| [L115](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L115) | emoji 面板点击插入      |
| [L636](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L636) | 冒号触发 emoji          |
| [L776](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L776) | 图片 `![]()` slash 输入 |
| [L807](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L807) | 空段落转表格等          |
| [L820](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L820) | 通用文本/`<div>` 插入   |

结论：

- Protyle Transport 不应默认做 `BlockDOM2StdMd → Md2BlockDOM` 往返；该路径可能重排 DOM、IAL、内联结构。
- Protyle 快路径应做 DOM/text 最小修改，然后 `SpinBlockDOM` 规范化并提交事务。
- kramdown Modifier 是 API Transport 的核心，不是所有 Protyle 写入的唯一实现。

### 2.5 斜杠命令删除应保留 Range/offset 语义

思源 slash hint 的删除基于 `getKey()` 计算的 `lastIndex` 和当前 `Range`：

- [`getKey()`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L1037-L1083)（L1037-L1083）：遍历所有扩展键（`/`, `#`, `:`, `((`），对每个键调用 `currentLineValue.lastIndexOf(item.key)`，取 `lastIndex` 最大值作为匹配位置（L1042-L1055）。
- [`fill()`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L442-L895) 中 Range 精确删除（L565-L568）：
  ```ts
  range.setStart(range.startContainer, this.lastIndex)
  range.deleteContents()
  ```
  `lastIndex` 将 Range 起点回退到 `/` 字符位置，从而精确选中 `/keyword` 整体进行删除。斜杠分支从 L649 开始，内部至少 9 处调用 `range.deleteContents()`。

结论：

- `removeSlashCommands` 不能只靠「删除首个匹配字符串」作为 Protyle 场景主路径。
- Protyle 场景应传入或计算 slash 起始 offset，执行 Range 精确删除。
- API-only 或无 Range 场景才允许使用文本 fallback。

### 2.6 Protyle 写入后光标恢复：`<wbr>` 与 `focusByOffset` 双机制

思源在块 DOM 修改后恢复光标位置有两种机制：

**保存阶段** — [`setInsertWbrHTML()`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L539-L568)（L539-L568）：

1. 非表格块：克隆节点 → `getSelectionOffset` 计算偏移 → `focusByOffset` 定位克隆中的光标 → 插入 `<wbr>` 元素 → 存入 `protyle.wysiwyg.lastHTMLs[id]`
2. 表格块：对 `<TH>`/`<TD>` 单元格做同样处理

**恢复阶段** — [`focusByWbr()`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L570-L625)（L570-L625）：

1. 在渲染后的 element 中查找所有 `<wbr>`，保留第一个，删除其余
2. 根据 `<wbr>` 的兄弟节点（文本/元素/img）选择合适的光标位置
3. 折叠 Range → 移除 `<wbr>` → `focusByRange()` 激活光标

**文本偏移恢复** — [`focusByOffset()`](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L457-L537)（L457-L537）：
通过 TreeWalker 遍历所有文本节点和 `<br>` 元素，按偏移量定位 startContainer/endContainer，直接操作 Range。适用于不需要 `<wbr>` 标记的简单场景。

结论：

- BlockWriter Protyle Transport 写入后应保存光标偏移量（写入前通过 TreeWalker 计算），写入后通过 `focusByOffset` 恢复。
- 如果写入涉及 DOM 重建（如替换 HTML），应使用 `<wbr>` 标记机制（克隆节点 → 插入 `<wbr>` → 写入后 `focusByWbr` 恢复）。
- 光标恢复失败时降级到行首不算错误。

1. 提供统一的写入入口 `writeBlock(context, patches)`，接受单个或批量 `BlockPatch`，逐步替代分散写入逻辑。
2. 抽出共享目标解析器，统一处理段落、任务列表项、多行事项、番茄钟附属行和 trailing IAL。
3. 保留思源原生写入语义：
   - 任务列表状态写 `NodeListItem`；
   - Protyle DOM 写入走最小 DOM 修改 + `SpinBlockDOM` + transaction；
   - API 写入走真实 `getBlockKramdown` 样本驱动的 kramdown 修改。
4. 保留自定义 IAL 属性，不只保留 `id`。
5. 迁移采用小闭环，每阶段只替换一个低风险入口并跑测试。

## 4. 非目标

1. 不一次性删除 `fileUtils.ts` 中全部旧写入函数。
2. 不把所有 Protyle 写入强制改为 markdown 往返。
3. 不重写 parser 主流程。
4. 不在第一阶段支持所有复杂块类型；复杂块不满足安全条件时降级到现有 API 路径。
5. 在验证阶段不替换任何现有业务写入入口；只新增 dev-only 测试入口。

## 5. 架构

```
writeBlock(context, patches)        ← patches: BlockPatch | BatchBlockPatch (BlockPatch[])
  |
  +-- resolveBlockTarget(context, firstPatch)
  |     - 判断目标是当前 block、父 NodeListItem、还是父块中的事项 raw
  |     - 返回 fullKramdown、targetRaw、contentLines、ialLines、replaceMode
  |
  +-- Protyle Transport
  |     - setStatus(task list): 修改 list item DOM data-task/class
  |     - removeSlashCommands: Range/offset 精确删除
  |     - safe single-line patches: 文本节点最小修改 + SpinBlockDOM + transaction
  |     - multi-patch: 按序依次做 DOM 修改后统一 SpinBlockDOM + transaction
  |     - unsafe: 降级 API Transport
  |
  +-- API Transport
        - getBlockKramdown(targetBlockId)
        - applyBlockPatches(resolvedTarget, patches)   ← 批量按序应用
        - updateBlock('markdown', newMarkdown, targetBlockId)
```

## 6. 模块划分

```
src/utils/blockWriter/
  index.ts             - 统一入口 writeBlock()
  types.ts             - BlockPatch、BlockWriteContext、ResolvedBlockTarget 等类型
  blockTargetResolver.ts
                       - 目标块/事项行解析，统一父块与列表项定位
  kramdownBlocks.ts    - 真实 getBlockKramdown 输出的拆分与重建
  kramdownModifier.ts  - 纯函数 patch：日期、状态、优先级、内容
  protyleTransport.ts  - DOM 最小修改、SpinBlockDOM、transaction、降级
  slashRange.ts        - Protyle slash Range/offset 删除
  apiTransport.ts      - API-only 写入
```

旧工具函数逐步迁移：

- 从 `fileUtils.ts` 抽出可复用 marker 逻辑到 `src/utils/blockWriter/itemLineMarkers.ts`。
- `extractItemMarkers`、`isTaskListFormat`、日期 marker 处理、优先级 marker 处理必须显式 export，避免新模块反向依赖整个 `fileUtils.ts`。

## 7. 类型设计

```ts
import type { ItemStatus, PriorityLevel, TimePrecision } from '@/types/models'

export interface ItemDateTimeInfo {
  date: string
  allDay: boolean
  startTime?: string
  endTime?: string
  timePrecision: TimePrecision
}

export interface BlockWriteContext {
  blockId: string
  protyle?: any
  nodeElement?: HTMLElement
  slashRange?: Range
  slashStartOffset?: number
}

export type BlockPatch
  = | {
    type: 'addDate'
    date: string
    originalDate?: string
    startTime?: string
    endTime?: string
    allDay?: boolean
    timePrecision?: TimePrecision
    siblingItems?: ItemDateTimeInfo[]
  }
  | { type: 'setStatus', status: ItemStatus }
  | { type: 'setPriority', priority: PriorityLevel | undefined }
  | { type: 'setContent', suffix?: string, newItemContent?: string }
  | { type: 'removeSlashCommands', filters: string[], suffix?: string }

export type BatchBlockPatch = BlockPatch[]

export interface KramdownBlockParts {
  contentLines: string[]
  ialLines: string[]
  raw: string
}

export interface ResolvedBlockTarget {
  originalBlockId: string
  targetBlockId: string
  targetType?: string
  targetSubType?: string
  fullKramdown: string
  targetRaw: string
  parts: KramdownBlockParts
  replaceMode: 'whole-block' | 'raw-within-parent'
}
```

## 8. Target Resolver

`resolveBlockTarget(context, firstPatch)` 是本设计的关键模块。它不能只服务 `setStatus`，而要服务所有会修改事项行的 patch。

**多 patch 场景**：当 `writeBlock` 收到 `BatchBlockPatch` 时，只用第一个 patch 做目标解析，所有 patch 共用同一份 `ResolvedBlockTarget`。典型场景如 `[{ type: 'setPriority', priority: 'high' }, { type: 'addDate', date: '2026-05-16' }]` — 两个 patch 都在同一个事项行上操作。

### 8.1 Protyle 场景

1. 如果 patch 是 `setStatus`，且 `nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]')` 命中，则目标切换到该 list item。
2. 其他 patch 默认以当前 block 为候选目标。
3. 如果当前 block 不满足安全 DOM 修改条件，Transport 降级到 API resolver。

### 8.2 API 场景

1. 调 `getBlockByID(blockId)` 获取当前块类型和 parent。
2. 对任务列表状态：如果 parent 是 `NodeListItem + subtype=t`，目标切换到 parent。
3. 对日期、内容、优先级：读取当前块 kramdown；必要时读取 parent kramdown，定位包含事项行的 `targetRaw`，保留 parent full kramdown，并以 `raw-within-parent` 模式替换。
4. 定位事项行时跳过：
   - IAL 行；
   - `🍅` 番茄钟记录行；
   - standalone block ref 行；
   - 空行。

## 9. Kramdown 修改规则

### 9.1 拆分与重建

Modifier 不直接用 `/\{:([^}]*)\}/` 全局删除属性。必须先拆分：

```ts
splitKramdownBlock(raw) => {
  contentLines: lines before trailing IAL,
  ialLines: trailing lines where trim().startsWith('{:') && trim().endsWith('}'),
  raw
}
```

重建时只替换目标内容行，原样附回 `ialLines`。

### 9.2 状态

- 任务列表：`completed` 写 `[x]`；`pending` 和 `abandoned` 写 `[ ]`。
- 非任务列表：使用状态标签。写入前移除已有完成/放弃标签，避免重复。
- `abandoned` 在任务列表中是否保留 `#已放弃` 标签，沿用当前插件行为：取消 checkbox，同时保留放弃标签。

### 9.3 日期

- 保留任务列表 marker、事项正文、非日期 marker、状态标签。
- 替换 `originalDate` 时只替换对应日期；无 `originalDate` 时合并并排序。
- 多日期合并继续复用当前 `optimizeDateTimeExpressions` 语义，但该函数应抽到可测试模块。

### 9.4 优先级

- 移除已有 `🔥/🌱/🍃`。
- 新优先级插入到日期 marker 之前；无日期时追加到正文后。

### 9.5 斜杠命令删除

- Protyle 场景：使用 `slashRange` 或 `slashStartOffset` 删除当前触发的 slash 片段。
- API fallback：可使用最长优先的文本匹配，但只作为降级路径，并应记录 warning。

### 9.6 批量修改（BatchBlockPatch）

当 `writeBlock` 收到 `BlockPatch[]` 时，按顺序依次应用每个 patch 到同一份 content lines 上：

```ts
function applyBlockPatches(parts: KramdownBlockParts, patches: BlockPatch[]): string {
  let currentParts = parts
  for (const patch of patches) {
    const result = applyBlockPatch(currentParts, patch)
    // 将上次输出作为下次输入 → 重新拆分为 KramdownBlockParts
    currentParts = splitKramdownBlock(result)
  }
  return rebuildKramdownBlock(currentParts)
}
```

**顺序约定**（避免 patch 间互相覆盖）：

1. `removeSlashCommands` — 必须先执行，清理 slash 片段
2. `setStatus` — 状态变更（可能带 `#已完成`/`#已放弃` 标签）
3. `setPriority` — 优先级 marker（`🔥/🌱/🍃`）
4. `addDate` — 日期 marker（`📅2026-05-16`）
5. `setContent` — 内容替换（可能覆盖前几项，建议最后）

调用方负责按正确顺序传入 patches。Modifier 不负责排序，只负责按序应用。

**约束**：

- 同一个 block 的同一次 `writeBlock` 调用中，`removeSlashCommands` 最多出现一次。
- `setStatus` 和 `setContent` 同时出现时，`setContent` 在后，覆盖状态变更。
- Protyle Transport 不支持 `BatchBlockPatch`（可逐个 patch 在 DOM 上执行，见 §10.4）；复杂批量写入降级 API Transport。

## 10. Protyle Transport

### 10.1 支持路径

1. `setStatus` 任务列表：
   - 修改 list item 的 `data-task`、`protyle-task--done` class、`updated`；
   - `SpinBlockDOM(listItem.outerHTML)`；
   - 重新查询新 list item；
   - `protyle.transaction(doOps, undoOps)`。

   > **审查发现**：思源原生 checkbox 点击（wysiwyg/index.ts L3054-L3067）**不调用** `SpinBlockDOM`，直接以 `outerHTML` 提交 `updateTransaction`。但 BlockWriter 的 `setStatus` 可能伴随其他文本修改（如追加状态标签），因此仍建议经过 `SpinBlockDOM` 规范化以确保 DOM 一致性。

2. `removeSlashCommands`：
   - 使用 Range 删除当前 slash；
   - 追加 suffix 或执行必要文本 transform；
   - `SpinBlockDOM`；
   - transaction。
3. 简单单行文本 patch：
   - 只在 `isProtyleBlockSafeForWriterFastPath(nodeElement)` 为 true 时执行；
   - 修改可见文本节点；
   - `SpinBlockDOM`；
   - transaction。

### 10.2 降级

以下情况降级 API Transport：

- 找不到目标文本节点；
- patch 需要跨多行/父块替换；
- 当前块不是安全普通文本块；
- Lute/DOM 规范化异常；
- Protyle transaction 不可用。

### 10.3 光标恢复

Protyle 写入后应恢复光标位置。使用 `TreeWalker` 保存写入前光标相对于文本内容的偏移量，写入后通过 `focusByOffset` 或 SiYuan 原生 `<wbr>` 机制恢复。光标恢复失败时降级到行首不算错误。

### 10.4 BatchBlockPatch 处理

Protyle Transport 对 `BatchBlockPatch` 的策略：

1. 如果只有一个 patch 且是 `removeSlashCommands`：走 §10.1 的 Range 删除路径。
2. 如果有 `removeSlashCommands` + 其他 patch：**先**走 Range 删除 slash，再依次做 DOM 修改，最后统一 `SpinBlockDOM` + transaction。
3. 如果是纯 API-only patch 组合（如 `setPriority` + `addDate`，无 `removeSlashCommands`）：**直接降级 API Transport**，因为 Protyle DOM 层面修改优先级 marker 和日期 marker 的复杂度高于一次 API kramdown 往返。
4. 如果 patch 数量 > 2 或含 `setContent`：**降级 API Transport**。

## 11. API Transport

API 写入流程：

1. `resolveBlockTarget(context, firstPatch)`。
2. `applyBlockPatches(resolvedTarget.parts, patches)` — 批量按序应用所有 patch。
3. 如果 `replaceMode === 'raw-within-parent'`，在 `fullKramdown` 中替换 `targetRaw`。
4. `updateBlock('markdown', newMarkdown, targetBlockId)`。

`NodeListItem` 写入必须单独测试：

- `getBlockKramdown(listItemId)` 的真实输出；
- `updateBlock('markdown', modified, listItemId)` 后 checkbox、正文、IAL 均正确。

## 12. 迁移策略

采用“新增模块 + 单点迁移 + 验证”的策略。

| Phase | 内容                                                    | 验证                             |
| ----- | ------------------------------------------------------- | -------------------------------- |
| 1     | 抽出 marker 工具、kramdown block 拆分/重建、纯 modifier | 单元测试                         |
| 2     | 实现 API Target Resolver 和 API Transport               | mocked API 单元测试              |
| 3     | 新增 npm dev 专用验证入口，不替换现有逻辑               | 手动验证                         |
| 4     | 验证通过后，迁移一个 API-only 低风险入口：优先级更新    | Vitest + 手动验证                |
| 5     | 实现 Protyle status/list item DOM 路径                  | 手动验证 checkbox 与 transaction |
| 6     | 逐步迁移日期、内容、剩余优先级入口                      | 每个入口独立测试和提交           |
| 7     | 删除旧函数                                              | 确认无调用后删除                 |

## 14. 测试策略

### 14.1 单元测试

- `kramdownBlocks.test.ts`
  - content + trailing IAL；
  - 多个 IAL 属性；
  - 列表项；
  - 番茄钟附属行。
- `kramdownModifier.test.ts`
  - `setStatus` 普通段落；
  - `setStatus` 任务列表；
  - `addDate` 替换/追加/合并日期；
  - `setPriority` 插入到日期前；
  - 保留自定义 IAL；
  - **批量 patch**：`setPriority` + `addDate` 同一事项行，验证两个 marker 都在且 IAL 不丢；
  - **批量 patch 顺序**：`removeSlashCommands` + `setStatus` + `setPriority`，验证最终 kramdown 正确。
- `blockTargetResolver.test.ts`
  - paragraph；
  - paragraph inside task list item；
  - parent kramdown raw replacement；
  - 无 parent fallback。

### 14.2 集成/手动测试

在 SiYuan 中验证：

1. 普通事项设置日期、优先级、完成/放弃。
2. 任务列表事项 `[ ]/[x]` 切换。
3. 含自定义属性如 `custom-reminder` 的事项更新后属性不丢。
4. 含 `🍅` 附属行的事项更新后番茄钟记录不丢。
5. slash 命令只删除当前触发片段，不删除行内其他相同文本。

## 15. 风险与缓解

| 风险                                        | 缓解                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `getBlockKramdown` 真实输出与测试样本不一致 | 从真实 API 输出补充 fixture，不使用行内 IAL 作为唯一样本                    |
| Protyle DOM 往返改变结构                    | Protyle 优先最小 DOM 修改 + `SpinBlockDOM`，复杂情况降级 API                |
| 任务列表 API 更新破坏 list wrapper          | 单独覆盖 `NodeListItem` updateBlock 往返                                    |
| slash 删除删错片段                          | Protyle 保留 Range/offset 语义，文本匹配只做 fallback                       |
| 一次性迁移范围过大                          | 每阶段只迁移一个入口，旧函数保留到调用方清零                                |
| dev-only 验证入口误进入生产                 | 所有注册都用 `import.meta.env.DEV` 包裹，并在构建产物中检查无 `bwtest` 文本 |

## 16. 源码引用附录

### 16.1 思源源码

| 文件                                | 行号                                                                                                                                                                                                                                                                                                                                                                                                                                              | 关键内容                                                                                     | 关联设计点  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| `app/src/protyle/wysiwyg/index.ts`  | [L3009](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/wysiwyg/index.ts#L3009)                                                                                                                                                                                                                                                                                                                                                        | `hasClosestByClassName(event.target, "protyle-action")` — actionElement 获取入口             | §2.1, §8.1  |
| 同上                                | [L3019-L3020](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/wysiwyg/index.ts#L3019-L3020)                                                                                                                                                                                                                                                                                                                                            | `li` 分支 + `actionId` 获取（`data-node-id`）                                                | §2.1        |
| 同上                                | [L3054-L3067](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/wysiwyg/index.ts#L3054-L3067)                                                                                                                                                                                                                                                                                                                                            | checkbox 状态切换：`data-task` `" "/"X"` + `protyle-task--done` CSS 类 + `updateTransaction` | §2.1, §10.1 |
| `kernel/api/block_op.go`            | [L786-L885](file:///C:/dev/projects/open-source/siyuan/kernel/api/block_op.go#L786-L885)                                                                                                                                                                                                                                                                                                                                                          | `updateBlock()` 完整实现                                                                     | §2.2, §11   |
| 同上                                | [L827-L848](file:///C:/dev/projects/open-source/siyuan/kernel/api/block_op.go#L827-L848)                                                                                                                                                                                                                                                                                                                                                          | `NodeDocument` 分支：全量替换文档子节点                                                      | §2.2        |
| 同上                                | [L850-L856](file:///C:/dev/projects/open-source/siyuan/kernel/api/block_op.go#L850-L856)                                                                                                                                                                                                                                                                                                                                                          | `NodeListItem` list wrapper 剥离（GitHub #4658）                                             | §2.2        |
| 同上                                | [L859-L864](file:///C:/dev/projects/open-source/siyuan/kernel/api/block_op.go#L859-L864)                                                                                                                                                                                                                                                                                                                                                          | IAL `id` 强制保留 + 空树 fallback 段落                                                       | §2.2        |
| `kernel/model/block.go`             | [L1039-L1055](file:///C:/dev/projects/open-source/siyuan/kernel/model/block.go#L1039-L1055)                                                                                                                                                                                                                                                                                                                                                       | `getBlockKramdown0` — 目标节点 + IAL sibling → 临时 root → `ExportNodeStdMd`                 | §2.3, §9.1  |
| `kernel/model/template.go`          | [L501-L533](file:///C:/dev/projects/open-source/siyuan/kernel/model/template.go#L501-L533)                                                                                                                                                                                                                                                                                                                                                        | `addBlockIALNodes` — `InsertAfter(NodeKramdownBlockIAL)`                                     | §2.3        |
| `kernel/treenode/node.go`           | [L155-L162](file:///C:/dev/projects/open-source/siyuan/kernel/treenode/node.go#L155-L162)                                                                                                                                                                                                                                                                                                                                                         | `ExportNodeStdMd` — Lute `ProtyleExportMdNodeSync`                                           | §2.3        |
| `app/src/protyle/hint/index.ts`     | [L1037-L1083](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L1037-L1083)                                                                                                                                                                                                                                                                                                                                               | `getKey()` — `lastIndex` 计算（`lastIndexOf` + `BLOCK_HINT_KEYS` 特殊处理）                  | §2.5, §7    |
| 同上                                | [L442-L895](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L442-L895)                                                                                                                                                                                                                                                                                                                                                   | `fill()` — 斜杠 hint 选择回调                                                                | §2.5        |
| 同上                                | [L565-L568](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L565-L568)                                                                                                                                                                                                                                                                                                                                                   | Range 精确删除：`range.setStart(..., this.lastIndex)` + `deleteContents()`                   | §2.5, §10.1 |
| 同上                                | [L649](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L649)                                                                                                                                                                                                                                                                                                                                                             | 斜杠分支入口 `splitChar === "/"`                                                             | §2.5        |
| 同上                                | [L115](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L115), [L636](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L636), [L776](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L776), [L807](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L807), [L820](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L820) | `SpinBlockDOM` 调用点（共 5 处核心引用）                                                     | §2.4, §10.1 |
| `app/src/protyle/util/selection.ts` | [L457-L537](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L457-L537)                                                                                                                                                                                                                                                                                                                                               | `focusByOffset` — TreeWalker 文本偏移光标恢复                                                | §2.6, §10.3 |
| 同上                                | [L539-L568](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L539-L568)                                                                                                                                                                                                                                                                                                                                               | `setInsertWbrHTML` — 克隆节点 + `<wbr>` 插入保存光标                                         | §2.6        |
| 同上                                | [L570-L625](file:///C:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L570-L625)                                                                                                                                                                                                                                                                                                                                               | `focusByWbr` — `<wbr>` 光标恢复                                                              | §2.6, §10.3 |

### 16.2 项目源码

| 文件                         | 行号                                                                                                                   | 关键内容                                                                 | 关联设计点    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| `src/utils/slashCommands.ts` | [L67-L214](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L67-L214)       | `deleteSlashCommandContent` — 全局文本替换删除 slash（待替换）           | §1, §2.5      |
| 同上                         | [L223-L251](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L223-L251)     | `updateTransaction` — Protyle 事务提交封装                               | §1, §2.1      |
| 同上                         | [L298-L532](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L298-L532)     | `createSlashCommands` — `builtinCommands` 数组（注册新斜杠命令的位置）   | §13.1         |
| 同上                         | [L627-L648](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L627-L648)     | `getValidatedItemFromNode` — 从 DOM 节点提取并校验 Item                  | §8            |
| 同上                         | [L1290-L1426](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L1290-L1426) | `createProtyleWriter` — ProtyleWriter 工厂（快/慢路径）（待替换）        | §1            |
| `src/utils/fileUtils.ts`     | [L184-L232](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L184-L232)         | `extractItemMarkers` — 提取优先级/日期/提醒/重复 markers（待抽出）       | §1, §6        |
| 同上                         | [L239-L241](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L239-L241)         | `isTaskListFormat` — 任务列表格式检测 `[ ]`/`[x]`                        | §9.2          |
| 同上                         | [L430-L493](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L430-L493)         | `handleSingleLineUpdate` — 单行日期替换辅助（待替换）                    | §1, §9.3      |
| 同上                         | [L495-L1023](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L495-L1023)       | `updateBlockDateTime` — 日期更新（529 行，待替换）                       | §1, §9.3      |
| 同上                         | [L1105-L1404](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L1105-L1404)     | `updateBlockContent` — 内容/标签更新（300 行，待替换）                   | §1            |
| 同上                         | [L1413-L1593](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/fileUtils.ts#L1413-L1593)     | `updateBlockPriority` — 优先级更新（181 行，待替换）                     | §1, §9.4, §12 |
| `src/api.ts`                 | [L232-L244](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/api.ts#L232-L244)                     | `updateBlock` — 通用块更新 API 封装                                      | §11           |
| 同上                         | [L268-L276](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/api.ts#L268-L276)                     | `getBlockKramdown` — 获取块 kramdown                                     | §2.3, §11     |
| 同上                         | [L345-L349](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/api.ts#L345-L349)                     | `getBlockByID` — SQL 查询块信息                                          | §8.2          |
| `src/parser/core.ts`         | [L91-L123](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts#L91-L123)               | `stripListAndBlockAttr` — 剥离列表前缀 + 行内块属性                      | §9.2          |
| 同上                         | [L237-L249](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts#L237-L249)             | `taskListMatch` — 任务列表正则匹配 + `listItemBlockIdStack` 嵌套处理     | §8.2          |
| 同上                         | [L498-L512](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts#L498-L512)             | `isTaskList` 局部变量 — 写入 `item.isTaskList` 和 `item.listItemBlockId` | §8            |
| `src/index.ts`               | [L314-L316](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L314-L316)                   | `onload()` 中 `registerTopBar()` 调用位置                                | §13.2         |
| 同上                         | [L350](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L350)                             | `onload()` 中 `registerSlashCommands()` 初次注册                         | §13.1         |
| 同上                         | [L1517-L1721](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L1517-L1721)               | `registerTopBar()` — 顶栏菜单构建                                        | §13.2         |
| 同上                         | [L3314-L3337](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L3314-L3337)               | `registerSlashCommands()` — 调用 `createSlashCommands(config)`           | §13.1         |

### 16.3 关键源码与设计模块的对应关系

| Spec 模块                         | 依赖的思源源码                                           | 依赖的项目源码                                            |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `protyleTransport.ts` (setStatus) | `wysiwyg/index.ts` L3054-L3067, `selection.ts` L457-L625 | `slashCommands.ts` L223-L251 (`updateTransaction`)        |
| `protyleTransport.ts` (slash)     | `hint/index.ts` L565-L568, L1037-L1083                   | `slashCommands.ts` L67-L214 (`deleteSlashCommandContent`) |
| `apiTransport.ts`                 | `block_op.go` L850-L864, `block.go` L1039-L1055          | `api.ts` L232-L244, L268-L276                             |
| `kramdownBlocks.ts`               | `block.go` L1039-L1055, `template.go` L501-L533          | —                                                         |
| `kramdownModifier.ts`             | —                                                        | `fileUtils.ts` L184-L232, L239-L241                       |
| `blockTargetResolver.ts`          | —                                                        | `api.ts` L345-L349, `parser/core.ts` L91-L123, L237-L249  |
| `slashRange.ts`                   | `hint/index.ts` L442-L895                                | `slashCommands.ts` L67-L214                               |
| `itemLineMarkers.ts`              | —                                                        | `fileUtils.ts` L184-L232                                  |

### 16.4 旧写入函数与 BlockWriter 替换对应关系

| 旧函数                            | 位置                           | 行数   | 替换为 BlockWriter                                 |
| --------------------------------- | ------------------------------ | ------ | -------------------------------------------------- |
| `deleteSlashCommandContent`       | `slashCommands.ts` L67-L214    | 148 行 | `writeBlock(ctx, { type: 'removeSlashCommands' })` |
| `createProtyleWriter` (快/慢路径) | `slashCommands.ts` L1290-L1426 | 137 行 | `writeBlock(ctx, patch)` — Protyle Transport       |
| `updateBlockDateTime`             | `fileUtils.ts` L495-L1023      | 529 行 | `writeBlock(ctx, { type: 'addDate' })`             |
| `updateBlockContent`              | `fileUtils.ts` L1105-L1404     | 300 行 | `writeBlock(ctx, { type: 'setContent' })`          |
| `updateBlockPriority`             | `fileUtils.ts` L1413-L1593     | 181 行 | `writeBlock(ctx, { type: 'setPriority' })`         |
| `handleSingleLineUpdate` (辅助)   | `fileUtils.ts` L430-L493       | 64 行  | 合并入 `kramdownModifier.addDate`                  |
| `extractItemMarkers` (辅助)       | `fileUtils.ts` L184-L232       | 49 行  | 抽出到 `itemLineMarkers.ts`                        |
