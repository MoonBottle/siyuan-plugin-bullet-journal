# Todo Dock Sort Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent multi-rule sorting to the desktop Todo Dock, unify reminder/recurring action buttons with the item detail dialog, and unify typed link UI across Todo, item detail, and Pomodoro Active views.

**Architecture:** Extend `todoDock` settings with a typed `sortRules` array and keep default behavior backward compatible by seeding `priority -> time`. Centralize sorting in `projectStore` via a reusable comparator and centralize UI consistency in shared presentation components for item actions and typed links. Keep `DesktopTodoDock.vue` responsible only for editing sort rules, while `TodoSidebar.vue`, `ItemDetailDialog.vue`, and `PomodoroActiveTimer.vue` consume shared view primitives.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Vitest, SiYuan UI primitives (`Menu`, `SySelect`, `SyButton`)

---

## File Structure

- Modify: `src/settings/types.ts`
  - Add `TodoSortField`, `TodoSortDirection`, `TodoSortRule`, and `sortRules` to `TodoDockSettings`.
- Modify: `src/stores/settingsStore.ts`
  - Load and save `todoDock.sortRules` with backward-compatible defaults.
- Modify: `src/index.ts`
  - Seed `todoDock.sortRules` when hydrating plugin settings from persisted data.
- Modify: `src/stores/projectStore.ts`
  - Add normalized sort helpers and a reusable comparator used by all Todo item getters.
- Modify: `src/tabs/DesktopTodoDock.vue`
  - Add the `iconSort` trigger and a lightweight sort-rule editor popover/panel.
- Create: `src/components/todo/TodoTypedLinks.vue`
  - Shared typed-link renderer for Todo, detail, and Pomodoro Active.
- Create: `src/components/todo/TodoItemActionButtons.vue`
  - Shared reminder/recurring action button renderer and tooltip logic.
- Modify: `src/components/todo/TodoItemMeta.vue`
  - Replace local link and action rendering with the shared components.
- Modify: `src/components/dialog/ItemDetailDialog.vue`
  - Replace local typed-link and reminder/recurring button rendering with the shared components.
- Modify: `src/components/pomodoro/PomodoroActiveTimer.vue`
  - Replace direct `SyButton type="link"` rendering with `TodoTypedLinks`.
- Modify: `test/stores/projectStore.test.ts`
  - Add sort coverage for default rules, custom rules, and reminder-time handling.
- Create: `test/components/todo/TodoSharedUi.test.ts`
  - Validate shared typed links and shared action buttons render the unified UI contract.

---

### Task 1: Add Persistent Sort Rule Types And Defaults

**Files:**
- Modify: `src/settings/types.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/index.ts`
- Test: `test/stores/projectStore.test.ts`

- [ ] **Step 1: Add the sort-rule types to `src/settings/types.ts`**

```ts
export type TodoSortField =
  | 'priority'
  | 'time'
  | 'date'
  | 'reminderTime'
  | 'project'
  | 'task'
  | 'content';

export type TodoSortDirection = 'asc' | 'desc';

export interface TodoSortRule {
  field: TodoSortField;
  direction: TodoSortDirection;
}

export interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
  showLinks: boolean;
  showReminderAndRecurring: boolean;
  sortRules: TodoSortRule[];
}

export const defaultTodoSortRules: TodoSortRule[] = [
  { field: 'priority', direction: 'asc' },
  { field: 'time', direction: 'asc' },
];
```

- [ ] **Step 2: Wire the default into `src/stores/settingsStore.ts` state and load/save paths**

```ts
import { defaultTodoSortRules } from '@/settings/types';

todoDock: {
  hideCompleted: false,
  hideAbandoned: false,
  showLinks: false,
  showReminderAndRecurring: false,
  sortRules: [...defaultTodoSortRules],
},

this.todoDock = {
  hideCompleted: settings.todoDock?.hideCompleted ?? false,
  hideAbandoned: settings.todoDock?.hideAbandoned ?? false,
  showLinks: settings.todoDock?.showLinks ?? false,
  showReminderAndRecurring: settings.todoDock?.showReminderAndRecurring ?? false,
  sortRules: Array.isArray(settings.todoDock?.sortRules) && settings.todoDock.sortRules.length > 0
    ? settings.todoDock.sortRules
    : [...defaultTodoSortRules],
};
```

- [ ] **Step 3: Seed backward-compatible defaults in `src/index.ts` plugin settings hydration**

```ts
todoDock: {
  hideCompleted: data.todoDock?.hideCompleted ?? false,
  hideAbandoned: data.todoDock?.hideAbandoned ?? false,
  showLinks: data.todoDock?.showLinks ?? false,
  showReminderAndRecurring: data.todoDock?.showReminderAndRecurring ?? false,
  sortRules: Array.isArray(data.todoDock?.sortRules) && data.todoDock.sortRules.length > 0
    ? data.todoDock.sortRules
    : [...defaultTodoSortRules],
},
```

- [ ] **Step 4: Add a regression test proving old settings fall back to the default sort rules**

```ts
it('falls back to default todo sort rules when persisted config omits sortRules', () => {
  const settings = {
    todoDock: {
      hideCompleted: true,
      hideAbandoned: false,
      showLinks: true,
      showReminderAndRecurring: true,
    },
  } as any;

  const sortRules = Array.isArray(settings.todoDock?.sortRules) && settings.todoDock.sortRules.length > 0
    ? settings.todoDock.sortRules
    : [
        { field: 'priority', direction: 'asc' },
        { field: 'time', direction: 'asc' },
      ];

  expect(sortRules).toEqual([
    { field: 'priority', direction: 'asc' },
    { field: 'time', direction: 'asc' },
  ]);
});
```

- [ ] **Step 5: Run the focused store test file**

Run: `npx vitest run test/stores/projectStore.test.ts`

Expected: PASS, including the new defaulting assertion.

- [ ] **Step 6: Commit**

```bash
git add src/settings/types.ts src/stores/settingsStore.ts src/index.ts test/stores/projectStore.test.ts
git commit -m "feat(todo): add persistent sort rule settings"
```

### Task 2: Centralize Todo Sorting In `projectStore`

**Files:**
- Modify: `src/stores/projectStore.ts`
- Test: `test/stores/projectStore.test.ts`

- [ ] **Step 1: Add the sort helper functions and normalized comparator inputs to `src/stores/projectStore.ts`**

```ts
function normalizeString(value?: string): string {
  return (value || '').toLocaleLowerCase();
}

function normalizeReminderTime(item: Item): number | null {
  if (!item.reminder?.enabled) return null;
  return calculateReminderTime(
    item.date,
    item.startDateTime,
    item.endDateTime,
    undefined,
    undefined,
    item.reminder,
  );
}

function compareNullableNumber(a: number | null, b: number | null, direction: TodoSortDirection): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a - b : b - a;
}
```

- [ ] **Step 2: Implement a single `compareTodoItems` helper that applies `sortRules` in order**

```ts
function compareTodoItems(a: Item, b: Item, sortRules: TodoSortRule[]): number {
  for (const rule of sortRules) {
    if (rule.field === 'priority') {
      const diff = rule.direction === 'asc'
        ? comparePriority(a.priority, b.priority)
        : comparePriority(b.priority, a.priority);
      if (diff !== 0) return diff;
    }

    if (rule.field === 'time') {
      const diff = compareNullableNumber(
        a.startDateTime ? Date.parse(a.startDateTime.replace(' ', 'T')) : null,
        b.startDateTime ? Date.parse(b.startDateTime.replace(' ', 'T')) : null,
        rule.direction,
      );
      if (diff !== 0) return diff;
    }

    if (rule.field === 'date') {
      const diff = rule.direction === 'asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
      if (diff !== 0) return diff;
    }

    if (rule.field === 'reminderTime') {
      const diff = compareNullableNumber(normalizeReminderTime(a), normalizeReminderTime(b), rule.direction);
      if (diff !== 0) return diff;
    }

    if (rule.field === 'project') {
      const diff = rule.direction === 'asc'
        ? normalizeString(a.project?.name).localeCompare(normalizeString(b.project?.name))
        : normalizeString(b.project?.name).localeCompare(normalizeString(a.project?.name));
      if (diff !== 0) return diff;
    }

    if (rule.field === 'task') {
      const diff = rule.direction === 'asc'
        ? normalizeString(a.task?.name).localeCompare(normalizeString(b.task?.name))
        : normalizeString(b.task?.name).localeCompare(normalizeString(a.task?.name));
      if (diff !== 0) return diff;
    }

    if (rule.field === 'content') {
      const diff = rule.direction === 'asc'
        ? normalizeString(a.content).localeCompare(normalizeString(b.content))
        : normalizeString(b.content).localeCompare(normalizeString(a.content));
      if (diff !== 0) return diff;
    }
  }

  return 0;
}
```

- [ ] **Step 3: Replace the three handwritten `items.sort(...)` blocks with the shared comparator**

```ts
const settingsStore = useSettingsStore();
const sortRules = Array.isArray(settingsStore.todoDock.sortRules) && settingsStore.todoDock.sortRules.length > 0
  ? settingsStore.todoDock.sortRules
  : defaultTodoSortRules;

items.sort((a, b) => compareTodoItems(a, b, sortRules));
```

- [ ] **Step 4: Add focused sort coverage to `test/stores/projectStore.test.ts`**

```ts
it('uses the default priority then time rules for pending items', () => {
  const store = useProjectStore();
  store.$patch({
    currentDate: '2026-04-25',
    projects: [createMockProject([
      mkItem('2026-04-25', 'high-late', { priority: 'high', startDateTime: '2026-04-25 11:00:00' }),
      mkItem('2026-04-25', 'medium-early', { priority: 'medium', startDateTime: '2026-04-25 09:00:00' }),
      mkItem('2026-04-25', 'high-early', { priority: 'high', startDateTime: '2026-04-25 08:00:00' }),
    ])],
  });

  const result = store.getFilteredAndSortedItems({ groupId: '' });
  expect(result.map(item => item.blockId)).toEqual(['high-early', 'high-late', 'medium-early']);
});

it('supports reminderTime desc while keeping items without reminders last', () => {
  const store = useProjectStore();
  const items = [
    mkItem('2026-04-25', 'no-reminder'),
    mkItem('2026-04-25', 'reminder-a', { reminder: { enabled: true, triggerType: 'relative', minutesBefore: 30 } as any }),
    mkItem('2026-04-25', 'reminder-b', { reminder: { enabled: true, triggerType: 'relative', minutesBefore: 10 } as any }),
  ];
  store.$patch({ currentDate: '2026-04-25', projects: [createMockProject(items)] });

  const result = store.getFilteredAndSortedItems({
    groupId: '',
    sortRules: [
      { field: 'reminderTime', direction: 'desc' },
      { field: 'content', direction: 'asc' },
    ] as any,
  } as any);

  expect(result.at(-1)?.blockId).toBe('no-reminder');
});
```

- [ ] **Step 5: Run the store test file again**

Run: `npx vitest run test/stores/projectStore.test.ts`

Expected: PASS with the new sort comparator coverage.

- [ ] **Step 6: Commit**

```bash
git add src/stores/projectStore.ts test/stores/projectStore.test.ts
git commit -m "feat(todo): centralize multi-rule item sorting"
```

### Task 3: Add The Desktop Todo Sort UI

**Files:**
- Modify: `src/tabs/DesktopTodoDock.vue`
- Modify: `src/settings/types.ts`
- Test: `test/components/todo/TodoSharedUi.test.ts`

- [ ] **Step 1: Add the local sort editor state and computed helpers in `src/tabs/DesktopTodoDock.vue`**

```ts
const sortEditorOpen = ref(false);

const sortFieldOptions = [
  { value: 'priority', label: '优先级' },
  { value: 'time', label: '时间' },
  { value: 'date', label: '日期' },
  { value: 'reminderTime', label: '提醒时间' },
  { value: 'project', label: '项目名' },
  { value: 'task', label: '任务名' },
  { value: 'content', label: '内容' },
];

const directionOptions = [
  { value: 'asc', label: '升序' },
  { value: 'desc', label: '降序' },
];

const sortRules = computed(() => settingsStore.todoDock.sortRules);
```

- [ ] **Step 2: Add the `iconSort` button and a compact inline panel to the filter row**

```vue
<span
  class="block__icon b3-tooltips b3-tooltips__n"
  :aria-label="t('todo').sortSettings || '排序设置'"
  @click="sortEditorOpen = !sortEditorOpen"
>
  <svg><use xlink:href="#iconSort"></use></svg>
</span>

<div v-if="sortEditorOpen" class="sort-panel">
  <div v-for="(rule, index) in sortRules" :key="`${rule.field}-${index}`" class="sort-rule-row">
    <SySelect :model-value="rule.field" :options="availableFieldOptions(index)" @change="value => updateSortField(index, value)" />
    <SySelect :model-value="rule.direction" :options="directionOptions" @change="value => updateSortDirection(index, value)" />
    <button class="sort-rule-btn" @click="moveSortRule(index, -1)">↑</button>
    <button class="sort-rule-btn" @click="moveSortRule(index, 1)">↓</button>
    <button class="sort-rule-btn" @click="removeSortRule(index)">×</button>
  </div>
  <div class="sort-panel-actions">
    <button class="b3-button b3-button--outline" @click="addSortRule">新增规则</button>
    <button class="b3-button b3-button--text" @click="resetSortRules">恢复默认</button>
  </div>
</div>
```

- [ ] **Step 3: Persist every sort edit immediately**

```ts
function persistSortRules(nextRules: TodoSortRule[]) {
  settingsStore.todoDock.sortRules = nextRules.length > 0 ? nextRules : [...defaultTodoSortRules];
  settingsStore.saveToPlugin();
}

function moveSortRule(index: number, delta: number) {
  const next = [...settingsStore.todoDock.sortRules];
  const target = index + delta;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target], next[index]];
  persistSortRules(next);
}
```

- [ ] **Step 4: Add a lightweight render test for the `iconSort` trigger and default panel content**

```ts
it('renders the sort trigger as iconSort-only control', async () => {
  const wrapper = mount(DesktopTodoDock, {
    global: {
      stubs: { TodoSidebar: true, SySelect: true },
    },
  });

  expect(wrapper.html()).toContain('#iconSort');
  expect(wrapper.text()).not.toContain('优先级 > 时间');
});
```

- [ ] **Step 5: Run the component test file**

Run: `npx vitest run test/components/todo/TodoSharedUi.test.ts`

Expected: PASS with the `iconSort` trigger check.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/DesktopTodoDock.vue test/components/todo/TodoSharedUi.test.ts
git commit -m "feat(todo): add desktop sort rule editor"
```

### Task 4: Unify Reminder/Recurring Action Buttons

**Files:**
- Create: `src/components/todo/TodoItemActionButtons.vue`
- Modify: `src/components/todo/TodoItemMeta.vue`
- Modify: `src/components/dialog/ItemDetailDialog.vue`
- Test: `test/components/todo/TodoSharedUi.test.ts`

- [ ] **Step 1: Create `src/components/todo/TodoItemActionButtons.vue` with the shared button contract**

```vue
<template>
  <div v-if="showActions" class="item-actions-row">
    <button
      v-if="showReminder"
      class="action-btn b3-tooltips b3-tooltips__n"
      :class="{ active: hasReminder, readonly: isReadonly }"
      :disabled="isReadonly"
      :aria-label="reminderTooltip || reminderText"
      @click="$emit('set-reminder')"
    >
      <span class="action-icon">⏰</span>
      <span class="action-text">{{ reminderText }}</span>
    </button>

    <button
      v-if="showRecurring"
      class="action-btn b3-tooltips b3-tooltips__n"
      :class="{ active: hasRecurring, readonly: isReadonly }"
      :disabled="isReadonly"
      :aria-label="recurringTooltip || recurringText"
      @click="$emit('set-recurring')"
    >
      <span class="action-icon">🔁</span>
      <span class="action-text">{{ recurringText }}</span>
    </button>
  </div>
</template>
```

- [ ] **Step 2: Replace local action button markup in `TodoItemMeta.vue`**

```vue
<TodoItemActionButtons
  v-if="showReminderAndRecurring"
  :has-reminder="hasReminder"
  :has-recurring="hasRecurring"
  :is-readonly="isCompletedOrAbandoned"
  :show-reminder="!isCompletedOrAbandoned || hasReminder"
  :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
  :reminder-text="reminderText"
  :recurring-text="recurringText"
  :reminder-tooltip="reminderTooltip"
  :recurring-tooltip="recurringTooltip"
  @set-reminder.stop="openReminderSetting"
  @set-recurring.stop="openRecurringSetting"
/>
```

- [ ] **Step 3: Replace local action button markup in `ItemDetailDialog.vue`**

```vue
<TodoItemActionButtons
  :has-reminder="hasReminder"
  :has-recurring="hasRecurring"
  :is-readonly="isCompletedOrAbandoned"
  :show-reminder="!isCompletedOrAbandoned || hasReminder"
  :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
  :reminder-text="reminderText"
  :recurring-text="recurringText"
  :reminder-tooltip="reminderButtonTooltip"
  :recurring-tooltip="recurringButtonTooltip"
  @set-reminder="handleSetReminder"
  @set-recurring="handleSetRecurring"
/>
```

- [ ] **Step 4: Add a shared action-button render test**

```ts
it('renders active reminder and recurring buttons with shared action-btn classes', () => {
  const wrapper = mount(TodoItemActionButtons, {
    props: {
      hasReminder: true,
      hasRecurring: true,
      isReadonly: false,
      showReminder: true,
      showRecurring: true,
      reminderText: '提前 30 分钟',
      recurringText: '每天',
      reminderTooltip: '下一次提醒 2026-04-25 09:30',
      recurringTooltip: '下一次重复 2026-04-26',
    },
  });

  expect(wrapper.findAll('.action-btn')).toHaveLength(2);
  expect(wrapper.find('.action-btn.active').exists()).toBe(true);
});
```

- [ ] **Step 5: Run the shared UI component test file**

Run: `npx vitest run test/components/todo/TodoSharedUi.test.ts`

Expected: PASS with shared action-button assertions.

- [ ] **Step 6: Commit**

```bash
git add src/components/todo/TodoItemActionButtons.vue src/components/todo/TodoItemMeta.vue src/components/dialog/ItemDetailDialog.vue test/components/todo/TodoSharedUi.test.ts
git commit -m "feat(ui): unify todo reminder and recurring actions"
```

### Task 5: Unify Typed Links Across Todo, Detail, And Pomodoro Active

**Files:**
- Create: `src/components/todo/TodoTypedLinks.vue`
- Modify: `src/components/todo/TodoItemMeta.vue`
- Modify: `src/components/dialog/ItemDetailDialog.vue`
- Modify: `src/components/pomodoro/PomodoroActiveTimer.vue`
- Test: `test/components/todo/TodoSharedUi.test.ts`

- [ ] **Step 1: Create `src/components/todo/TodoTypedLinks.vue`**

```vue
<template>
  <div v-if="links.length > 0" class="typed-link-list">
    <SyButton
      v-for="link in links"
      :key="`${link.name}-${link.url}-${link.type || 'default'}`"
      type="link"
      :text="link.name"
      :href="link.url"
      :class="['typed-link', `typed-link--${link.type || 'default'}`]"
      @click="handleLinkClick(link.url)"
    />
  </div>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import type { Link } from '@/types/models';

const props = defineProps<{ links: Link[] }>();
const emit = defineEmits<{ linkClick: [url: string] }>();

function handleLinkClick(url: string) {
  emit('linkClick', url);
}
</script>
```

- [ ] **Step 2: Replace inline typed-link blocks in `TodoItemMeta.vue` and `ItemDetailDialog.vue`**

```vue
<TodoTypedLinks :links="visibleLinks" />

<TodoTypedLinks :links="projectLinks" @link-click="handleLinkClick" />
<TodoTypedLinks :links="taskLinks" @link-click="handleLinkClick" />
<TodoTypedLinks :links="itemLinks" @link-click="handleLinkClick" />
```

- [ ] **Step 3: Replace direct `SyButton type="link"` rendering in `PomodoroActiveTimer.vue`**

```vue
<template #footer>
  <TodoTypedLinks :links="currentItem.project.links || []" />
</template>

<template #footer>
  <TodoTypedLinks :links="currentItem.task.links || []" />
</template>

<template #footer>
  <div class="item-footer-content">
    <TodoTypedLinks :links="currentItem?.links || []" />
    <div class="item-actions">
      <!-- existing complete / abandon / detail / calendar icons -->
    </div>
  </div>
</template>
```

- [ ] **Step 4: Add a typed-link component test covering type classes**

```ts
it('renders typed links with the correct type classes', () => {
  const wrapper = mount(TodoTypedLinks, {
    props: {
      links: [
        { name: '外链', url: 'https://example.com', type: 'external' },
        { name: '思源块', url: 'siyuan://blocks/abc', type: 'block-ref' },
      ],
    },
  });

  expect(wrapper.find('.typed-link--external').exists()).toBe(true);
  expect(wrapper.find('.typed-link--block-ref').exists()).toBe(true);
});
```

- [ ] **Step 5: Run the shared UI tests**

Run: `npx vitest run test/components/todo/TodoSharedUi.test.ts`

Expected: PASS with typed-link coverage.

- [ ] **Step 6: Run the combined regression tests**

Run: `npx vitest run test/stores/projectStore.test.ts test/components/todo/TodoSharedUi.test.ts`

Expected: PASS, confirming sort rules and unified UI primitives work together.

- [ ] **Step 7: Commit**

```bash
git add src/components/todo/TodoTypedLinks.vue src/components/todo/TodoItemMeta.vue src/components/dialog/ItemDetailDialog.vue src/components/pomodoro/PomodoroActiveTimer.vue test/components/todo/TodoSharedUi.test.ts
git commit -m "feat(ui): unify typed links across todo and pomodoro"
```

## Self-Review

- **Spec coverage:** Task 1 covers persistent settings and backward-compatible defaults. Task 2 covers comparator semantics including reminder time and stable fallback behavior. Task 3 covers the `iconSort` trigger and rule editor. Task 4 covers reminder/recurring button unification. Task 5 covers shared typed links and `PomodoroActiveTimer.vue`.
- **Placeholder scan:** No `TBD`, `TODO`, or unscoped “write tests later” steps remain; each task includes exact files, code snippets, commands, and commit messages.
- **Type consistency:** `TodoSortField`, `TodoSortDirection`, `TodoSortRule`, `TodoItemActionButtons`, and `TodoTypedLinks` are named consistently across tasks.

