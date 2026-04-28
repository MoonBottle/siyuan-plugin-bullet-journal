# SiYuan Attachment Link Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the parser and UI to treat `assets/...` links as attachment links, render them distinctly, and jump to the attachment block on click with an item-block fallback.

**Architecture:** Extend the shared link model first so parsing and UI agree on an `attachment` type and optional `blockId`. Then teach the Kramdown parser to capture attachment links with the source block ID, add a small presentation/navigation helper layer for typed links, and finally wire the new click behavior into the dialog and pomodoro surfaces that already consume `TodoTypedLinks`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia-backed UI, Vitest

---

## File Structure

### Existing files to modify

- `src/types/models.ts`
  - Shared `LinkType` and `Link` definitions used by parser, stores, and UI.
- `src/parser/lineParser.ts`
  - Central link type inference and `createLink()` factory.
- `src/parser/core.ts`
  - Kramdown parsing for task/item/project links and block association.
- `src/components/todo/TodoTypedLinks.vue`
  - Typed link rendering, class names, and click event payload.
- `src/components/dialog/ItemDetailDialog.vue`
  - Dialog-level link click handling.
- `src/components/pomodoro/PomodoroActiveTimer.vue`
  - Pomodoro card footer link click handling.
- `docs/superpowers/specs/2026-04-28-siyuan-attachment-link-design.md`
  - Approved spec that now includes the UI distinction requirement.

### New files to create

- `src/components/todo/typedLinkMeta.ts`
  - Small pure helper that maps link type to icon/class semantics for `TodoTypedLinks`.
- `src/utils/linkNavigation.ts`
  - Small pure helper that resolves which block ID to open for an attachment link.
- `test/components/todo/typedLinkMeta.test.ts`
  - Unit tests for UI distinction metadata.
- `test/utils/linkNavigation.test.ts`
  - Unit tests for attachment block resolution fallback logic.

### Existing tests to modify

- `test/parser/lineParser.test.ts`
  - Add link type and `blockId` factory coverage.
- `test/parser/core.test.ts`
  - Add attachment parsing coverage, including block-level attachment IDs.

## Task 1: Extend the shared link model and link factory

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/parser/lineParser.ts`
- Test: `test/parser/lineParser.test.ts`

- [ ] **Step 1: Write the failing parser tests for attachment link typing**

Add these tests near the existing `parseTaskLine` / `parseItemLine - 事项链接` coverage in `test/parser/lineParser.test.ts`:

```ts
import { LineParser, createLink, inferLinkType, parseBlockRefs } from '@/parser/lineParser';

it('inferLinkType: assets 相对路径识别为 attachment', () => {
  expect(inferLinkType('assets/demo.png')).toBe('attachment');
});

it('createLink: attachment 支持 blockId', () => {
  expect(createLink('截图', 'assets/demo.png', 'attachment', 'block-asset-1')).toEqual({
    name: '截图',
    url: 'assets/demo.png',
    type: 'attachment',
    blockId: 'block-asset-1',
  });
});

it('事项传入 attachment links 时保留 type 和 blockId', () => {
  const links = [
    { name: '截图', url: 'assets/demo.png', type: 'attachment', blockId: 'asset-block-1' as const },
  ];
  const items = LineParser.parseItemLine('带附件事项 @2024-01-01', 1, links);

  expect(items).toHaveLength(1);
  expect(items[0].links).toEqual(links);
});
```

- [ ] **Step 2: Run the parser test slice to verify it fails**

Run:

```bash
npx vitest run test/parser/lineParser.test.ts
```

Expected:

- FAIL because `inferLinkType('assets/demo.png')` still returns `external`
- FAIL because `createLink()` does not accept `blockId`

- [ ] **Step 3: Extend the shared link types and factory with attachment support**

Update `src/types/models.ts`:

```ts
export type LinkType = 'external' | 'siyuan' | 'block-ref' | 'attachment';

export interface Link {
  name: string;
  url: string;
  type?: LinkType;
  blockId?: string;
}
```

Update `src/parser/lineParser.ts`:

```ts
export function inferLinkType(url: string): Link['type'] {
  if (url.startsWith('siyuan://'))
    return 'siyuan';
  if (url.startsWith('assets/'))
    return 'attachment';
  return 'external';
}

export function createLink(
  name: string,
  url: string,
  type?: Link['type'],
  blockId?: string,
): Link {
  return {
    name,
    url,
    type: type ?? inferLinkType(url),
    blockId,
  };
}
```

Keep existing `parseBlockRefs()` calls unchanged; they will naturally emit `blockId: undefined`.

- [ ] **Step 4: Run the parser test slice to verify it passes**

Run:

```bash
npx vitest run test/parser/lineParser.test.ts
```

Expected:

- PASS for the new attachment tests
- PASS for existing block-ref and external link coverage

- [ ] **Step 5: Commit the model/factory change**

```bash
git add src/types/models.ts src/parser/lineParser.ts test/parser/lineParser.test.ts
git commit -m "feat(parser): add attachment link type metadata"
```

## Task 2: Parse attachment Markdown and preserve the source block ID

**Files:**
- Modify: `src/parser/core.ts`
- Test: `test/parser/core.test.ts`

- [ ] **Step 1: Write the failing Kramdown parser tests for attachment links**

Add these tests in `test/parser/core.test.ts` near the existing item-link coverage:

```ts
it('事项下方图片附件：识别为 attachment 并记录附件块 blockId', () => {
  const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }导出数据 @2026-04-27 11:00~12:00
{: id="after-i1" }
![0851d4ddc2897e0cf1313a3d6fec6cd3](assets/demo-20260427112346.png)
{: id="asset-block-1" }
`;

  const project = parseKramdown(kramdown, 'test-doc');

  expect(project!.tasks[0].items[0].links).toEqual([
    {
      name: '0851d4ddc2897e0cf1313a3d6fec6cd3',
      url: 'assets/demo-20260427112346.png',
      type: 'attachment',
      blockId: 'asset-block-1',
    },
  ]);
});

it('事项下方普通附件链接：attachment 与外链可并存', () => {
  const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }准备材料 @2026-04-27
{: id="after-i1" }
  - {: id="link1" }[说明文档](https://example.com/spec)
{: id="after-link1" }
  - {: id="asset1" }[报价单](assets/quote.pdf)
{: id="after-asset1" }
`;

  const project = parseKramdown(kramdown, 'test-doc');

  expect(project!.tasks[0].items[0].links).toEqual([
    { name: '说明文档', url: 'https://example.com/spec', type: 'external', blockId: 'after-link1' },
    { name: '报价单', url: 'assets/quote.pdf', type: 'attachment', blockId: 'after-asset1' },
  ]);
});
```

Note: if the implementation keeps current semantics where a block’s `blockId` comes from the trailing `{: id="..." }` line, make the assertions match that parsed block ID consistently.

- [ ] **Step 2: Run the core parser test slice to verify it fails**

Run:

```bash
npx vitest run test/parser/core.test.ts
```

Expected:

- FAIL because image syntax `![...]()` is not collected
- FAIL because no link currently stores a `blockId`

- [ ] **Step 3: Add a reusable Markdown link extractor in `src/parser/core.ts`**

Introduce a focused helper near the top of `src/parser/core.ts`:

```ts
function extractMarkdownLinks(text: string, blockId: string): Link[] {
  const links: Link[] = [];
  const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const [, rawName, rawUrl] = match;
    const isAttachment = rawUrl.startsWith('assets/');
    const fallbackName = rawUrl.split('/').pop() || '附件';
    const name = rawName.trim() || fallbackName;

    links.push(createLink(name, rawUrl.trim(), isAttachment ? 'attachment' : undefined, blockId));
  }

  return links;
}
```

Then replace one-off `match(/\[(.*?)\]\((.*?)\)/)` usage in:

- project-level pre-task link collection
- task-level link collection
- item-level link collection

with `extractMarkdownLinks(...)`, preserving current ordering and “stop at next item/task line” behavior.

For the item-level loops, pass `nextBlock.blockId` or the current block’s `blockId` when collecting links from each concrete block:

```ts
itemLinks.push(...extractMarkdownLinks(strippedNextContent, nextBlock.blockId));
```

For in-block multiline parsing:

```ts
itemLinks.push(...extractMarkdownLinks(strippedLineContent, block.blockId));
```

- [ ] **Step 4: Run the parser test slices to verify they pass**

Run:

```bash
npx vitest run test/parser/core.test.ts test/parser/lineParser.test.ts
```

Expected:

- PASS for the new attachment parsing tests
- PASS for the existing external link and block-ref coverage

- [ ] **Step 5: Commit the parser extraction change**

```bash
git add src/parser/core.ts test/parser/core.test.ts test/parser/lineParser.test.ts
git commit -m "feat(parser): capture attachment block ids from kramdown"
```

## Task 3: Add typed-link presentation metadata so attachments are visually distinct

**Files:**
- Create: `src/components/todo/typedLinkMeta.ts`
- Modify: `src/components/todo/TodoTypedLinks.vue`
- Test: `test/components/todo/typedLinkMeta.test.ts`

- [ ] **Step 1: Write the failing presentation helper tests**

Create `test/components/todo/typedLinkMeta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getTypedLinkMeta } from '@/components/todo/typedLinkMeta';

describe('getTypedLinkMeta', () => {
  it('attachment 返回独立样式和图标', () => {
    expect(getTypedLinkMeta('attachment')).toEqual({
      typeClass: 'typed-link--attachment',
      iconText: '📎',
      href: undefined,
    });
  });

  it('external 保持外链语义', () => {
    expect(getTypedLinkMeta('external')).toEqual({
      typeClass: 'typed-link--external',
      iconText: '↗',
      href: undefined,
    });
  });
});
```

- [ ] **Step 2: Run the new helper test to verify it fails**

Run:

```bash
npx vitest run test/components/todo/typedLinkMeta.test.ts
```

Expected:

- FAIL because `typedLinkMeta.ts` does not exist yet

- [ ] **Step 3: Implement the typed link presentation helper and wire it into `TodoTypedLinks`**

Create `src/components/todo/typedLinkMeta.ts`:

```ts
import type { LinkType } from '@/types/models';

export interface TypedLinkMeta {
  typeClass: string;
  iconText: string;
  href?: string;
}

export function getTypedLinkMeta(type?: LinkType): TypedLinkMeta {
  switch (type) {
    case 'attachment':
      return { typeClass: 'typed-link--attachment', iconText: '📎' };
    case 'siyuan':
      return { typeClass: 'typed-link--siyuan', iconText: 'S' };
    case 'block-ref':
      return { typeClass: 'typed-link--block-ref', iconText: '❝' };
    case 'external':
    default:
      return { typeClass: 'typed-link--external', iconText: '↗' };
  }
}
```

Update `src/components/todo/TodoTypedLinks.vue` to:

- compute `getTypedLinkMeta(link.type)`
- emit the full `Link`
- suppress raw `href` navigation for attachments so the click is handled by the parent

Use this component shape:

```vue
<SyButton
  v-for="link in links"
  :key="`${link.name}-${link.url}-${link.type || 'default'}-${link.blockId || 'no-block'}`"
  type="link"
  :text="link.name"
  :href="link.type === 'attachment' ? undefined : link.url"
  :class="['typed-link', getTypedLinkMeta(link.type).typeClass]"
  :data-icon="getTypedLinkMeta(link.type).iconText"
  @click="emit('linkClick', link)"
/>
```

And adjust the emit signature:

```ts
const emit = defineEmits<{
  linkClick: [link: Link];
}>();
```

Add scoped CSS for attachment:

```scss
:deep(.typed-link--attachment) {
  border-color: color-mix(in srgb, var(--b3-card-warning-color) 45%, var(--b3-border-color) 55%);
  background: color-mix(in srgb, var(--b3-card-warning-background) 70%, var(--b3-theme-surface) 30%);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--b3-card-warning-color) 75%, transparent 25%);
}

:deep(.typed-link--attachment::before) {
  content: attr(data-icon);
}
```

Keep the existing `external` / `siyuan` / `block-ref` markers, but refactor them to use the new class structure consistently.

- [ ] **Step 4: Run the helper and parser test slices**

Run:

```bash
npx vitest run test/components/todo/typedLinkMeta.test.ts test/parser/lineParser.test.ts test/parser/core.test.ts
```

Expected:

- PASS for the new presentation helper
- PASS for all parser coverage

- [ ] **Step 5: Commit the typed-link UI distinction change**

```bash
git add src/components/todo/typedLinkMeta.ts src/components/todo/TodoTypedLinks.vue test/components/todo/typedLinkMeta.test.ts
git commit -m "feat(todo): distinguish attachment links in typed link ui"
```

## Task 4: Wire attachment navigation into dialog and pomodoro surfaces

**Files:**
- Create: `src/utils/linkNavigation.ts`
- Modify: `src/components/dialog/ItemDetailDialog.vue`
- Modify: `src/components/pomodoro/PomodoroActiveTimer.vue`
- Test: `test/utils/linkNavigation.test.ts`

- [ ] **Step 1: Write the failing navigation helper tests**

Create `test/utils/linkNavigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';

describe('resolveAttachmentTargetBlockId', () => {
  it('优先返回 link.blockId', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '截图', url: 'assets/demo.png', type: 'attachment', blockId: 'asset-block-1' },
      'item-block-1',
    )).toBe('asset-block-1');
  });

  it('缺失 link.blockId 时回退到 item.blockId', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '截图', url: 'assets/demo.png', type: 'attachment' },
      'item-block-1',
    )).toBe('item-block-1');
  });

  it('非 attachment 返回 undefined', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '官网', url: 'https://example.com', type: 'external' },
      'item-block-1',
    )).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx vitest run test/utils/linkNavigation.test.ts
```

Expected:

- FAIL because `linkNavigation.ts` does not exist yet

- [ ] **Step 3: Implement the navigation helper and update the click handlers**

Create `src/utils/linkNavigation.ts`:

```ts
import type { Link } from '@/types/models';

export function resolveAttachmentTargetBlockId(link: Link, fallbackBlockId?: string): string | undefined {
  if (link.type !== 'attachment')
    return undefined;
  return link.blockId || fallbackBlockId;
}
```

Update `src/components/dialog/ItemDetailDialog.vue`:

```ts
import { showMessage } from 'siyuan';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';
import type { Link } from '@/types/models';

async function handleLinkClick(link: Link) {
  if (link.type === 'attachment') {
    const targetBlockId = resolveAttachmentTargetBlockId(link, props.item.blockId);
    if (!targetBlockId || !props.item.docId) {
      showMessage(t('common').blockIdError, 'error');
      return;
    }
    await openDocumentAtLine(props.item.docId, undefined, targetBlockId);
    handleClose();
    return;
  }

  if (link.url.startsWith('siyuan://')) {
    handleClose();
  }
}
```

Update `src/components/pomodoro/PomodoroActiveTimer.vue`:

```ts
import { showMessage } from 'siyuan';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';
import type { Link } from '@/types/models';

async function handleLinkClick(link: Link) {
  const docId = currentItem.value?.docId;
  const fallbackBlockId = currentItem.value?.blockId;

  if (link.type === 'attachment') {
    const targetBlockId = resolveAttachmentTargetBlockId(link, fallbackBlockId);
    if (!docId || !targetBlockId) {
      showMessage(t('common').blockIdError, 'error');
      return;
    }
    await openDocumentAtLine(docId, undefined, targetBlockId);
  }
}
```

Update the template bindings so all three `TodoTypedLinks` instances in `PomodoroActiveTimer.vue` pass `@link-click="handleLinkClick"`.

- [ ] **Step 4: Run the focused tests plus a full regression run**

Run:

```bash
npx vitest run test/utils/linkNavigation.test.ts test/components/todo/typedLinkMeta.test.ts test/parser/lineParser.test.ts test/parser/core.test.ts
npm test
```

Expected:

- PASS for the focused attachment slices
- PASS for the full Vitest suite

- [ ] **Step 5: Commit the attachment navigation wiring**

```bash
git add src/utils/linkNavigation.ts src/components/dialog/ItemDetailDialog.vue src/components/pomodoro/PomodoroActiveTimer.vue test/utils/linkNavigation.test.ts
git commit -m "feat(todo): jump to attachment blocks from typed links"
```

## Self-Review

### Spec coverage

- `attachment` type in shared model: Task 1
- parser captures `assets/...`: Task 1 and Task 2
- parser preserves attachment block IDs: Task 2
- UI distinction for attachment links: Task 3
- attachment click jumps to attachment block with item fallback: Task 4
- external/siyuan/block-ref regressions: Tasks 1, 2, and 4

No uncovered spec requirements remain.

### Placeholder scan

Checked for `TBD`, `TODO`, “implement later”, and vague testing steps. None remain in this plan.

### Type consistency

- `Link.type` includes `attachment`
- `Link.blockId` is the shared optional property used across parser, UI, and navigation helper
- `TodoTypedLinks` emits `Link`, not `url`
- `resolveAttachmentTargetBlockId()` accepts `Link` plus fallback item block ID

No naming drift remains across tasks.
