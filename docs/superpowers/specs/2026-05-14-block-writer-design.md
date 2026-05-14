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
  protyleTransport.ts  — Protyle 场景 transport
  apiTransport.ts      — API-only 场景 transport
  ialPreserver.ts      — IAL 属性提取与恢复
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
  const contentWithoutIAL = stripIAL(targetBlock.raw);
  const listPrefix = extractListPrefix(targetBlock.raw);

  let newContent: string;
  switch (patch.type) {
    case 'addDate':
      newContent = applyDatePatch(contentWithoutIAL, patch);
      break;
    case 'setStatus':
      newContent = applyStatusPatch(contentWithoutIAL, patch);
      break;
    case 'setPriority':
      newContent = applyPriorityPatch(contentWithoutIAL, patch);
      break;
    case 'setContent':
      newContent = applyContentPatch(contentWithoutIAL, patch);
      break;
    case 'removeSlashCommands':
      newContent = applySlashCommandRemoval(contentWithoutIAL, patch);
      break;
  }

  const modifiedRaw = buildLineWithIAL(listPrefix, newContent, ial);
  return kramdown.replace(targetBlock.raw, modifiedRaw);
}
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

export function stripIAL(raw: string): string {
  return raw.replace(/\{:([^}]*)\}/g, '').trim();
}

export function buildLineWithIAL(listPrefix: string, content: string, ial: string): string {
  if (!ial) return `${listPrefix}${content}`.trim();
  return `${listPrefix}${ial} ${content}`.trim();
}
```

## 5. 数据流

### 5.1 Protyle Transport（0 次 HTTP）

```
nodeElement.outerHTML
  → protyle.lute.BlockDOM2StdMd()          // 纯本地计算
  → applyBlockPatch(kramdown, blockId, patch)
  → protyle.lute.Md2BlockDOM(newKramdown)  // 纯本地计算
  → nodeElement.outerHTML = newHTML
  → protyle.transaction(doOps, undoOps)
```

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