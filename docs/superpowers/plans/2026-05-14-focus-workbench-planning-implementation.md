# Focus Workbench Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前“专注复盘”页内接入事项预计设置入口，补齐计划环节，并将页面命名升级为“专注工作台”。

**Architecture:** 先把“过期事项 + 当前日期事项”的候选筛选与排序收敛到独立工具函数，避免把业务规则直接散落在组件里。再新增一个轻量事项选择弹层，通过 `showFocusPlanDialog(item)` 复用已有 `/yj` 预计弹窗，最后将入口分别接到右侧 `ItemActionBar` 和左侧 `FocusReviewView`，并统一更新 i18n 命名与现有跳转文案。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + 现有 SiYuan Dialog / itemSetting / focusPlan 体系

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/focusPlanWorkbench.ts` | 新建 | 选择候选事项、分组、排序、过滤无效事项 |
| `src/components/dialog/FocusPlanItemPickerDialog.vue` | 新建 | 选择事项后再进入预计编辑器的轻量面板 |
| `src/utils/dialog.ts` | 修改 | 新增打开事项选择面板的封装函数 |
| `src/components/todo/ItemActionBar.vue` | 修改 | 增加“设置/修改预计”按钮并复用 `showFocusPlanDialog` |
| `src/components/pomodoro/review/FocusReviewView.vue` | 修改 | 左侧新增“添加预计”入口与空态承接，接入候选选择面板 |
| `src/tabs/FocusReviewTab.vue` | 修改 | 页面标题跟随命名调整 |
| `src/components/pomodoro/PomodoroStats.vue` | 修改 | 跳转入口文案从“查看专注复盘”改到“打开专注工作台” |
| `src/i18n/zh_CN.json` | 修改 | 新增计划入口、候选分组、命名调整文案 |
| `src/i18n/en_US.json` | 修改 | 同步英文文案 |
| `test/utils/focusPlanWorkbench.test.ts` | 新建 | 候选事项过滤、分组、排序测试 |
| `test/components/todo/ItemActionBar.test.ts` | 新建 | 预计按钮显示与点击行为测试 |
| `test/components/pomodoro/FocusReviewView.test.ts` | 修改 | 左侧入口、空态入口、命名与交互测试 |
| `test/components/pomodoro/PomodoroStats.test.ts` | 修改 | 跳转文案更新测试 |

---

## Task 1: 抽离候选事项筛选与排序规则

**Files:**
- Create: `src/utils/focusPlanWorkbench.ts`
- Test: `test/utils/focusPlanWorkbench.test.ts`

- [ ] **Step 1: 先写候选事项工具测试**

```ts
// test/utils/focusPlanWorkbench.test.ts
import { describe, expect, it } from 'vitest';
import { buildFocusPlanCandidateSections } from '@/utils/focusPlanWorkbench';
import type { Item } from '@/types/models';

function createItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    status: partial.status || 'pending',
    date: partial.date || '2026-05-14',
    blockId: partial.blockId || 'block',
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    focusPlan: partial.focusPlan,
    pomodoros: partial.pomodoros || [],
  } as Item;
}

describe('buildFocusPlanCandidateSections', () => {
  it('只返回过期事项和所选日期事项，并过滤完成、放弃、无 blockId 事项', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({ id: 'expired-1', date: '2026-05-13', content: '过期 A' }),
        createItem({ id: 'selected-1', date: '2026-05-14', content: '当天 A' }),
        createItem({ id: 'done-1', date: '2026-05-14', status: 'completed', content: '完成事项' }),
        createItem({ id: 'abandoned-1', date: '2026-05-12', status: 'abandoned', content: '放弃事项' }),
        createItem({ id: 'invalid-1', date: '2026-05-13', blockId: '', content: '无块事项' }),
        createItem({ id: 'other-1', date: '2026-05-16', content: '其他日期' }),
      ],
      selectedDate: '2026-05-14',
    });

    expect(sections).toEqual([
      expect.objectContaining({
        key: 'expired',
        items: [expect.objectContaining({ id: 'expired-1' })],
      }),
      expect.objectContaining({
        key: 'selected-date',
        items: [expect.objectContaining({ id: 'selected-1' })],
      }),
    ]);
  });

  it('过期事项按日期升序，同日内按开始时间排序，无时间排后', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({ id: 'a', date: '2026-05-12', startDateTime: '2026-05-12 12:00', content: 'A' }),
        createItem({ id: 'b', date: '2026-05-12', startDateTime: '2026-05-12 09:00', content: 'B' }),
        createItem({ id: 'c', date: '2026-05-11', content: 'C' }),
      ],
      selectedDate: '2026-05-14',
    });

    expect(sections[0].items.map(item => item.id)).toEqual(['c', 'b', 'a']);
  });
});
```

- [ ] **Step 2: 运行测试，确认模块缺失而失败**

Run: `npx vitest run test/utils/focusPlanWorkbench.test.ts`  
Expected: FAIL，提示找不到 `@/utils/focusPlanWorkbench`

- [ ] **Step 3: 实现候选事项工具函数**

```ts
// src/utils/focusPlanWorkbench.ts
import type { Item } from '@/types/models';

export interface FocusPlanCandidateSection {
  key: 'expired' | 'selected-date';
  items: Item[];
}

export function buildFocusPlanCandidateSections(input: {
  items: Item[];
  selectedDate: string;
}): FocusPlanCandidateSection[] {
  const { items, selectedDate } = input;

  const validItems = items.filter(item => item.blockId && item.status !== 'completed' && item.status !== 'abandoned');

  const expiredItems = validItems
    .filter(item => item.date && item.date < selectedDate)
    .sort(compareCandidateItems);

  const selectedDateItems = validItems
    .filter(item => item.date === selectedDate)
    .sort(compareCandidateItems);

  return [
    expiredItems.length ? { key: 'expired', items: expiredItems } : null,
    selectedDateItems.length ? { key: 'selected-date', items: selectedDateItems } : null,
  ].filter(Boolean) as FocusPlanCandidateSection[];
}

function compareCandidateItems(a: Item, b: Item): number {
  if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
  const aTime = a.startDateTime || '9999-99-99 99:99';
  const bTime = b.startDateTime || '9999-99-99 99:99';
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return (a.content || '').localeCompare(b.content || '');
}
```

- [ ] **Step 4: 跑工具测试确认通过**

Run: `npx vitest run test/utils/focusPlanWorkbench.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/focusPlanWorkbench.ts test/utils/focusPlanWorkbench.test.ts
git commit -m "feat(focus-workbench): add candidate selection rules"
```

---

## Task 2: 新增事项选择弹层并接入对话框工具

**Files:**
- Create: `src/components/dialog/FocusPlanItemPickerDialog.vue`
- Modify: `src/utils/dialog.ts`
- Test: `test/components/pomodoro/FocusReviewView.test.ts`

- [ ] **Step 1: 先扩展复盘视图测试，锁定“添加预计”入口**

```ts
// test/components/pomodoro/FocusReviewView.test.ts
const mockShowFocusPlanItemPickerDialog = vi.fn();

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
  showFocusPlanItemPickerDialog: mockShowFocusPlanItemPickerDialog,
}));

it('shows add-focus-plan entry and opens candidate picker from the sidebar', async () => {
  const mounted = await mountComponent();

  expect(mounted.container.textContent).toContain('添加预计');

  (mounted.container.querySelector('[data-testid="focus-review-add-plan"]') as HTMLButtonElement).click();
  await nextTick();

  expect(mockShowFocusPlanItemPickerDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      selectedDate: '2026-05-14',
    }),
  );

  mounted.unmount();
});
```

- [ ] **Step 2: 运行视图测试，确认新入口尚未实现**

Run: `npx vitest run test/components/pomodoro/FocusReviewView.test.ts`  
Expected: FAIL，找不到 `focus-review-add-plan` 或 `showFocusPlanItemPickerDialog` 未被调用

- [ ] **Step 3: 实现事项选择组件**

```vue
<!-- src/components/dialog/FocusPlanItemPickerDialog.vue -->
<template>
  <div class="focus-plan-item-picker">
    <div
      v-for="section in sections"
      :key="section.key"
      class="focus-plan-item-picker__section"
    >
      <div class="focus-plan-item-picker__section-title">
        {{ section.key === 'expired' ? t('focusReview').expiredItems : selectedDateTitle }}
      </div>

      <button
        v-for="item in section.items"
        :key="item.id"
        class="focus-plan-item-picker__item"
        type="button"
        @click="emit('select', item)"
      >
        <div class="focus-plan-item-picker__item-title">{{ item.content }}</div>
        <div class="focus-plan-item-picker__item-meta">
          <span>{{ item.task?.name || item.project?.name || t('todo').detail }}</span>
          <span>{{ item.date }}</span>
          <span v-if="item.focusPlan">{{ t('focusPlan').estimatedShort }} {{ formatFocusPlanDisplay(item.focusPlan) }}</span>
        </div>
      </button>
    </div>

    <div v-if="sections.length === 0" class="focus-plan-item-picker__empty">
      {{ t('focusReview').pickerEmpty }}
    </div>
  </div>
</template>
```

- [ ] **Step 4: 在对话框工具层新增打开函数，并复用已有 `showFocusPlanDialog`**

```ts
// src/utils/dialog.ts
import FocusPlanItemPickerDialog from '@/components/dialog/FocusPlanItemPickerDialog.vue';
import { buildFocusPlanCandidateSections } from '@/utils/focusPlanWorkbench';

export function showFocusPlanItemPickerDialog(input: {
  items: Item[];
  selectedDate: string;
  onSelected?: (item: Item) => void;
}): Dialog {
  const sections = buildFocusPlanCandidateSections({
    items: input.items,
    selectedDate: input.selectedDate,
  });

  const container = document.createElement('div');
  const app = createApp(FocusPlanItemPickerDialog, {
    sections,
    selectedDate: input.selectedDate,
    onSelect: (item: Item) => {
      dialog.destroy();
      input.onSelected?.(item);
      showFocusPlanDialog(item);
    },
    onCancel: () => dialog.destroy(),
  });

  app.use(getSharedPinia());
  app.mount(container);

  const dialog = new Dialog({
    title: t('focusPlan').settingTitle,
    content: '',
    width: '420px',
    destroyCallback: () => app.unmount(),
  });

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(container);
  return dialog;
}
```

- [ ] **Step 5: 在复盘页接入左侧入口**

```ts
// src/components/pomodoro/review/FocusReviewView.vue
import { showFocusPlanItemPickerDialog } from '@/utils/dialog';

function handleAddFocusPlan() {
  showFocusPlanItemPickerDialog({
    items: projectStore.items,
    selectedDate: selectedDate.value,
  });
}
```

```vue
<button
  class="focus-review-view__toolbar-button"
  data-testid="focus-review-add-plan"
  type="button"
  @click="handleAddFocusPlan"
>
  {{ t('focusReview').addPlan }}
</button>
```

- [ ] **Step 6: 跑复盘视图测试确认通过**

Run: `npx vitest run test/components/pomodoro/FocusReviewView.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/dialog/FocusPlanItemPickerDialog.vue src/utils/dialog.ts src/components/pomodoro/review/FocusReviewView.vue test/components/pomodoro/FocusReviewView.test.ts
git commit -m "feat(focus-workbench): add sidebar focus-plan picker"
```

---

## Task 3: 在事项操作栏增加“设置/修改预计”动作

**Files:**
- Modify: `src/components/todo/ItemActionBar.vue`
- Test: `test/components/todo/ItemActionBar.test.ts`

- [ ] **Step 1: 先写操作栏测试**

```ts
// test/components/todo/ItemActionBar.test.ts
import { createApp, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';

const mockShowFocusPlanDialog = vi.fn();

vi.mock('@/utils/dialog', () => ({
  hideIconTooltip: vi.fn(),
  showIconTooltip: vi.fn(),
  showPomodoroTimerDialog: vi.fn(),
  showFocusPlanDialog: mockShowFocusPlanDialog,
}));

it('shows set-focus-plan action and opens dialog for the current item', async () => {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue');
  const container = document.createElement('div');
  const app = createApp(ItemActionBar, {
    item: {
      id: 'item-1',
      blockId: 'block-1',
      content: '整理日报',
      date: '2026-05-14',
      status: 'pending',
    },
  });

  app.mount(container);
  await nextTick();

  const buttons = [...container.querySelectorAll('.block__icon')];
  const planButton = buttons.find(node => node.getAttribute('aria-label') === '设置预计');
  expect(planButton).toBeTruthy();

  (planButton as HTMLElement).click();
  expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'item-1' }),
  );

  app.unmount();
});
```

- [ ] **Step 2: 运行操作栏测试，确认按钮缺失**

Run: `npx vitest run test/components/todo/ItemActionBar.test.ts`  
Expected: FAIL，找不到 `设置预计` 动作

- [ ] **Step 3: 为操作栏增加预计动作**

```ts
// src/components/todo/ItemActionBar.vue
import { hideIconTooltip, showFocusPlanDialog, showIconTooltip, showPomodoroTimerDialog } from '@/utils/dialog';

const focusPlanLabel = computed(() => {
  return props.item?.focusPlan
    ? t('focusPlan').editAction
    : t('focusPlan').setAction;
});

const canSetFocusPlan = computed(() => {
  return !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned';
});

function handleFocusPlan() {
  if (!props.item || isProcessing.value) return;
  showFocusPlanDialog(props.item);
}
```

```vue
<span
  v-if="canSetFocusPlan"
  class="block__icon"
  :aria-label="focusPlanLabel"
  @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleFocusPlan"
>
  <svg><use xlink:href="#iconAttr"></use></svg>
</span>
```

- [ ] **Step 4: 跑操作栏测试确认通过**

Run: `npx vitest run test/components/todo/ItemActionBar.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/todo/ItemActionBar.vue test/components/todo/ItemActionBar.test.ts
git commit -m "feat(focus-workbench): add focus-plan action to item toolbar"
```

---

## Task 4: 收口复盘页空态、命名与跳转文案

**Files:**
- Modify: `src/components/pomodoro/review/FocusReviewView.vue`
- Modify: `src/tabs/FocusReviewTab.vue`
- Modify: `src/components/pomodoro/PomodoroStats.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `test/components/pomodoro/FocusReviewView.test.ts`
- Modify: `test/components/pomodoro/PomodoroStats.test.ts`

- [ ] **Step 1: 先补命名与空态测试**

```ts
// test/components/pomodoro/PomodoroStats.test.ts
expect(mounted.container.textContent).toContain('打开专注工作台');

// test/components/pomodoro/FocusReviewView.test.ts
expect(mounted.container.textContent).toContain('专注工作台');
expect(mounted.container.textContent).toContain('还没有预计事项');
expect(mounted.container.textContent).toContain('为事项设置预计');
```

- [ ] **Step 2: 运行相关测试，确认文案尚未更新**

Run: `npx vitest run test/components/pomodoro/FocusReviewView.test.ts test/components/pomodoro/PomodoroStats.test.ts`  
Expected: FAIL，仍为“专注复盘”与旧空态文案

- [ ] **Step 3: 更新 i18n 与页面标题**

```json
// src/i18n/zh_CN.json
"focusPlan": {
  "setAction": "设置预计",
  "editAction": "修改预计"
},
"focusReview": {
  "title": "专注工作台",
  "openReview": "打开专注工作台",
  "addPlan": "添加预计",
  "expiredItems": "过期事项",
  "pickerEmpty": "没有可设置预计的事项",
  "emptyTitle": "还没有预计事项",
  "emptyDesc": "为过期事项或当前日期事项设置预计后，这里会显示专注复盘。",
  "emptyAction": "为事项设置预计"
}
```

```vue
<!-- src/tabs/FocusReviewTab.vue -->
<h2 class="focus-review-tab__title">{{ t('focusReview').title }}</h2>
```

```vue
<!-- src/components/pomodoro/PomodoroStats.vue -->
<span class="stat-card__action-icon" :aria-label="t('focusReview').openReview">
```

- [ ] **Step 4: 把空态入口也接到同一个事项选择面板**

```vue
<!-- src/components/pomodoro/review/FocusReviewView.vue -->
<button
  v-if="filteredEntries.length === 0"
  class="focus-review-view__empty-action"
  type="button"
  @click="handleAddFocusPlan"
>
  {{ t('focusReview').emptyAction }}
</button>
```

- [ ] **Step 5: 跑完整相关测试确认通过**

Run: `npx vitest run test/utils/focusPlanWorkbench.test.ts test/components/todo/ItemActionBar.test.ts test/components/pomodoro/FocusReviewView.test.ts test/components/pomodoro/PomodoroStats.test.ts`  
Expected: PASS

- [ ] **Step 6: 运行现有专注相关回归测试**

Run: `npx vitest run test/components/workbench/WorkbenchViewHost.test.ts test/components/pomodoro/PomodoroFocusPlanUI.test.ts test/utils/slashCommands.focusPlan.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/pomodoro/review/FocusReviewView.vue src/tabs/FocusReviewTab.vue src/components/pomodoro/PomodoroStats.vue src/i18n/zh_CN.json src/i18n/en_US.json test/components/pomodoro/FocusReviewView.test.ts test/components/pomodoro/PomodoroStats.test.ts
git commit -m "feat(focus-workbench): complete planning flow and rename review page"
```

---

## Self-Review

- Spec coverage: 已覆盖左侧添加预计、候选范围、右侧修改预计、空态承接、图标选择、命名调整、刷新反馈与基础异常前置过滤。
- Placeholder scan: 计划中未保留 TBD / TODO / “自行处理” 之类空指令。
- Type consistency: 统一使用 `showFocusPlanDialog` 作为已有预计弹窗入口，新增候选选择入口统一命名为 `showFocusPlanItemPickerDialog`，避免与现有 `/yj` 调用链混淆。
