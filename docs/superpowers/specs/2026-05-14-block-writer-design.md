# BlockWriter：统一块写入层设计

## 1. 背景与问题

Task Assistant 当前有三类写入路径混用：

| 路径 | 位置 | 特点 |
|------|------|------|
| DOM 直接修改 | `src/utils/slashCommands.ts` 的 `deleteSlashCommandContent` | 直接改当前文本节点，再提交 `protyle.transaction()` |
| ProtyleWriter 快/慢路径 | `src/utils/slashCommands.ts` 的 `createProtyleWriter` | 单行同块走 DOM 快路径，复杂情况等待事务队列后走 `updateBlock` API |
| API 写入 | `src/utils/fileUtils.ts` 的 `updateBlockDateTime`、`updateBlockContent`、`updateBlockPriority` | 读取 kramdown，按行重建后调用 `/api/block/updateBlock` |

这些路径已经累积出几个具体问题：

1. 父块/列表项定位逻辑在日期、内容、优先级更新中重复实现。
2. kramdown 字符串修改分散，容易丢失块属性、番茄钟附属行、任务列表状态。
3. Protyle 正在累积事务时直接调 `updateBlock` API，可能与编辑器事务队列发生 write-after-write 竞争。
4. 斜杠命令删除依赖全局文本替换，和思源原生基于 Range 的精确删除语义不一致。

## 2. 思源源码约束

本设计必须显式遵守以下思源源码约束，而不是只按当前插件代码抽象。

### 2.1 任务列表状态更新目标是 `NodeListItem`

思源 checkbox 点击逻辑位于 `app/src/protyle/wysiwyg/index.ts`。当点击任务列表 checkbox 时，源码更新的是 `actionElement.parentElement`，即任务列表项 DOM，并以 `actionId` 提交事务：

```ts
actionElement.parentElement.setAttribute("data-task", "X");
updateTransaction(protyle, actionId, actionElement.parentElement.outerHTML, html);
```

因此 `setStatus` 在任务列表场景必须写 `NodeListItem`，不能只写其内部 paragraph。

### 2.2 `updateBlock(markdown)` 对 `NodeListItem` 有特殊处理

思源 kernel 的 `kernel/api/block_op.go:updateBlock` 在目标块是 `NodeListItem` 且 markdown 解析结果是 `NodeList` 时，会剥离 list wrapper：

```go
if "NodeListItem" == block.Type && ast.NodeList == tree.Root.FirstChild.Type {
    tree.Root.AppendChild(tree.Root.FirstChild.FirstChild)
    tree.Root.FirstChild.Unlink()
    if nil != tree.Root.FirstChild && ast.NodeKramdownBlockIAL == tree.Root.FirstChild.Type {
        tree.Root.FirstChild.Unlink()
    }
}
tree.Root.FirstChild.SetIALAttr("id", id)
```

结论：

- API Transport 可以更新 `NodeListItem`，但传入 markdown 的形态必须测试覆盖。
- kernel 只强制保留目标块 `id`，其他自定义 IAL 属性必须由插件保留在 markdown 中。

### 2.3 `getBlockKramdown` 输出包含目标节点与其 IAL

思源 `kernel/model/block.go:getBlockKramdown0` 会先调用 `addBlockIALNodes`，然后把目标节点和其后的 IAL 节点挂到临时 root 导出：

```go
root.AppendChild(node.Next) // IAL
root.PrependChild(node)
ret = treenode.ExportNodeStdMd(root, luteEngine)
```

结论：

- 设计不能假设 IAL 总是行内 `- {: id="..."}[ ] 内容`。
- Modifier 必须支持并优先测试真实形态：内容行 + trailing IAL 行，例如：

```markdown
- [ ] 任务内容 📅2026-05-14
{: id="20260514120000-abc" custom-reminder="..."}
```

### 2.4 Protyle DOM 写入应优先沿用 `SpinBlockDOM`

思源前端在大量现有块 DOM 修改后提交事务的路径中使用 `protyle.lute.SpinBlockDOM(nodeElement.outerHTML)` 规范化 DOM，再调用 `updateTransaction`。例如 `app/src/protyle/hint/index.ts` 处理图片 slash 输入时，会替换 DOM、重新查询新节点、用 `<wbr>` 恢复光标。

结论：

- Protyle Transport 不应默认做 `BlockDOM2StdMd -> Md2BlockDOM` 往返；该路径可能重排 DOM、IAL、内联结构。
- Protyle 快路径应做 DOM/text 最小修改，然后 `SpinBlockDOM` 规范化并提交事务。
- kramdown Modifier 是 API Transport 的核心，不是所有 Protyle 写入的唯一实现。

### 2.5 斜杠命令删除应保留 Range/offset 语义

思源 slash hint 的删除基于 `lastIndex` 和当前 `Range`：

```ts
range.setStart(range.startContainer, this.lastIndex);
range.deleteContents();
```

结论：

- `removeSlashCommands` 不能只靠“删除首个匹配字符串”作为 Protyle 场景主路径。
- Protyle 场景应传入或计算 slash 起始 offset，执行 Range 精确删除。
- API-only 或无 Range 场景才允许使用文本 fallback。

## 3. 设计目标

1. 提供统一的写入入口 `writeBlock(context, patch)`，逐步替代分散写入逻辑。
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
writeBlock(context, patch)
  |
  +-- resolveBlockTarget(context, patch)
  |     - 判断目标是当前 block、父 NodeListItem、还是父块中的事项 raw
  |     - 返回 fullKramdown、targetRaw、contentLines、ialLines、replaceMode
  |
  +-- Protyle Transport
  |     - setStatus(task list): 修改 list item DOM data-task/class
  |     - removeSlashCommands: Range/offset 精确删除
  |     - safe single-line patches: 文本节点最小修改 + SpinBlockDOM + transaction
  |     - unsafe: 降级 API Transport
  |
  +-- API Transport
        - getBlockKramdown(targetBlockId)
        - applyBlockPatch(resolvedTarget, patch)
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
import type { ItemStatus, PriorityLevel, TimePrecision } from '@/types/models';

export interface ItemDateTimeInfo {
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  timePrecision: TimePrecision;
}

export interface BlockWriteContext {
  blockId: string;
  protyle?: any;
  nodeElement?: HTMLElement;
  slashRange?: Range;
  slashStartOffset?: number;
}

export type BlockPatch =
  | {
      type: 'addDate';
      date: string;
      originalDate?: string;
      startTime?: string;
      endTime?: string;
      allDay?: boolean;
      timePrecision?: TimePrecision;
      siblingItems?: ItemDateTimeInfo[];
    }
  | { type: 'setStatus'; status: ItemStatus }
  | { type: 'setPriority'; priority: PriorityLevel | undefined }
  | { type: 'setContent'; suffix?: string; newItemContent?: string }
  | { type: 'removeSlashCommands'; filters: string[]; suffix?: string };

export interface KramdownBlockParts {
  contentLines: string[];
  ialLines: string[];
  raw: string;
}

export interface ResolvedBlockTarget {
  originalBlockId: string;
  targetBlockId: string;
  targetType?: string;
  targetSubType?: string;
  fullKramdown: string;
  targetRaw: string;
  parts: KramdownBlockParts;
  replaceMode: 'whole-block' | 'raw-within-parent';
}
```

## 8. Target Resolver

`resolveBlockTarget(context, patch)` 是本设计的关键模块。它不能只服务 `setStatus`，而要服务所有会修改事项行的 patch。

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

## 10. Protyle Transport

### 10.1 支持路径

1. `setStatus` 任务列表：
   - 修改 list item 的 `data-task`、`protyle-task--done` class、`updated`；
   - `SpinBlockDOM(listItem.outerHTML)`；
   - 重新查询新 list item；
   - `protyle.transaction(doOps, undoOps)`。
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

## 11. API Transport

API 写入流程：

1. `resolveBlockTarget(context, patch)`。
2. `applyBlockPatch(resolvedTarget, patch)`。
3. 如果 `replaceMode === 'raw-within-parent'`，在 `fullKramdown` 中替换 `targetRaw`。
4. `updateBlock('markdown', newMarkdown, targetBlockId)`。

`NodeListItem` 写入必须单独测试：

- `getBlockKramdown(listItemId)` 的真实输出；
- `updateBlock('markdown', modified, listItemId)` 后 checkbox、正文、IAL 均正确。

## 12. 迁移策略

采用“新增模块 + 单点迁移 + 验证”的策略。

| Phase | 内容 | 验证 |
|-------|------|------|
| 1 | 抽出 marker 工具、kramdown block 拆分/重建、纯 modifier | 单元测试 |
| 2 | 实现 API Target Resolver 和 API Transport | mocked API 单元测试 |
| 3 | 新增 npm dev 专用验证入口，不替换现有逻辑 | 手动验证 |
| 4 | 验证通过后，迁移一个 API-only 低风险入口：优先级更新 | Vitest + 手动验证 |
| 5 | 实现 Protyle status/list item DOM 路径 | 手动验证 checkbox 与 transaction |
| 6 | 逐步迁移日期、内容、剩余优先级入口 | 每个入口独立测试和提交 |
| 7 | 删除旧函数 | 确认无调用后删除 |

## 13. Dev-only 验证入口

在 `npm run dev` / `import.meta.env.DEV` 下额外注册两个验证入口。它们只用于人工验证 BlockWriter，不进入生产构建，不替换现有功能。

实现约束：验证入口只能新增注册项，不允许改动现有斜杠命令、现有顶栏菜单、`fileUtils.ts` 旧写入函数或任何真实业务调用方。人工验证通过前，旧写入链路保持当前行为。

### 13.1 测试斜杠命令：`/bwtest`

位置：`src/utils/slashCommands.ts` 的 `createSlashCommands()`。

注册条件：`import.meta.env.DEV`。

行为：

1. 使用当前 Range 定位本次触发的 `/bwtest` 起始 offset。
2. 调 `writeBlock({ protyle, nodeElement, blockId, slashRange, slashStartOffset }, { type: 'removeSlashCommands', filters: ['bwtest'], suffix: '#bw-protyle' })`。
3. 不调用旧 `deleteSlashCommandContent`，除非新逻辑返回 false 后 fallback。

覆盖：

- Protyle Transport；
- Range/offset 精确删除；
- `SpinBlockDOM` + transaction；
- 当前行中存在较早 `/bwtest` 文本时，不误删较早文本；
- undo/redo。

不足：

- 不覆盖 API Transport；
- 不覆盖任务列表 `NodeListItem` 状态切换；
- 不覆盖日期合并。

### 13.2 测试顶栏按钮：BlockWriter API Test

位置：`src/index.ts` 的 `registerTopBar()`。

注册条件：`import.meta.env.DEV`。

行为：

1. 增加一个 dev-only 顶栏按钮或主菜单项，标题为 `BlockWriter API Test`。
2. 点击时从当前选区读取 blockId，优先使用已有 `getBlockIdFromRange(range)`。
3. 调 `writeBlock({ blockId }, { type: 'setPriority', priority: 'high' })`。
4. 成功后提示 `BlockWriter API test success`，失败后提示 `BlockWriter API test failed`。

覆盖：

- API Transport；
- `getBlockByID` / `getBlockKramdown` / `updateBlock` 链路；
- trailing IAL 保留；
- 普通段落和任务列表项的 kramdown 修改。

不足：

- 如果当前选区不在任务列表内部，不能覆盖 paragraph inside list item 的 parent resolver；
- 不覆盖 Protyle Range 删除；
- 不覆盖日期合并。

### 13.3 两个入口是否足够

一个测试斜杠命令 + 一个顶栏按钮足够作为第一轮人工 smoke test，因为它们分别覆盖两条最关键 transport：

- `/bwtest` 覆盖 Protyle 编辑器内写入、slash Range 删除和 transaction；
- 顶栏按钮覆盖 API-only 写入和 kramdown/IAL 保留。

但它们不够作为最终迁移验收。进入真实替换前还必须补充至少三组专项验证：

1. 任务列表 `[ ]/[x]` 状态切换，确认目标是 `NodeListItem`。
2. `addDate` 多日期合并与 `originalDate` 替换。
3. 含 `🍅` 附属行、自定义 IAL、重复/提醒 marker 的事项更新。

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
  - 保留自定义 IAL。
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

| 风险 | 缓解 |
|------|------|
| `getBlockKramdown` 真实输出与测试样本不一致 | 从真实 API 输出补充 fixture，不使用行内 IAL 作为唯一样本 |
| Protyle DOM 往返改变结构 | Protyle 优先最小 DOM 修改 + `SpinBlockDOM`，复杂情况降级 API |
| 任务列表 API 更新破坏 list wrapper | 单独覆盖 `NodeListItem` updateBlock 往返 |
| slash 删除删错片段 | Protyle 保留 Range/offset 语义，文本匹配只做 fallback |
| 一次性迁移范围过大 | 每阶段只迁移一个入口，旧函数保留到调用方清零 |
| dev-only 验证入口误进入生产 | 所有注册都用 `import.meta.env.DEV` 包裹，并在构建产物中检查无 `bwtest` 文本 |

## 16. 参考源码

| 文件 | 参考点 |
|------|--------|
| `siyuan/app/src/protyle/wysiwyg/index.ts` | checkbox 点击更新 `NodeListItem` 并提交 transaction |
| `siyuan/kernel/api/block_op.go` | `updateBlock` markdown 转 BlockDOM、`NodeListItem` 特殊处理、仅强制目标 `id` |
| `siyuan/kernel/model/block.go` | `getBlockKramdown0` 导出目标节点和 IAL |
| `siyuan/app/src/protyle/hint/index.ts` | slash hint Range 删除、`SpinBlockDOM`、DOM 替换后重新查询节点 |
| `siyuan/app/src/protyle/util/selection.ts` | `focusByOffset`、`focusByWbr` 的光标恢复语义 |
