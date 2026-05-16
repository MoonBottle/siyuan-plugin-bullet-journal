# BlockWriter 统一块写入层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立符合思源源码写入语义的 BlockWriter，并先通过 npm dev 专用测试入口人工验证新逻辑；验证通过后再逐步替换现有写入。

**Architecture:** 先新增独立 `src/utils/blockWriter/` 模块，不改现有 `fileUtils.ts` / `slashCommands.ts` 的业务写入路径。dev 模式额外注册 `/bwtest` 斜杠命令验证 Protyle Transport，额外注册顶栏 `BlockWriter API Test` 按钮验证 API Transport。

**Tech Stack:** TypeScript, Vitest, SiYuan Kernel API (`getBlockByID`, `getBlockKramdown`, `updateBlock`), SiYuan Protyle Lute (`SpinBlockDOM`), existing plugin slash/topbar APIs.

---

## Scope Rules

1. 本计划第一轮不替换任何现有业务写入逻辑。
2. `/bwtest` 和 `BlockWriter API Test` 只在 `import.meta.env.DEV` 下注册。
3. Protyle 路径不默认走 `BlockDOM2StdMd -> Md2BlockDOM`，只做最小 DOM/Range 修改、`SpinBlockDOM`、transaction。
4. API 路径基于真实 `getBlockKramdown` 形态：内容行 + trailing IAL 行。
5. dev-only 验证通过后，后续迁移任务再逐个替换真实入口。

## Coverage Decision

一个测试斜杠命令 + 一个顶栏按钮足够做第一轮 smoke test，但不够做最终验收：

- `/bwtest` 覆盖 Protyle Transport、Range/offset 删除、`SpinBlockDOM`、transaction、undo/redo。
- 顶栏按钮覆盖 API Transport、`getBlockKramdown`、`updateBlock`、trailing IAL 保留。
- 仍需后续专项验证：任务列表 `NodeListItem` 状态切换、多日期合并、番茄钟附属行、自定义提醒/重复属性。

## File Structure

| 文件 | 职责 |
|------|------|
| `src/utils/blockWriter/types.ts` | BlockWriter 类型 |
| `src/utils/blockWriter/itemLineMarkers.ts` | 事项行 marker 纯函数 |
| `src/utils/blockWriter/kramdownBlocks.ts` | 拆分/重建 content lines + trailing IAL |
| `src/utils/blockWriter/kramdownModifier.ts` | 纯函数 patch |
| `src/utils/blockWriter/blockTargetResolver.ts` | API 目标块解析 |
| `src/utils/blockWriter/apiTransport.ts` | API-only 写入 |
| `src/utils/blockWriter/slashRange.ts` | Range/offset 删除 |
| `src/utils/blockWriter/protyleTransport.ts` | Protyle 写入与失败返回 |
| `src/utils/blockWriter/index.ts` | `writeBlock()` |
| `src/utils/slashCommands.ts` | dev-only `/bwtest` |
| `src/index.ts` | dev-only 顶栏按钮 |
| `test/blockWriter/*.test.ts` | 单元测试 |

---

### Task 1: Add Core Types

**Files:**
- Create: `src/utils/blockWriter/types.ts`

- [ ] **Step 1: Create directory**

```powershell
if (-not (Test-Path "src/utils/blockWriter")) { New-Item -ItemType Directory -Path "src/utils/blockWriter" -Force }
```

- [ ] **Step 2: Add `types.ts`**

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

export type DatePatch = {
  type: 'addDate';
  date: string;
  originalDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  timePrecision?: TimePrecision;
  siblingItems?: ItemDateTimeInfo[];
};

export type StatusPatch = {
  type: 'setStatus';
  status: ItemStatus;
};

export type PriorityPatch = {
  type: 'setPriority';
  priority: PriorityLevel | undefined;
};

export type ContentPatch = {
  type: 'setContent';
  suffix?: string;
  newItemContent?: string;
};

export type SlashCommandPatch = {
  type: 'removeSlashCommands';
  filters: string[];
  suffix?: string;
};

export type BlockPatch =
  | DatePatch
  | StatusPatch
  | PriorityPatch
  | ContentPatch
  | SlashCommandPatch;

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

- [ ] **Step 3: Verify**

```powershell
npx tsc --noEmit --pretty
```

Expected: no new type errors.

- [ ] **Step 4: Commit**

```powershell
git add src/utils/blockWriter/types.ts
git commit -m "feat(blockWriter): add core write types"
```

---

### Task 2: Add Kramdown Block Utilities

**Files:**
- Create: `src/utils/blockWriter/kramdownBlocks.ts`
- Create: `test/blockWriter/kramdownBlocks.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it } from 'vitest';
import { replaceContentLines, splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';

describe('kramdownBlocks', () => {
  it('splits content and trailing IAL', () => {
    const raw = '任务内容 📅2026-05-14\n{: id="abc" custom-reminder="yes"}';
    expect(splitKramdownBlock(raw)).toEqual({
      contentLines: ['任务内容 📅2026-05-14'],
      ialLines: ['{: id="abc" custom-reminder="yes"}'],
      raw,
    });
  });

  it('keeps pomodoro lines as content', () => {
    const raw = '任务内容 📅2026-05-14\n🍅 3/3\n{: id="abc"}';
    expect(splitKramdownBlock(raw).contentLines).toEqual(['任务内容 📅2026-05-14', '🍅 3/3']);
  });

  it('rebuilds with original IAL', () => {
    const parts = splitKramdownBlock('- [ ] 任务\n{: id="abc" custom-x="1"}');
    expect(replaceContentLines(parts, ['- [x] 任务'])).toBe('- [x] 任务\n{: id="abc" custom-x="1"}');
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx vitest run test/blockWriter/kramdownBlocks.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement**

```ts
import type { KramdownBlockParts } from './types';

function isIALLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('{:') && trimmed.endsWith('}');
}

export function splitKramdownBlock(raw: string): KramdownBlockParts {
  const lines = raw.split('\n');
  const ialLines: string[] = [];
  while (lines.length > 0 && isIALLine(lines[lines.length - 1])) {
    ialLines.unshift(lines.pop()!);
  }
  return {
    contentLines: lines,
    ialLines,
    raw,
  };
}

export function rebuildKramdownBlock(parts: KramdownBlockParts): string {
  return [...parts.contentLines, ...parts.ialLines].join('\n');
}

export function replaceContentLines(parts: KramdownBlockParts, contentLines: string[]): string {
  return rebuildKramdownBlock({
    ...parts,
    contentLines,
  });
}
```

- [ ] **Step 4: Verify**

```powershell
npx vitest run test/blockWriter/kramdownBlocks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/kramdownBlocks.ts test/blockWriter/kramdownBlocks.test.ts
git commit -m "feat(blockWriter): preserve trailing IAL in kramdown blocks"
```

---

### Task 3: Add Marker and Modifier Utilities

**Files:**
- Create: `src/utils/blockWriter/itemLineMarkers.ts`
- Create: `src/utils/blockWriter/kramdownModifier.ts`
- Create: `test/blockWriter/kramdownModifier.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it } from 'vitest';
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';
import { applyBlockPatch } from '@/utils/blockWriter/kramdownModifier';

describe('kramdownModifier', () => {
  it('sets status and preserves IAL', () => {
    const parts = splitKramdownBlock('任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}');
    expect(applyBlockPatch(parts, { type: 'setStatus', status: 'completed' }))
      .toBe('任务 📅2026-05-14 #已完成\n{: id="abc" custom-reminder="yes"}');
  });

  it('sets task list status', () => {
    const parts = splitKramdownBlock('- [ ] 任务 📅2026-05-14\n{: id="abc"}');
    expect(applyBlockPatch(parts, { type: 'setStatus', status: 'completed' }))
      .toBe('- [x] 任务 📅2026-05-14\n{: id="abc"}');
  });

  it('sets priority before date', () => {
    const parts = splitKramdownBlock('任务 📅2026-05-14\n{: id="abc"}');
    expect(applyBlockPatch(parts, { type: 'setPriority', priority: 'high' }))
      .toBe('任务 🔥 📅2026-05-14\n{: id="abc"}');
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement `itemLineMarkers.ts`**

```ts
import type { PriorityLevel } from '@/types/models';
import {
  generatePriorityMarker as generatePriorityMarkerFromParser,
  stripPriorityMarker as stripPriorityMarkerFromParser,
} from '@/parser/priorityParser';

export function isTaskListFormat(line: string): boolean {
  return /\[\s*[xX]?\s*\]/.test(line);
}

export function stripPriorityMarker(line: string): string {
  return stripPriorityMarkerFromParser(line).replace(/\s{2,}/g, ' ').trim();
}

export function generatePriorityMarker(priority: PriorityLevel): string {
  return generatePriorityMarkerFromParser(priority);
}
```

- [ ] **Step 4: Implement `kramdownModifier.ts`**

```ts
import type { BlockPatch, KramdownBlockParts } from './types';
import { replaceContentLines } from './kramdownBlocks';
import { generatePriorityMarker, isTaskListFormat, stripPriorityMarker } from './itemLineMarkers';

const STATUS_TAGS = ['#已完成', '#已放弃', '#done', '#abandoned', '✅', '❌'];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function primaryLineIndex(lines: string[]): number {
  const index = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('{:') && !trimmed.startsWith('🍅');
  });
  return index >= 0 ? index : 0;
}

function removeStatusTags(line: string): string {
  let result = line;
  for (const tag of STATUS_TAGS) {
    result = result.replace(new RegExp(`\\s*${escapeRegex(tag)}`, 'g'), '');
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

function applyStatus(line: string, status: BlockPatch & { type: 'setStatus' }): string {
  if (isTaskListFormat(line)) {
    let result = line.replace(/\[\s*[xX]?\s*\]/, status.status === 'completed' ? '[x]' : '[ ]');
    result = removeStatusTags(result);
    return status.status === 'abandoned' ? `${result} #已放弃` : result;
  }
  const cleaned = removeStatusTags(line);
  if (status.status === 'completed') return `${cleaned} #已完成`;
  if (status.status === 'abandoned') return `${cleaned} #已放弃`;
  return cleaned;
}

function applyPriority(line: string, priority: BlockPatch & { type: 'setPriority' }): string {
  let result = stripPriorityMarker(line);
  if (!priority.priority) return result;
  const marker = generatePriorityMarker(priority.priority);
  const dateMatch = result.match(/(?:@|📅)\d{4}-\d{2}-\d{2}/);
  if (!dateMatch || dateMatch.index === undefined) return `${result} ${marker}`.trim();
  return `${result.slice(0, dateMatch.index).trimEnd()} ${marker} ${result.slice(dateMatch.index).trimStart()}`.trim();
}

export function applyBlockPatch(parts: KramdownBlockParts, patch: BlockPatch): string {
  const contentLines = [...parts.contentLines];
  const index = primaryLineIndex(contentLines);
  const line = contentLines[index] ?? '';

  if (patch.type === 'setStatus') {
    contentLines[index] = applyStatus(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setPriority') {
    contentLines[index] = applyPriority(line, patch);
    return replaceContentLines(parts, contentLines);
  }

  throw new Error(`Patch ${patch.type} is not implemented yet`);
}
```

- [ ] **Step 5: Verify**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/blockWriter/itemLineMarkers.ts src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add basic kramdown patches"
```

---

### Task 4: Add API Resolver and Transport

**Files:**
- Create: `src/utils/blockWriter/blockTargetResolver.ts`
- Create: `src/utils/blockWriter/apiTransport.ts`
- Create: `src/utils/blockWriter/index.ts`
- Create: `test/blockWriter/apiTransport.test.ts`

- [ ] **Step 1: Write API transport test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeViaApi } from '@/utils/blockWriter/apiTransport';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
  getBlockKramdown: vi.fn(),
  updateBlock: vi.fn(),
}));

const api = await import('@/api');

describe('apiTransport', () => {
  beforeEach(() => vi.resetAllMocks());

  it('writes priority and preserves IAL', async () => {
    vi.mocked(api.getBlockByID).mockResolvedValue({ id: 'abc', type: 'NodeParagraph' } as any);
    vi.mocked(api.getBlockKramdown).mockResolvedValue({
      id: 'abc',
      kramdown: '任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}',
    } as any);
    vi.mocked(api.updateBlock).mockResolvedValue([] as any);

    const ok = await writeViaApi('abc', { type: 'setPriority', priority: 'high' });

    expect(ok).toBe(true);
    expect(api.updateBlock).toHaveBeenCalledWith(
      'markdown',
      '任务 🔥 📅2026-05-14\n{: id="abc" custom-reminder="yes"}',
      'abc',
    );
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx vitest run test/blockWriter/apiTransport.test.ts
```

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement resolver**

```ts
import { getBlockByID, getBlockKramdown } from '@/api';
import type { BlockPatch, ResolvedBlockTarget } from './types';
import { splitKramdownBlock } from './kramdownBlocks';

function subtypeOf(block: any): string | undefined {
  return block?.subtype ?? block?.subType;
}

export async function resolveApiBlockTarget(blockId: string, patch: BlockPatch): Promise<ResolvedBlockTarget> {
  const block = await getBlockByID(blockId);
  let targetBlock = block;
  let targetBlockId = blockId;

  if (patch.type === 'setStatus' && block?.parent_id) {
    const parent = await getBlockByID(block.parent_id);
    if (parent?.type === 'NodeListItem' && subtypeOf(parent) === 't') {
      targetBlock = parent;
      targetBlockId = parent.id;
    }
  }

  const result = await getBlockKramdown(targetBlockId);
  if (!result?.kramdown) throw new Error(`Failed to get kramdown for block ${targetBlockId}`);

  return {
    originalBlockId: blockId,
    targetBlockId,
    targetType: targetBlock?.type,
    targetSubType: subtypeOf(targetBlock),
    fullKramdown: result.kramdown,
    targetRaw: result.kramdown,
    parts: splitKramdownBlock(result.kramdown),
    replaceMode: 'whole-block',
  };
}
```

- [ ] **Step 4: Implement API transport and entry**

`src/utils/blockWriter/apiTransport.ts`:

```ts
import { updateBlock } from '@/api';
import type { BlockPatch } from './types';
import { resolveApiBlockTarget } from './blockTargetResolver';
import { applyBlockPatch } from './kramdownModifier';

export async function writeViaApi(blockId: string, patch: BlockPatch): Promise<boolean> {
  try {
    const target = await resolveApiBlockTarget(blockId, patch);
    const markdown = applyBlockPatch(target.parts, patch);
    const result = await updateBlock('markdown', markdown, target.targetBlockId);
    return Array.isArray(result);
  } catch (error) {
    console.error('[BlockWriter] writeViaApi failed:', error);
    return false;
  }
}
```

`src/utils/blockWriter/index.ts`:

```ts
import type { BlockPatch, BlockWriteContext } from './types';
import { writeViaApi } from './apiTransport';

export type {
  BlockPatch,
  BlockWriteContext,
  ContentPatch,
  DatePatch,
  ItemDateTimeInfo,
  PriorityPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
} from './types';

export async function writeBlock(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  return writeViaApi(context.blockId, patch);
}
```

- [ ] **Step 5: Verify**

```powershell
npx vitest run test/blockWriter/apiTransport.test.ts test/blockWriter/kramdownModifier.test.ts test/blockWriter/kramdownBlocks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/blockWriter/blockTargetResolver.ts src/utils/blockWriter/apiTransport.ts src/utils/blockWriter/index.ts test/blockWriter/apiTransport.test.ts
git commit -m "feat(blockWriter): add API write transport"
```

---

### Task 5: Add Dev-only Topbar API Test Button

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import**

```ts
import { writeBlock } from '@/utils/blockWriter';
```

- [ ] **Step 2: Add selected block helper**

Inside `TaskAssistantPlugin`:

```ts
private getCurrentEditorBlockId(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return getBlockIdFromRange(selection.getRangeAt(0)) ?? null;
}
```

- [ ] **Step 3: Register dev-only button**

In `registerTopBar()`, add a separate topbar button without changing the existing menu:

```ts
if (import.meta.env.DEV) {
  this.addTopBar({
    icon: 'iconBug',
    title: 'BlockWriter API Test',
    callback: async () => {
      const blockId = this.getCurrentEditorBlockId();
      if (!blockId) {
        showMessage('BlockWriter API test: no selected block', 2000, 'error');
        return;
      }

      const success = await writeBlock(
        { blockId },
        { type: 'setPriority', priority: 'high' },
      );

      showMessage(
        success ? 'BlockWriter API test success' : 'BlockWriter API test failed',
        2000,
        success ? 'info' : 'error',
      );
    },
  });
}
```

- [ ] **Step 4: Verify**

```powershell
npx vitest run test/blockWriter/
npx tsc --noEmit --pretty
```

Expected: PASS.

- [ ] **Step 5: Manual dev verification**

Run `npm run dev`, select a block, click `BlockWriter API Test`.

Expected:

- `🔥` is written through API Transport;
- trailing IAL/custom attrs remain;
- normal topbar menu still works;
- production build does not contain visible `BlockWriter API Test`.

- [ ] **Step 6: Commit**

```powershell
git add src/index.ts
git commit -m "feat(blockWriter): add dev API write test button"
```

---

### Task 6: Add Slash Range and Protyle Transport

**Files:**
- Create: `src/utils/blockWriter/slashRange.ts`
- Create: `src/utils/blockWriter/protyleTransport.ts`
- Modify: `src/utils/blockWriter/index.ts`
- Create: `test/blockWriter/slashRange.test.ts`

- [ ] **Step 1: Write Range test**

```ts
import { describe, expect, it } from 'vitest';
import { deleteSlashRangeText } from '@/utils/blockWriter/slashRange';

describe('slashRange', () => {
  it('deletes only the slash segment at the provided offset', () => {
    const textNode = document.createTextNode('keep /bwtest then /bwtest');
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);

    deleteSlashRangeText(range, 18);

    expect(textNode.textContent).toBe('keep /bwtest then ');
  });
});
```

- [ ] **Step 2: Implement `slashRange.ts`**

```ts
export function deleteSlashRangeText(range: Range, slashStartOffset: number): void {
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    throw new Error('Slash range must start in a text node');
  }
  if (slashStartOffset < 0 || slashStartOffset > range.startOffset) {
    throw new Error(`Invalid slashStartOffset ${slashStartOffset}`);
  }

  range.setStart(range.startContainer, slashStartOffset);
  range.deleteContents();
}
```

- [ ] **Step 3: Implement conservative Protyle transport**

```ts
import type { BlockPatch, BlockWriteContext } from './types';
import { deleteSlashRangeText } from './slashRange';

function formatUpdatedAttr(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
}

function commitProtyleUpdate(protyle: any, id: string, newHTML: string, oldHTML: string): boolean {
  if (newHTML === oldHTML) return true;
  if (!protyle?.transaction) return false;
  protyle.transaction(
    [{ id, data: newHTML, action: 'update' }],
    [{ id, data: oldHTML, action: 'update' }],
  );
  return true;
}

export async function writeViaProtyle(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  const { protyle, nodeElement } = context;
  if (!protyle || !nodeElement) return false;

  if (patch.type === 'removeSlashCommands' && context.slashRange && context.slashStartOffset !== undefined) {
    const oldHTML = nodeElement.outerHTML;
    deleteSlashRangeText(context.slashRange, context.slashStartOffset);
    if (patch.suffix) {
      context.slashRange.insertNode(document.createTextNode(` ${patch.suffix}`));
      context.slashRange.collapse(false);
    }
    nodeElement.setAttribute('updated', formatUpdatedAttr(new Date()));
    const spunHTML = protyle.lute?.SpinBlockDOM ? protyle.lute.SpinBlockDOM(nodeElement.outerHTML) : nodeElement.outerHTML;
    nodeElement.outerHTML = spunHTML;
    const newElement = protyle.wysiwyg?.element?.querySelector(`[data-node-id="${context.blockId}"]`) as HTMLElement | null;
    return commitProtyleUpdate(protyle, context.blockId, newElement?.outerHTML ?? spunHTML, oldHTML);
  }

  return false;
}
```

- [ ] **Step 4: Wire fallback in `index.ts`**

```ts
import type { BlockPatch, BlockWriteContext } from './types';
import { writeViaApi } from './apiTransport';
import { writeViaProtyle } from './protyleTransport';

export type {
  BlockPatch,
  BlockWriteContext,
  ContentPatch,
  DatePatch,
  ItemDateTimeInfo,
  PriorityPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
} from './types';

export async function writeBlock(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  if (context.protyle && context.nodeElement) {
    const ok = await writeViaProtyle(context, patch);
    if (ok) return true;
  }
  return writeViaApi(context.blockId, patch);
}
```

- [ ] **Step 5: Verify**

```powershell
npx vitest run test/blockWriter/
npx tsc --noEmit --pretty
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/blockWriter/slashRange.ts src/utils/blockWriter/protyleTransport.ts src/utils/blockWriter/index.ts test/blockWriter/slashRange.test.ts
git commit -m "feat(blockWriter): add Protyle slash transport"
```

---

### Task 7: Add Dev-only `/bwtest` Slash Command

**Files:**
- Modify: `src/utils/slashCommands.ts`

- [ ] **Step 1: Add import**

```ts
import { writeBlock } from '@/utils/blockWriter';
```

- [ ] **Step 2: Add active slash helper**

Near `getEditorRange`:

```ts
function getActiveSlashRange(): { range: Range; slashStartOffset: number; blockElement: HTMLElement; blockId: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const textNode = range.startContainer as Text;
  const textContent = textNode.textContent || '';
  const slashStartOffset = textContent.lastIndexOf('/', range.startOffset);
  if (slashStartOffset < 0) return null;

  let blockElement = textNode.parentElement;
  while (blockElement && !blockElement.getAttribute('data-node-id')) {
    blockElement = blockElement.parentElement;
  }

  const blockId = blockElement?.getAttribute('data-node-id');
  if (!blockElement || !blockId) return null;

  return {
    range,
    slashStartOffset,
    blockElement,
    blockId,
  };
}
```

- [ ] **Step 3: Register dev-only command**

In `createSlashCommands()`, after `builtinCommands` is initialized and before it is returned:

```ts
if (import.meta.env.DEV) {
  builtinCommands.push({
    filter: ['bwtest'],
    html: `<div class="b3-list-item__first">
        <span class="b3-list-item__text">BlockWriter Protyle Test</span>
        <span class="b3-list-item__meta">#bw-protyle</span>
    </div>`,
    id: 'bullet-journal-block-writer-test',
    callback: (protyle: any) => {
      void (async () => {
        const slash = getActiveSlashRange();
        if (!slash) {
          showMessage('BlockWriter slash test: no active slash range', 2000, 'error');
          return;
        }

        const success = await writeBlock(
          {
            blockId: slash.blockId,
            protyle,
            nodeElement: slash.blockElement,
            slashRange: slash.range,
            slashStartOffset: slash.slashStartOffset,
          },
          {
            type: 'removeSlashCommands',
            filters: ['bwtest'],
            suffix: '#bw-protyle',
          },
        );

        showMessage(
          success ? 'BlockWriter slash test success' : 'BlockWriter slash test failed',
          2000,
          success ? 'info' : 'error',
        );
      })();
    },
  });
}
```

- [ ] **Step 4: Verify**

```powershell
npx vitest run test/blockWriter/
npx tsc --noEmit --pretty
```

Expected: PASS.

- [ ] **Step 5: Manual dev verification**

Run `npm run dev`, type:

```text
keep /bwtest then trigger /bwtest
```

Select `BlockWriter Protyle Test`.

Expected:

- only the second `/bwtest` is removed;
- the first `/bwtest` remains;
- `#bw-protyle` is appended;
- undo/redo works;
- existing slash commands are unchanged.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/slashCommands.ts
git commit -m "feat(blockWriter): add dev slash write test"
```

---

### Task 8: Manual Smoke Test Matrix

**Files:**
- No code changes.

- [ ] **Step 1: Verify API button on normal paragraph**

Expected:

- `🔥` appears before date marker if date exists;
- trailing IAL/custom attrs remain;
- no existing UI behavior changes.

- [ ] **Step 2: Verify API button on task list item**

Expected:

- marker is added to the item content;
- `[ ]` or `[x]` remains intact;
- custom IAL remains.

- [ ] **Step 3: Verify `/bwtest` in paragraph**

Expected:

- current slash token removed precisely;
- earlier same text remains;
- `#bw-protyle` appended;
- undo/redo works.

- [ ] **Step 4: Decide whether two entry points are enough**

If all smoke tests pass, they are enough to start one real low-risk migration. They are not enough to remove old functions.

---

### Task 9: First Real Migration After User Approval

**Files:**
- Modify only one API-only caller selected after manual verification.

- [ ] **Step 1: Wait for user approval**

Do not migrate existing writes until the user confirms dev-only tests pass in SiYuan.

- [ ] **Step 2: Pick one API-only priority caller**

Recommended first caller: `src/tabs/QuadrantTab.vue` drop priority update, because it has a direct blockId and no live Protyle DOM dependency.

- [ ] **Step 3: Replace only that caller**

Replace:

```ts
const success = await updateBlockPriority(payload.blockId, targetPriority);
```

with:

```ts
const success = await writeBlock(
  { blockId: payload.blockId },
  { type: 'setPriority', priority: targetPriority },
);
```

- [ ] **Step 4: Verify and commit**

```powershell
npm run test
git add src/tabs/QuadrantTab.vue
git commit -m "refactor(blockWriter): migrate quadrant priority write"
```

---

### Task 10: Final Cleanup After All Migrations

**Files:**
- Modify: `src/utils/fileUtils.ts`
- Modify: `src/utils/slashCommands.ts`

- [ ] **Step 1: Confirm no legacy callers remain**

```powershell
rg "(updateBlockDateTime|updateBlockContent|updateBlockPriority|deleteSlashCommandContent|createProtyleWriter|BlockWriter)" src/ --no-heading -n
```

Expected: only definitions/deprecated comments or no results.

- [ ] **Step 2: Delete old code**

Delete legacy write functions only after all callers are gone.

- [ ] **Step 3: Full verification**

```powershell
npm run test
npm run lint
npm run build
npx tsc --noEmit --pretty
```

Expected: all pass.

---

## Self-Review

- Spec coverage: includes思源源码约束、dev-only验证入口、两条 transport、人工验证矩阵、后续真实迁移 gate。
- Placeholder scan: no unresolved placeholder text.
- Type consistency: `BlockPatch`、`BlockWriteContext`、`ResolvedBlockTarget` are used consistently across resolver, transport, and entry.
