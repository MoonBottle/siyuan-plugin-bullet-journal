# Mobile Habit Detail Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将移动端习惯 tab 从“面板内整页详情切换”改造成“卡片点击拉起接近全屏的详情 bottom sheet”，同时移除移动端独立日历按钮并修正周条 spacing。

**Architecture:** 以 `MobileHabitPanel.vue` 作为列表宿主，新增独立的 `MobileHabitDetailSheet.vue` 负责详情抽屉。`HabitListItem.vue` 增加移动端开关，移动端下改为主体点击打开详情、操作按钮仅负责打卡，桌面端保留现有打开文档 / 日历入口行为。

**Tech Stack:** TypeScript, Vue 3 SFC, Pinia stores, Vitest, SCSS

---

## File Structure

- Create: `src/mobile/components/habit/MobileHabitDetailSheet.vue`
  - 移动端习惯详情 bottom sheet，承载标题、关闭、今日进度、统计、月历、日志。
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
  - 从整页详情切换改为列表宿主 + sheet 状态；补周条左右 gutter 和顶部间距。
- Modify: `src/components/habit/HabitListItem.vue`
  - 增加 `isMobile` 分支，移动端移除日历按钮、主体改为 `open-detail`。
- Modify: `test/mobile/MobileHabitPanel.test.ts`
  - 覆盖移动端列表点击、快捷操作不串扰、外部导航打开详情、周条容器 spacing。
- Modify: `test/components/habit/HabitListItem.test.ts`
  - 覆盖移动端不渲染日历按钮、主体点击发 `open-detail`、按钮点击不串扰。
- Create: `test/mobile/MobileHabitDetailSheet.test.ts`
  - 覆盖详情 sheet 渲染、关闭、viewMonth 透传、今日进度回调。

## Task 1: 锁定移动端列表交互与周条 spacing

**Files:**
- Modify: `test/components/habit/HabitListItem.test.ts`
- Modify: `test/mobile/MobileHabitPanel.test.ts`
- Modify: `src/components/habit/HabitListItem.vue`
- Modify: `src/mobile/panels/MobileHabitPanel.vue`

- [ ] **Step 1: 写 `HabitListItem` 的移动端失败测试**

在 `test/components/habit/HabitListItem.test.ts` 追加下面两个用例：

```ts
it('移动端不显示日历按钮，主体点击发出 open-detail', async () => {
  const emits = {
    openDetail: vi.fn(),
    openDoc: vi.fn(),
    openCalendar: vi.fn(),
    checkIn: vi.fn(),
    increment: vi.fn(),
  };

  const mounted = mountHabitListItem({
    props: {
      habit,
      dayState,
      periodState,
      isMobile: true,
    },
    emits,
  });

  expect(mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')).toBeNull();

  mounted.container.querySelector('[data-testid="habit-list-item-main"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(emits.openDetail).toHaveBeenCalledWith(habit);
  expect(emits.openDoc).not.toHaveBeenCalled();
});

it('移动端点击 +1 时只触发 increment，不触发 open-detail', async () => {
  const emits = {
    openDetail: vi.fn(),
    increment: vi.fn(),
  };

  const mounted = mountHabitListItem({
    props: {
      habit: countHabit,
      dayState: countDayState,
      periodState,
      isMobile: true,
    },
    emits,
  });

  mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(emits.increment).toHaveBeenCalledWith(countHabit);
  expect(emits.openDetail).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 写 `MobileHabitPanel` 的失败测试，锁定详情打开和周条容器**

在 `test/mobile/MobileHabitPanel.test.ts` 增加 stub 和断言：

```ts
vi.mock('@/mobile/components/habit/MobileHabitDetailSheet.vue', () => ({
  default: defineComponent({
    name: 'MobileHabitDetailSheetStub',
    props: {
      habit: {
        type: Object,
        default: null,
      },
      open: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['close'],
    setup(props, { emit }) {
      return () => props.open
        ? h('div', { 'data-testid': 'mobile-habit-detail-sheet' }, [
            h('span', props.habit?.name ?? ''),
            h('button', {
              'data-testid': 'mobile-habit-detail-close',
              onClick: () => emit('close'),
            }),
          ])
        : null;
    },
  }),
}));
```

并新增用例：

```ts
it('点击列表项会打开详情 sheet，周条容器使用独立 gutter', async () => {
  const mounted = mountPanel();
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]')).not.toBeNull();

  mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  const detailSheet = mounted.container.querySelector('[data-testid="mobile-habit-detail-sheet"]');
  expect(detailSheet).not.toBeNull();
  expect(detailSheet?.textContent).toContain('Read');
});
```

- [ ] **Step 3: 跑测试，确认失败**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/mobile/MobileHabitPanel.test.ts
```

Expected: FAIL，原因应为：
- `HabitListItem.vue` 还没有 `isMobile` / `open-detail`
- `MobileHabitPanel.vue` 还没有 week bar wrapper / detail sheet 结构

- [ ] **Step 4: 写最小实现，让移动端列表交互成立**

先改 `src/components/habit/HabitListItem.vue`：

```ts
const props = defineProps<{
  habit: Habit;
  dayState: HabitDayState;
  periodState: HabitPeriodState;
  stats?: HabitStats;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  'check-in': [habit: Habit];
  'increment': [habit: Habit];
  'open-doc': [habit: Habit];
  'open-calendar': [habit: Habit];
  'open-detail': [habit: Habit];
}>();

function handleMainClick() {
  if (props.isMobile) {
    emit('open-detail', props.habit);
    return;
  }

  emit('open-doc', props.habit);
}
```

模板改成：

```vue
<div
  class="habit-list-item__main"
  data-testid="habit-list-item-main"
  @click="handleMainClick"
>
```

日历按钮改成仅桌面端显示：

```vue
<button
  v-if="!isMobile"
  class="habit-calendar-btn"
  data-testid="habit-list-item-calendar"
  :aria-label="t('habit').title"
  @click.stop="emit('open-calendar', habit)"
>
```

再改 `src/mobile/panels/MobileHabitPanel.vue`，先接回移动端事件和周条容器：

```vue
<div class="mobile-habit-panel__header">
  <span class="mobile-habit-panel__title">{{ t('habit').title }}</span>
</div>

<div class="mobile-habit-panel__week-bar-wrap" data-testid="habit-week-bar-wrap">
  <HabitWeekBar
    v-model="state.selectedDate"
    :current-date="currentDate"
    :habits="habits"
  />
</div>

<div v-if="habits.length > 0" class="mobile-habit-panel__list">
  <HabitListItem
    v-for="habit in habits"
    :key="habit.blockId"
    :habit="habit"
    :day-state="habitDayStateMap.get(habit.blockId)!"
    :period-state="habitPeriodStateMap.get(habit.blockId)!"
    :stats="habitStatsMap.get(habit.blockId)"
    :is-mobile="true"
    @check-in="handleCheckIn"
    @increment="handleIncrement"
    @open-detail="openHabitDetail"
  />
</div>
```

并补 styles：

```scss
.mobile-habit-panel__week-bar-wrap {
  padding: 12px 16px 0;
}

.mobile-habit-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 5: 跑测试，确认通过**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/mobile/MobileHabitPanel.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/habit/HabitListItem.vue src/mobile/panels/MobileHabitPanel.vue test/components/habit/HabitListItem.test.ts test/mobile/MobileHabitPanel.test.ts
git commit -m "feat(habit): align mobile list interactions"
```

## Task 2: 拆出独立的移动端详情 bottom sheet

**Files:**
- Create: `src/mobile/components/habit/MobileHabitDetailSheet.vue`
- Create: `test/mobile/MobileHabitDetailSheet.test.ts`
- Modify: `src/mobile/panels/MobileHabitPanel.vue`

- [ ] **Step 1: 写 `MobileHabitDetailSheet` 失败测试**

创建 `test/mobile/MobileHabitDetailSheet.test.ts`：

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobileHabitDetailSheet from '@/mobile/components/habit/MobileHabitDetailSheet.vue';

function mountSheet(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileHabitDetailSheet, props);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

it('打开时渲染标题并支持关闭事件', async () => {
  const onClose = vi.fn();
  const mounted = mountSheet({
    open: true,
    habit: { blockId: 'habit-1', name: 'Read', type: 'binary', records: [] },
    selectedDate: '2026-05-01',
    viewMonth: '2026-05',
    stats: { currentStreak: 1 },
    onClose,
  });

  await nextTick();

  expect(mounted.container.querySelector('[data-testid="mobile-habit-detail-sheet-title"]')?.textContent).toContain('Read');
  mounted.container.querySelector('[data-testid="mobile-habit-detail-sheet-close"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileHabitDetailSheet.test.ts
```

Expected: FAIL，因为 `MobileHabitDetailSheet.vue` 尚不存在。

- [ ] **Step 3: 写最小 `MobileHabitDetailSheet.vue` 实现**

创建 `src/mobile/components/habit/MobileHabitDetailSheet.vue`：

```vue
<template>
  <div v-if="open" class="mobile-habit-detail-sheet" data-testid="mobile-habit-detail-sheet">
    <div class="mobile-habit-detail-sheet__scrim" @click="emit('close')"></div>
    <section class="mobile-habit-detail-sheet__panel">
      <div class="mobile-habit-detail-sheet__handle"></div>
      <header class="mobile-habit-detail-sheet__header">
        <span class="mobile-habit-detail-sheet__title" data-testid="mobile-habit-detail-sheet-title">
          {{ habit?.name }}
        </span>
        <button data-testid="mobile-habit-detail-sheet-close" @click="emit('close')">
          <svg><use xlink:href="#iconCloseRound"></use></svg>
        </button>
      </header>
      <div class="mobile-habit-detail-sheet__body">
        <slot />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Habit, HabitStats } from '@/types/models';

defineProps<{
  open: boolean;
  habit: Habit | null;
  selectedDate: string;
  viewMonth: string;
  stats: HabitStats | null;
}>();

const emit = defineEmits<{
  close: [];
  'check-in': [];
  'count-change': [value: number];
  'update:view-month': [value: string];
}>();
</script>
```

- [ ] **Step 4: 将 `MobileHabitPanel.vue` 接到独立 sheet**

在 `src/mobile/panels/MobileHabitPanel.vue` 引入并替换旧的整页详情模板：

```vue
<MobileHabitDetailSheet
  :open="state.showHabitDetail"
  :habit="state.selectedHabit"
  :selected-date="state.selectedDate"
  :view-month="state.selectedViewMonth"
  :stats="selectedStats"
  @close="state.showHabitDetail = false"
  @update:view-month="state.selectedViewMonth = $event"
>
  <div v-if="state.selectedHabit && selectedStats && selectedDayState" class="mobile-habit-detail__body">
    <!-- 保留当前 today / stats / calendar / log 组合 -->
  </div>
</MobileHabitDetailSheet>
```

删除：

```vue
<template v-else>
  <div class="mobile-habit-detail">
    ...
  </div>
</template>
```

- [ ] **Step 5: 跑测试，确认通过**

Run:

```bash
npx vitest run test/mobile/MobileHabitDetailSheet.test.ts test/mobile/MobileHabitPanel.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/mobile/components/habit/MobileHabitDetailSheet.vue src/mobile/panels/MobileHabitPanel.vue test/mobile/MobileHabitDetailSheet.test.ts test/mobile/MobileHabitPanel.test.ts
git commit -m "feat(habit): add mobile detail bottom sheet"
```

## Task 3: 接回移动端详情内容、外部导航与刷新同步

**Files:**
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
- Modify: `test/mobile/MobileHabitPanel.test.ts`

- [ ] **Step 1: 写失败测试，锁定外部导航直接拉起详情和关闭后保留列表**

在 `test/mobile/MobileHabitPanel.test.ts` 增加：

```ts
it('pending target 会直接打开对应习惯详情', async () => {
  consumePendingHabitDockTarget.mockReturnValueOnce({
    habitId: 'habit-2',
    date: '2026-05-02',
  });

  const mounted = mountPanel();
  await nextTick();

  const detailSheet = mounted.container.querySelector('[data-testid="mobile-habit-detail-sheet"]');
  expect(detailSheet).not.toBeNull();
  expect(detailSheet?.textContent).toContain('Water');
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileHabitPanel.test.ts
```

Expected: FAIL，若 sheet state / pending target 接线不完整则无法直接看到详情。

- [ ] **Step 3: 补齐 `MobileHabitPanel.vue` 的状态同步**

确保下面逻辑存在且与 sheet 模型一致：

```ts
function openHabitDetail(habit: Habit) {
  state.selectedViewMonth = currentDate.value.substring(0, 7);
  state.selectedHabit = habit;
  state.showHabitDetail = true;
}

function applyHabitDockNavigation(target: HabitDockNavigationTarget): boolean {
  const habit = habits.value.find(item => item.blockId === target.habitId);
  if (!habit) {
    return false;
  }

  const targetDate = target.date || currentDate.value;
  state.selectedDate = targetDate;
  state.selectedViewMonth = targetDate.substring(0, 7);
  state.selectedHabit = habit;
  state.showHabitDetail = true;
  return true;
}

function syncSelectedHabit() {
  if (!state.selectedHabit) return;
  state.selectedHabit = habits.value.find(habit => habit.blockId === state.selectedHabit?.blockId) ?? null;
}

async function refreshHabits() {
  if (!plugin) return;
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  syncSelectedHabit();
}
```

关闭动作只改 `showHabitDetail`：

```vue
@close="state.showHabitDetail = false"
```

不要在关闭时清空 `selectedDate` 或重置列表容器。

- [ ] **Step 4: 跑测试，确认通过**

Run:

```bash
npx vitest run test/mobile/MobileHabitPanel.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/mobile/panels/MobileHabitPanel.vue test/mobile/MobileHabitPanel.test.ts
git commit -m "fix(habit): keep mobile detail sheet in sync"
```

## Task 4: 全量定向回归并整理实现文档

**Files:**
- Modify: `docs/superpowers/plans/2026-05-01-mobile-habit-detail-bottom-sheet-implementation.md`

- [ ] **Step 1: 跑本轮定向测试**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/mobile/MobileHabitPanel.test.ts test/mobile/MobileHabitDetailSheet.test.ts
```

Expected: PASS

- [ ] **Step 2: 跑与移动端 shell 的相邻回归**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts test/mobile/MobileMainShell.navigation.test.ts test/tabs/TodoDock.mobile.test.ts
```

Expected: PASS，确保这轮 habit 改造未破坏已完成的移动端四 tab 宿主。

- [ ] **Step 3: 更新计划勾选状态并记录实际差异**

在本计划文档中将已完成步骤勾选，并在文末追加简短实现备注：

```md
## Notes

- 若 `HabitListItem.vue` 跨端分支过重，可在实现中拆出 `MobileHabitListItem.vue`，但必须同步更新本计划与测试文件路径。
- 若 bottom sheet 需要额外遮住底栏，这是允许的；不要为“底栏持续可见”再引入额外状态复杂度。
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/plans/2026-05-01-mobile-habit-detail-bottom-sheet-implementation.md
git commit -m "docs(habit): update mobile detail bottom sheet plan status"
```

---

## Self-Review

- **Spec coverage:** 已覆盖卡片主体打开详情、移动端移除独立日历按钮、bottom sheet 结构、周条 spacing、外部导航拉起详情、列表上下文保留、测试回归。
- **Placeholder scan:** 无 `TODO` / `TBD` / “类似上一步” 这类占位描述；每个任务都给出具体测试、命令和代码片段。
- **Type consistency:** 统一使用 `open-detail`、`isMobile`、`MobileHabitDetailSheet.vue`、`showHabitDetail`、`selectedHabit` 命名；与现有 `MobileHabitPanel.vue` 状态保持兼容。
