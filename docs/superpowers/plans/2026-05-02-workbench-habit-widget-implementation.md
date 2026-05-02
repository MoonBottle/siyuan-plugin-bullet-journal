# Workbench Habit Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `habitWeek` workbench widget from a week-only summary into a grouped, configurable habit workspace entry with list interaction and dialog-based detail rendering, without changing the existing desktop habit dock behavior.

**Architecture:** Extract the shared habit workspace state and rendering boundaries so the desktop dock, workbench habit view, and dashboard widget reuse the same list/detail logic while differing only in detail-container mode. Add a dedicated workbench config model and dialog wiring for habit widgets, then bind the widget to a SiYuan `Dialog` host for full detail rendering.

**Tech Stack:** Vue 3 SFCs, Pinia stores, SiYuan `Dialog`, Vitest, existing habit domain/services (`habitCompletion`, `habitStatsUtils`, `habitService`)

---

## Guardrails

- This plan must not change mobile habit check-in behavior in `src/mobile/**`.
- Shared extraction is allowed only for desktop-safe state or detail-content building blocks.
- Mobile-specific container behavior, including sheet open/close flow and panel navigation, must remain untouched.
- Any test additions for this work should focus on desktop workbench / desktop dock regression unless a shared change makes a mobile regression risk explicit.

---

## File Structure

### Files to Create

- `src/components/workbench/widgets/HabitWeekWidget.vue`
  - Replace the current week-bar-only widget with week summary + list + dialog trigger behavior.
- `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue`
  - Workbench widget config dialog that only manages `groupId`.
- `src/workbench/habitWidgetConfigDialog.ts`
  - Dialog bootstrap for the habit widget config dialog with shared Pinia injection.
- `src/workbench/habitWidgetDetailDialog.ts`
  - Dialog bootstrap for opening a selected habit detail from the widget.
- `src/components/habit/HabitWorkspaceListPane.vue`
  - Shared list-pane renderer for `HabitWeekBar` + `HabitListItem[]` + empty state.
- `src/components/habit/HabitWorkspaceDetailPane.vue`
  - Shared detail-pane renderer for `HabitMonthCalendar`, `HabitStatsCards`, `HabitRecordLog`, and header actions.
- `src/composables/useHabitWorkspace.ts`
  - Shared state/composable for grouped habits, selection, stats, day/period state maps, refresh, and check-in actions.
- `test/components/workbench/HabitWeekWidget.test.ts`
  - Widget rendering/config/dialog behavior tests.
- `test/composables/useHabitWorkspace.test.ts`
  - Shared workspace state and refresh behavior tests.

### Files to Modify

- `src/types/workbench.ts`
  - Add the `WorkbenchHabitWeekWidgetConfig` type and wire it into the widget config surface.
- `src/workbench/widgetRegistry.ts`
  - Register default config and configure-dialog support for `habitWeek`.
- `src/components/workbench/view/WorkbenchHabitView.vue`
  - Recompose around shared list/detail building blocks without changing the current two-column UX.
- `src/tabs/DesktopHabitDock.vue`
  - Recompose around shared list/detail building blocks while preserving the list/detail toggle dock interaction.
- `src/components/habit/HabitListItem.vue`
  - Clarify emitted event usage only if needed to avoid misusing `open-calendar` for widget detail.
- `test/components/workbench/DashboardCanvas.test.ts`
  - Cover the new habit widget config flow.
- `test/components/workbench/WorkbenchHabitView.test.ts`
  - Update assertions if component structure changes while behavior stays the same.
- `test/tabs/DesktopHabitDock.test.ts`
  - Guard against regressions in dock-specific list/detail switching.

### Existing Files to Read Before Editing

- `src/tabs/DesktopHabitDock.vue`
- `src/components/workbench/view/WorkbenchHabitView.vue`
- `src/components/workbench/widgets/HabitWeekWidget.vue`
- `src/components/habit/HabitListItem.vue`
- `src/components/habit/HabitWeekBar.vue`
- `src/components/habit/HabitMonthCalendar.vue`
- `src/components/habit/HabitRecordLog.vue`
- `src/components/habit/HabitStatsCards.vue`
- `src/services/habitService.ts`
- `src/utils/habitStatsUtils.ts`
- `src/domain/habit/habitCompletion.ts`

---

### Task 1: Add the workbench habit widget config model

**Files:**
- Modify: `src/types/workbench.ts`
- Modify: `src/workbench/widgetRegistry.ts`
- Test: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write the failing config-flow test**

Add a new `DashboardCanvas` test that mirrors the todo/calendar config tests but targets `habitWeek`.

```ts
it('opens habit widget configure dialog and persists group config', async () => {
  const store = useWorkbenchStore();
  store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
  store.dashboards = [
    {
      id: 'dashboard-1',
      title: 'Habits',
      widgets: [
        {
          id: 'widget-1',
          type: 'habitWeek',
          title: 'Habit Widget',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {
            groupId: 'group-a',
          },
        },
      ],
    },
  ];

  const mounted = await mountCanvas({
    id: 'entry-dashboard',
    type: 'dashboard',
    title: 'Habits',
    icon: 'iconBoard',
    order: 0,
    dashboardId: 'dashboard-1',
  });

  (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
  await nextTick();
  (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

  expect(mockOpenHabitWidgetConfigDialog).toHaveBeenCalledWith({
    initialConfig: {
      groupId: 'group-a',
    },
    onConfirm: expect.any(Function),
  });

  const configureOptions = mockOpenHabitWidgetConfigDialog.mock.calls[0][0];
  await configureOptions.onConfirm({
    groupId: 'group-b',
  });

  expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
    groupId: 'group-b',
  });

  mounted.unmount();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/components/workbench/DashboardCanvas.test.ts
```

Expected: FAIL because `habitWeek` has no configure dialog registration and no `WorkbenchHabitWeekWidgetConfig` typing.

- [ ] **Step 3: Add the minimal config type and registry support**

Update `src/types/workbench.ts`:

```ts
export interface WorkbenchHabitWeekWidgetConfig {
  groupId?: string;
}
```

Update `src/workbench/widgetRegistry.ts`:

```ts
import type {
  WorkbenchCalendarWidgetConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchWidgetInstance,
  WorkbenchWidgetType,
} from '@/types/workbench';
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog';
```

Replace the `habitWeek` definition with:

```ts
habitWeek: {
  type: 'habitWeek',
  name: t('habit').title,
  icon: 'iconCheck',
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  createDefaultConfig: (): WorkbenchHabitWeekWidgetConfig => ({
    groupId: undefined,
  }),
  openConfigDialog: ({ widget, onUpdateConfig }) => {
    const habitConfig = widget.config as WorkbenchHabitWeekWidgetConfig;
    openHabitWidgetConfigDialog({
      initialConfig: {
        groupId: habitConfig.groupId,
      },
      onConfirm: async (nextConfig) => {
        await onUpdateConfig({
          groupId: nextConfig.groupId,
        });
      },
    });
  },
},
```

Update the dashboard-canvas test mock block:

```ts
const { mockOpenCalendarWidgetConfigDialog, mockOpenHabitWidgetConfigDialog } = vi.hoisted(() => ({
  mockOpenCalendarWidgetConfigDialog: vi.fn(),
  mockOpenHabitWidgetConfigDialog: vi.fn(),
}));

vi.mock('@/workbench/habitWidgetConfigDialog', () => ({
  openHabitWidgetConfigDialog: mockOpenHabitWidgetConfigDialog,
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/components/workbench/DashboardCanvas.test.ts
```

Expected: PASS for the new habit widget configure flow test.

- [ ] **Step 5: Commit**

```bash
git add src/types/workbench.ts src/workbench/widgetRegistry.ts test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): add habit widget config model"
```

---

### Task 2: Build the habit widget config dialog

**Files:**
- Create: `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue`
- Create: `src/workbench/habitWidgetConfigDialog.ts`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`

- [ ] **Step 1: Write the failing dialog test**

Add a dialog-focused unit test that mounts the dialog component directly and verifies group selection emit behavior.

```ts
it('confirms the selected group as widget config', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const mounted = await mountHabitWidgetConfigDialog({
    initialConfig: { groupId: 'group-a' },
    onConfirm,
    onCancel,
  });

  const select = mounted.container.querySelector('[data-testid="habit-widget-group-select"]') as HTMLSelectElement;
  select.value = 'group-b';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();

  (mounted.container.querySelector('[data-testid="habit-widget-config-confirm"]') as HTMLButtonElement).click();

  expect(onConfirm).toHaveBeenCalledWith({
    groupId: 'group-b',
  });

  mounted.unmount();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: FAIL because the config dialog files and mount helper do not exist.

- [ ] **Step 3: Implement the dialog component and dialog bootstrap**

Create `src/components/workbench/dialogs/HabitWidgetConfigDialog.vue` with the same layout shell as the calendar/todo widget dialogs.

```vue
<template>
  <WorkbenchConfigDialogLayout>
    <div class="habit-widget-config-dialog__body">
      <div class="habit-widget-config-dialog__field">
        <label class="habit-widget-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="habit-widget-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button class="b3-button b3-button--cancel" data-testid="habit-widget-config-cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" data-testid="habit-widget-config-confirm" type="button" @click="handleConfirm">
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>
```

```ts
const settingsStore = useSettingsStore();
const selectedGroup = ref(props.initialConfig.groupId ?? '');

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin();
  }
});

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
]);

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
  });
}
```

Create `src/workbench/habitWidgetConfigDialog.ts` by following `calendarWidgetConfigDialog.ts`:

```ts
export function openHabitWidgetConfigDialog(options: {
  initialConfig: WorkbenchHabitWeekWidgetConfig;
  onConfirm: (config: WorkbenchHabitWeekWidgetConfig) => void | Promise<void>;
}): Dialog {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;
  let isConfirming = false;

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  const closeDialog = () => {
    dialog.destroy();
  };

  app = createApp(HabitWidgetConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchHabitWeekWidgetConfig) => {
      if (isConfirming) return;
      isConfirming = true;
      try {
        await options.onConfirm(config);
        closeDialog();
      } finally {
        isConfirming = false;
      }
    },
  });

  const pinia = getSharedPinia();
  if (pinia) {
    app.use(pinia);
  }
  app.mount(mountEl);
  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
  return dialog;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: PASS for the config dialog selection test.

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/dialogs/HabitWidgetConfigDialog.vue src/workbench/habitWidgetConfigDialog.ts test/components/workbench/HabitWeekWidget.test.ts
git commit -m "feat(workbench): add habit widget config dialog"
```

---

### Task 3: Extract the shared habit workspace composable

**Files:**
- Create: `src/composables/useHabitWorkspace.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`

- [ ] **Step 1: Write the failing composable test**

Create a composable test that proves grouped filtering, selection sync, and refresh callback behavior.

```ts
it('filters habits by group and keeps the selected habit in sync after refresh', async () => {
  const habits = ref([
    createHabit({ blockId: 'habit-a', docId: 'doc-1', project: { groupId: 'group-a' } }),
    createHabit({ blockId: 'habit-b', docId: 'doc-2', project: { groupId: 'group-b' } }),
  ]);

  const refresh = vi.fn(async () => {
    habits.value = [
      createHabit({ blockId: 'habit-a', name: 'updated', docId: 'doc-1', project: { groupId: 'group-a' } }),
    ];
  });

  const workspace = useHabitWorkspace({
    habits,
    currentDate: ref('2026-05-02'),
    selectedDate: ref('2026-05-02'),
    selectedViewMonth: ref('2026-05'),
    groupId: ref('group-a'),
    refresh,
  });

  workspace.selectHabit(habits.value[0]);

  expect(workspace.filteredHabits.value.map(habit => habit.blockId)).toEqual(['habit-a']);

  await workspace.refreshHabits();

  expect(workspace.selectedHabit.value?.name).toBe('updated');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected: FAIL because `useHabitWorkspace` does not exist.

- [ ] **Step 3: Implement the composable**

Create `src/composables/useHabitWorkspace.ts` with a narrow, reusable surface:

```ts
export function useHabitWorkspace(options: {
  habits: Ref<Habit[]>;
  currentDate: Ref<string>;
  selectedDate: Ref<string>;
  selectedViewMonth: Ref<string>;
  groupId?: Ref<string>;
  refresh: () => Promise<void>;
}) {
  const selectedHabit = ref<Habit | null>(null);
  const selectedStatsCache = ref<HabitStats | null>(null);

  const filteredHabits = computed(() => {
    const currentGroupId = options.groupId?.value ?? '';
    if (!currentGroupId) {
      return options.habits.value;
    }
    return options.habits.value.filter(habit => habit.project?.groupId === currentGroupId);
  });

  const habitStatsMap = computed(() => calculateAllHabitStats(filteredHabits.value, options.currentDate.value));
  const habitDayStateMap = computed(() => new Map(
    filteredHabits.value.map(habit => [habit.blockId, getHabitDayState(habit, options.selectedDate.value)]),
  ));
  const habitPeriodStateMap = computed(() => new Map(
    filteredHabits.value.map(habit => [habit.blockId, getHabitPeriodState(habit, options.selectedDate.value)]),
  ));
  const selectedStats = computed(() => {
    if (!selectedHabit.value) return null;
    return calculateHabitStats(selectedHabit.value, options.currentDate.value, options.selectedViewMonth.value);
  });
  const displaySelectedStats = computed(() => selectedStats.value ?? selectedStatsCache.value);

  watch(selectedStats, (value) => {
    if (value) {
      selectedStatsCache.value = value;
    }
  }, { immediate: true });

  function syncSelectedHabit() {
    if (!selectedHabit.value) return;
    selectedHabit.value = filteredHabits.value.find(habit => habit.blockId === selectedHabit.value?.blockId) ?? null;
  }

  function selectHabit(habit: Habit) {
    options.selectedViewMonth.value = options.currentDate.value.substring(0, 7);
    selectedHabit.value = habit;
    selectedStatsCache.value = calculateHabitStats(habit, options.currentDate.value, options.selectedViewMonth.value);
  }

  async function refreshHabits() {
    await options.refresh();
    syncSelectedHabit();
  }

  async function handleCheckIn(habit: Habit) {
    const success = await checkIn(habit, options.selectedDate.value);
    if (success && selectedHabit.value?.blockId === habit.blockId) {
      syncSelectedHabit();
    }
  }

  async function handleIncrement(habit: Habit) {
    const success = await checkInCount(habit, options.selectedDate.value, 1);
    if (success && selectedHabit.value?.blockId === habit.blockId) {
      syncSelectedHabit();
    }
  }

  return {
    filteredHabits,
    selectedHabit,
    selectedStatsCache,
    habitStatsMap,
    habitDayStateMap,
    habitPeriodStateMap,
    displaySelectedStats,
    selectHabit,
    refreshHabits,
    handleCheckIn,
    handleIncrement,
    syncSelectedHabit,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected: PASS for grouped filtering and selected-habit sync.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts test/composables/useHabitWorkspace.test.ts
git commit -m "refactor(habit): extract shared workspace composable"
```

---

### Task 4: Extract the shared habit list/detail panes

**Files:**
- Create: `src/components/habit/HabitWorkspaceListPane.vue`
- Create: `src/components/habit/HabitWorkspaceDetailPane.vue`
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`
- Test: `test/components/workbench/WorkbenchHabitView.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Write the failing shared-pane regression tests**

Add two focused expectations:

```ts
it('renders the shared habit detail pane when a habit is selected', async () => {
  const mounted = await mountWorkbenchHabitView();
  (mounted.container.querySelector('[data-testid="workbench-habit-item-habit-1"]') as HTMLButtonElement).click();
  await nextTick();
  expect(mounted.container.querySelector('[data-testid="habit-workspace-detail-pane"]')).not.toBeNull();
});
```

```ts
it('keeps the desktop dock list/detail toggle behavior after shared pane extraction', async () => {
  const mounted = await mountDesktopHabitDock();
  expect(mounted.container.querySelector('[data-testid="habit-detail-content"]')).toBeNull();
  (mounted.container.querySelector('[data-testid="habit-list-item-open-calendar-habit-1"]') as HTMLButtonElement).click();
  await nextTick();
  expect(mounted.container.querySelector('[data-testid="habit-detail-content"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts test/tabs/DesktopHabitDock.test.ts
```

Expected: FAIL because the new shared pane markers and composition do not exist.

- [ ] **Step 3: Implement the shared panes and recompose the two containers**

Create `src/components/habit/HabitWorkspaceListPane.vue`:

```vue
<template>
  <div class="habit-workspace-list-pane" data-testid="habit-workspace-list-pane">
    <HabitWeekBar
      v-model="selectedDateModel"
      :current-date="currentDate"
      :habits="habits"
    />

    <div v-if="habits.length > 0" class="habit-workspace-list-pane__list">
      <HabitListItem
        v-for="habit in habits"
        :key="habit.blockId"
        :habit="habit"
        :day-state="habitDayStateMap.get(habit.blockId)!"
        :period-state="habitPeriodStateMap.get(habit.blockId)!"
        :stats="habitStatsMap.get(habit.blockId)"
        @check-in="$emit('check-in', habit)"
        @increment="$emit('increment', habit)"
        @open-doc="$emit('open-doc', habit)"
        @open-detail="$emit('open-detail', habit)"
        @open-calendar="$emit('open-detail', habit)"
      />
    </div>

    <div v-else class="habit-workspace-list-pane__empty">
      <div class="habit-workspace-list-pane__empty-icon">🎯</div>
      <div class="habit-workspace-list-pane__empty-title">{{ t('habit').noHabits }}</div>
      <div class="habit-workspace-list-pane__empty-desc">{{ t('habit').noHabitsDesc }}</div>
    </div>
  </div>
</template>
```

Create `src/components/habit/HabitWorkspaceDetailPane.vue`:

```vue
<template>
  <div class="habit-workspace-detail-pane" data-testid="habit-workspace-detail-pane">
    <div class="habit-workspace-detail-pane__header">
      <div class="habit-workspace-detail-pane__title">{{ habit.name }}</div>
      <div class="habit-workspace-detail-pane__actions">
        <button class="block__icon" data-testid="habit-workspace-refresh" :aria-label="t('common').refresh" @click="$emit('refresh')">
          <svg><use xlink:href="#iconRefresh"></use></svg>
        </button>
        <button class="block__icon" data-testid="habit-workspace-open-doc" :aria-label="t('todo').openDoc" @click="$emit('open-doc', habit)">
          <svg><use xlink:href="#iconFile"></use></svg>
        </button>
      </div>
    </div>

    <div class="habit-workspace-detail-pane__content" data-testid="habit-detail-content">
      <HabitMonthCalendar
        :habit="habit"
        :stats="stats"
        :current-date="currentDate"
        :view-month="viewMonth"
        @update:view-month="$emit('update:viewMonth', $event)"
      />
      <HabitStatsCards :stats="stats" />
      <HabitRecordLog :habit="habit" :view-month="viewMonth" />
    </div>
  </div>
</template>
```

Refactor both `WorkbenchHabitView.vue` and `DesktopHabitDock.vue` to consume `useHabitWorkspace()` and the two shared pane components instead of holding bespoke copies of week/list/detail rendering.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/components/workbench/WorkbenchHabitView.test.ts test/tabs/DesktopHabitDock.test.ts
```

Expected: PASS with dock behavior unchanged and workbench view using the shared detail pane.

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitWorkspaceListPane.vue src/components/habit/HabitWorkspaceDetailPane.vue src/components/workbench/view/WorkbenchHabitView.vue src/tabs/DesktopHabitDock.vue test/components/workbench/WorkbenchHabitView.test.ts test/tabs/DesktopHabitDock.test.ts
git commit -m "refactor(habit): share workspace list and detail panes"
```

---

### Task 5: Upgrade the habit widget surface to summary + list + grouping

**Files:**
- Modify: `src/components/workbench/widgets/HabitWeekWidget.vue`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`

- [ ] **Step 1: Write the failing widget rendering tests**

Add tests for grouped rendering and empty state:

```ts
it('renders week summary and filtered habit list from widget config', async () => {
  const mounted = await mountHabitWeekWidget({
    groupId: 'group-a',
  });

  expect(mounted.container.querySelector('[data-testid="habit-workspace-list-pane"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-a"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-b"]')).toBeNull();
});
```

```ts
it('renders an empty state when the configured group has no habits', async () => {
  const mounted = await mountHabitWeekWidget({
    groupId: 'missing-group',
  });

  expect(mounted.container.querySelector('[data-testid="habit-workspace-empty"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: FAIL because the widget only renders `HabitWeekBar` and does not filter by `groupId`.

- [ ] **Step 3: Implement the upgraded widget**

Replace `src/components/workbench/widgets/HabitWeekWidget.vue` with a composable-backed widget:

```vue
<template>
  <div class="workbench-widget-habit-week" data-testid="workbench-widget-habit-week">
    <HabitWorkspaceListPane
      v-model:selected-date="selectedDate"
      :current-date="currentDate"
      :habits="filteredHabits"
      :habit-stats-map="habitStatsMap"
      :habit-day-state-map="habitDayStateMap"
      :habit-period-state-map="habitPeriodStateMap"
      @check-in="handleCheckIn"
      @increment="handleIncrement"
      @open-detail="handleOpenDetail"
    />
  </div>
</template>
```

```ts
const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const selectedViewMonth = ref(dayjs().format('YYYY-MM'));
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const calendarConfig = computed(() => (props.widget?.config ?? {}) as WorkbenchHabitWeekWidgetConfig);
const currentDate = computed(() => projectStore.currentDate);
const habits = computed(() => projectStore.getHabits(''));
const groupId = computed(() => calendarConfig.value.groupId ?? '');

const workspace = useHabitWorkspace({
  habits,
  currentDate,
  selectedDate,
  selectedViewMonth,
  groupId,
  refresh: async () => {
    if (!plugin) return;
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  },
});
```

Expose `filteredHabits`, `habitStatsMap`, `habitDayStateMap`, `habitPeriodStateMap`, `handleCheckIn`, `handleIncrement`, `handleOpenDetail` from the composable-backed widget setup.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: PASS for grouped list rendering and empty-state rendering.

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/widgets/HabitWeekWidget.vue test/components/workbench/HabitWeekWidget.test.ts
git commit -m "feat(workbench): render habit list inside habit widget"
```

---

### Task 6: Add the widget detail dialog host and wire click-to-open behavior

**Files:**
- Create: `src/workbench/habitWidgetDetailDialog.ts`
- Modify: `src/components/workbench/widgets/HabitWeekWidget.vue`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`

- [ ] **Step 1: Write the failing dialog-open test**

Add a widget interaction test:

```ts
it('opens a habit detail dialog when a habit is selected from the widget list', async () => {
  const mounted = await mountHabitWeekWidget({
    groupId: 'group-a',
  });

  (mounted.container.querySelector('[data-testid="habit-list-item-open-detail-habit-a"]') as HTMLButtonElement).click();

  expect(mockOpenHabitWidgetDetailDialog).toHaveBeenCalledWith(expect.objectContaining({
    habit: expect.objectContaining({ blockId: 'habit-a' }),
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: FAIL because the detail dialog bootstrap does not exist.

- [ ] **Step 3: Implement the dialog host and widget wiring**

Create `src/workbench/habitWidgetDetailDialog.ts`:

```ts
export function openHabitWidgetDetailDialog(options: {
  habit: Habit;
  currentDate: string;
  selectedViewMonth: string;
  onRefresh: () => Promise<void>;
}) {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;

  const dialog = new Dialog({
    title: options.habit.name,
    content: '',
    width: '760px',
    height: '80vh',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  app = createApp(HabitWorkspaceDetailPane, {
    habit: options.habit,
    stats: calculateHabitStats(options.habit, options.currentDate, options.selectedViewMonth),
    currentDate: options.currentDate,
    viewMonth: options.selectedViewMonth,
    'onUpdate:viewMonth': () => {},
    onRefresh: options.onRefresh,
    onOpenDoc: async (habit: Habit) => {
      if (!habit.docId) return;
      await openDocumentAtLine(habit.docId, undefined, habit.blockId);
    },
  });

  const pinia = getSharedPinia();
  if (pinia) {
    app.use(pinia);
  }
  app.mount(mountEl);
  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
  return dialog;
}
```

Wire `HabitWeekWidget.vue`:

```ts
function handleOpenDetail(habit: Habit) {
  selectedViewMonth.value = currentDate.value.substring(0, 7);
  openHabitWidgetDetailDialog({
    habit,
    currentDate: currentDate.value,
    selectedViewMonth: selectedViewMonth.value,
    onRefresh: workspace.refreshHabits,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts
```

Expected: PASS for dialog-open behavior.

- [ ] **Step 5: Commit**

```bash
git add src/workbench/habitWidgetDetailDialog.ts src/components/workbench/widgets/HabitWeekWidget.vue test/components/workbench/HabitWeekWidget.test.ts
git commit -m "feat(workbench): open habit widget detail in dialog"
```

---

### Task 7: Keep dialog detail content live after refresh and check-in

**Files:**
- Modify: `src/workbench/habitWidgetDetailDialog.ts`
- Modify: `src/components/habit/HabitWorkspaceDetailPane.vue`
- Test: `test/components/workbench/HabitWeekWidget.test.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing live-refresh test**

Add a test that simulates refresh after dialog open and expects the updated habit stats or record data to be reflected.

```ts
it('refreshes the open habit detail dialog content after widget actions', async () => {
  const dialogState = createMockHabitDetailDialogState();
  mockOpenHabitWidgetDetailDialog.mockImplementation(dialogState.open);

  const mounted = await mountHabitWeekWidget({ groupId: 'group-a' });
  (mounted.container.querySelector('[data-testid="habit-list-item-open-detail-habit-a"]') as HTMLButtonElement).click();
  await nextTick();

  await dialogState.refreshFromHost();

  expect(dialogState.lastRenderedHabit?.name).toBe('updated habit a');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected: FAIL because the detail dialog is mounted with a static habit snapshot.

- [ ] **Step 3: Make the detail dialog reactive to refresh**

Refactor `src/workbench/habitWidgetDetailDialog.ts` to mount a tiny host component instead of a one-shot props snapshot:

```ts
const app = createApp(defineComponent({
  setup() {
    const selectedViewMonth = ref(options.selectedViewMonth);
    const habitRef = ref(options.habit);
    const stats = computed(() => calculateHabitStats(habitRef.value, options.currentDate, selectedViewMonth.value));

    async function handleRefresh() {
      await options.onRefresh();
      const nextHabit = options.getHabitById(habitRef.value.blockId);
      if (nextHabit) {
        habitRef.value = nextHabit;
      }
    }

    return () => h(HabitWorkspaceDetailPane, {
      habit: habitRef.value,
      stats: stats.value,
      currentDate: options.currentDate,
      viewMonth: selectedViewMonth.value,
      'onUpdate:viewMonth': (value: string) => {
        selectedViewMonth.value = value;
      },
      onRefresh: handleRefresh,
      onOpenDoc: async (habit: Habit) => {
        if (!habit.docId) return;
        await openDocumentAtLine(habit.docId, undefined, habit.blockId);
      },
    });
  },
}));
```

Update the `openHabitWidgetDetailDialog` options contract:

```ts
export function openHabitWidgetDetailDialog(options: {
  habit: Habit;
  currentDate: string;
  selectedViewMonth: string;
  onRefresh: () => Promise<void>;
  getHabitById: (blockId: string) => Habit | undefined;
})
```

Update `HabitWeekWidget.vue` accordingly:

```ts
openHabitWidgetDetailDialog({
  habit,
  currentDate: currentDate.value,
  selectedViewMonth: selectedViewMonth.value,
  onRefresh: workspace.refreshHabits,
  getHabitById: blockId => workspace.filteredHabits.value.find(item => item.blockId === blockId),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected: PASS for detail refresh continuity and composable refresh behavior.

- [ ] **Step 5: Commit**

```bash
git add src/workbench/habitWidgetDetailDialog.ts src/components/habit/HabitWorkspaceDetailPane.vue src/components/workbench/widgets/HabitWeekWidget.vue test/components/workbench/HabitWeekWidget.test.ts test/composables/useHabitWorkspace.test.ts
git commit -m "fix(workbench): keep habit widget detail dialog in sync"
```

---

### Task 8: Final regression verification and cleanup

**Files:**
- Modify: `src/components/habit/HabitListItem.vue` (only if event naming cleanup is still needed)
- Test: `test/components/workbench/HabitWeekWidget.test.ts`
- Test: `test/components/workbench/DashboardCanvas.test.ts`
- Test: `test/components/workbench/WorkbenchHabitView.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Add the final regression cases if still missing**

Ensure the suite explicitly covers:

```ts
it('does not change the desktop dock back-to-list interaction', async () => {
  const mounted = await mountDesktopHabitDock();
  (mounted.container.querySelector('[data-testid="habit-list-item-open-calendar-habit-1"]') as HTMLButtonElement).click();
  await nextTick();
  (mounted.container.querySelector('[aria-label="返回列表"]') as HTMLButtonElement).click();
  await nextTick();
  expect(mounted.container.querySelector('[data-testid="habit-detail-content"]')).toBeNull();
});
```

```ts
it('persists habit widget group config in the workbench store snapshot', async () => {
  await store.updateWidgetConfig('dashboard-1', 'widget-1', { groupId: 'group-a' });
  expect(store.dashboards[0].widgets[0].config).toEqual({ groupId: 'group-a' });
});
```

- [ ] **Step 2: Run the targeted regression suite**

Run:

```bash
npx vitest run test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts test/components/workbench/WorkbenchHabitView.test.ts test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected: PASS for all habit widget, config, dock, and shared-workspace tests.

- [ ] **Step 3: Run the broader workbench/habit smoke suite**

Run:

```bash
npx vitest run test/stores/workbenchStore.test.ts test/components/habit/HabitListItem.test.ts
```

Expected: PASS with no regressions in widget persistence or existing habit list item behavior.

- [ ] **Step 4: Review for dead code and remove any obsolete inline logic**

Delete any no-longer-used local duplicates from:

```ts
// Remove if no longer referenced after extraction:
// - duplicated habitStatsMap / habitDayStateMap / habitPeriodStateMap logic
// - duplicated selectedStatsCache watchers
// - bespoke empty-state blocks now covered by HabitWorkspaceListPane
```

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitListItem.vue src/components/workbench/widgets/HabitWeekWidget.vue src/components/workbench/view/WorkbenchHabitView.vue src/tabs/DesktopHabitDock.vue src/workbench/habitWidgetDetailDialog.ts test/components/workbench/HabitWeekWidget.test.ts test/components/workbench/DashboardCanvas.test.ts test/components/workbench/WorkbenchHabitView.test.ts test/tabs/DesktopHabitDock.test.ts test/composables/useHabitWorkspace.test.ts
git commit -m "feat(workbench): add interactive habit workspace widget"
```

---

## Self-Review

### Spec coverage

- Widget upgraded from summary-only to summary + list: covered by Task 5.
- Detail opens in dialog and reuses detail content: covered by Tasks 4, 6, and 7.
- Group filter config with workbench persistence: covered by Tasks 1 and 2.
- No desktop dock interaction regression: covered by Tasks 4 and 8.
- Refresh and check-in synchronization: covered by Tasks 3, 5, 6, and 7.

### Placeholder scan

- No `TODO` / `TBD` placeholders remain.
- Each task includes explicit files, code, commands, and expected outcomes.

### Type consistency

- `WorkbenchHabitWeekWidgetConfig` is defined once and referenced consistently.
- Shared state surface uses `useHabitWorkspace`.
- Dialog bootstrap uses `openHabitWidgetDetailDialog`.
- Shared panes use `HabitWorkspaceListPane` and `HabitWorkspaceDetailPane`.
