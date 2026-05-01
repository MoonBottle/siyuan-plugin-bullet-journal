# Quadrant Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-only top-level Quadrant Tab that reuses Todo cards, maps the four quadrants to existing priority levels, and keeps behavior aligned with Todo Dock.

**Architecture:** Reuse the existing `TodoSidebar` as the list renderer and extend its filtering surface just enough to express the fourth quadrant (`priority === undefined`) plus a compact display mode. Register a new desktop tab in `src/index.ts`, wire it into the top-bar menu, and keep filtering, sorting, and refresh behavior on the existing `projectStore` / `settingsStore` path.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, SiYuan plugin tab registration APIs

---

## File map

- Create: `src/tabs/QuadrantTab.vue`
- Create: `test/tabs/QuadrantTab.test.ts`
- Modify: `src/constants.ts`
- Modify: `src/index.ts`
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `src/stores/projectStore.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `test/stores/projectStore.test.ts`

### Responsibility boundaries

- `src/constants.ts`
  - Add the new `TAB_TYPES.QUADRANT` identifier.
- `src/index.ts`
  - Register the new tab, expose icon/title mapping, and add the top-bar menu entry.
- `src/stores/projectStore.ts`
  - Extend Todo filtering APIs so callers can explicitly request “items without priority”.
- `src/components/todo/TodoSidebar.vue`
  - Accept the new filter props and a compact/embedded display mode without changing existing Todo Dock behavior.
- `src/tabs/QuadrantTab.vue`
  - Compose toolbar + four quadrants, pass shared search/group filters and quadrant-specific priority filters into `TodoSidebar`.
- `test/stores/projectStore.test.ts`
  - Prove the new “priority undefined” filter path behaves correctly.
- `test/tabs/QuadrantTab.test.ts`
  - Prove the tab renders four quadrants and passes the expected filters to each `TodoSidebar`.

---

### Task 1: Register the new top-level tab entry

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/index.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Write the failing tab registration test**

Create `test/tabs/QuadrantTab.test.ts` with a focused smoke test that will eventually mount `QuadrantTab`, but start by verifying the top-level tab type is available via `TAB_TYPES`:

```ts
import { describe, expect, it } from 'vitest';
import { TAB_TYPES } from '@/constants';

describe('TAB_TYPES', () => {
  it('exposes quadrant tab type', () => {
    expect(TAB_TYPES.QUADRANT).toBe('bullet-journal-quadrant');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts -t "exposes quadrant tab type"`

Expected: FAIL because `TAB_TYPES.QUADRANT` does not exist yet.

- [ ] **Step 3: Write minimal constant and registration changes**

Update `src/constants.ts`:

```ts
export const TAB_TYPES = {
  CALENDAR: 'bullet-journal-calendar',
  GANTT: 'bullet-journal-gantt',
  PROJECT: 'bullet-journal-project',
  POMODORO_STATS: 'bullet-journal-pomodoro-stats',
  QUADRANT: 'bullet-journal-quadrant',
};
```

Update `src/index.ts` imports:

```ts
import QuadrantTab from '@/tabs/QuadrantTab.vue';
```

Register the tab next to the existing desktop tabs:

```ts
if (!this.isMobile) {
  this.addTab({
    type: TAB_TYPES.QUADRANT,
    init() {
      try {
        const pinia = getSharedPinia() ?? createPinia();
        const app = createApp(QuadrantTab);
        app.use(pinia);
        app.mount(this.element);
      } catch (error) {
        console.error('[Task Assistant] Failed to mount QuadrantTab:', error);
      }
    },
    destroy() {
      this.element.innerHTML = '';
    },
  });
}
```

Add icon/title mappings:

```ts
[TAB_TYPES.QUADRANT]: 'iconGrid',
```

```ts
[TAB_TYPES.QUADRANT]: t('quadrant').title,
```

Add the top-bar menu entry near the other desktop views:

```ts
menu.addItem({
  icon: 'iconGrid',
  label: t('quadrant').title,
  click: () => {
    this.openCustomTab(TAB_TYPES.QUADRANT);
  },
});
```

Add i18n roots in both locale files:

```json
"quadrant": {
  "title": "四象限"
}
```

```json
"quadrant": {
  "title": "Quadrants"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts -t "exposes quadrant tab type"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/index.ts src/i18n/zh_CN.json src/i18n/en_US.json test/tabs/QuadrantTab.test.ts
git commit -m "feat(tab): register quadrant top-level view"
```

---

### Task 2: Extend store filtering to express the fourth quadrant

**Files:**
- Modify: `src/stores/projectStore.ts`
- Modify: `test/stores/projectStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

Add a dedicated filter shape test in `test/stores/projectStore.test.ts`:

```ts
it('filters only items without priority when includeNoPriority is true', () => {
  const store = useProjectStore();
  const settingsStore = useSettingsStore();
  settingsStore.todoDock.sortRules = [{ field: 'content', direction: 'asc' }];

  const items = [
    mkItem('2026-04-25', 'high', { content: 'A', priority: 'high', dateRangeStart: undefined, dateRangeEnd: undefined }),
    mkItem('2026-04-25', 'none-1', { content: 'B', priority: undefined, dateRangeStart: undefined, dateRangeEnd: undefined }),
    mkItem('2026-04-25', 'none-2', { content: 'C', priority: undefined, dateRangeStart: undefined, dateRangeEnd: undefined }),
  ];

  store.$patch({
    currentDate: '2026-04-25',
    projects: [createMockProject(items)],
  });

  const result = store.getFilteredAndSortedItems({
    groupId: '',
    includeNoPriority: true,
  });

  expect(result.map(item => item.blockId)).toEqual(['none-1', 'none-2']);
});
```

Add one mixed test to prove explicit priorities and no-priority can coexist if a caller needs that shape:

```ts
it('supports combining priority filters with no-priority items', () => {
  const store = useProjectStore();
  const settingsStore = useSettingsStore();
  settingsStore.todoDock.sortRules = [{ field: 'content', direction: 'asc' }];

  const items = [
    mkItem('2026-04-25', 'high', { content: 'A', priority: 'high', dateRangeStart: undefined, dateRangeEnd: undefined }),
    mkItem('2026-04-25', 'medium', { content: 'B', priority: 'medium', dateRangeStart: undefined, dateRangeEnd: undefined }),
    mkItem('2026-04-25', 'none', { content: 'C', priority: undefined, dateRangeStart: undefined, dateRangeEnd: undefined }),
  ];

  store.$patch({
    currentDate: '2026-04-25',
    projects: [createMockProject(items)],
  });

  const result = store.getFilteredAndSortedItems({
    groupId: '',
    priorities: ['high'],
    includeNoPriority: true,
  });

  expect(result.map(item => item.blockId)).toEqual(['high', 'none']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/projectStore.test.ts -t "includeNoPriority"`

Expected: FAIL because the getter params do not support `includeNoPriority`.

- [ ] **Step 3: Write minimal filtering implementation**

Add a shared filter params type near the helper functions in `src/stores/projectStore.ts`:

```ts
type TodoFilterParams = {
  groupId: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  includeNoPriority?: boolean;
};
```

Add a helper that centralizes the priority filter expression:

```ts
function matchesPriorityFilter(item: Item, params: TodoFilterParams): boolean {
  const hasPriorityFilter = Boolean(params.priorities?.length);
  const wantsNoPriority = params.includeNoPriority === true;

  if (!hasPriorityFilter && !wantsNoPriority) {
    return true;
  }

  if (item.priority && params.priorities?.includes(item.priority)) {
    return true;
  }

  if (!item.priority && wantsNoPriority) {
    return true;
  }

  return false;
}
```

Use `TodoFilterParams` in:

```ts
getFilteredAndSortedItems: (state) => (params: TodoFilterParams) => { ... }
getFilteredCompletedItems: (state) => (params: TodoFilterParams) => { ... }
getFilteredAbandonedItems: (state) => (params: TodoFilterParams) => { ... }
```

Replace the existing priority-filter blocks with:

```ts
items = items.filter(item => matchesPriorityFilter(item, params));
```

Leave the rest of the filter and sort pipeline untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stores/projectStore.test.ts -t "includeNoPriority|combining priority filters"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/projectStore.ts test/stores/projectStore.test.ts
git commit -m "feat(todo): support no-priority filtering"
```

---

### Task 3: Make `TodoSidebar` embeddable inside quadrant cards

**Files:**
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write the failing sidebar-prop test**

Expand `test/tabs/QuadrantTab.test.ts` so the stubbed `TodoSidebar` records props. Start with one assertion that expects a quadrant instance to pass both `includeNoPriority` and a compact mode:

```ts
const sidebarProps: any[] = [];

vi.mock('@/components/todo/TodoSidebar.vue', () => ({
  default: defineComponent({
    name: 'TodoSidebarStub',
    props: [
      'groupId',
      'searchQuery',
      'priorities',
      'includeNoPriority',
      'displayMode',
    ],
    setup(props, { expose }) {
      sidebarProps.push(props);
      expose({
        allCollapsed: false,
        toggleCollapseAll: vi.fn(),
      });
      return () => h('div', { 'data-testid': 'todo-sidebar-stub' });
    },
  }),
}));
```

Add an expectation:

```ts
expect(sidebarProps.some(props => props.includeNoPriority === true)).toBe(true);
expect(sidebarProps.every(props => props.displayMode === 'embedded')).toBe(true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts -t "passes no-priority and embedded mode"`

Expected: FAIL because neither prop exists yet.

- [ ] **Step 3: Write minimal `TodoSidebar` prop support**

Extend `TodoSidebar` props:

```ts
const props = withDefaults(defineProps<{
  groupId?: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  completedDateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  includeNoPriority?: boolean;
  displayMode?: 'default' | 'embedded';
}>(), {
  groupId: '',
  searchQuery: '',
  dateRange: null,
  completedDateRange: null,
  priorities: () => [],
  includeNoPriority: false,
  displayMode: 'default',
});
```

Pass the new filter flag into the store calls:

```ts
includeNoPriority: props.includeNoPriority,
```

Update active-filter detection:

```ts
const hasActiveFilters = computed(() => {
  return props.groupId
    || props.searchQuery?.trim()
    || props.dateRange
    || props.priorities.length > 0
    || props.includeNoPriority;
});
```

Add one class hook at the root for compact styling:

```vue
<div class="todo-sidebar" :class="{ 'todo-sidebar--embedded': props.displayMode === 'embedded' }">
```

Then keep the initial style change small:

```scss
.todo-sidebar--embedded {
  .todo-content {
    padding: 0;
  }

  .empty-guide {
    padding: 24px 12px;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts -t "passes no-priority and embedded mode"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/todo/TodoSidebar.vue test/tabs/QuadrantTab.test.ts
git commit -m "feat(todo): add embedded sidebar mode"
```

---

### Task 4: Build `QuadrantTab.vue`

**Files:**
- Create: `src/tabs/QuadrantTab.vue`
- Modify: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write the failing component tests**

Build out `test/tabs/QuadrantTab.test.ts` with a full mount test:

```ts
it('renders four quadrants and passes the expected filters to each sidebar', async () => {
  const mounted = mountQuadrantTab();
  await nextTick();

  expect(mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')).toHaveLength(4);
  expect(sidebarProps).toHaveLength(4);

  expect(sidebarProps[0].priorities).toEqual(['high']);
  expect(sidebarProps[1].priorities).toEqual(['medium']);
  expect(sidebarProps[2].priorities).toEqual(['low']);
  expect(sidebarProps[3].priorities).toEqual([]);
  expect(sidebarProps[3].includeNoPriority).toBe(true);

  mounted.unmount();
});
```

Add a refresh-action test:

```ts
it('refresh button calls projectStore.refresh', async () => {
  const mounted = mountQuadrantTab();
  await nextTick();

  (mounted.container.querySelector('[data-testid="quadrant-refresh-button"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.projectStore.refresh).toHaveBeenCalled();
  mounted.unmount();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: FAIL because `QuadrantTab.vue` does not exist yet.

- [ ] **Step 3: Write minimal `QuadrantTab.vue` implementation**

Create `src/tabs/QuadrantTab.vue` with this structure:

```vue
<template>
  <div class="fn__flex-1 fn__flex-column quadrant-tab-container">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconGrid"></use></svg>
        {{ t('quadrant').title }}
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="allCollapsed ? t('todo').expandAll : t('todo').collapseAll"
        @click="toggleCollapseAll"
      >
        <svg><use :xlink:href="allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        data-testid="quadrant-refresh-button"
        :aria-label="t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>

    <div class="quadrant-tab-toolbar">
      <SySelect
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <div class="quadrant-search-box">
        <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('todo').searchPlaceholder"
          class="search-input"
        />
      </div>
    </div>

    <div class="quadrant-grid">
      <section
        v-for="quadrant in quadrants"
        :key="quadrant.id"
        class="quadrant-panel"
        data-testid="quadrant-panel"
      >
        <header class="quadrant-panel__header">
          <div class="quadrant-panel__title">{{ quadrant.title }}</div>
          <div class="quadrant-panel__count">{{ quadrant.count }}</div>
        </header>

        <div class="quadrant-panel__body">
          <TodoSidebar
            :ref="setSidebarRef(quadrant.id)"
            :group-id="selectedGroup"
            :search-query="searchQuery"
            :priorities="quadrant.priorities"
            :include-no-priority="quadrant.includeNoPriority"
            display-mode="embedded"
          />
        </div>
      </section>
    </div>
  </div>
</template>
```

Use a static quadrant config:

```ts
const quadrantDefs = [
  { id: 'q1', title: t('quadrant').importantUrgent, priorities: ['high'] as PriorityLevel[], includeNoPriority: false },
  { id: 'q2', title: t('quadrant').importantNotUrgent, priorities: ['medium'] as PriorityLevel[], includeNoPriority: false },
  { id: 'q3', title: t('quadrant').urgentNotImportant, priorities: ['low'] as PriorityLevel[], includeNoPriority: false },
  { id: 'q4', title: t('quadrant').notImportantNotUrgent, priorities: [] as PriorityLevel[], includeNoPriority: true },
];
```

Compute counts directly from the store using the same filters:

```ts
const quadrants = computed(() => {
  return quadrantDefs.map(def => ({
    ...def,
    count: projectStore.getFilteredAndSortedItems({
      groupId: selectedGroup.value,
      searchQuery: searchQuery.value,
      priorities: def.priorities.length > 0 ? def.priorities : undefined,
      includeNoPriority: def.includeNoPriority,
    }).length,
  }));
});
```

Implement collapse-all by collecting child refs:

```ts
const sidebarRefs = ref<Record<string, InstanceType<typeof TodoSidebar> | null>>({});

function setSidebarRef(id: string) {
  return (instance: InstanceType<typeof TodoSidebar> | null) => {
    sidebarRefs.value[id] = instance;
  };
}

const allCollapsed = computed(() => {
  const refs = Object.values(sidebarRefs.value).filter(Boolean);
  return refs.length > 0 && refs.every(sidebar => sidebar?.allCollapsed);
});

function toggleCollapseAll() {
  Object.values(sidebarRefs.value).forEach(sidebar => sidebar?.toggleCollapseAll?.());
}
```

Follow the same refresh wiring pattern as `DesktopTodoDock.vue`:

```ts
const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
  }
};
```

Add minimal locale keys in both i18n files:

```json
"quadrant": {
  "title": "四象限",
  "importantUrgent": "重要且紧急",
  "importantNotUrgent": "重要不紧急",
  "urgentNotImportant": "紧急不重要",
  "notImportantNotUrgent": "不重要不紧急"
}
```

```json
"quadrant": {
  "title": "Quadrants",
  "importantUrgent": "Important & Urgent",
  "importantNotUrgent": "Important, Not Urgent",
  "urgentNotImportant": "Urgent, Not Important",
  "notImportantNotUrgent": "Not Important, Not Urgent"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/QuadrantTab.vue test/tabs/QuadrantTab.test.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(tab): add quadrant task view"
```

---

### Task 5: Bring over the shared “more” menu behavior and refresh wiring

**Files:**
- Modify: `src/tabs/QuadrantTab.vue`
- Modify: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write the failing menu and refresh-channel tests**

In `test/tabs/QuadrantTab.test.ts`, add a menu mock like `DesktopTodoDock.test.ts` and assert that clicking the more button registers the same visibility actions:

```ts
it('more menu exposes todo visibility toggles', async () => {
  const mounted = mountQuadrantTab();
  await nextTick();

  (mounted.container.querySelector('[data-testid="quadrant-more-button"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  const labels = menuAddItem.mock.calls.map(call => call[0]?.label);
  expect(labels).toContain('隐藏已完成');
  expect(labels).toContain('隐藏已放弃');

  mounted.unmount();
});
```

Add one smoke assertion that the component subscribes to refresh events by mocking `eventBus.on` and checking it was called with `Events.DATA_REFRESH`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts -t "more menu exposes todo visibility toggles"`

Expected: FAIL because the component has no more button yet.

- [ ] **Step 3: Write minimal menu + refresh-channel implementation**

Port the same patterns from `DesktopTodoDock.vue`:

```vue
<span
  class="block__icon b3-tooltips b3-tooltips__sw"
  data-testid="quadrant-more-button"
  :aria-label="t('common').more"
  @click="handleMoreClick"
>
  <svg><use xlink:href="#iconMore"></use></svg>
</span>
```

Use the same menu body:

```ts
const handleMoreClick = (event: MouseEvent) => {
  event.stopPropagation();
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const menu = new Menu('bullet-journal-quadrant-more-menu');

  menu.addItem({
    icon: projectStore.hideCompleted ? 'iconEyeoff' : 'iconEye',
    label: projectStore.hideCompleted ? t('todo').showCompleted : t('todo').hideCompleted,
    click: () => {
      projectStore.toggleHideCompleted();
    },
  });

  menu.addItem({
    icon: projectStore.hideAbandoned ? 'iconEyeoff' : 'iconEye',
    label: projectStore.hideAbandoned ? t('todo').showAbandoned : t('todo').hideAbandoned,
    click: () => {
      projectStore.toggleHideAbandoned();
    },
  });

  menu.addItem({
    icon: settingsStore.todoDock.showLinks ? 'iconEyeoff' : 'iconEye',
    label: settingsStore.todoDock.showLinks ? t('todo').hideLinks : t('todo').showLinks,
    click: () => {
      settingsStore.todoDock.showLinks = !settingsStore.todoDock.showLinks;
      settingsStore.saveToPlugin();
    },
  });

  menu.addItem({
    icon: settingsStore.todoDock.showReminderAndRecurring ? 'iconEyeoff' : 'iconEye',
    label: settingsStore.todoDock.showReminderAndRecurring
      ? t('todo').hideReminderRecurring
      : t('todo').showReminderRecurring,
    click: () => {
      settingsStore.todoDock.showReminderAndRecurring = !settingsStore.todoDock.showReminderAndRecurring;
      settingsStore.saveToPlugin();
    },
  });

  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  });
};
```

Port the same event-bus/BroadcastChannel lifecycle from `DesktopTodoDock.vue`, adjusting `viewName` to `QuadrantTab`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: PASS, including the new menu assertions.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/QuadrantTab.vue test/tabs/QuadrantTab.test.ts
git commit -m "feat(tab): align quadrant view controls with todo dock"
```

---

### Task 6: Final verification and regression sweep

**Files:**
- Verify: `src/tabs/QuadrantTab.vue`
- Verify: `src/components/todo/TodoSidebar.vue`
- Verify: `src/stores/projectStore.ts`
- Verify: `test/tabs/QuadrantTab.test.ts`
- Verify: `test/stores/projectStore.test.ts`

- [ ] **Step 1: Run the focused store test suite**

Run: `npx vitest run test/stores/projectStore.test.ts`

Expected: PASS with the new no-priority filter coverage.

- [ ] **Step 2: Run the focused tab test suite**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts test/tabs/DesktopTodoDock.test.ts`

Expected: PASS, proving the new tab works and Todo Dock did not regress.

- [ ] **Step 3: Run the broader project test suite**

Run: `npm test`

Expected: PASS or, if unrelated failures already exist, capture the exact failing files and stop claiming completion.

- [ ] **Step 4: Manual code review checklist**

Confirm in code before closing the task:

```text
- TAB_TYPES, getTabIcon, and getTabTitle all include QUADRANT
- top-bar menu opens QuadrantTab on desktop
- QuadrantTab passes high / medium / low / includeNoPriority correctly
- TodoSidebar keeps default behavior when displayMode is omitted
- projectStore completed/abandoned filters also accept includeNoPriority for future reuse
```

- [ ] **Step 5: Commit**

```bash
git add src/tabs/QuadrantTab.vue src/components/todo/TodoSidebar.vue src/stores/projectStore.ts test/tabs/QuadrantTab.test.ts test/stores/projectStore.test.ts
git commit -m "test: verify quadrant tab integration"
```

---

## Self-review

### Spec coverage

- Top-level desktop tab registration: covered in Task 1 and Task 4.
- Four-quadrant mapping to high / medium / low / undefined: covered in Task 2 and Task 4.
- Reuse of Todo cards via `TodoSidebar`: covered in Task 3 and Task 4.
- Shared visibility settings (`hideCompleted`, `hideAbandoned`, `showLinks`, `showReminderAndRecurring`): covered in Task 5.
- Refresh behavior via existing event bus / broadcast channel path: covered in Task 5.
- Regression checks for Todo Dock stability: covered in Task 6.

No spec gaps found.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-changing task includes concrete file paths, snippets, and commands.

### Type consistency

- The new filter flag is consistently named `includeNoPriority`.
- The new sidebar mode is consistently named `displayMode` with `'default' | 'embedded'`.
- The top-level tab key is consistently named `TAB_TYPES.QUADRANT`.

