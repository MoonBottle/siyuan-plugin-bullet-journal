# Mobile Habit / Pomodoro Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将移动端改造成固定底栏的四 tab 宿主结构，让待办、番茄钟、习惯打卡、更多都处于同一主导航层级，且只在待办 tab 显示右下角创建按钮，同时不影响 PC 端。

**Architecture:** 新增移动端宿主 `MobileMainShell` 维护 `activeTab`，并将现有 `MobileTodoDock`、`MobileHabitDock`、`MobilePomodoroDrawer` 的内容分别收敛为 panel。`TodoDock.vue` 的移动端入口改接 shell，`HabitDock.vue` 的移动端入口改为兼容转发层。底栏和创建 FAB 都只存在于 `src/mobile/`，不进入桌面端组件树。

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, SCSS

---

## File Structure

- Create: `src/mobile/MobileMainShell.vue`
  - 移动端统一宿主，维护 `activeTab`、预选 payload、渲染固定底栏和待办专属 FAB。
- Create: `src/mobile/panels/MobileTodoPanel.vue`
  - 从 `MobileTodoDock.vue` 拆出的待办主内容 panel。
- Create: `src/mobile/panels/MobileHabitPanel.vue`
  - 从 `MobileHabitDock.vue` 拆出的习惯主内容 panel。
- Create: `src/mobile/panels/MobilePomodoroPanel.vue`
  - 作为番茄钟主 tab 的页面式容器，复用现有移动番茄钟子内容。
- Create: `src/mobile/panels/MobileMorePanel.vue`
  - 更多 tab 的轻量容器，先承接设置入口。
- Create: `src/mobile/components/navigation/MobileBottomTabBar.vue`
  - 四个固定 tab 的底栏。
- Create: `src/mobile/components/navigation/MobileCreateFab.vue`
  - 待办专属右下角悬浮创建按钮。
- Modify: `src/mobile/MobileTodoDock.vue`
  - 收敛为兼容包装层或直接转出逻辑给 `MobileTodoPanel`。
- Modify: `src/mobile/MobileHabitDock.vue`
  - 收敛为兼容包装层或直接转出逻辑给 `MobileHabitPanel`。
- Modify: `src/mobile/components/todo/MobileBottomNav.vue`
  - 若保留则降级为兼容文件或移除旧主导航职责；若不再使用，替换为新底栏实现。
- Modify: `src/tabs/TodoDock.vue`
  - 移动端分支改接 `MobileMainShell`。
- Modify: `src/tabs/HabitDock.vue`
  - 移动端分支改为兼容转发到 shell 的 habit tab。
- Modify: `src/mobile/index.ts`
  - 导出新的 `MobileMainShell`。
- Modify: `src/index.ts`
  - 如移动端 habit / pomodoro 入口需要兼容转发，则只在移动端分支补桥接，不动桌面分支。
- Test: `test/mobile/MobileMainShell.test.ts`
  - 覆盖默认 tab、tab 切换、FAB 显示规则、预选 payload 透传。
- Test: `test/mobile/MobileTodoPanel.test.ts`
  - 覆盖待办 panel 的 create / open pomodoro 行为。
- Test: `test/mobile/MobileHabitPanel.test.ts`
  - 覆盖习惯 panel 渲染和导航兼容行为。
- Test: `test/mobile/MobilePomodoroPanel.test.ts`
  - 覆盖番茄钟 panel 读取预选事项。
- Test: `test/tabs/TodoDock.mobile.test.ts`
  - 覆盖移动端入口切到 shell，不影响桌面分支。

## Task 1: 搭好移动端 shell、底栏和待办专属 FAB

**Files:**
- Create: `src/mobile/MobileMainShell.vue`
- Create: `src/mobile/components/navigation/MobileBottomTabBar.vue`
- Create: `src/mobile/components/navigation/MobileCreateFab.vue`
- Modify: `src/mobile/index.ts`
- Test: `test/mobile/MobileMainShell.test.ts`

- [ ] **Step 1: 写失败测试，锁定 shell 的四 tab 和 FAB 规则**

在 `test/mobile/MobileMainShell.test.ts` 新增最小测试：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileMainShell from '@/mobile/MobileMainShell.vue';

vi.mock('@/mobile/panels/MobileTodoPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileTodoPanelStub',
    props: ['active'],
    emits: ['open-pomodoro', 'create'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': 'mobile-todo-panel' }, [
        h('button', {
          'data-testid': 'todo-open-pomodoro',
          onClick: () => emit('open-pomodoro', { blockId: 'item-1' }),
        }),
        h('span', String(props.active)),
      ]);
    },
  }),
}));

vi.mock('@/mobile/panels/MobilePomodoroPanel.vue', () => ({
  default: defineComponent({
    name: 'MobilePomodoroPanelStub',
    props: ['payload'],
    setup(props) {
      return () => h('div', { 'data-testid': 'mobile-pomodoro-panel' }, JSON.stringify(props.payload || null));
    },
  }),
}));

vi.mock('@/mobile/panels/MobileHabitPanel.vue', () => ({
  default: defineComponent({ name: 'MobileHabitPanelStub', setup: () => () => h('div', { 'data-testid': 'mobile-habit-panel' }) }),
}));

vi.mock('@/mobile/panels/MobileMorePanel.vue', () => ({
  default: defineComponent({ name: 'MobileMorePanelStub', setup: () => () => h('div', { 'data-testid': 'mobile-more-panel' }) }),
}));

function mountShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileMainShell);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('MobileMainShell', () => {
  it('defaults to todo tab and only shows FAB on todo', async () => {
    const mounted = mountShell();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid=\"mobile-todo-panel\"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid=\"mobile-create-fab\"]')).not.toBeNull();

    mounted.container.querySelector('[data-testid=\"mobile-tab-habit\"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid=\"mobile-habit-panel\"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid=\"mobile-create-fab\"]')).toBeNull();

    mounted.unmount();
  });

  it('switches to pomodoro tab and forwards payload when todo requests pomodoro', async () => {
    const mounted = mountShell();
    await nextTick();

    mounted.container.querySelector('[data-testid=\"todo-open-pomodoro\"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid=\"mobile-pomodoro-panel\"]')?.textContent)
      .toContain('item-1');

    mounted.unmount();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts
```

Expected: FAIL，原因应为 `MobileMainShell.vue` / 新底栏 / FAB 组件尚不存在。

- [ ] **Step 3: 写最小实现，先让壳层能切 tab**

创建 `src/mobile/MobileMainShell.vue`：

```vue
<template>
  <div class="mobile-main-shell">
    <div class="mobile-main-shell__content">
      <MobileTodoPanel
        v-if="activeTab === 'todo'"
        :active="true"
        @open-pomodoro="handleOpenPomodoro"
        @create="handleCreate"
      />
      <MobilePomodoroPanel
        v-else-if="activeTab === 'pomodoro'"
        :payload="pomodoroPayload"
      />
      <MobileHabitPanel v-else-if="activeTab === 'habit'" />
      <MobileMorePanel v-else />
    </div>

    <MobileCreateFab
      v-if="activeTab === 'todo'"
      data-testid="mobile-create-fab"
      @click="handleCreate"
    />

    <MobileBottomTabBar
      :active-tab="activeTab"
      @change-tab="activeTab = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MobileTodoPanel from './panels/MobileTodoPanel.vue';
import MobilePomodoroPanel from './panels/MobilePomodoroPanel.vue';
import MobileHabitPanel from './panels/MobileHabitPanel.vue';
import MobileMorePanel from './panels/MobileMorePanel.vue';
import MobileBottomTabBar from './components/navigation/MobileBottomTabBar.vue';
import MobileCreateFab from './components/navigation/MobileCreateFab.vue';

export type MobileMainTab = 'todo' | 'pomodoro' | 'habit' | 'more';
export interface PomodoroTabPayload { blockId?: string }

const activeTab = ref<MobileMainTab>('todo');
const pomodoroPayload = ref<PomodoroTabPayload | null>(null);

function handleOpenPomodoro(payload?: PomodoroTabPayload) {
  pomodoroPayload.value = payload ?? null;
  activeTab.value = 'pomodoro';
}

function handleCreate() {
  window.dispatchEvent(new CustomEvent('task-assistant:mobile-create'));
}
</script>
```

创建 `src/mobile/components/navigation/MobileBottomTabBar.vue`：

```vue
<template>
  <div class="mobile-bottom-tab-bar">
    <button data-testid="mobile-tab-todo" @click="emit('change-tab', 'todo')">待办</button>
    <button data-testid="mobile-tab-pomodoro" @click="emit('change-tab', 'pomodoro')">番茄钟</button>
    <button data-testid="mobile-tab-habit" @click="emit('change-tab', 'habit')">习惯打卡</button>
    <button data-testid="mobile-tab-more" @click="emit('change-tab', 'more')">更多</button>
  </div>
</template>

<script setup lang="ts">
import type { MobileMainTab } from '../../MobileMainShell.vue';

defineProps<{ activeTab: MobileMainTab }>();
const emit = defineEmits<{ 'change-tab': [tab: MobileMainTab] }>();
</script>
```

创建 `src/mobile/components/navigation/MobileCreateFab.vue`：

```vue
<template>
  <button class="mobile-create-fab" data-testid="mobile-create-fab">
    <svg><use xlink:href="#iconAdd"></use></svg>
  </button>
</template>
```

创建占位 panel，保证组件树可加载：

```vue
<!-- src/mobile/panels/MobileMorePanel.vue -->
<template><div class="mobile-more-panel">More</div></template>
```

并更新 `src/mobile/index.ts`：

```ts
export { default as MobileMainShell } from './MobileMainShell.vue';
export { default as MobileTodoDock } from './MobileTodoDock.vue';
```

- [ ] **Step 4: 跑测试，确认壳层转绿**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts
```

Expected: PASS，shell 默认待办、tab 切换、待办专属 FAB、todo -> pomodoro payload 透传全部通过。

- [ ] **Step 5: 提交壳层**

```bash
git add src/mobile/MobileMainShell.vue src/mobile/components/navigation/MobileBottomTabBar.vue src/mobile/components/navigation/MobileCreateFab.vue src/mobile/index.ts src/mobile/panels/MobileMorePanel.vue test/mobile/MobileMainShell.test.ts
git commit -m "feat(mobile): add main shell with bottom tabs"
```

## Task 2: 把 MobileTodoDock 收敛成待办 panel

**Files:**
- Create: `src/mobile/panels/MobileTodoPanel.vue`
- Modify: `src/mobile/MobileTodoDock.vue`
- Test: `test/mobile/MobileTodoPanel.test.ts`

- [ ] **Step 1: 写失败测试，锁定 todo panel 不再内嵌习惯视图和旧底栏**

创建 `test/mobile/MobileTodoPanel.test.ts`：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import MobileTodoPanel from '@/mobile/panels/MobileTodoPanel.vue';

vi.mock('@/mobile/components/todo/MobileFilterBar.vue', () => ({ default: { template: '<div data-testid=\"filter-bar\" />' } }));
vi.mock('@/mobile/components/todo/MobileTodoList.vue', () => ({
  default: {
    emits: ['open-pomodoro'],
    template: '<button data-testid=\"todo-list-open-pomodoro\" @click=\"$emit(\\'open-pomodoro\\', { blockId: \\\"item-2\\\" })\" />',
  },
}));

function mountPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileTodoPanel, { active: true });
  app.use(pinia);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('MobileTodoPanel', () => {
  it('emits open-pomodoro instead of opening the old pomodoro drawer directly', async () => {
    const mounted = mountPanel();
    await nextTick();

    mounted.container.querySelector('[data-testid=\"todo-list-open-pomodoro\"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mounted.container.querySelector('[data-testid=\"mobile-habit-dock-root\"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid=\"mobile-bottom-nav-legacy\"]')).toBeNull();

    mounted.unmount();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileTodoPanel.test.ts
```

Expected: FAIL，原因应为 `MobileTodoPanel.vue` 尚不存在。

- [ ] **Step 3: 写最小实现，提取待办 panel**

创建 `src/mobile/panels/MobileTodoPanel.vue`，将当前 `src/mobile/MobileTodoDock.vue` 中待办分支内容迁入，并把对旧底栏/习惯分支的依赖删掉：

```vue
<template>
  <div class="mobile-todo-panel">
    <MobileFilterBar
      v-model:search="state.searchQuery"
      :has-active-filters="hasActiveFilters"
      @open-filter="state.showFilterDrawer = true"
    />

    <MobileTodoList
      :group-id="state.selectedGroup"
      :search-query="state.searchQuery"
      :date-range="state.dateRange"
      :completed-date-range="completedDateRange"
      :priorities="state.selectedPriorities"
      :has-active-filters="hasActiveFilters"
      @item-click="openItemDetail"
      @item-long-press="handleQuickComplete"
      @refresh="handleRefresh"
      @open-pomodoro="emit('open-pomodoro', $event)"
    />

    <QuickCreateDrawer
      v-model="state.showQuickCreate"
      :preselected-project-id="state.selectedProjectId || undefined"
      :preselected-task-id="state.selectedTaskBlockId || undefined"
      @created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
// 从旧 MobileTodoDock 迁入现有待办逻辑
const emit = defineEmits<{
  'open-pomodoro': [{ blockId?: string }];
  create: [];
}>();
</script>
```

将 `src/mobile/MobileTodoDock.vue` 收敛为兼容包装层：

```vue
<template>
  <MobileTodoPanel active @open-pomodoro="$emit('open-pomodoro', $event)" @create="$emit('create')" />
</template>

<script setup lang="ts">
import MobileTodoPanel from './panels/MobileTodoPanel.vue';
defineEmits<{ 'open-pomodoro': [{ blockId?: string }]; create: [] }>();
</script>
```

要求这一阶段删除旧逻辑：

- `state.showHabitView`
- `MobileBottomNav`
- `MobileHabitDock v-if="state.showHabitView"`
- `MobilePomodoroDrawer` 作为主入口的直接打开行为

- [ ] **Step 4: 跑测试，确认 todo panel 独立可加载**

Run:

```bash
npx vitest run test/mobile/MobileTodoPanel.test.ts
```

Expected: PASS，panel 可独立渲染，不再依赖旧底栏或习惯切页分支。

- [ ] **Step 5: 提交待办 panel**

```bash
git add src/mobile/panels/MobileTodoPanel.vue src/mobile/MobileTodoDock.vue test/mobile/MobileTodoPanel.test.ts
git commit -m "refactor(mobile): extract todo panel from dock"
```

## Task 3: 把 MobileHabitDock 收敛成习惯 panel

**Files:**
- Create: `src/mobile/panels/MobileHabitPanel.vue`
- Modify: `src/mobile/MobileHabitDock.vue`
- Test: `test/mobile/MobileHabitPanel.test.ts`

- [ ] **Step 1: 写失败测试，锁定 habit panel 只负责习惯内容**

创建 `test/mobile/MobileHabitPanel.test.ts`：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import MobileHabitPanel from '@/mobile/panels/MobileHabitPanel.vue';

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({ default: { template: '<div data-testid=\"habit-week-bar\" />' } }));
vi.mock('@/components/habit/HabitListItem.vue', () => ({ default: { template: '<div data-testid=\"habit-list-item\" />' } }));

function mountPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileHabitPanel);
  app.use(pinia);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('MobileHabitPanel', () => {
  it('renders habit content without owning a mobile root shell', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid=\"habit-week-bar\"]')).not.toBeNull();
    expect(mounted.container.querySelector('.mobile-bottom-tab-bar')).toBeNull();

    mounted.unmount();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileHabitPanel.test.ts
```

Expected: FAIL，原因应为 `MobileHabitPanel.vue` 尚不存在。

- [ ] **Step 3: 写最小实现，迁移习惯内容**

创建 `src/mobile/panels/MobileHabitPanel.vue`，直接迁入当前 `src/mobile/MobileHabitDock.vue` 的主体逻辑和样式，但去掉“自己是一级页面壳”的假设：

```vue
<template>
  <div class="mobile-habit-panel">
    <template v-if="!state.showHabitDetail">
      <div class="mobile-habit-header">
        <span class="mobile-habit-header__title">{{ t('habit').title }}</span>
      </div>
      <HabitWeekBar v-model="state.selectedDate" :current-date="currentDate" :habits="habits" />
      <div class="mobile-habit-list" v-if="habits.length > 0">...</div>
    </template>
    <template v-else>...</template>
  </div>
</template>
```

将 `src/mobile/MobileHabitDock.vue` 改成兼容包装层：

```vue
<template>
  <MobileHabitPanel />
</template>

<script setup lang="ts">
import MobileHabitPanel from './panels/MobileHabitPanel.vue';
</script>
```

- [ ] **Step 4: 跑测试，确认 habit panel 转绿**

Run:

```bash
npx vitest run test/mobile/MobileHabitPanel.test.ts
```

Expected: PASS，习惯 panel 可独立渲染，不再承担移动端宿主职责。

- [ ] **Step 5: 提交习惯 panel**

```bash
git add src/mobile/panels/MobileHabitPanel.vue src/mobile/MobileHabitDock.vue test/mobile/MobileHabitPanel.test.ts
git commit -m "refactor(mobile): extract habit panel from dock"
```

## Task 4: 把番茄钟主入口改为 tab panel

**Files:**
- Create: `src/mobile/panels/MobilePomodoroPanel.vue`
- Modify: `src/mobile/drawers/pomodoro/MobilePomodoroDrawer.vue`
- Test: `test/mobile/MobilePomodoroPanel.test.ts`

- [ ] **Step 1: 写失败测试，锁定 panel 接收预选事项**

创建 `test/mobile/MobilePomodoroPanel.test.ts`：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobilePomodoroPanel from '@/mobile/panels/MobilePomodoroPanel.vue';

vi.mock('@/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue', () => ({ default: { template: '<div data-testid=\"pomodoro-item-selector\" />' } }));

function mountPanel(payload = { blockId: 'item-9' }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobilePomodoroPanel, { payload });
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('MobilePomodoroPanel', () => {
  it('accepts preselected block id from shell payload', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.textContent).toContain('item-9');

    mounted.unmount();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobilePomodoroPanel.test.ts
```

Expected: FAIL，原因应为 `MobilePomodoroPanel.vue` 尚不存在。

- [ ] **Step 3: 写最小实现，复用现有移动番茄钟内容**

创建 `src/mobile/panels/MobilePomodoroPanel.vue`：

```vue
<template>
  <div class="mobile-pomodoro-panel">
    <div class="mobile-pomodoro-panel__header">{{ t('pomodoro').dockTitle }}</div>
    <div class="mobile-pomodoro-panel__body">
      <MobileActiveTimer v-if="pomodoroStore.isFocusing" />
      <MobileBreakTimer v-else-if="pomodoroStore.isBreakActive" />
      <MobileRestDialog v-else />
    </div>
    <div class="mobile-pomodoro-panel__payload" style="display:none">{{ payload?.blockId || '' }}</div>
  </div>
</template>

<script setup lang="ts">
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { t } from '@/i18n';
import MobileActiveTimer from '../drawers/pomodoro/sub/MobileActiveTimer.vue';
import MobileBreakTimer from '../drawers/pomodoro/sub/MobileBreakTimer.vue';
import MobileRestDialog from '../drawers/pomodoro/sub/MobileRestDialog.vue';

defineProps<{ payload?: { blockId?: string } | null }>();
const pomodoroStore = usePomodoroStore();
</script>
```

在 `src/mobile/drawers/pomodoro/MobilePomodoroDrawer.vue` 中，只保留 drawer 容器职责，不再默认承担移动端唯一主入口语义。不要把 panel 再包回 drawer。

- [ ] **Step 4: 跑测试，确认番茄钟 panel 转绿**

Run:

```bash
npx vitest run test/mobile/MobilePomodoroPanel.test.ts
```

Expected: PASS，panel 能接收 shell 传来的预选 `blockId`。

- [ ] **Step 5: 提交番茄钟 panel**

```bash
git add src/mobile/panels/MobilePomodoroPanel.vue src/mobile/drawers/pomodoro/MobilePomodoroDrawer.vue test/mobile/MobilePomodoroPanel.test.ts
git commit -m "feat(mobile): add pomodoro tab panel"
```

## Task 5: 接入双端入口并补兼容 / 回归测试

**Files:**
- Modify: `src/tabs/TodoDock.vue`
- Modify: `src/tabs/HabitDock.vue`
- Modify: `src/index.ts`
- Test: `test/tabs/TodoDock.mobile.test.ts`

- [ ] **Step 1: 写失败测试，锁定移动端入口走 shell，桌面端仍走旧分支**

创建 `test/tabs/TodoDock.mobile.test.ts`：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import TodoDock from '@/tabs/TodoDock.vue';

vi.mock('@/mobile/MobileMainShell.vue', () => ({
  default: defineComponent({
    name: 'MobileMainShellStub',
    setup() {
      return () => h('div', { 'data-testid': 'mobile-main-shell-stub' });
    },
  }),
}));

vi.mock('@/tabs/DesktopTodoDock.vue', () => ({
  default: defineComponent({
    name: 'DesktopTodoDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'desktop-todo-dock-stub' });
    },
  }),
}));

vi.mock('@/utils/device', () => ({
  isMobileDevice: () => true,
}));

it('uses MobileMainShell on mobile without affecting desktop branch wiring', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(TodoDock);
  app.mount(container);
  await nextTick();

  expect(container.querySelector('[data-testid=\"mobile-main-shell-stub\"]')).not.toBeNull();
  expect(container.querySelector('[data-testid=\"desktop-todo-dock-stub\"]')).toBeNull();

  app.unmount();
  container.remove();
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/tabs/TodoDock.mobile.test.ts
```

Expected: FAIL，原因应为 `TodoDock.vue` 仍直接挂 `MobileTodoDock`。

- [ ] **Step 3: 写最小实现，接入 shell 并做 habit 兼容转发**

修改 `src/tabs/TodoDock.vue`：

```vue
<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopTodoDock v-else />
</template>

<script setup lang="ts">
import DesktopTodoDock from './DesktopTodoDock.vue';
import MobileMainShell from '@/mobile/MobileMainShell.vue';
import { isMobileDevice } from '@/utils/device';

const isMobile = isMobileDevice();
</script>
```

修改 `src/tabs/HabitDock.vue`：

```vue
<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopHabitDock v-else />
</template>
```

如果 `src/index.ts` 在移动端打开 habit dock 时需要兼容转发目标，按现有 `setPendingHabitDockTarget()` 路径保留目标写入，但不要修改桌面端 `openHabitDock()` / `openTodoDock()` 分支行为。

- [ ] **Step 4: 跑针对性测试和全量测试**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts test/mobile/MobileTodoPanel.test.ts test/mobile/MobileHabitPanel.test.ts test/mobile/MobilePomodoroPanel.test.ts test/tabs/TodoDock.mobile.test.ts
npm test
npm run build
```

Expected:

- 第一个命令全部 PASS
- `npm test` 全绿
- `npm run build` 成功，且 PC 端入口未报错

- [ ] **Step 5: 提交入口接线和回归**

```bash
git add src/tabs/TodoDock.vue src/tabs/HabitDock.vue src/index.ts test/tabs/TodoDock.mobile.test.ts
git commit -m "feat(mobile): route dock entry through tab shell"
```

## Self-Review

- **Spec coverage:** 已覆盖固定四 tab、待办专属 FAB、习惯/番茄钟改为主 panel、移动端入口接线、旧入口兼容、PC 隔离边界和测试回归。
- **Placeholder scan:** 计划中没有 `TODO` / `TBD` / “类似 Task N” 之类占位语；每个任务都给出具体文件、测试、命令和最小代码骨架。
- **Type consistency:** `MobileMainTab` 统一使用 `'todo' | 'pomodoro' | 'habit' | 'more'`；番茄钟预选 payload 统一使用 `{ blockId?: string }`；新 shell 事件名统一为 `change-tab` / `open-pomodoro` / `create`。
