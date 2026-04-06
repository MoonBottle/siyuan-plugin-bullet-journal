# Slash Command Transaction Race Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the race condition between slash-command-triggered `updateBlock` API calls and SiYuan protyle's debounced `transactions`, by routing writes through `protyle.transaction()` when called from slash command context.

**Architecture:** Add an optional `writer` hook parameter to `updateBlockDateTime` and `updateBlockContent` in `fileUtils.ts`. When provided, the writer replaces the `updateBlock` API call. In `slashCommands.ts`, a `createProtyleWriter` factory produces a writer that updates the DOM and commits via `protyle.transaction()`, leveraging SiYuan's debounce merge to atomically replace the protyle's stale pending transaction. Complex cases (parent blocks, multi-line) fall back to a delayed `updateBlock` API call after the transaction queue flushes.

**Tech Stack:** TypeScript, SiYuan Plugin API, DOM manipulation

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/utils/fileUtils.ts` | Modify | Add `BlockWriter` type; add `writer` param to `updateBlockDateTime` (line 350) and `updateBlockContent` (line 640) |
| `src/utils/slashCommands.ts` | Modify | Add `createProtyleWriter`, `waitForProtyleTransactionsFlush`, `findFirstTextNode`, `formatUpdatedAttr`; update `markAsTodayItem`, `markAsTomorrowItem`, `markAsDateItem` handlers |

---

### Task 1: Add `BlockWriter` type and helper utilities

**Files:**
- Modify: `src/utils/fileUtils.ts:1-15` (add import + type near top)

- [ ] **Step 1: Add `BlockWriter` type export after imports in `fileUtils.ts`**

Insert after line 11 (`import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';`):

```typescript
/**
 * 写入钩子 - 用于斜杠命令中替换 updateBlock API
 * 通过 protyle.transaction() 提交，避免和 protyle 的防抖事务竞争
 */
export type BlockWriter = (
  content: string,
  targetBlockId: string
) => Promise<boolean>;
```

- [ ] **Step 2: Verify no compile errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new type (may have existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/utils/fileUtils.ts
git commit -m "feat: add BlockWriter type for transaction-safe block updates"
```

---

### Task 2: Add `writer` parameter to `updateBlockDateTime`

**Files:**
- Modify: `src/utils/fileUtils.ts:350-565`

- [ ] **Step 1: Update function signature (line 350-359)**

Replace:

```typescript
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus
): Promise<boolean> {
```

With:

```typescript
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus,
  writer?: BlockWriter
): Promise<boolean> {
```

- [ ] **Step 2: Replace the three `updateBlock` calls with writer-aware logic**

**Call 1 — line 431 (single-line path):**

Replace:
```typescript
      await updateBlock('markdown', newContent + attrSuffix, targetBlockId);
      return true;
```

With:
```typescript
      if (writer) {
        return await writer(newContent + attrSuffix, targetBlockId);
      }
      await updateBlock('markdown', newContent + attrSuffix, targetBlockId);
      return true;
```

**Call 2 — line 470 (fallback in multi-line path):**

Replace:
```typescript
      await updateBlock('markdown', newContent + attrSuffix, targetBlockId);
      return true;
```

With:
```typescript
      if (writer) {
        return await writer(newContent + attrSuffix, targetBlockId);
      }
      await updateBlock('markdown', newContent + attrSuffix, targetBlockId);
      return true;
```

**Call 3 — line 558 (multi-line with tomato clock / parent block):**

Replace:
```typescript
    await updateBlock('markdown', newContent, targetBlockId);

    return true;
```

With:
```typescript
    if (writer) {
      return await writer(newContent, targetBlockId);
    }
    await updateBlock('markdown', newContent, targetBlockId);

    return true;
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors. All existing callers still work since `writer` is optional.

- [ ] **Step 4: Commit**

```bash
git add src/utils/fileUtils.ts
git commit -m "feat: add writer hook to updateBlockDateTime for protyle.transaction path"
```

---

### Task 3: Add `writer` parameter to `updateBlockContent`

**Files:**
- Modify: `src/utils/fileUtils.ts:640-854`

- [ ] **Step 1: Update function signature (line 640-643)**

Replace:

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
```

With:

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string,
  writer?: BlockWriter
): Promise<boolean> {
```

- [ ] **Step 2: Replace the two `updateBlock` calls**

**Call 1 — line 791 (main path, item line found):**

Replace:
```typescript
      await updateBlock('markdown', newContent, targetBlockId);
      return true;
```

With:
```typescript
      if (writer) {
        return await writer(newContent, targetBlockId);
      }
      await updateBlock('markdown', newContent, targetBlockId);
      return true;
```

**Call 2 — line 847 (fallback path, no item line):**

Replace:
```typescript
    await updateBlock('markdown', newContent, targetBlockId);
```

With:
```typescript
    if (writer) {
      return await writer(newContent, targetBlockId);
    }
    await updateBlock('markdown', newContent, targetBlockId);
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/utils/fileUtils.ts
git commit -m "feat: add writer hook to updateBlockContent for protyle.transaction path"
```

---

### Task 4: Add `createProtyleWriter` and helper utilities to `slashCommands.ts`

**Files:**
- Modify: `src/utils/slashCommands.ts:27-28` (add new imports + functions)

- [ ] **Step 1: Add `updateBlock` import**

In the imports section, find line 13:
```typescript
import { updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
```

Replace with:
```typescript
import { updateBlockContent, updateBlockDateTime, type BlockWriter } from '@/utils/fileUtils';
```

Also add `updateBlock` import — find the import from `@/api` (line 27):
```typescript
import { getHPathByID, getBlockByID, renameDocByID } from '@/api';
```

Replace with:
```typescript
import { getHPathByID, getBlockByID, renameDocByID, updateBlock } from '@/api';
```

- [ ] **Step 2: Add helper functions after `getStatusTag` function (after line 794)**

Insert these three utility functions:

```typescript
/**
 * 格式化 updated 属性值
 */
function formatUpdatedAttr(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

/**
 * 查找块元素内的第一个文本节点
 */
function findFirstTextNode(element: HTMLElement): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // 跳过 protyle-attr 内的文本节点
      if ((node.parentElement as HTMLElement)?.classList?.contains('protyle-attr')) {
        return NodeFilter.FILTER_REJECT;
      }
      // 跳过空文本节点
      return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  return walker.nextNode() as Text | null;
}

/**
 * 等待 protyle 事务队列清空
 * 用于复杂场景下确保 protyle 的防抖事务已提交到服务端
 */
async function waitForProtyleTransactionsFlush(timeout = 3000): Promise<void> {
  const start = Date.now();
  const siyuanWin = window as any;
  while (siyuanWin.siyuan?.transactions?.length > 0 && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 100));
  }
  // 额外 buffer 确保服务端处理完毕
  await new Promise(r => setTimeout(r, 200));
}

/**
 * 创建 protyle writer 工厂函数
 * 将 updateBlock API 调用替换为 DOM 更新 + protyle.transaction()
 * 利用思源事务队列的防抖合并机制，自动替换 protyle 的旧 doOperations
 */
function createProtyleWriter(
  protyle: any,
  nodeElement: HTMLElement,
  currentBlockId: string
): BlockWriter {
  const oldHTML = nodeElement.outerHTML;

  return async (content: string, targetBlockId: string): Promise<boolean> => {
    try {
      // 去掉块属性行 {: id="..." updated="..." }
      const textContent = content.replace(/\n\{:[^}]*\}/g, '').trim();

      // 简单场景：同块 + 单行 → 走 DOM + protyle.transaction()
      const isSameBlock = targetBlockId === currentBlockId;
      const isSingleLine = !content.includes('\n');

      if (isSameBlock && isSingleLine) {
        const textNode = findFirstTextNode(nodeElement);
        if (textNode) {
          textNode.textContent = textContent;
        }

        nodeElement.setAttribute('updated', formatUpdatedAttr(new Date()));

        const newHTML = nodeElement.outerHTML;
        if (newHTML !== oldHTML) {
          protyle.transaction(
            [{ id: targetBlockId, data: newHTML, action: 'update' }],
            [{ id: targetBlockId, data: oldHTML, action: 'update' }]
          );
        }
        return true;
      }

      // 复杂场景：父块或多行 → 等队列清空后走 API
      await waitForProtyleTransactionsFlush();
      await updateBlock('markdown', content, targetBlockId);
      return true;
    } catch (error) {
      console.error('[Task Assistant] ProtyleWriter error:', error);
      // 降级到 API 路径
      await updateBlock('markdown', content, targetBlockId);
      return true;
    }
  };
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors. Functions not yet called, but all types resolve correctly.

- [ ] **Step 4: Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat: add createProtyleWriter and helper utilities for transaction-safe updates"
```

---

### Task 5: Update `markAsTodayItem` to accept and use `writer`

**Files:**
- Modify: `src/utils/slashCommands.ts:653-692`

- [ ] **Step 1: Update function signature and body**

Replace the entire `markAsTodayItem` function (lines 653-692):

```typescript
async function markAsTodayItem(
  protyle: any,
  nodeElement: HTMLElement,
  filter: string[] = SLASH_COMMAND_FILTERS.TODAY
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const today = formatDate(new Date());

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查今天是否已存在
  const todayItem = existingItems.find(item => item.date === today);
  if (todayItem) {
    // 日期已存在，删除斜杠命令并提示
    deleteSlashCommandContent(protyle, filter);
    showMessage(t('slash').alreadyMarkedToday || '今天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加今日日期
  const success = await updateBlockDateTime(
    blockId,
    today,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined  // status
  );

  if (success) {
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}
```

With:

```typescript
async function markAsTodayItem(
  protyle: any,
  nodeElement: HTMLElement,
  filter: string[] = SLASH_COMMAND_FILTERS.TODAY,
  writer?: BlockWriter
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const today = formatDate(new Date());

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查今天是否已存在
  const todayItem = existingItems.find(item => item.date === today);
  if (todayItem) {
    // 日期已存在，删除斜杠命令并提示
    deleteSlashCommandContent(protyle, filter);
    showMessage(t('slash').alreadyMarkedToday || '今天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加今日日期
  const success = await updateBlockDateTime(
    blockId,
    today,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined, // status
    writer
  );

  if (success) {
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat: pass writer through markAsTodayItem for transaction-safe updates"
```

---

### Task 6: Update `markAsTomorrowItem` to accept and use `writer`

**Files:**
- Modify: `src/utils/slashCommands.ts:699-737`

- [ ] **Step 1: Update function signature and body**

Replace the entire `markAsTomorrowItem` function (lines 699-737):

```typescript
async function markAsTomorrowItem(
  protyle: any,
  nodeElement: HTMLElement,
  filter: string[] = SLASH_COMMAND_FILTERS.TOMORROW
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查明天是否已存在
  const tomorrowItem = existingItems.find(item => item.date === tomorrow);
  if (tomorrowItem) {
    deleteSlashCommandContent(protyle, filter);
    showMessage(t('slash').alreadyMarkedTomorrow || '明天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加明天日期
  const success = await updateBlockDateTime(
    blockId,
    tomorrow,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined  // status
  );

  if (success) {
    showMessage(t('slash').markTomorrowSuccess || '已标记为明天事项', 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}
```

With:

```typescript
async function markAsTomorrowItem(
  protyle: any,
  nodeElement: HTMLElement,
  filter: string[] = SLASH_COMMAND_FILTERS.TOMORROW,
  writer?: BlockWriter
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查明天是否已存在
  const tomorrowItem = existingItems.find(item => item.date === tomorrow);
  if (tomorrowItem) {
    deleteSlashCommandContent(protyle, filter);
    showMessage(t('slash').alreadyMarkedTomorrow || '明天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加明天日期
  const success = await updateBlockDateTime(
    blockId,
    tomorrow,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined, // status
    writer
  );

  if (success) {
    showMessage(t('slash').markTomorrowSuccess || '已标记为明天事项', 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat: pass writer through markAsTomorrowItem for transaction-safe updates"
```

---

### Task 7: Update `markAsDateItem` to accept and use `writer`

**Files:**
- Modify: `src/utils/slashCommands.ts:744-787`

- [ ] **Step 1: Update function signature and pass `writer`**

Replace the entire `markAsDateItem` function (lines 744-787):

```typescript
async function markAsDateItem(
  protyle: any,
  nodeElement: HTMLElement,
  filter: string[] = SLASH_COMMAND_FILTERS.DATE,
  writer?: BlockWriter
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 使用 showDatePickerDialog 选择日期
  showDatePickerDialog(
    t('slash').selectDateTitle || '选择日期',
    dayjs().format('YYYY-MM-DD'),
    async (selectedDate) => {
      // 检查日期是否已存在
      const existingItem = existingItems.find(item => item.date === selectedDate);
      if (existingItem) {
        deleteSlashCommandContent(protyle, filter);
        showMessage(t('slash').alreadyMarkedDate || '该日期已标记', 2000, 'info');
        return;
      }

      // 使用 updateBlockDateTime 添加日期
      const success = await updateBlockDateTime(
        blockId,
        selectedDate,
        undefined, // newStartTime
        undefined, // newEndTime
        true,      // allDay
        undefined, // originalDate - undefined 表示添加新日期
        existingItems.length > 0 ? existingItems : undefined,
        undefined, // status
        writer
      );

      if (success) {
        showMessage(t('slash').markDateSuccess || '已标记日期', 2000, 'info');
      } else {
        showMessage(t('slash').markFailed, 2000, 'error');
      }
    }
  );
}
```

Note: For `markAsDateItem`, the user interaction (date picker dialog) takes seconds, so by the time the callback fires the protyle's 512ms debounce has already expired. The `waitForProtyleTransactionsFlush` inside the writer handles any remaining edge cases.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat: pass writer through markAsDateItem for transaction-safe updates"
```

---

### Task 8: Update `getActionHandler` to create and pass `writer` for date commands

**Files:**
- Modify: `src/utils/slashCommands.ts:491-497` (today handler)
- Modify: `src/utils/slashCommands.ts:498-503` (tomorrow handler)
- Modify: `src/utils/slashCommands.ts:504-510` (date handler)

- [ ] **Step 1: Update the `today` case in `getActionHandler`**

Find (around line 491):
```typescript
    case 'today':
      return (protyle, nodeElement) => markAsTodayItem(protyle, nodeElement, filter);
```

Replace with:
```typescript
    case 'today':
      return (protyle, nodeElement) => {
        const blockId = nodeElement.getAttribute('data-node-id');
        const writer = blockId ? createProtyleWriter(protyle, nodeElement, blockId) : undefined;
        markAsTodayItem(protyle, nodeElement, filter, writer);
      };
```

- [ ] **Step 2: Update the `tomorrow` case**

Find (around line 498):
```typescript
    case 'tomorrow':
      return (protyle, nodeElement) => markAsTomorrowItem(protyle, nodeElement, filter);
```

Replace with:
```typescript
    case 'tomorrow':
      return (protyle, nodeElement) => {
        const blockId = nodeElement.getAttribute('data-node-id');
        const writer = blockId ? createProtyleWriter(protyle, nodeElement, blockId) : undefined;
        markAsTomorrowItem(protyle, nodeElement, filter, writer);
      };
```

- [ ] **Step 3: Update the `date` case**

Find (around line 504):
```typescript
    case 'date':
      return (protyle, nodeElement) => markAsDateItem(protyle, nodeElement, filter);
```

Replace with:
```typescript
    case 'date':
      return (protyle, nodeElement) => {
        const blockId = nodeElement.getAttribute('data-node-id');
        const writer = blockId ? createProtyleWriter(protyle, nodeElement, blockId) : undefined;
        markAsDateItem(protyle, nodeElement, filter, writer);
      };
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat: wire up protyle writer for today/tomorrow/date slash commands"
```

---

### Task 9: Build and manual test

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run existing tests**

Run: `npm run test`
Expected: All existing tests pass (no regressions).

- [ ] **Step 3: Manual test — basic `/jt` flow**

1. Open SiYuan with the plugin installed
2. Create a new paragraph block
3. Type `/jt` and select the "mark as today" command
4. Verify: `/jt` text is removed, `📅YYYY-MM-DD` date marker appears
5. Open browser DevTools Network tab
6. Repeat steps 2-4
7. Verify: Only ONE `transactions` request is sent (no separate `updateBlock` request for simple case)

- [ ] **Step 4: Manual test — `/明天` flow**

Same as Step 3 but use `/明天` and verify tomorrow's date is added.

- [ ] **Step 5: Manual test — `/日期` with date picker**

1. Type `/日期` and select the date picker command
2. Pick a date from the dialog
3. Verify: date is added correctly
4. Check Network tab: should see a `transactions` call (for DOM cleanup) followed by an `updateBlock` call (for date addition, after the dialog callback)

- [ ] **Step 6: Manual test — already-marked case**

1. Use `/jt` on a block already marked with today
2. Verify: shows "already marked" message, no duplicate date

- [ ] **Step 7: Manual test — parent block scenario (list item)**

1. Create a list with a task item containing a date: `- [ ] task 📅2026-04-06`
2. Use `/jt` on the task item
3. Verify: date is added (or "already marked" shown)
4. Check that list structure is preserved

- [ ] **Step 8: Commit final state if any adjustments needed**

```bash
git add -A
git commit -m "fix: adjust protyle writer based on manual testing"
```
