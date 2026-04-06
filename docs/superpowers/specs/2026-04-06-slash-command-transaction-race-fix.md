# Fix: Slash Command Transaction Race Condition

**Date:** 2026-04-06
**Status:** Draft
**Scope:** `src/utils/slashCommands.ts`, `src/utils/fileUtils.ts`

## Problem

When a slash command (e.g., `/jt`) triggers `updateBlockDateTime` or `updateBlockContent`, two competing write paths race to update the same block on the SiYuan server:

1. **Our code** calls `updateBlock` API (immediate HTTP request)
2. **SiYuan protyle** commits a debounced `transactions` API call (~512ms later) with the stale DOM state (still containing `/jt`)

The protyle's transaction overwrites our API result, losing the date marker.

### Root Cause

SiYuan's protyle uses `window.siyuan.transactions` queue with 512ms debounce (`TIMEOUT_INPUT * 2`). When the user types `/jt`, each keystroke triggers an input event that queues a content-change transaction. When the user selects the slash command, our callback fires and calls `updateBlock` API immediately. But the protyle's debounced transaction fires later (after the debounce timer expires), sending the stale DOM HTML and overwriting our API update.

Critically, SiYuan's plugin slash command handling (`hint/index.ts` fill method) does **NOT** call `range.deleteContents()` for plugin commands (unlike built-in commands). Plugin callbacks must handle their own DOM cleanup.

## Solution

### Strategy

Route all slash-command-triggered updates through `protyle.transaction()` instead of `updateBlock` API. This puts our operations in the same transaction queue as the protyle's own operations, enabling debounce merge and eliminating the race.

### Two-Path Design

**Simple case** (same block, single line):
- Update DOM text node directly
- Commit via `protyle.transaction()`
- Debounce merge replaces protyle's stale `doOperations` with ours
- Zero delay, zero race

**Complex case** (parent block, multi-line with tomato clocks):
- Wait for protyle transaction queue to flush
- Then call `updateBlock` API
- No race because protyle has no pending transactions

### Interface Changes

#### 1. `BlockWriter` type

```typescript
// src/utils/fileUtils.ts
export type BlockWriter = (
  content: string,       // computed new content (markdown)
  targetBlockId: string  // target block ID (may differ from current block for parent block updates)
) => Promise<boolean>;
```

#### 2. `updateBlockDateTime` signature change

```typescript
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay?: boolean,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus,
  writer?: BlockWriter  // NEW: optional writer hook
): Promise<boolean>
```

At the end of the function, the final `updateBlock` call is replaced:

```typescript
// Before:
await updateBlock('markdown', newContent, targetBlockId);

// After:
if (writer) {
  return await writer(newContent, targetBlockId);
}
await updateBlock('markdown', newContent, targetBlockId);
```

This change applies to both the single-line path and the multi-line path inside `updateBlockDateTime`.

#### 3. `updateBlockContent` signature change (same pattern)

```typescript
export async function updateBlockContent(
  blockId: string,
  tag: string,
  writer?: BlockWriter  // NEW
): Promise<boolean>
```

#### 4. `createProtyleWriter` factory

```typescript
// src/utils/slashCommands.ts

function createProtyleWriter(
  protyle: any,
  nodeElement: HTMLElement,
  currentBlockId: string
): BlockWriter {
  const oldHTML = nodeElement.outerHTML;

  return async (content, targetBlockId) => {
    // Strip block attribute lines {: id="..." }
    const textContent = content.replace(/\n\{:[^}]*\}/g, '').trim();

    // Simple case: same block, single line
    if (targetBlockId === currentBlockId && !content.includes('\n')) {
      // Update DOM text node
      const textNode = findFirstTextNode(nodeElement);
      if (textNode) {
        textNode.textContent = textContent;
      }

      // Update "updated" attribute
      const now = new Date();
      nodeElement.setAttribute('updated', formatDateForAttr(now));

      // Commit via protyle.transaction()
      const newHTML = nodeElement.outerHTML;
      if (newHTML !== oldHTML) {
        protyle.transaction(
          [{ id: targetBlockId, data: newHTML, action: 'update' }],
          [{ id: targetBlockId, data: oldHTML, action: 'update' }]
        );
      }
      return true;
    }

    // Complex case: wait for protyle queue to flush, then API
    await waitForProtyleTransactionsFlush();
    await updateBlock('markdown', content, targetBlockId);
    return true;
  };
}
```

#### 5. `waitForProtyleTransactionsFlush` helper

```typescript
async function waitForProtyleTransactionsFlush(timeout = 3000): Promise<void> {
  const start = Date.now();
  while ((window as any).siyuan?.transactions?.length > 0 && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 100));
  }
  // Extra buffer for server-side processing
  await new Promise(r => setTimeout(r, 200));
}
```

#### 6. Updated slash command handlers

**`markAsTodayItem`:**

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
  const existingItems = await extractDatesFromBlock(blockId);

  // Date already exists: just clean slash command text
  const todayItem = existingItems.find(item => item.date === today);
  if (todayItem) {
    deleteSlashCommandContent(protyle, filter);
    showMessage(t('slash').alreadyMarkedToday, 2000, 'info');
    return;
  }

  // Add date via writer (DOM+transaction) or API
  const success = await updateBlockDateTime(
    blockId, today,
    undefined, undefined, true,
    undefined,
    existingItems.length > 0 ? existingItems : undefined,
    undefined,
    writer  // NEW: pass writer hook
  );

  if (success) {
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}
```

**`markAsTomorrowItem`** and **`markAsDateItem`**: same pattern, pass `writer`.

**Handler in `getActionHandler`:**

```typescript
case 'today':
  return (protyle, nodeElement) => {
    const blockId = nodeElement.getAttribute('data-node-id');
    const writer = blockId ? createProtyleWriter(protyle, nodeElement, blockId) : undefined;
    markAsTodayItem(protyle, nodeElement, filter, writer);
  };
```

## Affected Commands

| Command | Current Path | New Path |
|---------|-------------|----------|
| `today` | `updateBlockDateTime` API | DOM + `protyle.transaction()` |
| `tomorrow` | `updateBlockDateTime` API | DOM + `protyle.transaction()` |
| `date` | `updateBlockDateTime` API | DOM + `protyle.transaction()` (after picker) |
| `done` | `deleteSlashCommandContent` | No change (already safe) |
| `abandon` | `deleteSlashCommandContent` | No change (already safe) |
| `markAsTask` | `deleteSlashCommandContent` + suffix | No change (already safe) |

## Non-Goals

- Not changing `updateBlockDateTime` behavior for non-slash-command callers (calendar view, detail panel, etc.)
- Not refactoring `deleteSlashCommandContent` — it already works correctly
- Not handling the `updateBlockContent` changes for standalone `markAsDone`/`markAsAbandoned` (those are called from non-slash contexts)

## Testing

1. Type `/jt` in a block → date marker should appear, `/jt` removed, no flicker
2. Type `/明天` → tomorrow's date added correctly
3. Type `/日期` → picker shows, after selection date is added correctly
4. Type `/jt` on a block that already has today's date → should show "already marked" message
5. Test on a list item block (parent block scenario) → should still work correctly via delayed API path
6. Test on a block with tomato clock records → complex path should handle correctly
