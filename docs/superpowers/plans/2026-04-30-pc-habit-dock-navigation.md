# PC Habit Dock Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PC habit dock list open the source document on primary click while adding a dedicated entry into the existing habit detail/calendar view.

**Architecture:** Split the list-item interaction model into explicit events for open-document, open-detail, and check-in actions. Keep the existing desktop habit detail view intact, but add a document-open affordance in its header so the new list behavior does not trap users away from the source note.

**Tech Stack:** Vue 3 SFCs, Pinia stores, Vitest with happy-dom, existing `openDocumentAtLine` utility.

---

## File Structure

- Modify: `src/components/habit/HabitListItem.vue`
  - Change the list item from a single click surface into separate primary-body and secondary-action events.
- Modify: `src/tabs/DesktopHabitDock.vue`
  - Rewire list events, add document-open handlers, and add a document-open button in detail header.
- Create: `test/components/habit/HabitListItem.test.ts`
  - Add focused component tests for event separation and click bubbling protection.
- Create or Modify: `test/tabs/DesktopHabitDock.test.ts`
  - Add desktop dock behavior tests for document opening and detail navigation.

## Task 1: Lock Down `HabitListItem` Interaction Semantics

**Files:**
- Modify: `src/components/habit/HabitListItem.vue`
- Create: `test/components/habit/HabitListItem.test.ts`

- [ ] **Step 1: Write the failing component tests**

Create `test/components/habit/HabitListItem.test.ts` with explicit event expectations:

```ts
// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import type { Habit, HabitDayState, HabitPeriodState } from '@/types/models';

function mountListItem(overrides: Partial<{ habit: Habit, dayState: HabitDayState, periodState: HabitPeriodState }> = {}) {
  const habit = {
    name: '喝水',
    blockId: 'habit-1',
    docId: 'doc-1',
    type: 'count',
    startDate: '2026-04-01',
    target: 8,
    unit: '杯',
    frequency: { type: 'daily' },
    records: [],
  } as Habit;

  const dayState = {
    date: '2026-04-30',
    isCompleted: false,
    currentValue: 0,
  } as HabitDayState;

  const periodState = {
    periodType: 'day',
    isCompleted: false,
  } as HabitPeriodState;

  const events = {
    openDoc: [] as Habit[],
    openCalendar: [] as Habit[],
    increment: [] as Habit[],
    checkIn: [] as Habit[],
  };

  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitListItem, {
    habit,
    dayState,
    periodState,
    ...overrides,
    onOpenDoc: (value: Habit) => events.openDoc.push(value),
    onOpenCalendar: (value: Habit) => events.openCalendar.push(value),
    onIncrement: (value: Habit) => events.increment.push(value),
    onCheckIn: (value: Habit) => events.checkIn.push(value),
  });

  app.mount(container);

  return {
    container,
    events,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('HabitListItem', () => {
  it('clicking the main body emits open-doc only', async () => {
    const mounted = mountListItem();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.events.openDoc).toHaveLength(1);
    expect(mounted.events.openCalendar).toHaveLength(0);
    expect(mounted.events.increment).toHaveLength(0);

    mounted.unmount();
  });

  it('clicking the calendar action emits open-calendar only', async () => {
    const mounted = mountListItem();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.events.openCalendar).toHaveLength(1);
    expect(mounted.events.openDoc).toHaveLength(0);

    mounted.unmount();
  });

  it('clicking the increment action emits increment only', async () => {
    const mounted = mountListItem();

    mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.events.increment).toHaveLength(1);
    expect(mounted.events.openDoc).toHaveLength(0);
    expect(mounted.events.openCalendar).toHaveLength(0);

    mounted.unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/habit/HabitListItem.test.ts`

Expected: FAIL because `HabitListItem.vue` does not yet expose `open-doc` / `open-calendar` events or the required `data-testid` hooks.

- [ ] **Step 3: Write the minimal component implementation**

Update `src/components/habit/HabitListItem.vue` so the main content and each action have separate click surfaces:

```vue
<template>
  <div
    :class="['habit-list-item', {
      'habit-list-item--completed': isCompleted,
      'habit-list-item--count': habit.type === 'count'
    }]"
  >
    <div
      class="habit-list-item__main"
      data-testid="habit-list-item-main"
      @click="emit('open-doc', habit)"
    >
      <!-- existing content -->
    </div>

    <div class="habit-list-item__actions">
      <button
        class="habit-calendar-btn"
        data-testid="habit-list-item-calendar"
        @click.stop="emit('open-calendar', habit)"
      >
        <svg><use xlink:href="#iconCalendar"></use></svg>
      </button>

      <button
        v-if="habit.type === 'binary'"
        :class="['habit-check-btn', { 'habit-check-btn--done': dayState.isCompleted }]"
        :disabled="dayState.isCompleted"
        data-testid="habit-list-item-check-in"
        @click.stop="emit('check-in', habit)"
      >
        {{ dayState.isCompleted ? '✅' : t('habit').checkIn }}
      </button>

      <button
        v-else
        class="habit-increment-btn"
        :disabled="dayState.isCompleted"
        data-testid="habit-list-item-increment"
        @click.stop="emit('increment', habit)"
      >
        {{ t('habit').addOne }}
      </button>
    </div>
  </div>
</template>
```

Also update emits:

```ts
const emit = defineEmits<{
  'check-in': [habit: Habit];
  'increment': [habit: Habit];
  'open-doc': [habit: Habit];
  'open-calendar': [habit: Habit];
}>();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/components/habit/HabitListItem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitListItem.vue test/components/habit/HabitListItem.test.ts
git commit -m "feat(habit): split list item document and calendar actions"
```

## Task 2: Rewire `DesktopHabitDock` List and Detail Navigation

**Files:**
- Modify: `src/tabs/DesktopHabitDock.vue`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Write the failing dock tests**

Create or extend `test/tabs/DesktopHabitDock.test.ts` with behavior around document opening and detail entry:

```ts
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import { openDocumentAtLine } from '@/utils/fileUtils';

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
}));

function mountDock() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(DesktopHabitDock);
  app.use(createPinia());
  app.mount(container);
  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('DesktopHabitDock', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('opening a list item document uses openDocumentAtLine', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalled();
    mounted.unmount();
  });

  it('clicking the calendar action enters detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')).not.toBeNull();
    mounted.unmount();
  });

  it('detail header open-doc action opens the selected habit document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-open-doc"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalled();
    mounted.unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/DesktopHabitDock.test.ts`

Expected: FAIL because `DesktopHabitDock.vue` still listens for `click` and has no detail-header open-document affordance.

- [ ] **Step 3: Write the minimal dock implementation**

Update `src/tabs/DesktopHabitDock.vue`:

1. Import the existing utility:

```ts
import { openDocumentAtLine } from '@/utils/fileUtils';
```

2. Rewire list-item events:

```vue
<HabitListItem
  v-for="habit in habits"
  :key="habit.blockId"
  :habit="habit"
  :day-state="habitDayStateMap.get(habit.blockId)!"
  :period-state="habitPeriodStateMap.get(habit.blockId)!"
  :stats="habitStatsMap.get(habit.blockId)"
  @check-in="handleCheckIn"
  @increment="handleIncrement"
  @open-doc="handleOpenHabitDoc"
  @open-calendar="selectedHabit = $event"
/>
```

3. Add detail-header document button:

```vue
<template v-if="selectedHabit">
  <button
    class="block__icon"
    :aria-label="t('habit').backToList"
    @click="selectedHabit = null"
  >
    <svg><use xlink:href="#iconLeft"></use></svg>
  </button>
  <div class="block__logo" data-testid="habit-detail-header">{{ selectedHabit.name }}</div>
  <span class="fn__flex-1 fn__space"></span>
  <button
    class="block__icon"
    data-testid="habit-detail-open-doc"
    :aria-label="t('todo').openDoc"
    @click="handleOpenSelectedHabitDoc"
  >
    <svg><use xlink:href="#iconFile"></use></svg>
  </button>
</template>
```

4. Add handlers:

```ts
async function handleOpenHabitDoc(habit: Habit) {
  if (!habit.docId) return;
  await openDocumentAtLine(habit.docId, (habit as any).lineNumber, habit.blockId);
}

async function handleOpenSelectedHabitDoc() {
  if (!selectedHabit.value?.docId) return;
  await openDocumentAtLine(
    selectedHabit.value.docId,
    (selectedHabit.value as any).lineNumber,
    selectedHabit.value.blockId,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/DesktopHabitDock.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tabs/DesktopHabitDock.vue test/tabs/DesktopHabitDock.test.ts
git commit -m "feat(habit): align pc dock navigation with todo list"
```

## Task 3: Regression Verification for Dock Actions

**Files:**
- Modify: `test/tabs/DesktopHabitDock.test.ts`
- Test: `test/components/habit/HabitListItem.test.ts`

- [ ] **Step 1: Add regression tests for action isolation**

Extend tests so action buttons do not trigger the wrong navigation path:

```ts
it('binary check-in action does not open the document', async () => {
  const mounted = mountDock();

  mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(openDocumentAtLine).not.toHaveBeenCalled();
  mounted.unmount();
});

it('increment action does not enter detail mode', async () => {
  const mounted = mountDock();

  mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')).toBeNull();
  mounted.unmount();
});
```

- [ ] **Step 2: Run targeted tests to verify current behavior**

Run: `npx vitest run test/components/habit/HabitListItem.test.ts test/tabs/DesktopHabitDock.test.ts`

Expected: PASS after Task 1 and Task 2 implementation

- [ ] **Step 3: Run broader habit regression checks**

Run: `npx vitest run test/components/habit/HabitListItem.test.ts test/tabs/DesktopHabitDock.test.ts test/utils/slashCommands.habit.test.ts test/components/dialog/HabitCreateDialog.test.ts`

Expected: PASS

- [ ] **Step 4: Run full suite**

Run: `npm test`

Expected: PASS with the existing full-suite baseline

- [ ] **Step 5: Commit**

```bash
git add test/components/habit/HabitListItem.test.ts test/tabs/DesktopHabitDock.test.ts
git commit -m "test(habit): cover pc dock navigation regressions"
```

## Self-Review

- Spec coverage:
  - Main list click opens document: Task 1 + Task 2
  - Dedicated calendar/detail entry: Task 1 + Task 2
  - Detail header document entry: Task 2
  - Action isolation and no regressions: Task 3
- Placeholder scan:
  - No TBD/TODO markers remain
  - Each code-changing step includes concrete snippets
- Type consistency:
  - Event names are consistently `open-doc` / `open-calendar`
  - Document navigation always uses `openDocumentAtLine`

