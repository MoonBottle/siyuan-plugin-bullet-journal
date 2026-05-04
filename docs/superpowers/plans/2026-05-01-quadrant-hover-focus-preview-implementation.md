# Quadrant Hover Focus Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-only hover-triggered focus preview for Quadrant task cards that opens an editable native SiYuan `Protyle` popover showing the target block and its child blocks without navigating away from the Quadrant workflow.

**Architecture:** Build a reusable preview capability with a composable for hover/lifecycle state and a popover component that mounts a native `Protyle` instance into a plugin-owned floating container. Wire that capability into Quadrant task cards only, suppress preview while dragging, and rely on the existing SiYuan/plugin refresh chain after edits instead of inventing a new sync path.

**Tech Stack:** Vue 3, TypeScript, Pinia stores, SiYuan plugin API (`Protyle`, `TProtyleAction`), Vitest

---

## File Structure

**Create:**
- `src/components/preview/BlockFocusPreviewPopover.vue` — floating container component that mounts/destroys native `Protyle`, positions itself by anchor element, and owns hover persistence for the popover surface
- `src/composables/useBlockFocusPreview.ts` — reusable hover preview state manager for `blockId`, timers, anchor element, drag suppression, and single-instance switching
- `test/components/preview/BlockFocusPreviewPopover.test.ts` — component-level tests for native editor mount orchestration, action selection, cleanup, and positioning state
- `test/composables/useBlockFocusPreview.test.ts` — unit tests for delayed show/hide, hover persistence, and drag suppression logic
- `docs/superpowers/plans/2026-05-01-quadrant-hover-focus-preview-implementation.md` — this plan

**Modify:**
- `src/components/todo/TodoSidebar.vue` — expose minimal hover trigger context for task cards without embedding preview implementation details
- `src/tabs/QuadrantTab.vue` — instantiate the preview capability, pass hover hooks into `TodoSidebar`, render the popover, and integrate drag-state suppression
- `src/index.scss` or a more local preview stylesheet location if already used by shared floating UI — add popover shell styles if existing scoped styles are insufficient

**Test:**
- `test/tabs/QuadrantTab.test.ts` — extend Quadrant tests to cover preview hook wiring and drag/hover interaction boundaries
- `test/components/preview/BlockFocusPreviewPopover.test.ts`
- `test/composables/useBlockFocusPreview.test.ts`

---

### Task 1: Map Existing Hover and Native Editor Integration Points

**Files:**
- Modify: `docs/superpowers/plans/2026-05-01-quadrant-hover-focus-preview-implementation.md`
- Reference: `src/components/todo/TodoSidebar.vue`
- Reference: `src/tabs/QuadrantTab.vue`
- Reference: `node_modules/siyuan/types/protyle.d.ts`
- Reference: `C:\dev\projects\open-source\siyuan-master\app\src\block\Panel.ts`

- [ ] **Step 1: Confirm native editor API and current card event shape**

Read:

```text
src/components/todo/TodoSidebar.vue
src/tabs/QuadrantTab.vue
node_modules/siyuan/types/protyle.d.ts
C:\dev\projects\open-source\siyuan-master\app\src\block\Panel.ts
```

Capture these exact implementation constraints in notes before coding:

```ts
type PreviewActionMode = 'all' | 'context';

type PreviewTriggerPayload = {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
};

type NativePreviewSpec = {
  blockId: string;
  action: TProtyleAction[];
  title: boolean;
};
```

- [ ] **Step 2: Verify the action selection rule matches the spec**

Use this rule as the implementation source of truth:

```ts
function getNativePreviewAction(isRootDocumentBlock: boolean): TProtyleAction[] {
  return isRootDocumentBlock
    ? ['cb-get-context']
    : ['cb-get-all'];
}
```

Expected finding: this mirrors the `BlockPanel` behavior described in the spec and avoids custom preview rendering.

- [ ] **Step 3: Commit the analysis-only checkpoint**

```bash
git add docs/superpowers/plans/2026-05-01-quadrant-hover-focus-preview-implementation.md
git commit -m "docs(quadrant): add hover focus preview implementation plan"
```

Expected: a docs-only checkpoint exists before implementation starts.

---

### Task 2: Add Failing Tests for the Reusable Hover Preview State

**Files:**
- Create: `test/composables/useBlockFocusPreview.test.ts`
- Reference: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write the failing composable tests**

Create `test/composables/useBlockFocusPreview.test.ts` with these cases:

```ts
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';

describe('useBlockFocusPreview', () => {
  it('opens only after the configured hover delay', async () => {
    vi.useFakeTimers();
    const preview = useBlockFocusPreview({ showDelayMs: 120, hideDelayMs: 120 });
    const anchorEl = document.createElement('div');

    preview.scheduleShow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });

    expect(preview.activeBlockId.value).toBe('');
    vi.advanceTimersByTime(119);
    expect(preview.isOpen.value).toBe(false);

    vi.advanceTimersByTime(1);
    await nextTick();

    expect(preview.isOpen.value).toBe(true);
    expect(preview.activeBlockId.value).toBe('block-1');
  });

  it('keeps the preview open when the pointer moves from trigger to popover', async () => {
    vi.useFakeTimers();
    const preview = useBlockFocusPreview({ showDelayMs: 0, hideDelayMs: 100 });
    const anchorEl = document.createElement('div');

    preview.showNow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });

    preview.scheduleHide();
    preview.markPopoverHovered(true);
    vi.advanceTimersByTime(100);
    await nextTick();

    expect(preview.isOpen.value).toBe(true);
  });

  it('suppresses opening while drag is active', async () => {
    vi.useFakeTimers();
    const preview = useBlockFocusPreview({ showDelayMs: 0, hideDelayMs: 0 });
    const anchorEl = document.createElement('div');

    preview.setDragActive(true);
    preview.scheduleShow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    vi.runAllTimers();
    await nextTick();

    expect(preview.isOpen.value).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new composable test file to verify it fails**

Run:

```bash
npx vitest run test/composables/useBlockFocusPreview.test.ts
```

Expected: FAIL because `@/composables/useBlockFocusPreview` does not exist yet.

- [ ] **Step 3: Commit the failing-test checkpoint**

```bash
git add test/composables/useBlockFocusPreview.test.ts
git commit -m "test(preview): add hover focus preview composable cases"
```

Expected: the new test file is committed in a red state checkpoint if your workflow allows it; otherwise keep it staged locally until the implementation lands.

---

### Task 3: Implement the Reusable Hover Preview Composable

**Files:**
- Create: `src/composables/useBlockFocusPreview.ts`
- Test: `test/composables/useBlockFocusPreview.test.ts`

- [ ] **Step 1: Write the minimal composable implementation**

Create `src/composables/useBlockFocusPreview.ts`:

```ts
import { computed, ref } from 'vue';

export type BlockFocusPreviewTrigger = {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
};

type Options = {
  showDelayMs: number;
  hideDelayMs: number;
};

export function useBlockFocusPreview(options: Options) {
  const activeBlockId = ref('');
  const activeItemId = ref('');
  const anchorEl = ref<HTMLElement | null>(null);
  const triggerHovered = ref(false);
  const popoverHovered = ref(false);
  const dragActive = ref(false);
  const isMounted = ref(false);

  let showTimer: number | null = null;
  let hideTimer: number | null = null;

  const isOpen = computed(() => !!activeBlockId.value && isMounted.value);

  function clearShowTimer() {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function clearHideTimer() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function showNow(payload: BlockFocusPreviewTrigger) {
    if (dragActive.value || !payload.blockId) {
      return;
    }
    clearShowTimer();
    clearHideTimer();
    activeBlockId.value = payload.blockId;
    activeItemId.value = payload.itemId;
    anchorEl.value = payload.anchorEl;
    isMounted.value = true;
  }

  function scheduleShow(payload: BlockFocusPreviewTrigger) {
    triggerHovered.value = true;
    clearShowTimer();
    clearHideTimer();
    showTimer = window.setTimeout(() => showNow(payload), options.showDelayMs);
  }

  function scheduleHide() {
    triggerHovered.value = false;
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (triggerHovered.value || popoverHovered.value) {
        return;
      }
      isMounted.value = false;
      activeBlockId.value = '';
      activeItemId.value = '';
      anchorEl.value = null;
    }, options.hideDelayMs);
  }

  function markPopoverHovered(hovered: boolean) {
    popoverHovered.value = hovered;
    if (hovered) {
      clearHideTimer();
    } else if (!triggerHovered.value) {
      scheduleHide();
    }
  }

  function setDragActive(active: boolean) {
    dragActive.value = active;
    if (active) {
      clearShowTimer();
    }
  }

  return {
    activeBlockId,
    activeItemId,
    anchorEl,
    isOpen,
    scheduleShow,
    showNow,
    scheduleHide,
    markPopoverHovered,
    setDragActive,
  };
}
```

- [ ] **Step 2: Run the composable test file**

Run:

```bash
npx vitest run test/composables/useBlockFocusPreview.test.ts
```

Expected: PASS for all composable timing and suppression cases.

- [ ] **Step 3: Commit the composable implementation**

```bash
git add src/composables/useBlockFocusPreview.ts test/composables/useBlockFocusPreview.test.ts
git commit -m "feat(preview): add reusable hover focus preview state"
```

Expected: reusable preview state exists with passing tests.

---

### Task 4: Add Failing Tests for the Native Protyle Popover Shell

**Files:**
- Create: `test/components/preview/BlockFocusPreviewPopover.test.ts`
- Reference: `node_modules/siyuan/types/protyle.d.ts`

- [ ] **Step 1: Write the failing popover component tests**

Create `test/components/preview/BlockFocusPreviewPopover.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const protyleDestroy = vi.fn();
const protyleCtor = vi.fn(() => ({
  destroy: protyleDestroy,
  protyle: {
    element: document.createElement('div'),
  },
}));

vi.mock('siyuan', async () => {
  const actual = await vi.importActual<object>('siyuan');
  return {
    ...actual,
    Protyle: protyleCtor,
  };
});

describe('BlockFocusPreviewPopover', () => {
  it('mounts native Protyle with cb-get-all for non-root blocks', async () => {
    const { default: BlockFocusPreviewPopover } = await import('@/components/preview/BlockFocusPreviewPopover.vue');

    mount(BlockFocusPreviewPopover, {
      props: {
        blockId: 'block-1',
        anchorEl: document.createElement('div'),
        isRootDocumentBlock: false,
        visible: true,
      },
    });

    expect(protyleCtor).toHaveBeenCalled();
    expect(protyleCtor.mock.calls[0][2].action).toEqual(['cb-get-all']);
  });

  it('mounts native Protyle with cb-get-context for root document blocks', async () => {
    const { default: BlockFocusPreviewPopover } = await import('@/components/preview/BlockFocusPreviewPopover.vue');

    mount(BlockFocusPreviewPopover, {
      props: {
        blockId: 'doc-root',
        anchorEl: document.createElement('div'),
        isRootDocumentBlock: true,
        visible: true,
      },
    });

    expect(protyleCtor.mock.calls[0][2].action).toEqual(['cb-get-context']);
  });

  it('destroys the native Protyle instance when hidden', async () => {
    const { default: BlockFocusPreviewPopover } = await import('@/components/preview/BlockFocusPreviewPopover.vue');

    const wrapper = mount(BlockFocusPreviewPopover, {
      props: {
        blockId: 'block-1',
        anchorEl: document.createElement('div'),
        isRootDocumentBlock: false,
        visible: true,
      },
    });

    await wrapper.setProps({ visible: false });
    expect(protyleDestroy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the popover component test file**

Run:

```bash
npx vitest run test/components/preview/BlockFocusPreviewPopover.test.ts
```

Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Commit the failing-test checkpoint**

```bash
git add test/components/preview/BlockFocusPreviewPopover.test.ts
git commit -m "test(preview): add native popover shell cases"
```

Expected: the expected popover behavior is pinned down before implementation.

---

### Task 5: Implement the Native Protyle Popover Component

**Files:**
- Create: `src/components/preview/BlockFocusPreviewPopover.vue`
- Modify: `src/index.scss` or local component styles if sufficient
- Test: `test/components/preview/BlockFocusPreviewPopover.test.ts`

- [ ] **Step 1: Write the minimal popover component**

Create `src/components/preview/BlockFocusPreviewPopover.vue`:

```vue
<template>
  <div
    v-if="visible"
    class="block-focus-preview-popover"
    :style="popoverStyle"
    @mouseenter="emit('popover-hover', true)"
    @mouseleave="emit('popover-hover', false)"
  >
    <div ref="mountEl" class="block-focus-preview-popover__editor"></div>
  </div>
</template>

<script setup lang="ts">
import { Protyle } from 'siyuan';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { usePlugin } from '@/main';

const props = defineProps<{
  blockId: string;
  anchorEl: HTMLElement | null;
  visible: boolean;
  isRootDocumentBlock: boolean;
}>();

const emit = defineEmits<{
  (event: 'popover-hover', hovered: boolean): void;
}>();

const mountEl = ref<HTMLElement | null>(null);
const protyleInstance = ref<any>(null);

const popoverStyle = computed(() => {
  const rect = props.anchorEl?.getBoundingClientRect();
  if (!rect) {
    return {};
  }
  return {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.bottom + 8}px`,
    width: '560px',
    maxHeight: '70vh',
    zIndex: 'var(--b3-z-index, 300)',
  };
});

function destroyProtyle() {
  protyleInstance.value?.destroy?.();
  protyleInstance.value = null;
}

async function mountProtyle() {
  if (!props.visible || !props.blockId || !mountEl.value) {
    return;
  }
  destroyProtyle();
  await nextTick();
  const plugin = usePlugin();
  protyleInstance.value = new Protyle((plugin as any).app, mountEl.value, {
    blockId: props.blockId,
    action: [props.isRootDocumentBlock ? 'cb-get-context' : 'cb-get-all'],
    render: {
      gutter: true,
      scroll: true,
      breadcrumbDocName: true,
      title: props.isRootDocumentBlock,
    },
    typewriterMode: false,
  });
}

watch(() => [props.visible, props.blockId, props.isRootDocumentBlock], mountProtyle, { immediate: true });

watch(() => props.visible, (visible) => {
  if (!visible) {
    destroyProtyle();
  }
});

onBeforeUnmount(() => {
  destroyProtyle();
});
</script>
```

- [ ] **Step 2: Add the minimal popover shell styles**

Add:

```scss
.block-focus-preview-popover {
  overflow: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-background);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
}

.block-focus-preview-popover__editor {
  min-height: 240px;
}
```

- [ ] **Step 3: Run the component test file**

Run:

```bash
npx vitest run test/components/preview/BlockFocusPreviewPopover.test.ts
```

Expected: PASS for native `Protyle` mount/destroy and action selection.

- [ ] **Step 4: Commit the popover implementation**

```bash
git add src/components/preview/BlockFocusPreviewPopover.vue src/index.scss test/components/preview/BlockFocusPreviewPopover.test.ts
git commit -m "feat(preview): add native protyle popover shell"
```

Expected: the reusable popover shell exists and uses native editor mounting only.

---

### Task 6: Add Failing Tests for Quadrant Wiring

**Files:**
- Modify: `test/tabs/QuadrantTab.test.ts`
- Reference: `src/tabs/QuadrantTab.vue`

- [ ] **Step 1: Extend Quadrant tests with preview wiring cases**

Add tests like:

```ts
it('passes hover preview callbacks into embedded todo sidebars', async () => {
  const mounted = await mountQuadrantTab();
  const sidebarProps = getLatestTodoSidebarProps();

  expect(sidebarProps.onItemHoverStart).toBeTypeOf('function');
  expect(sidebarProps.onItemHoverEnd).toBeTypeOf('function');
});

it('suppresses preview opening while drag is active', async () => {
  const mounted = await mountQuadrantTab();
  const sidebarProps = getLatestTodoSidebarProps();
  const anchorEl = document.createElement('div');

  sidebarProps.onItemDragStart?.({ blockId: 'block-1', itemId: 'item-1', priority: 'high' }, new DragEvent('dragstart'));
  sidebarProps.onItemHoverStart?.({ blockId: 'block-1', itemId: 'item-1', anchorEl });

  await nextTick();
  expect(mounted.root.querySelector('.block-focus-preview-popover')).toBeNull();
});
```

- [ ] **Step 2: Run the Quadrant test file**

Run:

```bash
npx vitest run test/tabs/QuadrantTab.test.ts
```

Expected: FAIL because Quadrant does not yet wire preview handlers or render the popover.

- [ ] **Step 3: Commit the failing-test checkpoint**

```bash
git add test/tabs/QuadrantTab.test.ts
git commit -m "test(quadrant): cover hover focus preview wiring"
```

Expected: Quadrant integration expectations are locked before code changes.

---

### Task 7: Extend TodoSidebar with Minimal Hover Context Hooks

**Files:**
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `test/components/todo/TodoSidebar.test.ts` if the hook surface needs direct coverage

- [ ] **Step 1: Add new optional props for hover preview hooks**

Add to `TodoSidebar.vue` props:

```ts
onItemHoverStart?: (payload: {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
}, event: MouseEvent) => void;
onItemHoverEnd?: (payload: {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
}, event: MouseEvent) => void;
```

- [ ] **Step 2: Bind card-level mouseenter and mouseleave without embedding preview logic**

Add handlers like:

```ts
function handleItemHoverStart(item: Item, event: MouseEvent) {
  if (!item.blockId) return;
  const anchorEl = event.currentTarget as HTMLElement | null;
  if (!anchorEl) return;
  props.onItemHoverStart?.({
    blockId: item.blockId,
    itemId: item.id,
    anchorEl,
  }, event);
}

function handleItemHoverEnd(item: Item, event: MouseEvent) {
  if (!item.blockId) return;
  const anchorEl = event.currentTarget as HTMLElement | null;
  if (!anchorEl) return;
  props.onItemHoverEnd?.({
    blockId: item.blockId,
    itemId: item.id,
    anchorEl,
  }, event);
}
```

Then attach them to each card root with `@mouseenter` and `@mouseleave`.

- [ ] **Step 3: Run focused TodoSidebar tests**

Run:

```bash
npx vitest run test/components/todo/TodoSidebar.test.ts
```

Expected: PASS, or update the existing test stub file if needed so the new prop surface is covered.

- [ ] **Step 4: Commit the hover hook surface**

```bash
git add src/components/todo/TodoSidebar.vue test/components/todo/TodoSidebar.test.ts
git commit -m "feat(todo): expose hover preview trigger hooks"
```

Expected: `TodoSidebar` remains preview-agnostic while exposing minimal trigger context.

---

### Task 8: Integrate the Preview Capability into QuadrantTab

**Files:**
- Modify: `src/tabs/QuadrantTab.vue`
- Create/Use: `src/composables/useBlockFocusPreview.ts`
- Create/Use: `src/components/preview/BlockFocusPreviewPopover.vue`
- Test: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Instantiate the preview composable and render the popover**

Add to `QuadrantTab.vue`:

```ts
import BlockFocusPreviewPopover from '@/components/preview/BlockFocusPreviewPopover.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';

const preview = useBlockFocusPreview({
  showDelayMs: 180,
  hideDelayMs: 120,
});

const previewIsRootDocumentBlock = computed(() => {
  const blockId = preview.activeBlockId.value;
  if (!blockId) return false;
  const item = projectStore.getDisplayItems(selectedGroup.value).find(candidate => candidate.blockId === blockId);
  return !!item?.docId && item.docId === blockId;
});
```

Render:

```vue
<BlockFocusPreviewPopover
  :visible="preview.isOpen.value"
  :block-id="preview.activeBlockId.value"
  :anchor-el="preview.anchorEl.value"
  :is-root-document-block="previewIsRootDocumentBlock"
  @popover-hover="preview.markPopoverHovered"
/>
```

- [ ] **Step 2: Wire TodoSidebar hover and drag callbacks**

Pass:

```vue
:on-item-hover-start="payload => preview.scheduleShow(payload)"
:on-item-hover-end="() => preview.scheduleHide()"
```

Update drag handlers:

```ts
function handleItemDragStart(payload: QuadrantDragPayload) {
  draggedItem.value = payload;
  preview.setDragActive(true);
}

function handleItemDragEnd() {
  draggedItem.value = null;
  activeDropQuadrant.value = null;
  preview.setDragActive(false);
}
```

- [ ] **Step 3: Run the Quadrant test file**

Run:

```bash
npx vitest run test/tabs/QuadrantTab.test.ts
```

Expected: PASS for both the old drag behavior and the new hover preview wiring assertions.

- [ ] **Step 4: Commit the Quadrant integration**

```bash
git add src/tabs/QuadrantTab.vue test/tabs/QuadrantTab.test.ts
git commit -m "feat(quadrant): add hover focus preview integration"
```

Expected: Quadrant owns the feature entry point without leaking it into other views.

---

### Task 9: Verify Refresh, Native Editing, and Style Fit

**Files:**
- Modify: `src/components/preview/BlockFocusPreviewPopover.vue` if cleanup or sizing issues appear
- Modify: `src/index.scss` if shell spacing or overflow issues appear

- [ ] **Step 1: Run the focused preview-related suite**

Run:

```bash
npx vitest run test/composables/useBlockFocusPreview.test.ts test/components/preview/BlockFocusPreviewPopover.test.ts test/tabs/QuadrantTab.test.ts test/components/todo/TodoSidebar.test.ts
```

Expected: PASS for all preview-related tests.

- [ ] **Step 2: Run the broader regression suite**

Run:

```bash
npm test
```

Expected: PASS with no regressions in existing Todo, dialog, or Quadrant behavior.

- [ ] **Step 3: Perform manual desktop verification**

Check these behaviors in SiYuan:

```text
1. Hover a Quadrant task card and confirm the popover appears after a short delay.
2. Move the pointer from card into popover and confirm it stays open.
3. Edit the main task block and a child block in the popover.
4. Confirm the change persists through the existing refresh chain.
5. Start dragging a card and confirm no new hover preview opens mid-drag.
6. Click the card and confirm existing document navigation still works.
```

Expected: native editing works inside the popover and does not replace current click navigation.

- [ ] **Step 4: Commit final fit-and-finish adjustments**

```bash
git add src/components/preview/BlockFocusPreviewPopover.vue src/index.scss
git commit -m "fix(preview): polish hover focus preview behavior"
```

Expected: any final sizing, cleanup, or interaction fixes are isolated in a final commit.

---

## Self-Review

**Spec coverage:**  
- Native `Protyle` only: covered in Tasks 4, 5, 8, 9  
- `CB_GET_ALL` / `CB_GET_CONTEXT` strategy: covered in Tasks 1, 4, 5  
- Reusable capability but Quadrant-only integration: covered in Tasks 3, 5, 8  
- Drag suppression and single-instance behavior: covered in Tasks 2, 3, 6, 8  
- Existing refresh chain preserved: covered in Tasks 8, 9

**Placeholder scan:**  
- No `TODO` or vague “handle appropriately” steps remain.  
- Each test and implementation task names exact files and concrete commands.  
- Manual verification is explicit and bounded to the spec scope.

**Type consistency:**  
- Reused names consistently: `useBlockFocusPreview`, `BlockFocusPreviewPopover`, `scheduleShow`, `scheduleHide`, `markPopoverHovered`, `setDragActive`.  
- The trigger payload keeps the same `blockId`, `itemId`, `anchorEl` shape across the plan.

