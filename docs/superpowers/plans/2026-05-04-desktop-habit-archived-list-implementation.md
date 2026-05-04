# Desktop Habit Archived List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated archived-habits list entry to the desktop HabitDock so users can browse archived habits, open archived habit details, and return to the correct list context without disturbing the default active list.

**Architecture:** Keep the source of truth in `useHabitWorkspace`. The composable will own a small `listMode` state plus filtered list derivation, while `DesktopHabitDock.vue` will render the correct top-bar and list/detail shell from that state. `HabitWorkspaceListPane.vue` and `HabitListItem.vue` will be extended just enough to reuse the existing list UI for archived habits without showing check-in controls.

**Tech Stack:** Vue 3 SFCs, TypeScript, Pinia-backed composables, Vitest with happy-dom, existing SiYuan icon and tooltip helpers.

---

## File Structure

- Modify: `src/composables/useHabitWorkspace.ts`
  - Add desktop list mode state (`active` / `archived`)
  - Expose filtered `habits` based on current mode while keeping `allHabits` internal for `selectedHabit`
  - Add actions for switching list mode and preserving detail return context
- Modify: `src/components/habit/HabitWorkspaceListPane.vue`
  - Accept archived-list mode flags and empty-state strings
  - Pass archived rendering hints down to list items
- Modify: `src/components/habit/HabitListItem.vue`
  - Support hiding check-in controls when rendering archived list items
  - Keep open-detail and open-doc behavior intact
- Modify: `src/tabs/DesktopHabitDock.vue`
  - Add top-bar archived-list entry icon
  - Render archived-list header state and back navigation
  - Reuse detail shell while returning to the correct source list
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
  - Add strings for archived list title, entry tooltip, and empty state
- Test: `test/composables/useHabitWorkspace.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`

---

### Task 1: Add Archived List Mode To `useHabitWorkspace`

**Files:**
- Modify: `src/composables/useHabitWorkspace.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing composable tests**

Add focused cases in `test/composables/useHabitWorkspace.test.ts`:

```ts
it('defaults to active list mode and only exposes active habits', async () => {
  const projectStore = useProjectStore();
  projectStore.currentDate = '2026-05-04';
  projectStore.projects = [{
    id: 'project-a',
    name: 'Project A',
    items: [],
    tasks: [],
    habits: [
      createHabit({ blockId: 'active-1' }),
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ],
    links: [],
    groupId: 'group-a',
  } as any];

  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  expect(workspace.listMode.value).toBe('active');
  expect(workspace.habits.value.map(habit => habit.blockId)).toEqual(['active-1']);
});

it('switches to archived list mode and only exposes archived habits', async () => {
  const projectStore = useProjectStore();
  projectStore.currentDate = '2026-05-04';
  projectStore.projects = [{
    id: 'project-a',
    name: 'Project A',
    items: [],
    tasks: [],
    habits: [
      createHabit({ blockId: 'active-1' }),
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ],
    links: [],
    groupId: 'group-a',
  } as any];

  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  workspace.showArchivedHabits();

  expect(workspace.listMode.value).toBe('archived');
  expect(workspace.habits.value.map(habit => habit.blockId)).toEqual(['archived-1']);
});

it('keeps selectedHabit resolvable from all habits while archived list mode is active', async () => {
  const projectStore = useProjectStore();
  projectStore.currentDate = '2026-05-04';
  projectStore.projects = [{
    id: 'project-a',
    name: 'Project A',
    items: [],
    tasks: [],
    habits: [
      createHabit({ blockId: 'active-1' }),
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ],
    links: [],
    groupId: 'group-a',
  } as any];

  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  workspace.showArchivedHabits();
  workspace.selectHabitById('archived-1');

  expect(workspace.selectedHabit.value?.blockId).toBe('archived-1');
  workspace.clearSelectedHabit();
  expect(workspace.listMode.value).toBe('archived');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- FAIL
- `listMode` / `showArchivedHabits` are missing
- `clearSelectedHabit()` behavior does not preserve archived list context

- [ ] **Step 3: Write the minimal composable implementation**

In `src/composables/useHabitWorkspace.ts`, introduce an explicit list mode:

```ts
type HabitListMode = 'active' | 'archived';

const listMode = ref<HabitListMode>('active');
const allHabits = computed(() => projectStore.getHabits(groupId.value));

const habits = computed(() => {
  if (listMode.value === 'archived') {
    return allHabits.value.filter(habit => Boolean(habit.archivedAt));
  }

  return allHabits.value.filter(habit => !habit.archivedAt);
});
```

Expose narrow actions:

```ts
function showArchivedHabits() {
  listMode.value = 'archived';
}

function showActiveHabits() {
  listMode.value = 'active';
}

function clearSelectedHabit() {
  selectedHabitId.value = null;
}
```

Keep `selectedHabit` sourced from `allHabits`:

```ts
const selectedHabit = computed(() => {
  if (!selectedHabitId.value) {
    return null;
  }

  return allHabits.value.find(habit => habit.blockId === selectedHabitId.value) ?? null;
});
```

Return the new surface:

```ts
return {
  listMode,
  habits,
  showActiveHabits,
  showArchivedHabits,
  // existing exports...
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts test/composables/useHabitWorkspace.test.ts
git commit -m "feat(habit): add archived list mode"
```

---

### Task 2: Reuse Habit List UI For Archived Items

**Files:**
- Modify: `src/components/habit/HabitWorkspaceListPane.vue`
- Modify: `src/components/habit/HabitListItem.vue`

- [ ] **Step 1: Extend the list pane props for archived rendering**

In `src/components/habit/HabitWorkspaceListPane.vue`, add props that let callers switch empty copy and item behavior:

```ts
withDefaults(defineProps<{
  selectedDate: string;
  currentDate: string;
  habits: Habit[];
  habitStatsMap: Map<string, HabitStats>;
  habitDayStateMap: Map<string, HabitDayState>;
  habitPeriodStateMap: Map<string, HabitPeriodState>;
  activeHabitId?: string | null;
  itemOpenBehavior?: 'document' | 'detail';
  itemTestIdPrefix?: string;
  archivedList?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}>(), {
  activeHabitId: null,
  itemOpenBehavior: 'document',
  itemTestIdPrefix: '',
  archivedList: false,
  emptyTitle: '',
  emptyDesc: '',
});
```

Use the overrides in the empty state:

```vue
<div class="habit-workspace-list-pane__empty-title">
  {{ emptyTitle || t('habit').noHabits }}
</div>
<div class="habit-workspace-list-pane__empty-desc">
  {{ emptyDesc || t('habit').noHabitsDesc }}
</div>
```

Pass archived rendering down:

```vue
<HabitListItem
  :habit="habit"
  :day-state="habitDayStateMap.get(habit.blockId)!"
  :period-state="habitPeriodStateMap.get(habit.blockId)!"
  :stats="habitStatsMap.get(habit.blockId)"
  :is-mobile="itemOpenBehavior === 'detail'"
  :readonly-actions="archivedList"
  @check-in="emit('check-in', $event)"
  @increment="emit('increment', $event)"
  @open-doc="emit('open-doc', $event)"
  @open-detail="emit('select-habit', $event)"
/>
```

- [ ] **Step 2: Hide archived check-in controls in the list item**

In `src/components/habit/HabitListItem.vue`, add a prop and gate the action buttons:

```ts
const props = defineProps<{
  habit: Habit;
  dayState: HabitDayState;
  periodState: HabitPeriodState;
  stats?: HabitStats;
  isMobile?: boolean;
  readonlyActions?: boolean;
}>();
```

Render only the document button when `readonlyActions` is true:

```vue
<div class="habit-list-item__actions">
  <button
    v-if="!isMobile"
    class="habit-calendar-btn"
    data-testid="habit-list-item-open-doc"
    :aria-label="t('todo').openDoc"
    @click.stop="emit('open-doc', habit)"
  >
    <svg><use xlink:href="#iconFile"></use></svg>
  </button>

  <template v-if="!readonlyActions">
    <!-- existing binary/count buttons -->
  </template>
</div>
```

Do not change `handleMainClick()`. Archived items should still emit `open-detail`.

- [ ] **Step 3: Sanity-check types**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS
- No new Vue prop/type errors triggered by the edited imports during test transform

- [ ] **Step 4: Commit**

```bash
git add src/components/habit/HabitWorkspaceListPane.vue src/components/habit/HabitListItem.vue
git commit -m "refactor(habit): support readonly archived list items"
```

---

### Task 3: Add Desktop Archived List Navigation And Empty State

**Files:**
- Modify: `src/tabs/DesktopHabitDock.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Write the failing desktop dock tests**

Add cases in `test/tabs/DesktopHabitDock.test.ts`:

```ts
it('shows an archived-list entry in active list mode and opens archived list mode on click', async () => {
  const mounted = mountDock();
  mounted.projectStore.projects[0].habits = [
    createHabit({ blockId: 'active-1' }),
    createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-archived-header"]')?.textContent).toContain('Archived');
  expect(mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-active-1"]')).toBeNull();
  mounted.unmount();
});

it('returns from archived detail to archived list context', async () => {
  const mounted = mountDock();
  mounted.projectStore.projects[0].habits = [
    createHabit({ blockId: 'active-1' }),
    createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-list-item-main"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-detail-back-button"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-archived-header"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')).not.toBeNull();
  mounted.unmount();
});

it('renders the archived empty state when there are no archived habits', async () => {
  const mounted = mountDock();

  mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.textContent).toContain('No archived habits');
  mounted.unmount();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts
```

Expected:
- FAIL
- Archived-list entry test ids do not exist
- Back-from-detail context still assumes only the active list shell

- [ ] **Step 3: Add i18n strings**

In `src/i18n/zh_CN.json`, add:

```json
"archivedList": "已归档习惯",
"viewArchived": "查看已归档",
"archivedEmptyTitle": "暂无已归档习惯",
"archivedEmptyDesc": "归档后的习惯会出现在这里"
```

In `src/i18n/en_US.json`, add:

```json
"archivedList": "Archived Habits",
"viewArchived": "View archived",
"archivedEmptyTitle": "No archived habits",
"archivedEmptyDesc": "Archived habits will appear here"
```

Place them under the existing `habit` namespace.

- [ ] **Step 4: Implement the desktop dock shell**

In `src/tabs/DesktopHabitDock.vue`, destructure the new workspace surface:

```ts
const {
  listMode,
  selectedDate,
  selectedViewMonth,
  selectedHabit,
  currentDate,
  habits,
  habitStatsMap,
  habitDayStateMap,
  habitPeriodStateMap,
  displaySelectedStats,
  refreshHabits,
  showActiveHabits,
  showArchivedHabits,
  selectHabit,
  selectHabitById,
  clearSelectedHabit,
  checkInHabit,
  incrementHabit,
  openHabitDoc,
  openSelectedHabitDoc,
  archiveSelectedHabit,
  unarchiveSelectedHabit,
} = useHabitWorkspace();
```

Add the active-list archived entry button:

```vue
<button
  class="block__icon"
  data-testid="habit-dock-open-archived"
  :aria-label="t('habit').viewArchived"
  @click="handleShowArchivedHabits"
>
  <svg
    @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('habit').viewArchived)"
    @mouseleave="hideIconTooltip"
  ><use xlink:href="#iconInbox"></use></svg>
</button>
```

Add archived-list top bar:

```vue
<template v-else-if="listMode === 'archived'">
  <button
    class="block__icon"
    data-testid="habit-archived-back-button"
    :aria-label="t('habit').backToList"
    @click="handleBackToActiveList"
  >
    <svg
      @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('habit').backToList)"
      @mouseleave="hideIconTooltip"
    ><use xlink:href="#iconLeft"></use></svg>
  </button>
  <div class="block__logo" data-testid="habit-archived-header">{{ t('habit').archivedList }}</div>
  <span class="fn__flex-1 fn__space"></span>
  <button
    class="block__icon"
    data-testid="habit-dock-refresh-button"
    :aria-label="t('common').refresh"
    @click="refreshHabits"
  >
    <svg
      @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('common').refresh)"
      @mouseleave="hideIconTooltip"
    ><use xlink:href="#iconRefresh"></use></svg>
  </button>
</template>
```

Render the list pane with archived hints:

```vue
<HabitWorkspaceListPane
  :selected-date="selectedDate"
  :current-date="currentDate"
  :habits="habits"
  :habit-stats-map="habitStatsMap"
  :habit-day-state-map="habitDayStateMap"
  :habit-period-state-map="habitPeriodStateMap"
  :archived-list="listMode === 'archived'"
  :empty-title="listMode === 'archived' ? t('habit').archivedEmptyTitle : ''"
  :empty-desc="listMode === 'archived' ? t('habit').archivedEmptyDesc : ''"
  @update:selected-date="selectedDate = $event"
  @check-in="checkInHabit"
  @increment="incrementHabit"
  @open-doc="openHabitDoc"
  @select-habit="selectHabit"
/>
```

Add handlers:

```ts
function handleShowArchivedHabits() {
  hideIconTooltip();
  showArchivedHabits();
}

function handleBackToActiveList() {
  hideIconTooltip();
  showActiveHabits();
}
```

Do not special-case `handleBackToList()`. It should continue to only clear `selectedHabit`, letting `listMode` decide which list is shown afterward.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS
- Archived list state, detail entry, and return context all work

- [ ] **Step 6: Commit**

```bash
git add src/tabs/DesktopHabitDock.vue src/i18n/zh_CN.json src/i18n/en_US.json test/tabs/DesktopHabitDock.test.ts src/composables/useHabitWorkspace.ts test/composables/useHabitWorkspace.test.ts src/components/habit/HabitWorkspaceListPane.vue src/components/habit/HabitListItem.vue
git commit -m "feat(habit): add desktop archived habit list"
```

---

### Task 4: Verify Unarchive And Archived Readonly Behavior End To End

**Files:**
- Modify: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Add end-to-end regression tests for archived readonly behavior**

Extend `test/tabs/DesktopHabitDock.test.ts` with:

```ts
it('does not render archived list check-in controls', async () => {
  const mounted = mountDock();
  mounted.projectStore.projects[0].habits = [
    createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')).toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-increment"]')).toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')).not.toBeNull();
  mounted.unmount();
});

it('removes a habit from the archived list after unarchive and returning to the archived list shell', async () => {
  unarchiveHabit.mockResolvedValue(true);
  const mounted = mountDock();
  mounted.projectStore.projects[0].habits = [
    createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-list-item-main"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.projectStore.projects[0].habits = [
    createHabit({ blockId: 'archived-1' }),
  ];
  mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-detail-back-button"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.textContent).toContain('No archived habits');
  mounted.unmount();
});
```

- [ ] **Step 2: Run the focused desktop regression suite**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS
- Archived list renders read-only controls correctly
- Unarchive flow updates the archived list context correctly

- [ ] **Step 3: Run the broader habit regression suite**

Run:

```bash
npx vitest run test/services/habitService.test.ts test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts test/mobile/MobileHabitDetailSheet.test.ts test/mobile/MobileHabitPanel.test.ts
```

Expected:
- PASS
- No regressions in archive service or existing detail actions
- Mobile archive flows remain unchanged

- [ ] **Step 4: Commit**

```bash
git add test/tabs/DesktopHabitDock.test.ts
git commit -m "test(habit): verify desktop archived list flow"
```

---

## Self-Review

- **Spec coverage:** Covered top-bar archived entry, archived list shell, detail return context, read-only archived list behavior, empty state, and unarchive-after-detail flow. No mobile changes included, matching spec non-goals.
- **Placeholder scan:** No `TODO`, `TBD`, or “similar to” references remain. Each code-changing step includes concrete snippets or assertions.
- **Type consistency:** Uses one list-mode type name throughout: `HabitListMode`. Public composable actions are consistently named `showActiveHabits()` and `showArchivedHabits()`. Archived list rendering prop is consistently named `archivedList`.
