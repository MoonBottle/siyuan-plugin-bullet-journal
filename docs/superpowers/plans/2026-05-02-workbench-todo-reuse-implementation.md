# Workbench Todo Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workbench `todoList` widget and workbench `todo` view reuse the Todo dock’s filter and content capabilities, with widget config acting as a preset-filter entry rather than a second Todo implementation.

**Architecture:** Extract the Todo dock’s filter state and presentational surface into reusable units, then let `DesktopTodoDock` remain the canonical shell while workbench paths inject preset filters into the same model. The widget keeps only lightweight config such as preset filters and preview count; the actual item rendering and top filter behavior stay aligned with Todo dock.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Vitest, existing `DesktopTodoDock.vue`, `TodoSidebar.vue`, `workbenchStore`, and dialog helpers.

---

## File Map

### Create

- `src/types/todoView.ts`
  - Shared Todo filter state and preset payload types used by Desktop Todo and workbench
- `src/composables/useTodoViewState.ts`
  - Canonical Todo filter/search/sort state setup with optional preset injection
- `src/components/todo/TodoFilterBar.vue`
  - Shared Todo top filter bar UI
- `src/components/todo/TodoContentPane.vue`
  - Shared Todo content area that renders `TodoSidebar` from normalized props
- `test/composables/useTodoViewState.test.ts`
  - State merge / preset injection tests
- `test/components/todo/TodoFilterBar.test.ts`
  - Shared filter bar rendering and event tests

### Modify

- `src/tabs/DesktopTodoDock.vue`
  - Replace local Todo filter UI/state wiring with shared composable + shared components
- `src/components/workbench/widgets/TodoListWidget.vue`
  - Stop rendering ad hoc bullet list; reuse shared Todo content in a constrained preview mode
- `src/components/workbench/view/WorkbenchViewHost.vue`
  - Route workbench todo entry through reusable Todo surface with preset initialization
- `src/components/workbench/dashboard/DashboardCanvas.vue`
  - Pass widget config into `TodoListWidget`; keep configure flow aligned with new config shape
- `src/workbench/widgetRegistry.ts`
  - Change `todoList` default config from `previewCount` only to `{ preset, previewCount }`
- `src/types/workbench.ts`
  - Add typed config shapes for `todoList` widget preset support
- `src/stores/workbenchStore.ts`
  - Preserve/normalize richer `todoList` widget config updates
- `test/components/workbench/DashboardCanvas.test.ts`
  - Replace lightweight todo widget expectations with shared Todo content expectations
- `test/components/workbench/WorkbenchViewHost.test.ts`
  - Verify todo workbench view uses preset-aware shared Todo surface
- `test/stores/workbenchStore.test.ts`
  - Verify `todoList` widget config persists preset + preview count
- `test/tabs/DesktopTodoDock.test.ts`
  - Keep Todo dock green after extraction

### Existing References To Inspect While Implementing

- `src/tabs/DesktopTodoDock.vue`
- `src/components/todo/TodoSidebar.vue`
- `src/settings/types.ts`
- `src/workbench/widgetRegistry.ts`
- `src/components/workbench/widgets/TodoListWidget.vue`
- `src/components/workbench/view/WorkbenchViewHost.vue`
- `docs/superpowers/specs/2026-05-02-workbench-tab-design.md`

---

### Task 1: Define Shared Todo View Types and Preset Merge Rules

**Files:**
- Create: `src/types/todoView.ts`
- Create: `test/composables/useTodoViewState.test.ts`

- [ ] **Step 1: Write the failing preset-merge tests**

```ts
import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '@/stores';

describe('useTodoViewState preset merge', () => {
  it('applies widget preset as initial todo filter state', async () => {
    setActivePinia(createPinia());
    const settingsStore = useSettingsStore();
    settingsStore.todoDock.selectedGroup = '';

    const { useTodoViewState } = await import('@/composables/useTodoViewState');
    const state = useTodoViewState({
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    });

    expect(state.selectedGroup.value).toBe('group-a');
    expect(state.dateFilterType.value).toBe('today');
    expect(state.selectedPriorities.value).toEqual(['high']);
  });

  it('does not overwrite widget preset when current state changes later', async () => {
    setActivePinia(createPinia());

    const { useTodoViewState } = await import('@/composables/useTodoViewState');
    const preset = {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'] as const,
    };
    const state = useTodoViewState({ preset });

    state.selectedGroup.value = 'group-b';
    state.selectedPriorities.value = ['low'];

    expect(preset).toEqual({
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/composables/useTodoViewState.test.ts`
Expected: FAIL with module not found for `@/composables/useTodoViewState`

- [ ] **Step 3: Define shared Todo view types**

```ts
// src/types/todoView.ts
import type { PriorityLevel } from '@/types/models';
import type { TodoDateFilterType } from '@/utils/todoDateFilter';
import type { TodoSortRule } from '@/settings';

export interface TodoViewPreset {
  groupId?: string;
  dateFilterType?: TodoDateFilterType;
  startDate?: string;
  endDate?: string;
  priorities?: PriorityLevel[];
  searchQuery?: string;
  sortRules?: TodoSortRule[];
}

export interface TodoViewStateOptions {
  preset?: TodoViewPreset;
  persistToSettings?: boolean;
}
```

- [ ] **Step 4: Add minimal preset-aware state composable**

```ts
// src/composables/useTodoViewState.ts
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { useProjectStore, useSettingsStore } from '@/stores';
import { buildCompletedTodoDateRange, buildTodoDateRange, type TodoDateFilterType } from '@/utils/todoDateFilter';
import type { PriorityLevel } from '@/types/models';
import type { TodoViewStateOptions } from '@/types/todoView';

export function useTodoViewState(options: TodoViewStateOptions = {}) {
  const settingsStore = useSettingsStore();
  const projectStore = useProjectStore();

  const selectedGroup = ref(options.preset?.groupId ?? settingsStore.todoDock.selectedGroup);
  const searchQuery = ref(options.preset?.searchQuery ?? '');
  const selectedPriorities = ref<PriorityLevel[]>([...(options.preset?.priorities ?? [])]);
  const dateFilterType = ref<TodoDateFilterType>(options.preset?.dateFilterType ?? 'today');
  const startDate = ref(options.preset?.startDate ?? dayjs().format('YYYY-MM-DD'));
  const endDate = ref(options.preset?.endDate ?? dayjs().add(7, 'day').format('YYYY-MM-DD'));

  if (options.persistToSettings !== false) {
    watch(selectedGroup, (value) => {
      settingsStore.todoDock.selectedGroup = value;
      settingsStore.saveToPlugin();
    });
  }

  const dateRange = computed(() => buildTodoDateRange(
    dateFilterType.value,
    projectStore.currentDate,
    startDate.value,
    endDate.value,
  ));

  const completedDateRange = computed(() => buildCompletedTodoDateRange(
    dateFilterType.value,
    projectStore.currentDate,
    dateRange.value,
  ));

  return {
    selectedGroup,
    searchQuery,
    selectedPriorities,
    dateFilterType,
    startDate,
    endDate,
    dateRange,
    completedDateRange,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/composables/useTodoViewState.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/todoView.ts src/composables/useTodoViewState.ts test/composables/useTodoViewState.test.ts
git commit -m "feat(todo): add preset-aware shared todo view state"
```

---

### Task 2: Extract Shared Todo Filter Bar and Content Pane

**Files:**
- Create: `src/components/todo/TodoFilterBar.vue`
- Create: `src/components/todo/TodoContentPane.vue`
- Create: `test/components/todo/TodoFilterBar.test.ts`
- Modify: `src/tabs/DesktopTodoDock.vue`
- Test: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: Write the failing shared filter bar tests**

```ts
import { createApp, h, ref } from 'vue';
import { describe, expect, it } from 'vitest';

async function mountFilterBar() {
  const { default: TodoFilterBar } = await import('@/components/todo/TodoFilterBar.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const selectedGroup = ref('group-a');
  const dateFilterType = ref('today');
  const selectedPriorities = ref(['high']);
  const searchQuery = ref('abc');

  createApp({
    render() {
      return h(TodoFilterBar, {
        selectedGroup: selectedGroup.value,
        dateFilterType: dateFilterType.value,
        selectedPriorities: selectedPriorities.value,
        searchQuery: searchQuery.value,
        startDate: '2026-05-02',
        endDate: '2026-05-09',
        showSortPanel: false,
        sortRules: [],
      });
    },
  }).mount(container);

  return container;
}

describe('TodoFilterBar', () => {
  it('renders the same todo search and filter controls', async () => {
    const container = await mountFilterBar();

    expect(container.querySelector('.search-input')).not.toBeNull();
    expect(container.querySelector('.group-select')).not.toBeNull();
    expect(container.querySelector('.date-filter-select')).not.toBeNull();
    expect(container.querySelectorAll('.priority-btn').length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/todo/TodoFilterBar.test.ts`
Expected: FAIL with module not found for `@/components/todo/TodoFilterBar.vue`

- [ ] **Step 3: Extract the filter bar UI from `DesktopTodoDock.vue`**

```vue
<!-- src/components/todo/TodoFilterBar.vue -->
<template>
  <div class="todo-filter-card">
    <div class="search-row">
      <div class="search-box">
        <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          :value="searchQuery"
          type="text"
          :placeholder="t('todo').searchPlaceholder"
          class="search-input"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="filter-row">
      <SySelect
        :model-value="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
        class="group-select"
        @change="value => $emit('update:selectedGroup', value)"
      />
      <SySelect
        :model-value="dateFilterType"
        :options="dateFilterOptions"
        class="date-filter-select"
        @change="value => $emit('update:dateFilterType', value)"
      />
      <button class="sort-trigger" @click="$emit('toggle-sort-panel')">
        <svg><use xlink:href="#iconSort"></use></svg>
      </button>
      <div class="priority-filter">
        <button
          v-for="p in priorityOptions"
          :key="p.value"
          :class="['priority-btn', { active: selectedPriorities.includes(p.value) }]"
          @click="$emit('toggle-priority', p.value)"
        >
          {{ p.emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Extract the shared Todo content pane**

```vue
<!-- src/components/todo/TodoContentPane.vue -->
<template>
  <div class="todo-dock-content">
    <TodoSidebar
      ref="todoSidebar"
      :group-id="groupId"
      :search-query="searchQuery"
      :date-range="dateRange"
      :completed-date-range="completedDateRange"
      :priorities="priorities"
      :display-mode="displayMode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import type { PriorityLevel } from '@/types/models';

defineProps<{
  groupId: string;
  searchQuery: string;
  dateRange?: { start: string; end: string } | null;
  completedDateRange?: { start: string; end: string } | null;
  priorities: PriorityLevel[];
  displayMode?: 'default' | 'embedded';
}>();

const todoSidebar = ref<InstanceType<typeof TodoSidebar> | null>(null);

defineExpose({
  todoSidebar,
});
</script>
```

- [ ] **Step 5: Refactor `DesktopTodoDock.vue` to use the shared units**

```vue
<!-- replace local filter markup and local TodoSidebar mount -->
<TodoFilterBar
  :selected-group="selectedGroup"
  :search-query="searchQuery"
  :date-filter-type="dateFilterType"
  :selected-priorities="selectedPriorities"
  :start-date="startDate"
  :end-date="endDate"
  :show-sort-panel="showSortPanel"
  :sort-rules="sortRules"
  @update:selected-group="selectedGroup = $event"
  @update:search-query="searchQuery = $event"
  @update:date-filter-type="dateFilterType = $event"
  @toggle-priority="togglePriority"
  @toggle-sort-panel="toggleSortPanel"
/>

<TodoContentPane
  ref="todoPane"
  :group-id="selectedGroup"
  :search-query="searchQuery"
  :date-range="dateRange"
  :completed-date-range="completedDateRange"
  :priorities="selectedPriorities"
/>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/components/todo/TodoFilterBar.test.ts test/tabs/DesktopTodoDock.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/todo/TodoFilterBar.vue src/components/todo/TodoContentPane.vue src/tabs/DesktopTodoDock.vue test/components/todo/TodoFilterBar.test.ts test/tabs/DesktopTodoDock.test.ts
git commit -m "refactor(todo): share todo filter and content surfaces"
```

---

### Task 3: Type and Persist `todoList` Widget Preset Config

**Files:**
- Modify: `src/types/workbench.ts`
- Modify: `src/workbench/widgetRegistry.ts`
- Modify: `src/stores/workbenchStore.ts`
- Modify: `test/stores/workbenchStore.test.ts`

- [ ] **Step 1: Write the failing widget config persistence test**

```ts
it('persists todoList widget preset config and preview count together', async () => {
  const store = useWorkbenchStore();
  await store.load(plugin as any);
  await store.addWidget('dashboard-1', 'todoList');

  const widgetId = store.dashboards[0].widgets[0].id;
  await store.updateWidgetConfig('dashboard-1', widgetId, {
    previewCount: 7,
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });

  expect(store.dashboards[0].widgets[0].config).toEqual({
    previewCount: 7,
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/workbenchStore.test.ts -t "persists todoList widget preset config"`
Expected: FAIL because `todoList` config is still loosely modeled and not normalized around preset data

- [ ] **Step 3: Add typed `todoList` widget config**

```ts
// src/types/workbench.ts
import type { TodoViewPreset } from '@/types/todoView';

export interface WorkbenchTodoListWidgetConfig {
  previewCount?: number;
  preset?: TodoViewPreset;
}

export type WorkbenchWidgetConfigMap = {
  todoList: WorkbenchTodoListWidgetConfig;
  quadrantSummary: Record<string, never>;
  habitWeek: Record<string, never>;
  miniCalendar: Record<string, never>;
  pomodoroStats: Record<string, never>;
};
```

- [ ] **Step 4: Change widget defaults and store updates**

```ts
// src/workbench/widgetRegistry.ts
todoList: {
  type: 'todoList',
  name: t('todo').title,
  icon: 'iconList',
  defaultSize: { w: 6, h: 6 },
  createDefaultConfig: () => ({
    previewCount: 5,
    preset: {},
  }),
}
```

```ts
// src/stores/workbenchStore.ts
async function updateWidgetConfig(dashboardId: string, widgetId: string, config: Record<string, unknown>) {
  const dashboard = dashboards.value.find(item => item.id === dashboardId);
  const widget = dashboard?.widgets.find(item => item.id === widgetId);
  if (!widget) return;

  widget.config = {
    ...widget.config,
    ...config,
  };
  await persist();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/stores/workbenchStore.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/workbench.ts src/workbench/widgetRegistry.ts src/stores/workbenchStore.ts test/stores/workbenchStore.test.ts
git commit -m "feat(workbench): type todo widget preset config"
```

---

### Task 4: Rebuild `TodoListWidget` as a Preset-Driven Todo Surface

**Files:**
- Modify: `src/components/workbench/widgets/TodoListWidget.vue`
- Modify: `src/components/workbench/dashboard/DashboardCanvas.vue`
- Modify: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write the failing widget rendering test**

```ts
it('renders todo widget using shared todo content instead of plain bullet preview list', async () => {
  const mounted = await mountCanvasWithTodoWidget({
    previewCount: 5,
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });

  expect(mounted.container.querySelector('[data-testid="workbench-widget-todo-list"]')).not.toBeNull();
  expect(mounted.container.querySelector('.todo-dock-content')).not.toBeNull();
  expect(mounted.container.querySelector('.workbench-widget-todo-list__list')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts -t "renders todo widget using shared todo content"`
Expected: FAIL because `TodoListWidget.vue` still renders an ad hoc `<ul>`

- [ ] **Step 3: Replace the ad hoc widget markup with shared Todo content**

```vue
<template>
  <div class="workbench-widget-todo-list" data-testid="workbench-widget-todo-list">
    <div class="workbench-widget-todo-list__meta">
      <span>{{ previewCount }}</span>
      <span>{{ t('todo').title }}</span>
    </div>

    <TodoContentPane
      :group-id="todoState.selectedGroup.value"
      :search-query="todoState.searchQuery.value"
      :date-range="todoState.dateRange.value"
      :completed-date-range="todoState.completedDateRange.value"
      :priorities="todoState.selectedPriorities.value"
      display-mode="embedded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import TodoContentPane from '@/components/todo/TodoContentPane.vue';
import { useTodoViewState } from '@/composables/useTodoViewState';
import type { WorkbenchTodoListWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const config = computed(() => (props.widget?.config ?? {}) as WorkbenchTodoListWidgetConfig);
const todoState = useTodoViewState({
  preset: config.value.preset,
  persistToSettings: false,
});

const previewCount = computed(() => {
  const raw = Number(config.value.previewCount ?? 5);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), 20) : 5;
});
</script>
```

- [ ] **Step 4: Keep `DashboardCanvas` configure flow compatible**

```ts
// configure result shape for todoList widget
await workbenchStore.updateWidgetConfig(dashboard.value!.id, widgetId, {
  previewCount,
  preset,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/widgets/TodoListWidget.vue src/components/workbench/dashboard/DashboardCanvas.vue test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): reuse todo content in todo widget"
```

---

### Task 5: Inject Widget Presets Into the Workbench Todo View

**Files:**
- Modify: `src/components/workbench/view/WorkbenchViewHost.vue`
- Modify: `test/components/workbench/WorkbenchViewHost.test.ts`
- Modify: `src/components/workbench/WorkbenchContentHost.vue`

- [ ] **Step 1: Write the failing todo view preset test**

```ts
it('initializes workbench todo view from the selected todo widget preset', async () => {
  const mounted = await mountWorkbenchViewHost({
    id: 'entry-todo',
    type: 'view',
    title: 'Todo',
    icon: 'iconList',
    order: 0,
    viewType: 'todo',
  }, {
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });

  expect(mounted.container.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull();
  expect(mounted.container.querySelector('.group-select')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/WorkbenchViewHost.test.ts -t "initializes workbench todo view"`
Expected: FAIL because `WorkbenchViewHost` currently mounts raw `DesktopTodoDock` with no preset boundary

- [ ] **Step 3: Route workbench todo view through the shared Todo surface**

```vue
<!-- src/components/workbench/view/WorkbenchViewHost.vue -->
<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div v-if="viewType === 'todo'" class="workbench-view-host__surface" data-testid="workbench-view-todo">
      <TodoFilterBar
        :selected-group="todoState.selectedGroup.value"
        :search-query="todoState.searchQuery.value"
        :date-filter-type="todoState.dateFilterType.value"
        :selected-priorities="todoState.selectedPriorities.value"
        :start-date="todoState.startDate.value"
        :end-date="todoState.endDate.value"
        :show-sort-panel="false"
        :sort-rules="[]"
        @update:selected-group="todoState.selectedGroup.value = $event"
        @update:search-query="todoState.searchQuery.value = $event"
        @update:date-filter-type="todoState.dateFilterType.value = $event"
        @toggle-priority="togglePriority"
      />

      <TodoContentPane
        :group-id="todoState.selectedGroup.value"
        :search-query="todoState.searchQuery.value"
        :date-range="todoState.dateRange.value"
        :completed-date-range="todoState.completedDateRange.value"
        :priorities="todoState.selectedPriorities.value"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 4: Pass preset context from workbench content routing**

```ts
// WorkbenchContentHost or parent
<WorkbenchViewHost
  v-else
  :entry="activeEntry"
  :todo-preset="resolvedTodoPreset"
/>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/components/workbench/WorkbenchViewHost.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue src/components/workbench/WorkbenchContentHost.vue test/components/workbench/WorkbenchViewHost.test.ts
git commit -m "feat(workbench): inject widget presets into todo view"
```

---

### Task 6: Replace Todo Widget Configure Flow With Preset + Preview Controls

**Files:**
- Modify: `src/workbench/widgetRegistry.ts`
- Modify: `src/components/workbench/dashboard/DashboardCanvas.vue`
- Modify: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write the failing configure-flow test**

```ts
it('updates todo widget config with previewCount and preset filters from configure action', async () => {
  const mounted = await mountCanvasWithConfigurableTodoWidget();

  mounted.openConfigureDialogResult({
    previewCount: 8,
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });

  expect(mockUpdateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
    previewCount: 8,
    preset: {
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts -t "updates todo widget config with previewCount and preset filters"`
Expected: FAIL because configure flow still only handles `previewCount`

- [ ] **Step 3: Change the todo widget configure dialog contract**

```ts
// src/workbench/widgetRegistry.ts
openConfigDialog: async ({ widget, onConfirm }) => {
  const current = widget.config as WorkbenchTodoListWidgetConfig;
  const result = await openTodoWidgetConfigDialog({
    previewCount: current.previewCount ?? 5,
    preset: current.preset ?? {},
  });

  if (!result) {
    return;
  }

  onConfirm({
    previewCount: result.previewCount,
    preset: result.preset,
  });
}
```

- [ ] **Step 4: Persist configure results through `DashboardCanvas`**

```ts
async function handleWidgetConfigure(widgetId: string, config: Record<string, unknown>) {
  await workbenchStore.updateWidgetConfig(dashboard.value!.id, widgetId, config);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts test/stores/workbenchStore.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/workbench/widgetRegistry.ts src/components/workbench/dashboard/DashboardCanvas.vue test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): configure todo widget presets and preview count"
```

---

### Task 7: Verification Sweep for Todo Reuse Boundary

**Files:**
- Verify only

- [ ] **Step 1: Run focused new tests**

Run: `npx vitest run test/composables/useTodoViewState.test.ts test/components/todo/TodoFilterBar.test.ts test/components/workbench/DashboardCanvas.test.ts test/components/workbench/WorkbenchViewHost.test.ts test/stores/workbenchStore.test.ts`
Expected: PASS

- [ ] **Step 2: Run Todo regression tests**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts test/components/todo/TodoSidebar.test.ts`
Expected: PASS

- [ ] **Step 3: Run workbench shell regressions**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts test/components/workbench/WorkbenchSidebar.test.ts`
Expected: PASS

- [ ] **Step 4: Perform manual desktop verification**

```text
1. Open desktop Todo dock and confirm the top filter bar and card content look unchanged.
2. Open Workbench tab, select a Todo view entry, and confirm it uses the same filter and card structure as Todo dock.
3. Add a todoList widget to a dashboard and confirm it no longer renders a plain bullet list.
4. Configure the widget preset with group/date/priority filters and preview count.
5. Open the widget-linked Todo view and verify the top filter bar initializes from the widget preset.
6. Change filters temporarily in the workbench Todo view and confirm the widget preset is not overwritten automatically.
7. Reload the plugin and confirm widget preset + preview count survive via `workbench.json`.
```

- [ ] **Step 5: Commit final verification note if any code changed during validation**

```bash
git status --short
```

Expected: clean working tree if verification did not require follow-up fixes

---

## Self-Review

### Spec coverage

- `todoList` widget is treated as a preset entry rather than a second Todo implementation: covered by Tasks 3, 4, and 6
- Todo display and top filter bar are reused from the same source as Todo dock: covered by Tasks 1, 2, 4, and 5
- Workbench Todo view initializes from widget preset and does not auto-overwrite preset: covered by Tasks 1 and 5
- Widget config remains lightweight (`preset + previewCount`): covered by Tasks 3 and 6

### Placeholder scan

- No `TODO` / `TBD` placeholders remain
- Each task includes exact file paths and explicit commands
- Code steps include concrete snippets for the expected direction of implementation

### Type consistency

- `TodoViewPreset` is defined in Task 1 and reused consistently in workbench and Todo paths
- `WorkbenchTodoListWidgetConfig` is introduced in Task 3 before being used in Tasks 4 and 6
- Shared Todo surface names (`TodoFilterBar`, `TodoContentPane`, `useTodoViewState`) are introduced before downstream tasks depend on them

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-workbench-todo-reuse-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
