# BlockWriter：统一块写入层设计

## 1. 背景与问题

### 1.1 当前写操作架构

插件当前有三层写入策略混用在 `slashCommands.ts` 和 `fileUtils.ts` 中：

| 策略 | 位置 | 原理 |
|------|------|------|
| DOM 直接修改 | `deleteSlashCommandContent` | 改 `textNode.textContent`，然后调 `updateTransaction` 提交 |
| ProtyleWriter 快/慢路径 | `slashCommands.ts` L1290-1426 | 快路径改 DOM → `protyle.transaction()`；慢路径调 `updateBlock` API |
| updateBlock API | `fileUtils.ts` L810, L1016, L1312 等 | 直接 HTTP 调 `/api/block/updateBlock` |

### 1.2 核心痛点

1. **父块检测逻辑在三处重复**：`updateBlockDateTime`、`updateBlockContent`、`updateBlockPriority` 各自实现相同的"查父块 kramdown → 判断任务列表格式"逻辑
2. **手动正则操作 kramdown 不可靠**：用 split / 正则 / join 操作 kramdown，容易丢失块属性、嵌入块引用
3. **与 protyle 事务队列竞争**：插件调 `updateBlock` API 时 protyle 可能正在累积待提交事务，导致 write-after-write 冲突
4. **自定义 IAL 属性丢失**：`stripListAndBlockAttr` 移除所有 `{: ... }` 块属性，重建时不带回

### 1.3 调研结论

通过分析 SiYuan kernel 源码 `kernel/api/block_op.go`：

1. **父块 kramdown 查询可省略，仅需轻量类型检测**：通过分析 SiYuan 源码 `protyle/wysiwyg/index.ts` L3054-3067，思源原生 toggle `[ ]`/`[x]` 时更新的是 `NodeListItem` 块（非 `NodeParagraph` 子块）。因此对于 `setStatus` patch（任务列表完成/取消），必须知道段落是否位于任务列表项内。检测方式：
   - **Protyle 场景**：`nodeElement.closest('[data-subtype="t"]')` 做 DOM 属性判断（0 次 API）
   - **API 场景**：`getBlockByID(blockId)` 查 parent 类型是否为 `NodeListItem + subtype=t`（1 次 API，仅查类型不含 kramdown）
   - 其他 patch（addDate / setPriority / setContent / removeSlashCommands）均不需父块信息。
2. **Lute 全局可用**：`Lute.New()` 是全局构造函数，不依赖 protyle 实例，但有 protyle 时使用 `protyle.lute` 可获得完整配置。
3. **IAL 需要插件自行保持**：kernel 只保证 `id` 属性不丢，其他自定义 IAL（如 `custom-reminder`）需要 kramdown 自身携带 `{: ...}` 保留。

## 2. 方案概览

分层混合架构：核心 Kramdown Modifier（纯函数，无 DOM/protyle 依赖） + 双 Transport 层。

```
┌─────────────────────────────────────────────┐
│            Transport Layer                   │
│                                             │
│  Protyle 场景               API-Only 场景     │
│  (有 DOM + protyle)         (只有 blockId)    │
│                                             │
│  DOM                          getBlockKramdown│
│   │                                │          │
│   ▼                                ▼          │
│  Lute.BlockDOM2StdMd()          kramdown 文本  │
│   │                                │          │
│   └──────────┬─────────────────────┘          │
│              ▼                                │
├─────────────────────────────────────────────┤
│       Core: Kramdown Modifier (纯函数)        │
│                                             │
│  parseKramdownBlocks → 结构化修改 → 序列化     │
│  + IAL 提取与恢复                              │
│                                             │
├─────────────────────────────────────────────┤
│            Commit                             │
│                                             │
│  Protyle: DOM 替换 → protyle.transaction()    │
│  API:     updateBlock API                    │
└─────────────────────────────────────────────┘
```

## 3. 模块划分

```
src/utils/blockWriter/
  index.ts             — 统一入口 writeBlock()
  types.ts             — BlockPatch、BlockWriteContext 等类型
  kramdownModifier.ts  — 核心纯函数 applyBlockPatch()
  protyleTransport.ts  — Protyle 场景 transport（含光标保持）
  apiTransport.ts      — API-only 场景 transport
  ialPreserver.ts      — IAL 属性提取与恢复
  cursorPreserver.ts   — Protyle 光标偏移量保存/恢复
```

## 4. 接口设计

### 4.1 类型定义

```typescript
// types.ts

import type { ItemStatus, PriorityLevel, TimePrecision } from '@/types/models';

export interface BlockWriteContext {
  protyle?: any;
  nodeElement?: HTMLElement;
  blockId: string;
}

export type BlockPatch =
  | { type: 'addDate'; date: string; originalDate?: string; startTime?: string; endTime?: string; allDay?: boolean; timePrecision?: TimePrecision; siblingItems?: ItemDateTimeInfo[] }
  | { type: 'setStatus'; status: ItemStatus }
  | { type: 'setPriority'; priority: PriorityLevel | undefined }
  | { type: 'setContent'; suffix: string; newItemContent?: string }
  | { type: 'removeSlashCommands'; filters: string[]; suffix?: string };

export async function writeBlock(context: BlockWriteContext, patch: BlockPatch): Promise<boolean>;
```

### 4.2 统一入口 + setStatus 的任务列表检测

```typescript
// index.ts

export async function writeBlock(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  try {
    if (patch.type === 'setStatus') {
      return await writeStatus(context, patch);
    }
    if (context.protyle && context.nodeElement) {
      return await writeViaProtyle(context, patch);
    }
    return await writeViaApi(context.blockId, patch);
  } catch (error) {
    console.error('[BlockWriter] writeBlock failed:', error);
    return false;
  }
}

async function writeStatus(context: BlockWriteContext, patch: StatusPatch): Promise<boolean> {
  let targetId = context.blockId;
  let targetElement = context.nodeElement;

  // 检测是否为任务列表项内的段落
  if (context.protyle && context.nodeElement) {
    const listItem = context.nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]');
    if (listItem) {
      targetElement = listItem as HTMLElement;
      targetId = listItem.getAttribute('data-node-id')!;
    }
  } else {
    const block = await getBlockByID(context.blockId);
    if (block.parent_id) {
      const parent = await getBlockByID(block.parent_id);
      if (parent.type === 'NodeListItem' && parent.subtype === 't') {
        targetId = parent.id;  // ← 写入目标切换到父块（ListItem）
      }
    }
  }

  const newCtx = { ...context, blockId: targetId, nodeElement: targetElement };
  if (newCtx.protyle && newCtx.nodeElement) {
    return await writeViaProtyle(newCtx, patch);
  }
  return await writeViaApi(newCtx.blockId, patch);
}
```

核心逻辑：`setStatus` 时，如果检测到当前 block 是任务列表项内的段落，**写入目标从 paragraph 切换到 listItem**。
- 后续 `applyBlockPatch` 拿到的 kramdown 是 listItem 的（含 `[ ]`/`[x]`），而非 paragraph 的（无此标记）
- 提交时 `blockId` 指向 listItem，与思源原生操作一致（[wysiwyg/index.ts#L3067](file:///c:/dev/projects/open-source/siyuan/app/src/protyle/wysiwyg/index.ts#L3067)）

### 4.3 Kramdown Modifier

```typescript
// kramdownModifier.ts

export function applyBlockPatch(kramdown: string, blockId: string, patch: BlockPatch): string {
  const blocks = parseKramdownBlocks(kramdown);
  const targetBlock = blocks.find(b => b.blockId === blockId);
  if (!targetBlock) throw new Error(`Block ${blockId} not found in kramdown`);

  const ial = extractIAL(targetBlock.raw);
  const listPrefix = extractListPrefix(targetBlock.raw);
  // 去掉 IAL 和列表前缀，得到纯内容体（保留 [ ]/[x] 标记）
  const bodyContent = stripIALAndPrefix(targetBlock.raw, listPrefix);

  let newContent: string;
  switch (patch.type) {
    case 'addDate':
      newContent = applyDatePatch(bodyContent, patch);
      break;
    case 'setStatus':
      newContent = applyStatusPatch(bodyContent, patch);
      break;
    case 'setPriority':
      newContent = applyPriorityPatch(bodyContent, patch);
      break;
    case 'setContent':
      newContent = applyContentPatch(bodyContent, patch);
      break;
    case 'removeSlashCommands':
      newContent = applySlashCommandRemoval(bodyContent, patch);
      break;
  }

  const modifiedRaw = buildLineWithIAL(listPrefix, newContent, ial);
  return kramdown.replace(targetBlock.raw, modifiedRaw);
}
```

**示例**：任务列表 `setStatus`

```
raw:              "- {: id=\"abc\"}[ ] 任务内容"
ial:              "{: id=\"abc\"}"              (extractIAL)
listPrefix:       "- "                          (extractListPrefix)
bodyContent:      "[ ] 任务内容"                 (stripIALAndPrefix)
                  → applyStatusPatch → "[x] 任务内容"
modifiedRaw:      "- {: id=\"abc\"}[x] 任务内容" (buildLineWithIAL)
```

### 4.4 IAL Preserver

```typescript
// ialPreserver.ts

export function extractIAL(raw: string): string {
  const match = raw.match(/\{:([^}]*)\}/);
  return match ? match[0] : '';
}

export function extractListPrefix(raw: string): string {
  const match = raw.match(/^(\s*(?:[-]|\d+\.)\s*)/);
  return match ? match[1] : '';
}

export function stripIALAndPrefix(raw: string, listPrefix: string): string {
  return raw
    .replace(/\{:([^}]*)\}/g, '')
    .replace(listPrefix, '')
    .trim();
}

export function buildLineWithIAL(listPrefix: string, content: string, ial: string): string {
  if (!ial) return `${listPrefix}${content}`.trim();
  return `${listPrefix}${ial} ${content}`.trim();
}
```

### 4.5 斜杠命令移除改进

当前 `processLineText` 使用正则**全局替换**删除行内所有匹配模式（`/`、`/t`、`/to`...），会误删行内非命令的匹配文本。

改进：改为**首个匹配**移除——找到行内第一个匹配的斜杠命令模式，只删除那一处。

```typescript
// kramdownModifier.ts
export function applySlashCommandRemoval(bodyContent: string, patch: SlashCommandPatch): string {
  const patterns = generateSlashPatterns(patch.filters);
  const sortedPatterns = Array.from(patterns).sort((a, b) => b.length - a.length);

  let result = bodyContent;
  for (const pattern of sortedPatterns) {
    const idx = result.indexOf(pattern);
    if (idx !== -1) {
      result = result.slice(0, idx) + result.slice(idx + pattern.length);
      break;  // 只删第一个匹配
    }
  }

  result = result.trimStart();
  if (patch.suffix) {
    result = `${result} ${patch.suffix}`.trim();
  }
  return result;
}
```

对比思源原生做法（[hint/index.ts#L565-L763](file:///c:/dev/projects/open-source/siyuan/app/src/protyle/hint/index.ts#L565-L763)）：`range.setStart(container, this.lastIndex)` → `range.deleteContents()` —— 基于分隔符位置精确界定删除范围。改进后虽仍是文本层面操作（非 DOM Range），但"只删首个匹配"消除了误删风险。

#### 非事项行的处理

当前 `getValidatedItemFromNode`（[slashCommands.ts#L638-L644](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/slashCommands.ts#L638-L644)）检测到非有效事项行时，仅调用 `deleteSlashCommandContent` 删除斜杠命令文本。新方案通过 patch 分离自然覆盖此场景：

```
// 调用方决定用哪个 patch：
if (item) {
  writeBlock(ctx, { type: 'addDate', date, ... })   // 完整的事项修改
} else {
  writeBlock(ctx, { type: 'removeSlashCommands', filters })  // 只删前缀
}
```

`removeSlashCommands` patch 不含任何 date/status/priority 字段，语义上就是纯文本删除操作。

## 5. 数据流

### 5.1 Protyle Transport（0 次 HTTP，含光标保持）

```
// 步骤 1：保存光标位置
saveCursorOffset(protyle, nodeElement) → 光标在块文本内的字符偏移量

// 步骤 2：Lute 往返
nodeElement.outerHTML
  → protyle.lute.BlockDOM2StdMd()          // 纯本地计算
  → applyBlockPatch(kramdown, blockId, patch)
  → protyle.lute.Md2BlockDOM(newKramdown)  // 纯本地计算

// 步骤 3：替换 DOM + 提交事务
nodeElement.outerHTML = newHTML
protyle.transaction(doOps, undoOps)

// 步骤 4：恢复光标位置
restoreCursorOffset(nodeElement, savedOffset)
```

#### 光标保存机制

借鉴思源 `<wbr>` 标记思路（[selection.ts#L570-L625](file:///c:/dev/projects/open-source/siyuan/app/src/protyle/util/selection.ts#L570-L625)），在 Protyle Transport 中：

```
DOM 替换前：
  saveCursorOffset(protyle, nodeElement)
    → getSelection().getRangeAt(0)
    → 遍历块内文本节点，累加字符数直到光标位置
    → 返回 int（字符偏移量）

DOM 替换后（outerHTML 已更新，原 DOM 节点已销毁）：
  restoreCursorOffset(newNodeElement, savedOffset)
    → 在新 DOM 中从头遍历文本节点，累加字符数
    → 到达 savedOffset 位置时：range.setStart(textNode, localOffset)
    → range.collapse(true)
    → selection.removeAllRanges(); selection.addRange(range)
```

光标偏移量的计算基准是块内**可见文本**，与 `processLineText` 的文本操作对齐——删除斜杠命令后光标自然落在新文本的对应位置。

### 5.2 API Transport（1-2 次 HTTP）

```
// 非 setStatus patch：2 次 HTTP
getBlockKramdown(blockId)                  // HTTP #1
  → applyBlockPatch(kramdown, blockId, patch)
  → updateBlock('markdown', newKramdown, blockId)  // HTTP #2

// setStatus patch + 任务列表检测：最多 3 次 HTTP（仅类型检测，非 kramdown 解析）
getBlockByID(blockId)                      // HTTP #1（检测是否在任务列表中）
  → 若 parent.type === 'NodeListItem' && parent.subtype === 't'
    → blockId = parentId（切换目标为 ListItem）
getBlockKramdown(targetBlockId)            // HTTP #2
  → applyBlockPatch(kramdown, targetBlockId, patch)
  → updateBlock('markdown', newKramdown, targetBlockId)  // HTTP #3
```

### 5.3 Protyle Transport — setStatus 在任务列表中的处理

```
// 检测是否在任务列表中
nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]')
  → 是 → 使用 listItem 的 DOM 和 blockId（而非 paragraph）
    → lute.BlockDOM2StdMd(listItem.outerHTML)
    → "- {: id=\"yyy\"}[ ] 任务内容 📅2026-05-14"
    → applyBlockPatch → 修改 [-] 为 [x]
    → lute.Md2BlockDOM → 新的 listItem DOM
    → listItem.outerHTML = newHTML
    → protyle.transaction(doOps, undoOps)
  → 否 → 使用 paragraph，添加 #已完成 标签
```

### 5.4 降级策略

Protyle Transport 失败时（如 Lute 转换异常）自动降级到 API Transport。

## 6. 迁移对照

| 现有函数 | 新调用 |
|---------|--------|
| `updateBlockDateTime(blockId, date, startTime, endTime, allDay, originalDate, siblingItems, status, writer, precision)` | `writeBlock(ctx, { type:'addDate', date, startTime, endTime, allDay, originalDate, siblingItems, status, timePrecision })` |
| `updateBlockContent(blockId, suffix, writer, newItemContent)` | `writeBlock(ctx, { type:'setContent', suffix, newItemContent })` |
| `updateBlockPriority(blockId, priority, writer)` | `writeBlock(ctx, { type:'setPriority', priority })` |
| `deleteSlashCommandContent(protyle, filters, suffix, transform, persist)` | `writeBlock(ctx, { type:'removeSlashCommands', filters, suffix })` |
| `createProtyleWriter(protyle, nodeElement, blockId)` | 删除，由 `protyleTransport` 内部处理 |

## 7. 迁移策略：增量替换

| Phase | 替换目标 | 验证点 |
|-------|---------|--------|
| 1 | `updateBlockPriority` → `setPriority` patch | 优先级标记正确出现在行内 |
| 2 | `updateBlockContent` → `setContent` / `setStatus` patch | 状态标签正确、任务列表 [x] 切换正确 |
| 3 | `updateBlockDateTime` → `addDate` patch | 日期标记正确、多日期合并正确 |
| 4 | `deleteSlashCommandContent` + `createProtyleWriter` → `removeSlashCommands` patch | 斜杠文本被正确移除 |
| 5 | 清理 `fileUtils.ts` 中被替换的函数 | 编译通过、lint 通过 |

每替换一个函数后运行 `npm run test` 确认无回归。

## 8. IAL 保持验证用例

| 场景 | 原始行 | 修改后 | IAL 状态 |
|------|--------|--------|----------|
| 无 IAL 普通段落 | `任务内容` | `任务内容 📅2026-05-14` | — |
| 有 id 的列表项 | `- {: id="abc"}[ ] 任务` | `- {: id="abc"}[x] 任务` | ✅ id 保留 |
| 有自定义属性 | `- {: id="abc" custom-reminder="..."}[ ] 任务` | `- {: id="abc" custom-reminder="..."}[x] 任务` | ✅ 自定义属性保留 |
| 多行 pomodoro | `任务\n🍅 3/3` | `任务\n🍅 3/3` | ✅ 非事项行不受影响 |

## 9. 错误处理

| 错误 | Protyle Transport | API Transport |
|------|------------------|---------------|
| Lute 转换失败 | 降级到 API Transport | N/A |
| getBlockKramdown 失败 | N/A | throw → writeBlock 返回 false |
| updateBlock API 失败 | N/A | throw → writeBlock 返回 false |
| parseKramdownBlocks 找不到 block | throw → writeBlock 返回 false | throw → writeBlock 返回 false |

## 10. 测试策略

1. **单元测试** `kramdownModifier.test.ts`：给定 kramdown 输入 + patch，验证输出 kramdown
2. **IAL 保持测试**：验证自定义属性不被丢失
3. **集成测试**：通过 `npm run test` 确认现有测试套件不回归
4. **手动验证**：每个 Phase 完成后在 SiYuan 中验证实际编辑效果

---

## 附录 A：参考的思源源码

思源源码目录：`C:\dev\projects\open-source\siyuan`

| 文件 | 行号 | 内容 | 参考目的 |
|------|------|------|----------|
| `app/src/protyle/wysiwyg/index.ts` | L3054-L3067 | task checkbox 点击处理 | 确认 `[ ]`/`[x]` 切换更新的是 `NodeListItem`（非 `NodeParagraph`），`actionId` = list item 的 `data-node-id` |
| `app/src/protyle/hint/index.ts` | L1037-L1083 | `getKey()` 方法 | 理解斜杠命令分隔符识别逻辑：`lastIndex` 记录 `/` 在行内的字符偏移位置 |
| `app/src/protyle/hint/index.ts` | L442-L894 | `fill()` 方法 | 理解斜杠命令文本的精确删除：`range.setStart(container, lastIndex)` → `range.deleteContents()` |
| `app/src/protyle/util/selection.ts` | L570-L625 | `focusByWbr()` | 理解 `<wbr>` 标记方式的光标恢复机制，为本方案的光标保持提供思路 |
| `app/src/protyle/util/selection.ts` | L642-L774 | `focusBlock()` | 理解块级光标定位的通用方法 |
| `app/src/protyle/util/selection.ts` | L457-L537 | `focusByOffset()` | 理解基于字符偏移量的光标恢复方法 |
| `app/src/protyle/wysiwyg/input.ts` | L288-L289 | `focusByWbr` + `hint.render` | 确认输入事件后的光标恢复和提示渲染流程 |
| `kernel/api/block_op.go` | L786-L885 | `updateBlock` kernel 实现 | 确认 `NodeListItem` 特殊处理（L850-L857：剥离 list wrapper）、IAL id 保持（L859-L861） |
| `kernel/model/blockial.go` | 全文件 | IAL 属性处理 | 理解块属性（`{: id="xxx" custom-xxx="yyy"}`）的解析与序列化 |

## 附录 B：旧代码与新逻辑的对应关系

### 旧代码位置

| 函数 | 文件 | 行号 |
|------|------|------|
| `deleteSlashCommandContent` | `src/utils/slashCommands.ts` | L67-L214 |
| `updateTransaction` | `src/utils/slashCommands.ts` | L223-L251 |
| `createProtyleWriter` | `src/utils/slashCommands.ts` | L1290-L1426 |
| `getValidatedItemFromNode` | `src/utils/slashCommands.ts` | L627-L648 |
| `updateBlockDateTime` | `src/utils/fileUtils.ts` | L495-L1023 |
| `updateBlockContent` | `src/utils/fileUtils.ts` | L1105-L1404 |
| `updateBlockPriority` | `src/utils/fileUtils.ts` | L1413-L1593 |
| `handleSingleLineUpdate` | `src/utils/fileUtils.ts` | L430-L493 |
| `extractItemMarkers` | `src/utils/fileUtils.ts` | L184-L232 |
| `isTaskListFormat` | `src/utils/fileUtils.ts` | L239-L241 |
| `stripListAndBlockAttr` | `src/parser/core.ts` | L82-L114 |
| `isTaskList` 检测 | `src/parser/core.ts` | L474-L489 |
| `updateBlock` API | `src/api.ts` | L232-L244 |
| `getBlockKramdown` API | `src/api.ts` | L268-L276 |
| `getBlockByID` API | `src/api.ts` | L345-L349 |

### 新旧映射

| 旧代码 | 新代码 | 说明 |
|--------|--------|------|
| `deleteSlashCommandContent(slashCommands.ts:67-214)` | `writeBlock(ctx, { type:'removeSlashCommands', filters })` → `applySlashCommandRemoval` (首次匹配删除) | 删除斜杠命令文本，不再全局替换 |
| `updateTransaction(slashCommands.ts:223-251)` | 内联到 `writeViaProtyle` (protyleTransport.ts) | 统一在 Transport 层处理 |
| `createProtyleWriter(slashCommands.ts:1290-1426)` | **删除**，由 `writeViaProtyle` 统一处理 | 不再需要工厂函数和快/慢路径分支 |
| `updateBlockDateTime(fileUtils.ts:495-1023)` | `writeBlock(ctx, { type:'addDate', date, ... })` → `applyDatePatch` | 去掉父块 kramdown 查询，简化日期添加逻辑 |
| `updateBlockContent(fileUtils.ts:1105-1404)` | `writeBlock(ctx, { type:'setStatus', status })` → `applyStatusPatch` / `applyContentPatch` | 去掉父块检测，改为 Transport 层类型判断 |
| `updateBlockPriority(fileUtils.ts:1413-1593)` | `writeBlock(ctx, { type:'setPriority', priority })` → `applyPriorityPatch` | 去掉父块检测 |
| `handleSingleLineUpdate(fileUtils.ts:430-493)` | 内联到 `applyDatePatch` | 单行更新逻辑合并 |
| `extractItemMarkers(fileUtils.ts:184-232)` | **保留复用**，被 `applyDatePatch` 调用 | 无变化 |
| `isTaskListFormat(fileUtils.ts:239-241)` | **保留复用**，被 `applyStatusPatch` 调用 | 无变化 |
| `stripListAndBlockAttr(core.ts:82-114)` | **保留复用**，被各 patch 函数调用 | 无变化 |
| `isTaskList` 检测 (core.ts:474-489) | **保留**（解析器逻辑不在此次重构范围） | 无变化 |
| `updateBlock(api.ts:232-244)` | **保留复用**，被 `apiTransport.ts` 调用 | 无变化 |
| `getBlockKramdown(api.ts:268-276)` | **保留复用**，被 `apiTransport.ts` 调用 | 无变化 |
| `getBlockByID(api.ts:345-349)` | **保留复用**，被 `detectTaskListParent` 调用 | 无变化 |