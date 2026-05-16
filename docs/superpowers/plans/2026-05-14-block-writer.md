# BlockWriter 统一块写入层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个符合思源源码写入语义的 BlockWriter，并以小步迁移替代当前分散的块写入逻辑。

**Architecture:** 先实现真实 kramdown 拆分、事项行 marker 纯函数和 API Target Resolver；Protyle 写入不默认做 markdown 往返，而是沿用思源最小 DOM 修改 + `SpinBlockDOM` + transaction 的方式。迁移按单入口推进，旧函数保留到调用方全部清零后再删除。

**Tech Stack:** TypeScript, Vitest, SiYuan Kernel API (`getBlockByID`, `getBlockKramdown`, `updateBlock`), SiYuan Protyle Lute (`SpinBlockDOM`), Vue/Pinia existing plugin runtime.

---

## Scope Notes

本计划替代旧 plan 中“一次性新增所有模块并批量迁移”的方式。执行时必须遵守：

1. 不先删除旧函数。
2. 不把 Protyle 写入统一改成 `BlockDOM2StdMd -> Md2BlockDOM`。
3. 每个迁移任务只替换一个入口，并可独立回滚。
4. 所有 kramdown 测试以 `getBlockKramdown` 真实形态为主：内容行 + trailing IAL 行。

## File Structure

| 文件 | 职责 |
|------|------|
| `src/utils/blockWriter/types.ts` | BlockWriter 对外类型 |
| `src/utils/blockWriter/itemLineMarkers.ts` | 从 `fileUtils.ts` 抽出的 marker 纯函数 |
| `src/utils/blockWriter/kramdownBlocks.ts` | 拆分/重建真实 kramdown block，保留 trailing IAL |
| `src/utils/blockWriter/kramdownModifier.ts` | 对事项行应用 patch 的纯函数 |
| `src/utils/blockWriter/blockTargetResolver.ts` | API 场景目标解析：当前块、父 list item、父块 raw replacement |
| `src/utils/blockWriter/apiTransport.ts` | API-only 写入 |
| `src/utils/blockWriter/protyleTransport.ts` | Protyle DOM 写入与降级 |
| `src/utils/blockWriter/slashRange.ts` | slash Range/offset 精确删除 |
| `src/utils/blockWriter/index.ts` | `writeBlock()` 统一入口 |
| `test/blockWriter/*.test.ts` | 新模块单元测试 |
| `src/utils/fileUtils.ts` | 逐步标记旧函数 deprecated，最终删除 |
| `src/utils/slashCommands.ts` | 逐步迁移 slash 命令调用 |

---

### Task 1: Add BlockWriter Types

**Files:**
- Create: `src/utils/blockWriter/types.ts`

- [ ] **Step 1: Create the directory**

Run:

```powershell
if (-not (Test-Path "src/utils/blockWriter")) { New-Item -ItemType Directory -Path "src/utils/blockWriter" -Force }
```

Expected: command succeeds.

- [ ] **Step 2: Add types**

Create `src/utils/blockWriter/types.ts`:

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

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npx tsc --noEmit --pretty
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add src/utils/blockWriter/types.ts
git commit -m "feat(blockWriter): add core write types"
```

---

### Task 2: Extract Item Line Marker Utilities

**Files:**
- Create: `src/utils/blockWriter/itemLineMarkers.ts`
- Create: `test/blockWriter/itemLineMarkers.test.ts`
- Modify later only if needed: `src/utils/fileUtils.ts`

- [ ] **Step 1: Write tests**

Create `test/blockWriter/itemLineMarkers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  extractItemMarkers,
  generatePriorityMarker,
  isTaskListFormat,
  stripPriorityMarker,
} from '@/utils/blockWriter/itemLineMarkers';

describe('itemLineMarkers', () => {
  it('detects task list markers', () => {
    expect(isTaskListFormat('[ ] task')).toBe(true);
    expect(isTaskListFormat('[x] task')).toBe(true);
    expect(isTaskListFormat('task')).toBe(false);
  });

  it('extracts date, priority, reminder and repeat markers', () => {
    expect(extractItemMarkers('🔥 task 📅2026-05-14 ⏰09:00 🔁每天'))
      .toBe('🔥 📅2026-05-14 ⏰09:00 🔁每天');
  });

  it('strips priority markers', () => {
    expect(stripPriorityMarker('🔥 task 📅2026-05-14')).toBe('task 📅2026-05-14');
  });

  it('generates priority markers', () => {
    expect(generatePriorityMarker('high')).toBe('🔥');
    expect(generatePriorityMarker('medium')).toBe('🌱');
    expect(generatePriorityMarker('low')).toBe('🍃');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npx vitest run test/blockWriter/itemLineMarkers.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement utilities**

Create `src/utils/blockWriter/itemLineMarkers.ts`:

```ts
import type { PriorityLevel } from '@/types/models';
import {
  generatePriorityMarker as generatePriorityMarkerFromParser,
  stripPriorityMarker as stripPriorityMarkerFromParser,
} from '@/parser/priorityParser';

const TIME_PART_PATTERN = '\\d{2}:\\d{2}(?::\\d{2})?';
const TIME_RANGE_PATTERN = `${TIME_PART_PATTERN}(?:~${TIME_PART_PATTERN})?`;
const DATE_MARKER_PATTERN = `(?:@|📅)\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`;

export function isTaskListFormat(line: string): boolean {
  return /\[\s*[xX]?\s*\]/.test(line);
}

export function extractItemMarkers(line: string): string {
  const markers: string[] = [];

  const priorityMatches = line.match(/[🔥🌱🍃]/gu);
  if (priorityMatches) {
    markers.push(...priorityMatches);
  }

  const dateMatch = line.match(new RegExp(DATE_MARKER_PATTERN));
  if (dateMatch) {
    markers.push(dateMatch[0]);
  }

  const reminderMatch = line.match(/⏰(?:\d{2}:\d{2}(?::\d{2})?|(?:提前|before|after)?[^\s]*(?:\s+(?!🔁|截止到|剩余|until)[^\s]+)*)/);
  if (reminderMatch) {
    const trimmed = reminderMatch[0].trim();
    if (trimmed && !trimmed.match(/⏰\s*$/)) {
      markers.push(trimmed);
    }
  }

  const repeatMatch = line.match(/🔁(?:[^\s]+(?:\s+(?!截止到|剩余|until|remaining)[^\s]+)*)/);
  if (repeatMatch) {
    markers.push(repeatMatch[0].trim());
  }

  const endConditionMatch = line.match(/(?:截止到|until|剩余|remaining)[^\s]+(?:\s+[^\s]+)*/i);
  if (endConditionMatch) {
    markers.push(endConditionMatch[0]);
  }

  return markers.join(' ');
}

export function stripPriorityMarker(line: string): string {
  return stripPriorityMarkerFromParser(line).replace(/\s{2,}/g, ' ').trim();
}

export function generatePriorityMarker(priority: PriorityLevel): string {
  return generatePriorityMarkerFromParser(priority);
}
```

- [ ] **Step 4: Run tests**

```powershell
npx vitest run test/blockWriter/itemLineMarkers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/itemLineMarkers.ts test/blockWriter/itemLineMarkers.test.ts
git commit -m "feat(blockWriter): extract item line marker utilities"
```

---

### Task 3: Add Kramdown Block Split/Rebuild

**Files:**
- Create: `src/utils/blockWriter/kramdownBlocks.ts`
- Create: `test/blockWriter/kramdownBlocks.test.ts`

- [ ] **Step 1: Write tests**

Create `test/blockWriter/kramdownBlocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  replaceContentLines,
  splitKramdownBlock,
} from '@/utils/blockWriter/kramdownBlocks';

describe('kramdownBlocks', () => {
  it('splits content and trailing IAL', () => {
    const raw = '任务内容 📅2026-05-14\n{: id="abc" custom-reminder="yes"}';
    expect(splitKramdownBlock(raw)).toEqual({
      contentLines: ['任务内容 📅2026-05-14'],
      ialLines: ['{: id="abc" custom-reminder="yes"}'],
      raw,
    });
  });

  it('preserves pomodoro lines as content lines', () => {
    const raw = '任务内容 📅2026-05-14\n🍅 3/3\n{: id="abc"}';
    expect(splitKramdownBlock(raw).contentLines).toEqual([
      '任务内容 📅2026-05-14',
      '🍅 3/3',
    ]);
  });

  it('rebuilds with original trailing IAL', () => {
    const raw = '- [ ] 任务\n{: id="abc" custom-x="1"}';
    const parts = splitKramdownBlock(raw);
    expect(replaceContentLines(parts, ['- [x] 任务'])).toBe('- [x] 任务\n{: id="abc" custom-x="1"}');
  });
});
```

- [ ] **Step 2: Run the failing test**

```powershell
npx vitest run test/blockWriter/kramdownBlocks.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement split/rebuild**

Create `src/utils/blockWriter/kramdownBlocks.ts`:

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

- [ ] **Step 4: Run tests**

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

### Task 4: Add Kramdown Modifier Pure Functions

**Files:**
- Create: `src/utils/blockWriter/kramdownModifier.ts`
- Create: `test/blockWriter/kramdownModifier.test.ts`

- [ ] **Step 1: Write tests**

Create `test/blockWriter/kramdownModifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyBlockPatch } from '@/utils/blockWriter/kramdownModifier';
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';

describe('kramdownModifier', () => {
  it('sets completed status on a normal item', () => {
    const parts = splitKramdownBlock('任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}');
    const result = applyBlockPatch(parts, { type: 'setStatus', status: 'completed' });
    expect(result).toBe('任务 📅2026-05-14 #已完成\n{: id="abc" custom-reminder="yes"}');
  });

  it('sets completed status on a task list item and preserves IAL', () => {
    const parts = splitKramdownBlock('- [ ] 任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}');
    const result = applyBlockPatch(parts, { type: 'setStatus', status: 'completed' });
    expect(result).toBe('- [x] 任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}');
  });

  it('sets abandoned status on a task list item with abandoned tag', () => {
    const parts = splitKramdownBlock('- [x] 任务 📅2026-05-14\n{: id="abc"}');
    const result = applyBlockPatch(parts, { type: 'setStatus', status: 'abandoned' });
    expect(result).toBe('- [ ] 任务 📅2026-05-14 #已放弃\n{: id="abc"}');
  });

  it('adds priority before date marker', () => {
    const parts = splitKramdownBlock('任务 📅2026-05-14\n{: id="abc"}');
    const result = applyBlockPatch(parts, { type: 'setPriority', priority: 'high' });
    expect(result).toBe('任务 🔥 📅2026-05-14\n{: id="abc"}');
  });

  it('removes priority', () => {
    const parts = splitKramdownBlock('任务 🔥 📅2026-05-14\n{: id="abc"}');
    const result = applyBlockPatch(parts, { type: 'setPriority', priority: undefined });
    expect(result).toBe('任务 📅2026-05-14\n{: id="abc"}');
  });
});
```

- [ ] **Step 2: Run the failing test**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement modifier**

Create `src/utils/blockWriter/kramdownModifier.ts`:

```ts
import type { BlockPatch, KramdownBlockParts, PriorityPatch, StatusPatch } from './types';
import { replaceContentLines } from './kramdownBlocks';
import {
  generatePriorityMarker,
  isTaskListFormat,
  stripPriorityMarker,
} from './itemLineMarkers';

const STATUS_TAGS = ['#已完成', '#已放弃', '#done', '#abandoned', '✅', '❌'];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPrimaryLineIndex(lines: string[]): number {
  const index = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed !== ''
      && !trimmed.startsWith('{:')
      && !trimmed.startsWith('🍅');
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

export function applyStatusToLine(line: string, patch: StatusPatch): string {
  if (isTaskListFormat(line)) {
    let result = line.replace(/\[\s*[xX]?\s*\]/, patch.status === 'completed' ? '[x]' : '[ ]');
    result = removeStatusTags(result);
    if (patch.status === 'abandoned') {
      result = `${result} #已放弃`;
    }
    return result;
  }

  const cleaned = removeStatusTags(line);
  if (patch.status === 'completed') {
    return `${cleaned} #已完成`;
  }
  if (patch.status === 'abandoned') {
    return `${cleaned} #已放弃`;
  }
  return cleaned;
}

export function applyPriorityToLine(line: string, patch: PriorityPatch): string {
  let result = stripPriorityMarker(line);
  if (!patch.priority) {
    return result;
  }

  const marker = generatePriorityMarker(patch.priority);
  const dateMatch = result.match(/(?:@|📅)\d{4}-\d{2}-\d{2}/);
  if (!dateMatch || dateMatch.index === undefined) {
    return `${result} ${marker}`.trim();
  }

  return `${result.slice(0, dateMatch.index).trimEnd()} ${marker} ${result.slice(dateMatch.index).trimStart()}`.trim();
}

export function applyBlockPatch(parts: KramdownBlockParts, patch: BlockPatch): string {
  const contentLines = [...parts.contentLines];
  const targetIndex = findPrimaryLineIndex(contentLines);
  const currentLine = contentLines[targetIndex] ?? '';

  if (patch.type === 'setStatus') {
    contentLines[targetIndex] = applyStatusToLine(currentLine, patch);
    return replaceContentLines(parts, contentLines);
  }

  if (patch.type === 'setPriority') {
    contentLines[targetIndex] = applyPriorityToLine(currentLine, patch);
    return replaceContentLines(parts, contentLines);
  }

  throw new Error(`Patch ${patch.type} is not implemented yet`);
}
```

- [ ] **Step 4: Run tests**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add kramdown status and priority patches"
```

---

### Task 5: Add API Target Resolver

**Files:**
- Create: `src/utils/blockWriter/blockTargetResolver.ts`
- Create: `test/blockWriter/blockTargetResolver.test.ts`

- [ ] **Step 1: Write tests with mocked API**

Create `test/blockWriter/blockTargetResolver.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBlockTarget } from '@/utils/blockWriter/blockTargetResolver';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
  getBlockKramdown: vi.fn(),
}));

const api = await import('@/api');

describe('blockTargetResolver', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves direct block for normal status patch', async () => {
    vi.mocked(api.getBlockByID).mockResolvedValue({ id: 'abc', type: 'NodeParagraph' } as any);
    vi.mocked(api.getBlockKramdown).mockResolvedValue({
      id: 'abc',
      kramdown: '任务 📅2026-05-14\n{: id="abc"}',
    } as any);

    const result = await resolveApiBlockTarget('abc', { type: 'setStatus', status: 'completed' });

    expect(result.targetBlockId).toBe('abc');
    expect(result.replaceMode).toBe('whole-block');
    expect(result.parts.ialLines).toEqual(['{: id="abc"}']);
  });

  it('switches setStatus to parent task list item', async () => {
    vi.mocked(api.getBlockByID)
      .mockResolvedValueOnce({ id: 'child', type: 'NodeParagraph', parent_id: 'li' } as any)
      .mockResolvedValueOnce({ id: 'li', type: 'NodeListItem', subtype: 't' } as any);
    vi.mocked(api.getBlockKramdown).mockResolvedValue({
      id: 'li',
      kramdown: '- [ ] 任务 📅2026-05-14\n{: id="li" custom-reminder="yes"}',
    } as any);

    const result = await resolveApiBlockTarget('child', { type: 'setStatus', status: 'completed' });

    expect(result.originalBlockId).toBe('child');
    expect(result.targetBlockId).toBe('li');
    expect(result.targetType).toBe('NodeListItem');
    expect(result.parts.ialLines).toEqual(['{: id="li" custom-reminder="yes"}']);
  });
});
```

- [ ] **Step 2: Run the failing test**

```powershell
npx vitest run test/blockWriter/blockTargetResolver.test.ts
```

Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Implement API resolver**

Create `src/utils/blockWriter/blockTargetResolver.ts`:

```ts
import { getBlockByID, getBlockKramdown } from '@/api';
import type { BlockPatch, ResolvedBlockTarget } from './types';
import { splitKramdownBlock } from './kramdownBlocks';

function getBlockSubtype(block: any): string | undefined {
  return block?.subtype ?? block?.subType;
}

export async function resolveApiBlockTarget(blockId: string, patch: BlockPatch): Promise<ResolvedBlockTarget> {
  const block = await getBlockByID(blockId);
  let targetBlockId = blockId;
  let targetBlock = block;

  if (patch.type === 'setStatus' && block?.parent_id) {
    const parent = await getBlockByID(block.parent_id);
    if (parent?.type === 'NodeListItem' && getBlockSubtype(parent) === 't') {
      targetBlockId = parent.id;
      targetBlock = parent;
    }
  }

  const result = await getBlockKramdown(targetBlockId);
  if (!result?.kramdown) {
    throw new Error(`Failed to get kramdown for block ${targetBlockId}`);
  }

  return {
    originalBlockId: blockId,
    targetBlockId,
    targetType: targetBlock?.type,
    targetSubType: getBlockSubtype(targetBlock),
    fullKramdown: result.kramdown,
    targetRaw: result.kramdown,
    parts: splitKramdownBlock(result.kramdown),
    replaceMode: 'whole-block',
  };
}
```

- [ ] **Step 4: Run tests**

```powershell
npx vitest run test/blockWriter/blockTargetResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/blockTargetResolver.ts test/blockWriter/blockTargetResolver.test.ts
git commit -m "feat(blockWriter): resolve API block targets"
```

---

### Task 6: Add API Transport and Public Entry

**Files:**
- Create: `src/utils/blockWriter/apiTransport.ts`
- Create: `src/utils/blockWriter/index.ts`
- Create: `test/blockWriter/apiTransport.test.ts`

- [ ] **Step 1: Write transport test**

Create `test/blockWriter/apiTransport.test.ts`:

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
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates markdown and preserves trailing IAL', async () => {
    vi.mocked(api.getBlockByID).mockResolvedValue({ id: 'abc', type: 'NodeParagraph' } as any);
    vi.mocked(api.getBlockKramdown).mockResolvedValue({
      id: 'abc',
      kramdown: '任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}',
    } as any);
    vi.mocked(api.updateBlock).mockResolvedValue([] as any);

    const ok = await writeViaApi('abc', { type: 'setStatus', status: 'completed' });

    expect(ok).toBe(true);
    expect(api.updateBlock).toHaveBeenCalledWith(
      'markdown',
      '任务 📅2026-05-14 #已完成\n{: id="abc" custom-reminder="yes"}',
      'abc',
    );
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx vitest run test/blockWriter/apiTransport.test.ts
```

Expected: FAIL because transport does not exist.

- [ ] **Step 3: Implement API transport**

Create `src/utils/blockWriter/apiTransport.ts`:

```ts
import { updateBlock } from '@/api';
import type { BlockPatch } from './types';
import { resolveApiBlockTarget } from './blockTargetResolver';
import { applyBlockPatch } from './kramdownModifier';

export async function writeViaApi(blockId: string, patch: BlockPatch): Promise<boolean> {
  try {
    const target = await resolveApiBlockTarget(blockId, patch);
    const newMarkdown = applyBlockPatch(target.parts, patch);
    const result = await updateBlock('markdown', newMarkdown, target.targetBlockId);
    return Array.isArray(result);
  } catch (error) {
    console.error('[BlockWriter] writeViaApi failed:', error);
    return false;
  }
}
```

- [ ] **Step 4: Implement public entry**

Create `src/utils/blockWriter/index.ts`:

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

- [ ] **Step 5: Run tests**

```powershell
npx vitest run test/blockWriter/apiTransport.test.ts test/blockWriter/blockTargetResolver.test.ts test/blockWriter/kramdownModifier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/blockWriter/apiTransport.ts src/utils/blockWriter/index.ts test/blockWriter/apiTransport.test.ts
git commit -m "feat(blockWriter): add API transport entry"
```

---

### Task 7: Migrate One API-Only Priority Call

**Files:**
- Modify: caller found by `rg "updateBlockPriority" src/ --no-heading -n`
- Modify: `src/utils/fileUtils.ts`

- [ ] **Step 1: Find callers**

Run:

```powershell
rg "updateBlockPriority" src/ --no-heading -n
```

Expected: list all callers.

- [ ] **Step 2: Replace the QuadrantTab API-only caller**

Modify `src/tabs/QuadrantTab.vue`.

Replace:

```ts
import { updateBlockPriority } from '@/utils/fileUtils';
```

with:

```ts
import { writeBlock } from '@/utils/blockWriter';
```

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

Do not migrate slash command priority in this task.

- [ ] **Step 3: Mark old function deprecated**

In `src/utils/fileUtils.ts`, add above `updateBlockPriority`:

```ts
/** @deprecated Use writeBlock({ blockId }, { type: 'setPriority', priority }) for new API-only writes. */
```

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run test/blockWriter/
```

Expected: PASS.

- [ ] **Step 5: Run full tests**

```powershell
npm run test
```

Expected: PASS or no new failures compared with baseline.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "refactor(blockWriter): migrate one API priority write"
```

---

### Task 8: Add Slash Range Deletion Utility

**Files:**
- Create: `src/utils/blockWriter/slashRange.ts`
- Create: `test/blockWriter/slashRange.test.ts`

- [ ] **Step 1: Write jsdom tests**

Create `test/blockWriter/slashRange.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deleteSlashRangeText } from '@/utils/blockWriter/slashRange';

describe('slashRange', () => {
  it('deletes only the slash segment at the provided offset', () => {
    const textNode = document.createTextNode('keep /today delete /to');
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);

    deleteSlashRangeText(range, 19);

    expect(textNode.textContent).toBe('keep /today delete ');
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx vitest run test/blockWriter/slashRange.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement range deletion**

Create `src/utils/blockWriter/slashRange.ts`:

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

- [ ] **Step 4: Run test**

```powershell
npx vitest run test/blockWriter/slashRange.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/slashRange.ts test/blockWriter/slashRange.test.ts
git commit -m "feat(blockWriter): add slash range deletion helper"
```

---

### Task 9: Add Protyle Transport Skeleton

**Files:**
- Create: `src/utils/blockWriter/protyleTransport.ts`
- Modify: `src/utils/blockWriter/index.ts`

- [ ] **Step 1: Implement conservative Protyle transport**

Create `src/utils/blockWriter/protyleTransport.ts`:

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
    const target = nodeElement;
    const oldHTML = target.outerHTML;
    deleteSlashRangeText(context.slashRange, context.slashStartOffset);
    if (patch.suffix) {
      context.slashRange.insertNode(document.createTextNode(` ${patch.suffix}`));
      context.slashRange.collapse(false);
    }
    target.setAttribute('updated', formatUpdatedAttr(new Date()));
    const spunHTML = protyle.lute?.SpinBlockDOM ? protyle.lute.SpinBlockDOM(target.outerHTML) : target.outerHTML;
    target.outerHTML = spunHTML;
    const newElement = protyle.wysiwyg?.element?.querySelector(`[data-node-id="${context.blockId}"]`) as HTMLElement | null;
    return commitProtyleUpdate(protyle, context.blockId, newElement?.outerHTML ?? spunHTML, oldHTML);
  }

  return false;
}
```

- [ ] **Step 2: Wire public entry with fallback**

Modify `src/utils/blockWriter/index.ts`:

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

- [ ] **Step 3: Run typecheck and tests**

```powershell
npx tsc --noEmit --pretty
npx vitest run test/blockWriter/
```

Expected: both pass.

- [ ] **Step 4: Commit**

```powershell
git add src/utils/blockWriter/protyleTransport.ts src/utils/blockWriter/index.ts
git commit -m "feat(blockWriter): add conservative Protyle transport"
```

---

### Task 10: Add Slash Offset Helper and Migrate One Slash Command Remove Path

**Files:**
- Modify: `src/utils/slashCommands.ts`

- [ ] **Step 1: Add a helper that finds the active slash start**

Add this helper near `getEditorRange` in `src/utils/slashCommands.ts`:

```ts
function getActiveSlashRange(protyle: any): { range: Range; slashStartOffset: number; blockElement: HTMLElement; blockId: string } | null {
  const wysiwygElement = protyle.wysiwyg?.element || protyle.protyle?.wysiwyg?.element;
  if (!wysiwygElement) return null;

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

- [ ] **Step 2: Migrate the `calendar` slash command**

In the `case 'calendar'` handler, replace:

```ts
deleteSlashCommandContent(protyle, filter);
openCalendarForBlock(nodeElement, config.openCustomTab);
```

with:

```ts
void (async () => {
  const slash = getActiveSlashRange(protyle);
  if (slash) {
    await writeBlock(
      {
        blockId: slash.blockId,
        protyle,
        nodeElement: slash.blockElement,
        slashRange: slash.range,
        slashStartOffset: slash.slashStartOffset,
      },
      {
        type: 'removeSlashCommands',
        filters: filter,
      },
    );
  }
  else {
    deleteSlashCommandContent(protyle, filter);
  }
  openCalendarForBlock(nodeElement, config.openCustomTab);
})();
```

Add the import:

```ts
import { writeBlock } from '@/utils/blockWriter';
```

- [ ] **Step 3: Keep old `deleteSlashCommandContent`**

Do not delete `deleteSlashCommandContent` yet. Add a deprecation comment only after the first migrated command is verified.

- [ ] **Step 4: Run tests**

```powershell
npm run test
```

Expected: PASS or no new failures compared with baseline.

- [ ] **Step 5: Manual verify in SiYuan**

Verify the migrated slash command:

- only the currently typed slash command is deleted;
- earlier identical text in the same line is preserved;
- suffix is inserted correctly;
- undo works through Protyle transaction.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/slashCommands.ts
git commit -m "refactor(blockWriter): migrate one slash removal path"
```

---

### Task 11: Implement Date and Content Patches

**Files:**
- Modify: `src/utils/blockWriter/kramdownModifier.ts`
- Modify: `test/blockWriter/kramdownModifier.test.ts`

- [ ] **Step 1: Add tests for date and content**

Append to `test/blockWriter/kramdownModifier.test.ts`:

```ts
it('adds a date while preserving trailing IAL', () => {
  const parts = splitKramdownBlock('任务\n{: id="abc" custom-reminder="yes"}');
  const result = applyBlockPatch(parts, { type: 'addDate', date: '2026-05-14', allDay: true });
  expect(result).toBe('任务 📅2026-05-14\n{: id="abc" custom-reminder="yes"}');
});

it('replaces item content and preserves markers', () => {
  const parts = splitKramdownBlock('[ ] 旧任务 📅2026-05-14\n{: id="abc"}');
  const result = applyBlockPatch(parts, { type: 'setContent', newItemContent: '新任务' });
  expect(result).toBe('[ ] 新任务 📅2026-05-14\n{: id="abc"}');
});
```

- [ ] **Step 2: Run failing tests**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: FAIL because date/content patches throw.

- [ ] **Step 3: Implement minimal date/content behavior**

Extend `src/utils/blockWriter/kramdownModifier.ts` with:

```ts
import type { ContentPatch, DatePatch } from './types';
import { extractItemMarkers } from './itemLineMarkers';

export function applyDateToLine(line: string, patch: DatePatch): string {
  const dateMarker = `📅${patch.date}`;
  const withoutSameDate = patch.originalDate
    ? line.replace(new RegExp(`\\s*(?:@|📅)${patch.originalDate}`), '')
    : line;
  if (withoutSameDate.includes(dateMarker)) {
    return withoutSameDate.replace(/\s{2,}/g, ' ').trim();
  }
  return `${withoutSameDate.trim()} ${dateMarker}`;
}

export function applyContentToLine(line: string, patch: ContentPatch): string {
  if (patch.newItemContent === undefined) {
    return patch.suffix ? `${line.trim()} ${patch.suffix}` : line;
  }

  const taskMarker = line.match(/\[\s*[xX]?\s*\]/)?.[0];
  const markers = extractItemMarkers(line);
  return [
    taskMarker,
    patch.newItemContent,
    markers,
  ].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();
}
```

Then add cases in `applyBlockPatch`:

```ts
if (patch.type === 'addDate') {
  contentLines[targetIndex] = applyDateToLine(currentLine, patch);
  return replaceContentLines(parts, contentLines);
}

if (patch.type === 'setContent') {
  contentLines[targetIndex] = applyContentToLine(currentLine, patch);
  return replaceContentLines(parts, contentLines);
}
```

- [ ] **Step 4: Run tests**

```powershell
npx vitest run test/blockWriter/kramdownModifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add date and content patches"
```

---

### Task 12: Continue Migrations One Entry at a Time

**Files:**
- Modify: `src/utils/fileUtils.ts`
- Modify: `src/utils/slashCommands.ts`
- Modify callers discovered by `rg`

- [ ] **Step 1: Migrate one `updateBlockContent` API-only caller**

Find callers:

```powershell
rg "updateBlockContent" src/ --no-heading -n
```

Replace one API-only caller with:

```ts
await writeBlock({ blockId }, { type: 'setStatus', status: 'completed' });
```

Run:

```powershell
npm run test
```

Commit:

```powershell
git add src
git commit -m "refactor(blockWriter): migrate one content status write"
```

- [ ] **Step 2: Migrate one `updateBlockDateTime` API-only caller**

Find callers:

```powershell
rg "updateBlockDateTime" src/ --no-heading -n
```

Replace one API-only caller with:

```ts
await writeBlock(
  { blockId },
  {
    type: 'addDate',
    date,
    startTime,
    endTime,
    allDay,
    originalDate,
    siblingItems,
    timePrecision: precision,
  },
);
```

Run:

```powershell
npm run test
```

Commit:

```powershell
git add src
git commit -m "refactor(blockWriter): migrate one date write"
```

- [ ] **Step 3: Repeat only after manual verification**

Do not batch migrate remaining callers until the previous migrated path has been manually verified in SiYuan.

---

### Task 13: Final Cleanup

**Files:**
- Modify: `src/utils/fileUtils.ts`
- Modify: `src/utils/slashCommands.ts`

- [ ] **Step 1: Confirm old functions are unused**

Run:

```powershell
rg "(updateBlockDateTime|updateBlockContent|updateBlockPriority|deleteSlashCommandContent|createProtyleWriter|BlockWriter)" src/ --no-heading -n
```

Expected: only definitions, deprecated comments, or no results.

- [ ] **Step 2: Delete old functions only after no callers remain**

Delete:

- `deleteSlashCommandContent`
- `updateTransaction` if unused
- `createProtyleWriter`
- `updateBlockDateTime`
- `updateBlockContent`
- `updateBlockPriority`
- `BlockWriter` type from `fileUtils.ts`

- [ ] **Step 3: Run full verification**

```powershell
npm run test
npm run lint
npm run build
npx tsc --noEmit --pretty
```

Expected: all pass.

- [ ] **Step 4: Commit**

```powershell
git add src test
git commit -m "refactor(blockWriter): remove legacy write paths"
```

---

## Manual Verification Checklist

Before final cleanup, verify in SiYuan:

- [ ] 普通事项可设置完成、放弃、优先级、日期。
- [ ] 任务列表事项 `[ ]` / `[x]` 切换正确，写入目标是 list item。
- [ ] 自定义 IAL 属性如 `custom-reminder` 更新后不丢。
- [ ] 含 `🍅` 附属行的事项更新后番茄钟记录不丢。
- [ ] slash 命令只删除当前触发片段，不删除行内较早出现的同名文本。
- [ ] undo/redo 能恢复 Protyle transaction。

## Self-Review

- Spec coverage: plan 覆盖源码约束、真实 kramdown IAL、API resolver、Protyle DOM 写入、slash Range 删除和小步迁移。
- Placeholder scan: 没有未决占位；后续迁移以明确 `rg`、替换模板、测试命令描述。
- Type consistency: `BlockPatch`、`BlockWriteContext`、`ResolvedBlockTarget` 在类型、resolver、transport、entry 中一致。
