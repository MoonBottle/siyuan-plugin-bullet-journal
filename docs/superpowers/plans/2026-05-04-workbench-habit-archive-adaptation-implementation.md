# Workbench Habit Archive Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the workbench habit view and habit widget to the archive model so the full workbench habit view supports archived-list browsing like Desktop HabitDock, while the habit widget can be configured to show either active or archived habits.

**Architecture:** Extend the shared `useHabitWorkspace()` state surface so both Desktop HabitDock and workbench habit surfaces use the same list-mode and selection semantics. Then wire `WorkbenchHabitView.vue` to expose archived list navigation, and upgrade `HabitWeekWidget.vue` plus its config dialog to drive a fixed `habitScope` filter (`active` or `archived`) without adding widget-level runtime toggles.

**Tech Stack:** Vue 3 SFCs, Pinia-backed composables, TypeScript, Vitest with happy-dom, existing workbench widget config/dialog helpers.

---

## File Structure

- Modify: `src/composables/useHabitWorkspace.ts`
  - Support configurable initial list mode and optional list-mode switching surface for additional hosts
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
  - Add archived-list top bar controls and pass archived-list state into the shared list pane
- Modify: `src/components/workbench/widgets/HabitWeekWidget.vue`
  - Read `habitScope` from widget config and bind the shared workspace to `active` or `archived`
- Modify: `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue`
  - Add a widget configuration select for habit scope
- Modify: `src/types/workbench.ts`
  - Extend `WorkbenchHabitWeekWidgetConfig` with `habitScope?: 'active' | 'archived'`
- Modify: `src/workbench/widgetRegistry.ts`
  - Add default config for `habitScope`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
  - Add workbench/widget habit-scope labels if needed
- Test: `test/composables/useHabitWorkspace.test.ts`
- Test: `test/components/workbench/WorkbenchHabitView.test.ts`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`
- Test: `test/components/workbench/DashboardCanvas.test.ts`

---

### Task 1: Extend `useHabitWorkspace` For Host-Provided Default List Mode

**Files:**
- Modify: `src/composables/useHabitWorkspace.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing composable tests**

Add tests in `test/composables/useHabitWorkspace.test.ts`:

```ts
it('supports an archived default list mode at initialization', async () => {
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
  const workspace = useHabitWorkspace({
    defaultListMode: 'archived',
  });

  expect(workspace.listMode.value).toBe('archived');
  expect(workspace.habits.value.map(habit => habit.blockId)).toEqual(['archived-1']);
});

it('returns to the host-provided default list mode when explicitly requested', async () => {
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
  const workspace = useHabitWorkspace({
    defaultListMode: 'archived',
  });

  workspace.showActiveHabits();
  expect(workspace.listMode.value).toBe('active');

  workspace.resetListMode();
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
- `defaultListMode` / `resetListMode()` are not supported yet

- [ ] **Step 3: Implement host-provided default list mode**

In `src/composables/useHabitWorkspace.ts`, extend the options type:

```ts
type HabitListMode = 'active' | 'archived';

type UseHabitWorkspaceOptions = {
  groupId?: MaybeRefOrGetter<string | undefined>;
  defaultListMode?: MaybeRefOrGetter<HabitListMode | undefined>;
};
```

Drive the initial and reset behavior from a computed default:

```ts
const defaultListMode = computed<HabitListMode>(() => {
  return toValue(options.defaultListMode) ?? 'active';
});

const listMode = ref<HabitListMode>(defaultListMode.value);
```

Keep the host default in sync without overwriting an active detail selection:

```ts
watch(defaultListMode, (value) => {
  listMode.value = value;
}, { immediate: false });

function resetListMode() {
  listMode.value = defaultListMode.value;
}
```

Return the new helper:

```ts
return {
  listMode,
  resetListMode,
  // ...
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
git commit -m "refactor(habit): support configurable workspace list mode"
```

---

### Task 2: Adapt `WorkbenchHabitView` To Archived List Navigation

**Files:**
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
- Test: `test/components/workbench/WorkbenchHabitView.test.ts`

- [ ] **Step 1: Write the failing workbench habit view tests**

Extend `test/components/workbench/WorkbenchHabitView.test.ts` with:

```ts
it('shows an archived list entry and switches the sidebar to archived habits', async () => {
  const mounted = await mountView();
  const projectStore = useProjectStore();
  projectStore.projects[0].habits = [
    createHabit({ blockId: 'active-1', name: 'Active Habit' }),
    createHabit({ blockId: 'archived-1', name: 'Archived Habit', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="workbench-habit-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="workbench-habit-archived-header"]')?.textContent).toContain('Archived');
  expect(mounted.container.textContent).toContain('Archived Habit');
  expect(mounted.container.textContent).not.toContain('Active Habit');
  mounted.unmount();
});

it('returns from archived detail to archived list context', async () => {
  const mounted = await mountView();
  const projectStore = useProjectStore();
  projectStore.projects[0].habits = [
    createHabit({ blockId: 'active-1', name: 'Active Habit' }),
    createHabit({ blockId: 'archived-1', name: 'Archived Habit', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  mounted.container.querySelector('[data-testid="workbench-habit-open-archived"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  mounted.container.querySelector('[data-testid="workbench-habit-back-to-list"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="workbench-habit-archived-header"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')).not.toBeNull();
  mounted.unmount();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts
```

Expected:
- FAIL
- Archived-list entry and archived header test ids do not exist

- [ ] **Step 3: Implement archived list navigation in the workbench view**

In `src/components/workbench/view/WorkbenchHabitView.vue`, destructure the shared workspace state:

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
  clearSelectedHabit,
  checkInHabit,
  incrementHabit,
  openSelectedHabitDoc,
} = useHabitWorkspace();
```

Add a sidebar header before `HabitWorkspaceListPane`:

```vue
<div class="workbench-habit-view__sidebar-header">
  <template v-if="selectedHabit">
    <button
      class="block__icon"
      data-testid="workbench-habit-back-to-list"
      :aria-label="t('habit').backToList"
      @click="clearSelectedHabit"
    >
      <svg><use xlink:href="#iconLeft"></use></svg>
    </button>
    <div class="workbench-habit-view__sidebar-title">{{ selectedHabit.name }}</div>
    <span class="fn__flex-1"></span>
    <button
      class="block__icon"
      data-testid="workbench-habit-refresh-button"
      :aria-label="t('common').refresh"
      @click="refreshHabits"
    >
      <svg><use xlink:href="#iconRefresh"></use></svg>
    </button>
  </template>
  <template v-else-if="listMode === 'archived'">
    <button
      class="block__icon"
      data-testid="workbench-habit-back-active"
      :aria-label="t('habit').backToList"
      @click="showActiveHabits"
    >
      <svg><use xlink:href="#iconLeft"></use></svg>
    </button>
    <div class="workbench-habit-view__sidebar-title" data-testid="workbench-habit-archived-header">{{ t('habit').archivedList }}</div>
    <span class="fn__flex-1"></span>
    <button
      class="block__icon"
      data-testid="workbench-habit-refresh-button"
      :aria-label="t('common').refresh"
      @click="refreshHabits"
    >
      <svg><use xlink:href="#iconRefresh"></use></svg>
    </button>
  </template>
  <template v-else>
    <div class="workbench-habit-view__sidebar-title">{{ t('habit').title }}</div>
    <span class="fn__flex-1"></span>
    <button
      class="block__icon"
      data-testid="workbench-habit-refresh-button"
      :aria-label="t('common').refresh"
      @click="refreshHabits"
    >
      <svg><use xlink:href="#iconRefresh"></use></svg>
    </button>
    <button
      class="block__icon"
      data-testid="workbench-habit-open-archived"
      :aria-label="t('habit').viewArchived"
      @click="showArchivedHabits"
    >
      <svg><use xlink:href="#iconInbox"></use></svg>
    </button>
  </template>
</div>
```

Pass archived-list state into the shared list pane:

```vue
<HabitWorkspaceListPane
  :selected-date="selectedDate"
  :current-date="currentDate"
  :habits="habits"
  :habit-stats-map="habitStatsMap"
  :habit-day-state-map="habitDayStateMap"
  :habit-period-state-map="habitPeriodStateMap"
  :active-habit-id="selectedHabit?.blockId"
  :archived-list="listMode === 'archived'"
  :empty-title="listMode === 'archived' ? t('habit').archivedEmptyTitle : ''"
  :empty-desc="listMode === 'archived' ? t('habit').archivedEmptyDesc : ''"
  item-open-behavior="detail"
  item-test-id-prefix="habit-list-item-"
  @update:selected-date="selectedDate = $event"
  @check-in="checkInHabit"
  @increment="incrementHabit"
  @select-habit="selectHabit"
/>
```

Do not change the right detail pane host; it should keep reusing `HabitWorkspaceDetailPane`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts
```

Expected:
- PASS
- Archived list navigation and return context work inside the workbench shell

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/view/WorkbenchHabitView.vue test/components/workbench/WorkbenchHabitView.test.ts
git commit -m "feat(workbench): add archived list to habit view"
```

---

### Task 3: Add Widget `habitScope` Config And Archived Filtering

**Files:**
- Modify: `src/types/workbench.ts`
- Modify: `src/workbench/widgetRegistry.ts`
- Modify: `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue`
- Modify: `src/components/workbench/widgets/HabitWeekWidget.vue`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`
- Test: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write the failing widget config and widget rendering tests**

Extend `test/components/workbench/HabitWeekWidget.test.ts` with:

```ts
it('confirms the selected habit scope together with group id', async () => {
  const settingsStore = useSettingsStore();
  settingsStore.loaded = true;
  settingsStore.groups = [{ id: 'group-a', name: 'Alpha' } as any];

  const mounted = await mountDialog({
    initialConfig: {
      groupId: 'group-a',
      habitScope: 'active',
    },
  });

  const scopeSelect = mounted.container.querySelector('[data-testid="habit-widget-scope-select"]') as HTMLSelectElement;
  scopeSelect.value = 'archived';
  scopeSelect.dispatchEvent(new Event('change'));
  await nextTick();

  (mounted.container.querySelector('[data-testid="habit-widget-config-confirm"]') as HTMLButtonElement).click();

  expect(mounted.onConfirm).toHaveBeenCalledWith({
    groupId: 'group-a',
    habitScope: 'archived',
  });

  mounted.unmount();
});

it('shows only archived habits when widget scope is archived', async () => {
  const mounted = await mountWidget({
    groupId: 'group-a',
    habitScope: 'archived',
  });
  const projectStore = useProjectStore();
  projectStore.projects[0].habits = [
    createHabit({ blockId: 'active-a', name: 'Active Habit' }),
    createHabit({ blockId: 'archived-a', name: 'Archived Habit', archivedAt: '2026-05-04' }),
  ];
  await nextTick();

  expect(mounted.container.textContent).toContain('Archived Habit');
  expect(mounted.container.textContent).not.toContain('Active Habit');
  mounted.unmount();
});
```

Extend `test/components/workbench/DashboardCanvas.test.ts` with a persistence assertion:

```ts
expect(savedWidget.config).toEqual({
  groupId: 'group-a',
  habitScope: 'archived',
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts
```

Expected:
- FAIL
- `habitScope` is missing from config typing or confirmation payload
- Archived widget scope does not filter rendered habits

- [ ] **Step 3: Implement the workbench widget config model**

In `src/types/workbench.ts`, update the config type:

```ts
export interface WorkbenchHabitWeekWidgetConfig {
  groupId?: string;
  habitScope?: 'active' | 'archived';
}
```

In `src/workbench/widgetRegistry.ts`, provide the default:

```ts
createDefaultConfig: (): WorkbenchHabitWeekWidgetConfig => ({
  groupId: undefined,
  habitScope: 'active',
}),
```

- [ ] **Step 4: Implement the config dialog and widget scope binding**

In `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue`, add state:

```ts
const selectedScope = ref(props.initialConfig.habitScope ?? 'active');

const scopeOptions = computed(() => [
  { value: 'active', label: t('workbench').habitWidgetScopeActive },
  { value: 'archived', label: t('workbench').habitWidgetScopeArchived },
]);
```

Render the new select:

```vue
<div class="habit-widget-config-dialog__field">
  <label class="habit-widget-config-dialog__label">
    {{ t('habit').title }}
  </label>
  <SySelect
    v-model="selectedScope"
    data-testid="habit-widget-scope-select"
    :options="scopeOptions"
  />
</div>
```

Return it on confirm:

```ts
props.onConfirm({
  groupId: selectedGroup.value || undefined,
  habitScope: selectedScope.value === 'archived' ? 'archived' : 'active',
});
```

In `src/components/workbench/widgets/HabitWeekWidget.vue`, bind workspace mode from config:

```ts
const habitConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchHabitWeekWidgetConfig;
});

const habitScope = computed(() => habitConfig.value.habitScope ?? 'active');

const {
  selectedDate,
  currentDate,
  habits,
  habitStatsMap,
  habitDayStateMap,
  habitPeriodStateMap,
  checkInHabit,
  incrementHabit,
} = useHabitWorkspace({
  groupId: () => habitConfig.value.groupId,
  defaultListMode: () => habitScope.value,
});
```

Pass readonly rendering to the list pane:

```vue
<HabitWorkspaceListPane
  :selected-date="selectedDate"
  :current-date="currentDate"
  :habits="habits"
  :habit-stats-map="habitStatsMap"
  :habit-day-state-map="habitDayStateMap"
  :habit-period-state-map="habitPeriodStateMap"
  :archived-list="habitScope === 'archived'"
  item-open-behavior="detail"
  @update:selected-date="selectedDate = $event"
  @check-in="checkInHabit"
  @increment="incrementHabit"
  @select-habit="handleOpenDetail"
/>
```

Do not add a runtime toggle to the widget UI.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts
```

Expected:
- PASS
- Widget config persists `habitScope`
- Archived widget scope renders archived habits only

- [ ] **Step 6: Commit**

```bash
git add src/types/workbench.ts src/workbench/widgetRegistry.ts src/components/workbench/dialogs/HabitWidgetConfigDialog.vue src/components/workbench/widgets/HabitWeekWidget.vue test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): add habit widget archive scope"
```

---

### Task 4: Run Shared Workbench + Habit Regression

**Files:**
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Add any missing i18n strings**

If the widget config and workbench view need dedicated labels, add them under existing namespaces:

In `src/i18n/zh_CN.json`:

```json
"habitWidgetScopeActive": "坚持中习惯",
"habitWidgetScopeArchived": "已归档习惯"
```

In `src/i18n/en_US.json`:

```json
"habitWidgetScopeActive": "Active habits",
"habitWidgetScopeArchived": "Archived habits"
```

Prefer placing them under `workbench` if they are widget/workbench-specific labels.

- [ ] **Step 2: Run the focused workbench suite**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts test/components/workbench/HabitWeekWidget.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS
- Shared workspace state works for both workbench hosts

- [ ] **Step 3: Run the broader regression suite**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts test/mobile/MobileHabitPanel.test.ts test/mobile/MobileHabitDetailSheet.test.ts
```

Expected:
- PASS
- No regression in Desktop HabitDock archived list behavior
- No regression in mobile habit archive/detail flows

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "test(workbench): verify habit archive adaptation"
```

---

## Self-Review

- **Spec coverage:** Covered shared default list mode, full archived-list adaptation for `WorkbenchHabitView`, widget `habitScope` config, archived widget rendering, and config persistence.
- **Placeholder scan:** No `TODO`, `TBD`, or vague “handle later” items remain. Each task contains concrete code/test snippets and exact commands.
- **Type consistency:** Uses one config property name throughout: `habitScope`. Shared list-mode type remains `HabitListMode`, with `defaultListMode` and `resetListMode()` consistently named across tasks.
