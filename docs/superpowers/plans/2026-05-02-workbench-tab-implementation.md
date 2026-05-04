# Workbench Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-only top-level `WorkbenchTab` with a two-column layout, left-side entry navigation, right-side dashboard/view hosting, and dedicated `workbench.json` persistence.

**Architecture:** Introduce a dedicated `workbenchStore` backed by `plugin.loadData/saveData('workbench.json')`, register a new top-level tab in `src/index.ts`, and split the UI into focused workbench components: sidebar, content host, view host, dashboard canvas, widget card, and widget components. Phase 1 ships the workbench shell plus `todo / habit / quadrant / pomodoroStats` workbench views; Phase 2 adds widget registry, dashboard widgets, and persisted grid layout.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Vitest, existing SiYuan plugin `loadData/saveData`, existing Todo/Habit/Quadrant/Pomodoro components and stores.

---

## File Map

### New files

- `src/types/workbench.ts`
  - Shared workbench types: entry, dashboard, widget, view types, persisted settings shape
- `src/stores/workbenchStore.ts`
  - Runtime state and persistence API for `workbench.json`
- `src/utils/workbenchStorage.ts`
  - Small persistence helper around plugin `loadData/saveData`
- `src/tabs/WorkbenchTab.vue`
  - Top-level desktop tab shell
- `src/components/workbench/WorkbenchSidebar.vue`
  - Left navigation column
- `src/components/workbench/WorkbenchContentHost.vue`
  - Right-side mode switcher for dashboard/view
- `src/components/workbench/view/WorkbenchViewHost.vue`
  - Host for supported workbench views
- `src/components/workbench/dashboard/DashboardCanvas.vue`
  - Grid canvas for dashboard widgets
- `src/components/workbench/dashboard/WorkbenchWidgetCard.vue`
  - Widget shell with title and drag handle
- `src/components/workbench/widgets/TodoListWidget.vue`
  - Lightweight todo widget
- `src/components/workbench/widgets/QuadrantSummaryWidget.vue`
  - Lightweight quadrant widget
- `src/components/workbench/widgets/HabitWeekWidget.vue`
  - Lightweight habit widget
- `src/components/workbench/widgets/MiniCalendarWidget.vue`
  - Lightweight calendar widget
- `src/components/workbench/widgets/PomodoroStatsWidget.vue`
  - Lightweight pomodoro widget
- `src/components/workbench/widgets/widgetRegistry.ts`
  - Registry metadata for widget types and defaults
- `test/stores/workbenchStore.test.ts`
  - Store and persistence behavior tests
- `test/utils/workbenchStorage.test.ts`
  - Persistence helper tests
- `test/tabs/WorkbenchTab.test.ts`
  - Integration tests for shell and routing between entries
- `test/components/workbench/WorkbenchSidebar.test.ts`
  - Sidebar creation and selection tests
- `test/components/workbench/WorkbenchContentHost.test.ts`
  - Host switching tests
- `test/components/workbench/DashboardCanvas.test.ts`
  - Dashboard render/layout tests
- `test/components/workbench/WorkbenchViewHost.test.ts`
  - View host mode tests

### Modified files

- `src/constants.ts`
  - Add `TAB_TYPES.WORKBENCH`
- `src/index.ts`
  - Register `WorkbenchTab`, add top-bar menu entry, tab icon/title mapping
- `src/i18n/zh_CN.json`
  - Add workbench labels
- `src/i18n/en_US.json`
  - Add workbench labels
- `src/main.ts` or existing plugin context helper file if needed
  - Export `usePlugin/useApp` usage for workbench components if not already enough
- `src/tabs/TodoDock.vue`
  - Optional: expose or reuse desktop content host if needed by workbench view mode
- `src/tabs/HabitDock.vue`
  - Optional: same as above
- `src/tabs/QuadrantTab.vue`
  - Optional: add `displayMode` or extract shared content component if direct reuse proves too coupled
- `src/tabs/PomodoroStatsTab.vue`
  - Optional: add `displayMode` or extract shared content component if direct reuse proves too coupled

### Existing references to inspect while implementing

- `src/index.ts`
- `src/constants.ts`
- `src/tabs/QuadrantTab.vue`
- `src/tabs/DesktopTodoDock.vue`
- `src/tabs/DesktopHabitDock.vue`
- `src/tabs/PomodoroStatsTab.vue`
- `src/utils/pomodoroStorage.ts`
- `src/services/conversationStorageService.ts`
- `docs/superpowers/specs/2026-05-02-workbench-tab-design.md`

---

### Task 1: Define Workbench Types and Persistence Helper

**Files:**
- Create: `src/types/workbench.ts`
- Create: `src/utils/workbenchStorage.ts`
- Create: `test/utils/workbenchStorage.test.ts`

- [ ] **Step 1: Write the failing persistence helper tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
};

describe('workbenchStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads default workbench settings when workbench.json is missing', async () => {
    plugin.loadData.mockResolvedValueOnce(null);
    const { loadWorkbenchSettings } = await import('@/utils/workbenchStorage');

    const result = await loadWorkbenchSettings(plugin as any);

    expect(plugin.loadData).toHaveBeenCalledWith('workbench.json');
    expect(result).toEqual({
      entries: [],
      dashboards: [],
      activeEntryId: null,
    });
  });

  it('saves workbench settings to workbench.json', async () => {
    const { saveWorkbenchSettings } = await import('@/utils/workbenchStorage');
    const settings = {
      entries: [{ id: 'e1', type: 'view', title: 'Todo', icon: 'iconList', order: 0, viewType: 'todo' }],
      dashboards: [],
      activeEntryId: 'e1',
    };

    await saveWorkbenchSettings(plugin as any, settings as any);

    expect(plugin.saveData).toHaveBeenCalledWith('workbench.json', settings);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/workbenchStorage.test.ts`
Expected: FAIL with module not found for `@/utils/workbenchStorage`

- [ ] **Step 3: Write the type definitions**

```ts
export type WorkbenchViewType =
  | 'calendar'
  | 'gantt'
  | 'quadrant'
  | 'project'
  | 'todo'
  | 'habit'
  | 'pomodoroStats';

export type WorkbenchEntry = {
  id: string;
  type: 'dashboard' | 'view';
  title: string;
  icon: string;
  order: number;
  viewType?: WorkbenchViewType;
  dashboardId?: string;
};

export type WorkbenchWidgetType =
  | 'todoList'
  | 'quadrantSummary'
  | 'habitWeek'
  | 'miniCalendar'
  | 'pomodoroStats';

export type WorkbenchWidgetInstance = {
  id: string;
  type: WorkbenchWidgetType;
  title?: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>;
};

export type WorkbenchDashboard = {
  id: string;
  title: string;
  widgets: WorkbenchWidgetInstance[];
};

export type WorkbenchSettings = {
  entries: WorkbenchEntry[];
  dashboards: WorkbenchDashboard[];
  activeEntryId: string | null;
};
```

- [ ] **Step 4: Write the minimal storage helper**

```ts
import type { WorkbenchSettings } from '@/types/workbench';

const WORKBENCH_FILE = 'workbench.json';

export function createEmptyWorkbenchSettings(): WorkbenchSettings {
  return {
    entries: [],
    dashboards: [],
    activeEntryId: null,
  };
}

export async function loadWorkbenchSettings(plugin: {
  loadData: (storageName: string) => Promise<any>;
}): Promise<WorkbenchSettings> {
  const data = await plugin.loadData(WORKBENCH_FILE);
  if (!data || typeof data !== 'object') {
    return createEmptyWorkbenchSettings();
  }

  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    dashboards: Array.isArray(data.dashboards) ? data.dashboards : [],
    activeEntryId: typeof data.activeEntryId === 'string' ? data.activeEntryId : null,
  };
}

export async function saveWorkbenchSettings(plugin: {
  saveData: (storageName: string, content: any) => Promise<void>;
}, settings: WorkbenchSettings): Promise<void> {
  await plugin.saveData(WORKBENCH_FILE, settings);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/utils/workbenchStorage.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/workbench.ts src/utils/workbenchStorage.ts test/utils/workbenchStorage.test.ts
git commit -m "feat(workbench): add workbench persistence primitives"
```

---

### Task 2: Add `workbenchStore` with Entry and Dashboard CRUD

**Files:**
- Create: `src/stores/workbenchStore.ts`
- Create: `test/stores/workbenchStore.test.ts`
- Reference: `src/stores/settingsStore.ts`
- Reference: `src/utils/workbenchStorage.ts`

- [ ] **Step 1: Write the failing store tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const loadWorkbenchSettings = vi.fn();
const saveWorkbenchSettings = vi.fn();

vi.mock('@/utils/workbenchStorage', () => ({
  createEmptyWorkbenchSettings: () => ({
    entries: [],
    dashboards: [],
    activeEntryId: null,
  }),
  loadWorkbenchSettings: (...args: any[]) => loadWorkbenchSettings(...args),
  saveWorkbenchSettings: (...args: any[]) => saveWorkbenchSettings(...args),
}));

describe('workbenchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads persisted workbench settings and exposes active entry', async () => {
    loadWorkbenchSettings.mockResolvedValueOnce({
      entries: [{ id: 'todo-view', type: 'view', title: 'Todo', icon: 'iconList', order: 0, viewType: 'todo' }],
      dashboards: [],
      activeEntryId: 'todo-view',
    });

    const { useWorkbenchStore } = await import('@/stores/workbenchStore');
    const store = useWorkbenchStore();

    await store.load({ loadData: vi.fn() } as any);

    expect(store.entries).toHaveLength(1);
    expect(store.activeEntry?.id).toBe('todo-view');
  });

  it('creates a dashboard entry and dashboard together', async () => {
    const { useWorkbenchStore } = await import('@/stores/workbenchStore');
    const store = useWorkbenchStore();

    store.createDashboardEntry('本周概览');

    expect(store.entries[0]?.type).toBe('dashboard');
    expect(store.dashboards[0]?.title).toBe('本周概览');
    expect(store.activeEntryId).toBe(store.entries[0]?.id);
  });

  it('creates a view entry for todo', async () => {
    const { useWorkbenchStore } = await import('@/stores/workbenchStore');
    const store = useWorkbenchStore();

    store.createViewEntry('todo');

    expect(store.entries[0]).toEqual(expect.objectContaining({
      type: 'view',
      viewType: 'todo',
      icon: 'iconList',
    }));
  });

  it('persists after rename and delete operations', async () => {
    const { useWorkbenchStore } = await import('@/stores/workbenchStore');
    const plugin = { saveData: vi.fn() };
    const store = useWorkbenchStore();
    store.bindPlugin(plugin as any);
    store.createDashboardEntry('本周概览');

    const id = store.entries[0].id;
    await store.renameEntry(id, '新的名称');
    await store.deleteEntry(id);

    expect(saveWorkbenchSettings).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/workbenchStore.test.ts`
Expected: FAIL with module not found for `@/stores/workbenchStore`

- [ ] **Step 3: Write the minimal store implementation**

```ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { WorkbenchDashboard, WorkbenchEntry, WorkbenchSettings, WorkbenchViewType } from '@/types/workbench';
import { createEmptyWorkbenchSettings, loadWorkbenchSettings, saveWorkbenchSettings } from '@/utils/workbenchStorage';

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getViewMeta(viewType: WorkbenchViewType) {
  const meta = {
    todo: { title: 'Todo', icon: 'iconList' },
    habit: { title: 'Habit', icon: 'iconCheck' },
    quadrant: { title: 'Quadrant', icon: 'iconLayout' },
    pomodoroStats: { title: 'Pomodoro Stats', icon: 'iconClock' },
    calendar: { title: 'Calendar', icon: 'iconCalendar' },
    gantt: { title: 'Gantt', icon: 'iconGraph' },
    project: { title: 'Project', icon: 'iconFolder' },
  } satisfies Record<WorkbenchViewType, { title: string; icon: string }>;
  return meta[viewType];
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const entries = ref<WorkbenchEntry[]>([]);
  const dashboards = ref<WorkbenchDashboard[]>([]);
  const activeEntryId = ref<string | null>(null);
  const pluginRef = ref<any>(null);

  const activeEntry = computed(() => entries.value.find(entry => entry.id === activeEntryId.value) ?? null);

  async function persist() {
    if (!pluginRef.value) return;
    const settings: WorkbenchSettings = {
      entries: entries.value,
      dashboards: dashboards.value,
      activeEntryId: activeEntryId.value,
    };
    await saveWorkbenchSettings(pluginRef.value, settings);
  }

  function bindPlugin(plugin: any) {
    pluginRef.value = plugin;
  }

  async function load(plugin: any) {
    bindPlugin(plugin);
    const settings = await loadWorkbenchSettings(plugin);
    entries.value = settings.entries;
    dashboards.value = settings.dashboards;
    activeEntryId.value = settings.activeEntryId;
  }

  function createDashboardEntry(title: string) {
    const dashboardId = createId('dashboard');
    const entryId = createId('entry');
    dashboards.value.push({
      id: dashboardId,
      title,
      widgets: [],
    });
    entries.value.push({
      id: entryId,
      type: 'dashboard',
      title,
      icon: 'iconLayout',
      order: entries.value.length,
      dashboardId,
    });
    activeEntryId.value = entryId;
    void persist();
  }

  function createViewEntry(viewType: WorkbenchViewType) {
    const meta = getViewMeta(viewType);
    const entryId = createId('entry');
    entries.value.push({
      id: entryId,
      type: 'view',
      title: meta.title,
      icon: meta.icon,
      order: entries.value.length,
      viewType,
    });
    activeEntryId.value = entryId;
    void persist();
  }

  async function renameEntry(id: string, title: string) {
    const entry = entries.value.find(item => item.id === id);
    if (!entry) return;
    entry.title = title;
    if (entry.type === 'dashboard' && entry.dashboardId) {
      const dashboard = dashboards.value.find(item => item.id === entry.dashboardId);
      if (dashboard) dashboard.title = title;
    }
    await persist();
  }

  async function deleteEntry(id: string) {
    const index = entries.value.findIndex(item => item.id === id);
    if (index < 0) return;
    const [entry] = entries.value.splice(index, 1);
    if (entry.type === 'dashboard' && entry.dashboardId) {
      dashboards.value = dashboards.value.filter(item => item.id !== entry.dashboardId);
    }
    activeEntryId.value = entries.value[0]?.id ?? null;
    await persist();
  }

  function setActiveEntry(id: string) {
    activeEntryId.value = id;
    void persist();
  }

  return {
    entries,
    dashboards,
    activeEntryId,
    activeEntry,
    bindPlugin,
    load,
    createDashboardEntry,
    createViewEntry,
    renameEntry,
    deleteEntry,
    setActiveEntry,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stores/workbenchStore.test.ts test/utils/workbenchStorage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/workbenchStore.ts test/stores/workbenchStore.test.ts src/utils/workbenchStorage.ts test/utils/workbenchStorage.test.ts
git commit -m "feat(workbench): add store for workbench entries and dashboards"
```

---

### Task 3: Register the Top-Level Workbench Tab and i18n Labels

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/index.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Create: `test/tabs/WorkbenchTab.test.ts`

- [ ] **Step 1: Write the failing tab registration tests**

```ts
import { describe, expect, it } from 'vitest';
import { TAB_TYPES } from '@/constants';

describe('TAB_TYPES', () => {
  it('exposes workbench tab type', () => {
    expect(TAB_TYPES.WORKBENCH).toBe('bullet-journal-workbench');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts -t "exposes workbench tab type"`
Expected: FAIL because `TAB_TYPES.WORKBENCH` does not exist yet

- [ ] **Step 3: Add the workbench tab registration**

```ts
// src/constants.ts
export const TAB_TYPES = {
  CALENDAR: 'bullet-journal-calendar',
  GANTT: 'bullet-journal-gantt',
  QUADRANT: 'bullet-journal-quadrant',
  PROJECT: 'bullet-journal-project',
  POMODORO_STATS: 'bullet-journal-pomodoro-stats',
  WORKBENCH: 'bullet-journal-workbench',
};
```

```ts
// src/index.ts imports
import WorkbenchTab from '@/tabs/WorkbenchTab.vue';

// inside registerTabs()
if (!this.isMobile) {
  this.addTab({
    type: TAB_TYPES.WORKBENCH,
    init() {
      try {
        const pinia = getSharedPinia() ?? createPinia();
        const app = createApp(WorkbenchTab);
        app.use(pinia);
        app.mount(this.element);
      }
      catch (error) {
        console.error('[Task Assistant] Failed to mount WorkbenchTab:', error);
      }
    },
    destroy() {
      this.element.innerHTML = '';
    },
  });
}
```

```ts
// src/index.ts top-bar menu and mappings
menu.addItem({
  icon: 'iconPanel',
  label: t('workbench').title,
  click: () => {
    this.openCustomTab(TAB_TYPES.WORKBENCH);
  },
});

[TAB_TYPES.WORKBENCH]: 'iconPanel',
[TAB_TYPES.WORKBENCH]: t('workbench').title,
```

```json
// zh_CN.json
"workbench": {
  "title": "工作台",
  "newDashboard": "新建仪表盘",
  "newView": "新建视图"
}
```

```json
// en_US.json
"workbench": {
  "title": "Workbench",
  "newDashboard": "New Dashboard",
  "newView": "New View"
}
```

- [ ] **Step 4: Add a placeholder WorkbenchTab component**

```vue
<template>
  <div class="workbench-tab">Workbench</div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts -t "exposes workbench tab type"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/index.ts src/i18n/zh_CN.json src/i18n/en_US.json src/tabs/WorkbenchTab.vue test/tabs/WorkbenchTab.test.ts
git commit -m "feat(workbench): register top-level workbench tab"
```

---

### Task 4: Build the Workbench Shell, Sidebar, and Content Host

**Files:**
- Modify: `src/tabs/WorkbenchTab.vue`
- Create: `src/components/workbench/WorkbenchSidebar.vue`
- Create: `src/components/workbench/WorkbenchContentHost.vue`
- Create: `test/components/workbench/WorkbenchSidebar.test.ts`
- Modify: `test/tabs/WorkbenchTab.test.ts`

- [ ] **Step 1: Write failing shell tests**

```ts
it('renders the left sidebar and right content host', async () => {
  const mounted = await mountWorkbenchTab();

  expect(mounted.querySelector('[data-testid="workbench-sidebar"]')).not.toBeNull();
  expect(mounted.querySelector('[data-testid="workbench-content-host"]')).not.toBeNull();
});

it('creates dashboard and view entries from sidebar actions', async () => {
  const mounted = await mountWorkbenchTab();

  mounted.querySelector('[data-testid="workbench-new-dashboard"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  mounted.querySelector('[data-testid="workbench-new-view-todo"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  await Promise.resolve();

  expect(mounted.querySelectorAll('[data-testid="workbench-entry"]').length).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts -t "renders the left sidebar and right content host"`
Expected: FAIL because placeholder component does not render the shell

- [ ] **Step 3: Implement the shell and sidebar**

```vue
<!-- src/tabs/WorkbenchTab.vue -->
<template>
  <div class="workbench-tab" data-testid="workbench-tab">
    <WorkbenchSidebar
      :entries="workbenchStore.entries"
      :active-entry-id="workbenchStore.activeEntryId"
      @select="workbenchStore.setActiveEntry"
      @create-dashboard="handleCreateDashboard"
      @create-view="handleCreateView"
    />
    <WorkbenchContentHost :entry="workbenchStore.activeEntry" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import WorkbenchSidebar from '@/components/workbench/WorkbenchSidebar.vue';
import WorkbenchContentHost from '@/components/workbench/WorkbenchContentHost.vue';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import type { WorkbenchViewType } from '@/types/workbench';

const plugin = usePlugin() as any;
const workbenchStore = useWorkbenchStore();

onMounted(async () => {
  await workbenchStore.load(plugin);
});

function handleCreateDashboard() {
  workbenchStore.createDashboardEntry(t('workbench').newDashboard);
}

function handleCreateView(viewType: WorkbenchViewType) {
  workbenchStore.createViewEntry(viewType);
}
</script>
```

```vue
<!-- src/components/workbench/WorkbenchSidebar.vue -->
<template>
  <aside class="workbench-sidebar" data-testid="workbench-sidebar">
    <div class="workbench-sidebar__search">
      <input type="text" :placeholder="t('common').search" />
    </div>
    <div class="workbench-sidebar__entries">
      <button
        v-for="entry in entries"
        :key="entry.id"
        data-testid="workbench-entry"
        :class="{ 'is-active': entry.id === activeEntryId }"
        @click="$emit('select', entry.id)"
      >
        {{ entry.title }}
      </button>
    </div>
    <div class="workbench-sidebar__footer">
      <button data-testid="workbench-new-dashboard" @click="$emit('create-dashboard')">{{ t('workbench').newDashboard }}</button>
      <button data-testid="workbench-new-view-todo" @click="$emit('create-view', 'todo')">{{ t('workbench').newView }} Todo</button>
    </div>
  </aside>
</template>
```

```vue
<!-- src/components/workbench/WorkbenchContentHost.vue -->
<template>
  <section class="workbench-content-host" data-testid="workbench-content-host">
    <div v-if="!entry">Empty Workbench</div>
    <div v-else>{{ entry.title }}</div>
  </section>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts test/components/workbench/WorkbenchSidebar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tabs/WorkbenchTab.vue src/components/workbench/WorkbenchSidebar.vue src/components/workbench/WorkbenchContentHost.vue test/tabs/WorkbenchTab.test.ts test/components/workbench/WorkbenchSidebar.test.ts
git commit -m "feat(workbench): add two-column workbench shell"
```

---

### Task 5: Implement `WorkbenchViewHost` for Supported View Entries

**Files:**
- Create: `src/components/workbench/view/WorkbenchViewHost.vue`
- Modify: `src/components/workbench/WorkbenchContentHost.vue`
- Create: `test/components/workbench/WorkbenchViewHost.test.ts`
- Optional Modify: `src/tabs/QuadrantTab.vue`
- Optional Modify: `src/tabs/PomodoroStatsTab.vue`

- [ ] **Step 1: Write failing view host tests**

```ts
it('renders todo workbench view when entry.viewType is todo', async () => {
  const { mountViewHost } = await import('./helpers');
  const mounted = await mountViewHost({
    id: 'todo-view',
    type: 'view',
    title: 'Todo',
    icon: 'iconList',
    order: 0,
    viewType: 'todo',
  });

  expect(mounted.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull();
});

it('renders quadrant workbench view when entry.viewType is quadrant', async () => {
  const { mountViewHost } = await import('./helpers');
  const mounted = await mountViewHost({
    id: 'quadrant-view',
    type: 'view',
    title: 'Quadrant',
    icon: 'iconLayout',
    order: 0,
    viewType: 'quadrant',
  });

  expect(mounted.querySelector('[data-testid="workbench-view-quadrant"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/WorkbenchViewHost.test.ts`
Expected: FAIL because `WorkbenchViewHost.vue` does not exist

- [ ] **Step 3: Implement minimal workbench view host**

```vue
<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <DesktopTodoDock v-if="entry.viewType === 'todo'" data-testid="workbench-view-todo" />
    <DesktopHabitDock v-else-if="entry.viewType === 'habit'" data-testid="workbench-view-habit" />
    <QuadrantTab v-else-if="entry.viewType === 'quadrant'" data-testid="workbench-view-quadrant" />
    <PomodoroStatsTab v-else-if="entry.viewType === 'pomodoroStats'" data-testid="workbench-view-pomodoro" />
    <div v-else data-testid="workbench-view-unsupported">Unsupported</div>
  </div>
</template>

<script setup lang="ts">
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import QuadrantTab from '@/tabs/QuadrantTab.vue';
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue';
import type { WorkbenchEntry } from '@/types/workbench';

defineProps<{
  entry: WorkbenchEntry & { type: 'view' };
}>();
</script>
```

- [ ] **Step 4: Wire `WorkbenchContentHost` to route by entry type**

```vue
<template>
  <section class="workbench-content-host" data-testid="workbench-content-host">
    <div v-if="!entry" data-testid="workbench-empty">Empty Workbench</div>
    <DashboardCanvas v-else-if="entry.type === 'dashboard'" :entry="entry" />
    <WorkbenchViewHost v-else :entry="entry" />
  </section>
</template>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/components/workbench/WorkbenchViewHost.test.ts test/tabs/WorkbenchTab.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue src/components/workbench/WorkbenchContentHost.vue test/components/workbench/WorkbenchViewHost.test.ts test/tabs/WorkbenchTab.test.ts
git commit -m "feat(workbench): add host for supported workbench views"
```

---

### Task 6: Add Widget Registry, Widget Card, and Dashboard Canvas

**Files:**
- Create: `src/components/workbench/dashboard/DashboardCanvas.vue`
- Create: `src/components/workbench/dashboard/WorkbenchWidgetCard.vue`
- Create: `src/components/workbench/widgets/widgetRegistry.ts`
- Create: `test/components/workbench/DashboardCanvas.test.ts`
- Modify: `src/stores/workbenchStore.ts`

- [ ] **Step 1: Write failing dashboard canvas tests**

```ts
it('renders widgets for the selected dashboard entry', async () => {
  const mounted = await mountDashboardCanvas({
    entry: {
      id: 'entry-1',
      type: 'dashboard',
      title: '本周概览',
      icon: 'iconLayout',
      order: 0,
      dashboardId: 'dashboard-1',
    },
    dashboards: [{
      id: 'dashboard-1',
      title: '本周概览',
      widgets: [{
        id: 'widget-1',
        type: 'todoList',
        title: '今日待办',
        layout: { x: 0, y: 0, w: 4, h: 3 },
        config: {},
      }],
    }],
  });

  expect(mounted.querySelector('[data-testid="workbench-widget-card"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts`
Expected: FAIL because `DashboardCanvas.vue` does not exist

- [ ] **Step 3: Add widget registry and dashboard rendering**

```ts
// src/components/workbench/widgets/widgetRegistry.ts
export const widgetRegistry = {
  todoList: { type: 'todoList', name: 'Todo List', icon: 'iconList', defaultSize: { w: 4, h: 3 }, createDefaultConfig: () => ({}) },
  quadrantSummary: { type: 'quadrantSummary', name: 'Quadrant', icon: 'iconLayout', defaultSize: { w: 4, h: 3 }, createDefaultConfig: () => ({}) },
  habitWeek: { type: 'habitWeek', name: 'Habit Week', icon: 'iconCheck', defaultSize: { w: 4, h: 3 }, createDefaultConfig: () => ({}) },
  miniCalendar: { type: 'miniCalendar', name: 'Mini Calendar', icon: 'iconCalendar', defaultSize: { w: 4, h: 3 }, createDefaultConfig: () => ({}) },
  pomodoroStats: { type: 'pomodoroStats', name: 'Pomodoro Stats', icon: 'iconClock', defaultSize: { w: 4, h: 3 }, createDefaultConfig: () => ({}) },
} as const;
```

```vue
<!-- src/components/workbench/dashboard/WorkbenchWidgetCard.vue -->
<template>
  <article class="workbench-widget-card" data-testid="workbench-widget-card">
    <header class="workbench-widget-card__header">
      <span>{{ title }}</span>
      <span class="workbench-widget-card__drag">::</span>
    </header>
    <div class="workbench-widget-card__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
```

```vue
<!-- src/components/workbench/dashboard/DashboardCanvas.vue -->
<template>
  <div class="dashboard-canvas" data-testid="dashboard-canvas">
    <div v-if="!dashboard" data-testid="dashboard-empty">Empty Dashboard</div>
    <WorkbenchWidgetCard
      v-for="widget in dashboard?.widgets ?? []"
      :key="widget.id"
      :title="widget.title || widget.type"
    >
      <div :data-testid="`widget-${widget.type}`">{{ widget.type }}</div>
    </WorkbenchWidgetCard>
  </div>
</template>
```

- [ ] **Step 4: Extend the store with widget CRUD**

```ts
function addWidget(dashboardId: string, type: WorkbenchWidgetType) {
  const dashboard = dashboards.value.find(item => item.id === dashboardId);
  if (!dashboard) return;
  const definition = widgetRegistry[type];
  dashboard.widgets.push({
    id: createId('widget'),
    type,
    title: definition.name,
    layout: {
      x: 0,
      y: dashboard.widgets.length,
      w: definition.defaultSize.w,
      h: definition.defaultSize.h,
    },
    config: definition.createDefaultConfig(),
  });
  void persist();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/components/workbench/DashboardCanvas.test.ts test/stores/workbenchStore.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/dashboard/DashboardCanvas.vue src/components/workbench/dashboard/WorkbenchWidgetCard.vue src/components/workbench/widgets/widgetRegistry.ts src/stores/workbenchStore.ts test/components/workbench/DashboardCanvas.test.ts test/stores/workbenchStore.test.ts
git commit -m "feat(workbench): add dashboard canvas and widget registry"
```

---

### Task 7: Implement First-Pass Widget Components and Add-Widget Flow

**Files:**
- Create: `src/components/workbench/widgets/TodoListWidget.vue`
- Create: `src/components/workbench/widgets/QuadrantSummaryWidget.vue`
- Create: `src/components/workbench/widgets/HabitWeekWidget.vue`
- Create: `src/components/workbench/widgets/MiniCalendarWidget.vue`
- Create: `src/components/workbench/widgets/PomodoroStatsWidget.vue`
- Modify: `src/components/workbench/dashboard/DashboardCanvas.vue`
- Modify: `src/tabs/WorkbenchTab.vue`
- Modify: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write failing add-widget tests**

```ts
it('adds a todoList widget to the active dashboard from the workbench toolbar', async () => {
  const mounted = await mountWorkbenchTabWithDashboard();

  mounted.querySelector('[data-testid="workbench-add-widget-todoList"]')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );

  await Promise.resolve();

  expect(mounted.querySelector('[data-testid="widget-todoList"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts -t "adds a todoList widget"`
Expected: FAIL because no add-widget flow exists yet

- [ ] **Step 3: Implement widget component shells**

```vue
<template><div data-testid="widget-todoList">Todo Widget</div></template>
```

```vue
<template><div data-testid="widget-quadrantSummary">Quadrant Widget</div></template>
```

```vue
<template><div data-testid="widget-habitWeek">Habit Widget</div></template>
```

```vue
<template><div data-testid="widget-miniCalendar">Calendar Widget</div></template>
```

```vue
<template><div data-testid="widget-pomodoroStats">Pomodoro Widget</div></template>
```

- [ ] **Step 4: Wire the toolbar and dashboard rendering**

```vue
<!-- WorkbenchTab toolbar -->
<button
  v-if="workbenchStore.activeEntry?.type === 'dashboard'"
  data-testid="workbench-add-widget-todoList"
  @click="handleAddWidget('todoList')"
>
  Add Todo Widget
</button>
```

```ts
function handleAddWidget(type: WorkbenchWidgetType) {
  const entry = workbenchStore.activeEntry;
  if (!entry || entry.type !== 'dashboard' || !entry.dashboardId) return;
  workbenchStore.addWidget(entry.dashboardId, type);
}
```

```vue
<!-- DashboardCanvas slot switch -->
<TodoListWidget v-if="widget.type === 'todoList'" />
<QuadrantSummaryWidget v-else-if="widget.type === 'quadrantSummary'" />
<HabitWeekWidget v-else-if="widget.type === 'habitWeek'" />
<MiniCalendarWidget v-else-if="widget.type === 'miniCalendar'" />
<PomodoroStatsWidget v-else-if="widget.type === 'pomodoroStats'" />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/tabs/WorkbenchTab.test.ts test/components/workbench/DashboardCanvas.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/widgets src/components/workbench/dashboard/DashboardCanvas.vue src/tabs/WorkbenchTab.vue test/tabs/WorkbenchTab.test.ts test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): add initial widget components and creation flow"
```

---

### Task 8: Add Widget Layout Updates and Persistence Verification

**Files:**
- Modify: `src/stores/workbenchStore.ts`
- Modify: `src/components/workbench/dashboard/DashboardCanvas.vue`
- Modify: `test/stores/workbenchStore.test.ts`
- Modify: `test/components/workbench/DashboardCanvas.test.ts`

- [ ] **Step 1: Write the failing layout persistence tests**

```ts
it('updates widget layout and persists the dashboard', async () => {
  const { useWorkbenchStore } = await import('@/stores/workbenchStore');
  const plugin = { saveData: vi.fn() };
  const store = useWorkbenchStore();
  store.bindPlugin(plugin as any);
  store.createDashboardEntry('本周概览');
  const dashboardId = store.dashboards[0].id;
  store.addWidget(dashboardId, 'todoList');
  const widgetId = store.dashboards[0].widgets[0].id;

  await store.updateWidgetLayout(dashboardId, widgetId, { x: 2, y: 1, w: 6, h: 4 });

  expect(store.dashboards[0].widgets[0].layout).toEqual({ x: 2, y: 1, w: 6, h: 4 });
  expect(saveWorkbenchSettings).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/workbenchStore.test.ts -t "updates widget layout"`
Expected: FAIL because `updateWidgetLayout` does not exist

- [ ] **Step 3: Implement minimal layout update path**

```ts
async function updateWidgetLayout(
  dashboardId: string,
  widgetId: string,
  layout: { x: number; y: number; w: number; h: number },
) {
  const dashboard = dashboards.value.find(item => item.id === dashboardId);
  const widget = dashboard?.widgets.find(item => item.id === widgetId);
  if (!widget) return;
  widget.layout = layout;
  await persist();
}
```

```vue
<!-- temporary dashboard interaction -->
<button
  :data-testid="`widget-move-${widget.id}`"
  @click="$emit('update-layout', widget.id, { x: widget.layout.x + 1, y: widget.layout.y, w: widget.layout.w, h: widget.layout.h })"
>
  Move
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stores/workbenchStore.test.ts test/components/workbench/DashboardCanvas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/workbenchStore.ts src/components/workbench/dashboard/DashboardCanvas.vue test/stores/workbenchStore.test.ts test/components/workbench/DashboardCanvas.test.ts
git commit -m "feat(workbench): persist widget layout updates"
```

---

### Task 9: Full Verification Sweep

**Files:**
- Verify only

- [ ] **Step 1: Run focused workbench tests**

Run: `npx vitest run test/utils/workbenchStorage.test.ts test/stores/workbenchStore.test.ts test/tabs/WorkbenchTab.test.ts test/components/workbench/WorkbenchSidebar.test.ts test/components/workbench/WorkbenchContentHost.test.ts test/components/workbench/WorkbenchViewHost.test.ts test/components/workbench/DashboardCanvas.test.ts`
Expected: PASS

- [ ] **Step 2: Run related regression tests for reused views**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts test/components/todo/TodoSidebar.test.ts test/tabs/DesktopHabitDock.test.ts`
Expected: PASS

- [ ] **Step 3: Perform manual desktop verification**

```text
1. Open Workbench tab from top-bar menu.
2. Confirm left sidebar and right content host render.
3. Create a dashboard entry and verify it appears in the sidebar.
4. Create todo/habit/quadrant/pomodoroStats view entries and verify the right panel switches.
5. Add widgets to a dashboard and confirm they render.
6. Trigger a widget layout update and reload the tab; confirm state survives via workbench.json.
7. Verify workbench.json appears under the plugin storage and remains independent from settings.
```

- [ ] **Step 4: Commit final verification note if code changed during verification**

```bash
git status --short
```

Expected: clean working tree if no follow-up fixes were needed

---

## Self-Review

### Spec coverage

- Top-level `WorkbenchTab`: covered by Tasks 3 and 4
- Left/right two-column layout: covered by Task 4
- Entry model with `dashboard` and `view`: covered by Tasks 1 and 2
- Dedicated `workbench.json` persistence: covered by Tasks 1 and 2
- `todo / habit / quadrant / pomodoroStats` workbench views: covered by Task 5
- Dashboard widgets and grid shell: covered by Tasks 6, 7, and 8
- Store/component tests and regressions: covered by Task 9

### Placeholder scan

- No `TODO` or `TBD` placeholders remain
- Every task includes exact file paths
- Every test/implementation step includes code or explicit verification commands

### Type consistency

- `WorkbenchSettings`, `WorkbenchEntry`, `WorkbenchDashboard`, and `WorkbenchWidgetInstance` are introduced in Task 1 and reused consistently later
- `workbenchStore` API (`load`, `bindPlugin`, `createDashboardEntry`, `createViewEntry`, `addWidget`, `updateWidgetLayout`) is introduced before later tasks consume it

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-workbench-tab-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
