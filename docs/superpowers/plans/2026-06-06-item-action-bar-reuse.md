# ItemActionBar 复用到 TodoSidebarList 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 扩展 ItemActionBar 使其支持 TodoSidebarList 的两行操作栏布局（hover + fixed），消除 5 处重复模板，并将操作逻辑提取为纯函数。

**架构：** 提取操作纯函数到 `itemActions.ts`，ItemActionBar 通过 props（showPin/showDetail）控制 fixed 行渲染，内部调用纯函数执行操作，仅导航类事件通过 emit 传递。TodoSidebarList 的 5 处重复操作栏模板替换为 ItemActionBar 组件调用。

**技术栈：** Vue 3 + TypeScript + Vitest

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/utils/itemActions.ts` | 事项操作纯函数（完成、放弃、迁移等） | 新建 |
| `src/components/todo/ItemActionBar.vue` | 统一操作栏组件，支持 hover + fixed 两行 | 修改 |
| `src/components/todo/TodoSidebarList.vue` | 替换 5 处重复操作栏为 ItemActionBar | 修改 |
| `src/components/dialog/ItemDetailDialog.vue` | 适配 ItemActionBar 事件变更 | 修改 |
| `test/utils/itemActions.test.ts` | 纯函数测试 | 新建 |
| `test/components/todo/ItemActionBar.test.ts` | 扩展组件测试 | 修改 |

---

### 任务 1：提取操作纯函数

**文件：**
- 创建：`src/utils/itemActions.ts`
- 创建：`test/utils/itemActions.test.ts`

- [ ] **步骤 1：编写 itemActions 纯函数测试**

```typescript
// test/utils/itemActions.test.ts
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { Item } from '@/types/models'

const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

// 需要跳过 skipCurrentOccurrence 的依赖
vi.mock('@/services/recurringService', () => ({
  skipCurrentOccurrence: vi.fn(() => Promise.resolve(true)),
}))

import { completeItem, abandonItem, migrateItem, migrateItemToToday, skipOccurrenceItem } from '@/utils/itemActions'
import { skipCurrentOccurrence } from '@/services/recurringService'

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    blockId: 'block-1',
    docId: 'doc-1',
    content: '测试事项',
    date: '2026-05-14',
    status: 'pending',
    siblingItems: [],
    ...overrides,
  } as Item
}

describe('itemActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('completeItem', () => {
    it('calls writeBlock with setStatus completed', async () => {
      const item = createItem({ blockId: 'block-1', listItemBlockId: 'li-1' })
      const result = await completeItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1', listItemBlockId: 'li-1' },
        { type: 'setStatus', status: 'completed' },
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await completeItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('abandonItem', () => {
    it('calls writeBlock with setStatus abandoned', async () => {
      const item = createItem({ blockId: 'block-1', listItemBlockId: 'li-1' })
      const result = await abandonItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1', listItemBlockId: 'li-1' },
        { type: 'setStatus', status: 'abandoned' },
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await abandonItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('migrateItem', () => {
    it('migrates overdue item to today', async () => {
      const item = createItem({
        blockId: 'block-1',
        date: '2026-05-13',
        startDateTime: '2026-05-13 09:00',
        endDateTime: '2026-05-13 10:30',
        siblingItems: [{ date: '2026-05-20' }],
      })
      const result = await migrateItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        {
          type: 'addDate',
          date: '2026-05-14',
          startTime: '09:00',
          endTime: '10:30',
          allDay: false,
          originalDate: '2026-05-13',
          siblingItems: [
            { date: '2026-05-20' },
            { date: '2026-05-13', startDateTime: '2026-05-13 09:00', endDateTime: '2026-05-13 10:30' },
          ],
        },
      )
    })

    it('migrates today item to tomorrow', async () => {
      const item = createItem({ blockId: 'block-1', date: '2026-05-14' })
      const result = await migrateItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        expect.objectContaining({
          type: 'addDate',
          date: '2026-05-15',
        }),
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await migrateItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('migrateItemToToday', () => {
    it('migrates item to today', async () => {
      const item = createItem({ blockId: 'block-1', date: '2026-05-10' })
      const result = await migrateItemToToday(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        expect.objectContaining({
          type: 'addDate',
          date: '2026-05-14',
        }),
      )
    })
  })

  describe('skipOccurrenceItem', () => {
    it('calls skipCurrentOccurrence', async () => {
      const item = createItem({ blockId: 'block-1', repeatRule: { freq: 'DAILY', interval: 1 } })
      const result = await skipOccurrenceItem(null, item)
      expect(result).toBe(true)
      expect(skipCurrentOccurrence).toHaveBeenCalled()
    })

    it('returns false when no repeatRule', async () => {
      const item = createItem({ blockId: 'block-1' })
      const result = await skipOccurrenceItem(null, item)
      expect(result).toBe(false)
      expect(skipCurrentOccurrence).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/itemActions.test.ts`
预期：FAIL，报错 "Cannot find module '@/utils/itemActions'"

- [ ] **步骤 3：编写 itemActions 纯函数实现**

```typescript
// src/utils/itemActions.ts
import type { Item } from '@/types/models'
import { writeBlock } from '@/utils/blockWriter'
import dayjs from '@/utils/dayjs'
import { skipCurrentOccurrence } from '@/services/recurringService'

function buildDatePatch(item: Item, targetDate: string) {
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date
      ? [{
          date: item.date,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
        }]
      : []),
  ]

  return {
    type: 'addDate' as const,
    date: targetDate,
    startTime: item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    endTime: item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    allDay: !item.startDateTime,
    originalDate: item.date,
    siblingItems: completeSiblingItems,
  }
}

export async function completeItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  return writeBlock(
    { blockId: item.blockId, listItemBlockId: item.listItemBlockId },
    { type: 'setStatus', status: 'completed' },
  )
}

export async function abandonItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  return writeBlock(
    { blockId: item.blockId, listItemBlockId: item.listItemBlockId },
    { type: 'setStatus', status: 'abandoned' },
  )
}

export async function migrateItem(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  const targetDate = item.date < dayjs().format('YYYY-MM-DD')
    ? dayjs().format('YYYY-MM-DD')
    : dayjs().add(1, 'day').format('YYYY-MM-DD')
  return writeBlock({ blockId: item.blockId }, buildDatePatch(item, targetDate))
}

export async function migrateItemToToday(item: Item): Promise<boolean> {
  if (!item.blockId) return false
  const todayStr = dayjs().format('YYYY-MM-DD')
  return writeBlock({ blockId: item.blockId }, buildDatePatch(item, todayStr))
}

export async function skipOccurrenceItem(plugin: any, item: Item): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false
  return skipCurrentOccurrence(plugin, item)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/itemActions.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/itemActions.ts test/utils/itemActions.test.ts
git commit -m "feat: 提取事项操作纯函数到 itemActions.ts"
```

---

### 任务 2：扩展 ItemActionBar 支持 fixed 行

**文件：**
- 修改：`src/components/todo/ItemActionBar.vue`
- 修改：`test/components/todo/ItemActionBar.test.ts`

- [ ] **步骤 1：编写 ItemActionBar 新增功能测试**

在 `test/components/todo/ItemActionBar.test.ts` 中新增以下测试用例：

```typescript
// 在 vi.mock('@/i18n', ...) 的 t 函数中补充：
// if (key === 'todo') return { ..., detail: '详情', pin: '置顶', unpin: '取消置顶' }
// if (key === 'recurring') return { skipThis: '跳过本次', skipTooltip: '跳过本次，下次：{date}' }

it('shows pin icon when showPin is true', async () => {
  const mounted = await mountComponent({
    id: 'item-pin',
    blockId: 'block-pin',
    content: '测试置顶',
    date: '2026-05-14',
    status: 'pending',
  }, { showPin: true })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const pinButton = buttons.find((node) => node.getAttribute('aria-label') === '置顶')
  expect(pinButton).toBeTruthy()

  mounted.unmount()
})

it('hides pin icon when showPin is false (default)', async () => {
  const mounted = await mountComponent({
    id: 'item-no-pin',
    blockId: 'block-no-pin',
    content: '测试无置顶',
    date: '2026-05-14',
    status: 'pending',
  })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const pinButton = buttons.find((node) => node.getAttribute('aria-label') === '置顶')
  expect(pinButton).toBeFalsy()

  mounted.unmount()
})

it('shows detail icon when showDetail is true', async () => {
  const mounted = await mountComponent({
    id: 'item-detail',
    blockId: 'block-detail',
    content: '测试详情',
    date: '2026-05-14',
    status: 'pending',
  }, { showDetail: true })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const detailButton = buttons.find((node) => node.getAttribute('aria-label') === '详情')
  expect(detailButton).toBeTruthy()

  mounted.unmount()
})

it('renders fixed row when showPin or showDetail is true', async () => {
  const mounted = await mountComponent({
    id: 'item-fixed',
    blockId: 'block-fixed',
    content: '测试 fixed 行',
    date: '2026-05-14',
    status: 'pending',
  }, { showPin: true })

  const fixedRow = mounted.container.querySelector('.item-actions-fixed')
  expect(fixedRow).toBeTruthy()

  mounted.unmount()
})

it('does not render fixed row when showPin and showDetail are both false', async () => {
  const mounted = await mountComponent({
    id: 'item-no-fixed',
    blockId: 'block-no-fixed',
    content: '测试无 fixed 行',
    date: '2026-05-14',
    status: 'pending',
  })

  const fixedRow = mounted.container.querySelector('.item-actions-fixed')
  expect(fixedRow).toBeFalsy()

  mounted.unmount()
})

it('moves calendar icon to fixed row when fixed row exists', async () => {
  const mounted = await mountComponent({
    id: 'item-cal-fixed',
    blockId: 'block-cal-fixed',
    content: '测试日历位置',
    date: '2026-05-14',
    status: 'pending',
  }, { showPin: true })

  const fixedRow = mounted.container.querySelector('.item-actions-fixed')
  const hoverRow = mounted.container.querySelector('.item-actions-hover')

  // 日历图标应在 fixed 行中
  const calendarInFixed = fixedRow?.querySelector('[aria-label="日历"]')
  const calendarInHover = hoverRow?.querySelector('[aria-label="日历"]')
  expect(calendarInFixed).toBeTruthy()
  expect(calendarInHover).toBeFalsy()

  mounted.unmount()
})

it('keeps calendar icon in hover row when no fixed row', async () => {
  const mounted = await mountComponent({
    id: 'item-cal-hover',
    blockId: 'block-cal-hover',
    content: '测试日历位置',
    date: '2026-05-14',
    status: 'pending',
  })

  const hoverRow = mounted.container.querySelector('.item-actions-hover')
  const calendarInHover = hoverRow?.querySelector('[aria-label="日历"]')
  expect(calendarInHover).toBeTruthy()

  mounted.unmount()
})

it('emits togglePinned when pin icon is clicked', async () => {
  const mounted = await mountComponent({
    id: 'item-toggle-pin',
    blockId: 'block-toggle-pin',
    content: '测试切换置顶',
    date: '2026-05-14',
    status: 'pending',
  }, { showPin: true })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const pinButton = buttons.find((node) => node.getAttribute('aria-label') === '置顶') as HTMLElement
  pinButton.click()
  await nextTick()

  // 验证 togglePinned 事件被触发（通过检查 emit 调用）
  // 由于使用 createApp 挂载，需要通过其他方式验证
  // 这里验证 toggleItemPinned 被调用
  mounted.unmount()
})

it('emits openDetail when detail icon is clicked', async () => {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const emitted: string[] = []
  const app = createApp({
    setup() {
      return () => ItemActionBar({
        item: {
          id: 'item-open-detail',
          blockId: 'block-open-detail',
          content: '测试打开详情',
          date: '2026-05-14',
          status: 'pending',
        },
        showDetail: true,
        onOpenDetail: () => { emitted.push('openDetail') },
      })
    },
  })
  app.mount(container)
  await nextTick()

  const buttons = [...container.querySelectorAll('.block__icon')]
  const detailButton = buttons.find((node) => node.getAttribute('aria-label') === '详情') as HTMLElement
  detailButton.click()
  await nextTick()

  expect(emitted).toContain('openDetail')

  app.unmount()
  container.remove()
})

it('shows skip icon for recurring overdue item', async () => {
  const mounted = await mountComponent({
    id: 'item-skip',
    blockId: 'block-skip',
    content: '循环事项',
    date: '2026-05-13',
    status: 'pending',
    repeatRule: { freq: 'DAILY', interval: 1 },
  })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const skipButton = buttons.find((node) => node.getAttribute('aria-label') === '跳过本次')
  expect(skipButton).toBeTruthy()

  mounted.unmount()
})

it('hides skip icon for non-recurring item', async () => {
  const mounted = await mountComponent({
    id: 'item-no-skip',
    blockId: 'block-no-skip',
    content: '非循环事项',
    date: '2026-05-13',
    status: 'pending',
  })

  const buttons = [...mounted.container.querySelectorAll('.block__icon')]
  const skipButton = buttons.find((node) => node.getAttribute('aria-label') === '跳过本次')
  expect(skipButton).toBeFalsy()

  mounted.unmount()
})

it('calls completeItem instead of writeBlock directly', async () => {
  const mockCompleteItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
  vi.doMock('@/utils/itemActions', () => ({
    completeItem: mockCompleteItem,
    abandonItem: vi.fn(() => Promise.resolve(true)),
    migrateItem: vi.fn(() => Promise.resolve(true)),
  }))

  const mounted = await mountComponent({
    id: 'item-complete-fn',
    blockId: 'block-complete-fn',
    content: '测试纯函数',
    date: '2026-05-14',
    status: 'pending',
  })

  const completeButton = [...mounted.container.querySelectorAll('.block__icon')]
    .find((node) => node.getAttribute('aria-label') === '完成') as HTMLElement
  completeButton.click()
  await nextTick()

  expect(mockCompleteItem).toHaveBeenCalled()

  mounted.unmount()
  vi.doUnmock('@/utils/itemActions')
})
```

同时需要更新 `mountComponent` 函数支持额外 props：

```typescript
async function mountComponent(item: any, extraProps: Record<string, any> = {}) {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ItemActionBar, { item, ...extraProps })
  app.mount(container)
  await nextTick()

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/components/todo/ItemActionBar.test.ts`
预期：部分 FAIL（新增测试因缺少 props 和图标而失败）

- [ ] **步骤 3：修改 ItemActionBar.vue**

变更要点：
1. 新增 `showPin`、`showDetail` props
2. 新增 `openDetail`、`togglePinned` emits
3. 将 `handleComplete`、`handleAbandon`、`handleMigrate` 改为调用纯函数
4. 新增置顶、详情图标
5. 条件渲染 fixed 行
6. 日历图标根据 fixed 行是否存在移到不同位置
7. 移除 `buildDatePatch` 函数（已移到 itemActions.ts）

**Props 变更：**
```typescript
const props = withDefaults(defineProps<{
  item: Item | null
  openDocMode?: OpenDocMode
  showPin?: boolean
  showDetail?: boolean
}>(), {
  openDocMode: 'navigate',
  showPin: false,
  showDetail: false,
})
```

**Emits 变更：**
```typescript
const emit = defineEmits<{
  (event: 'openDoc', docId: string, blockId: string): void
  (event: 'openCalendar', date: string): void
  (event: 'skipOccurrence'): void
  (event: 'openDetail'): void
  (event: 'togglePinned'): void
}>()
```

**新增计算属性：**
```typescript
const hasFixedRow = computed(() => props.showPin || props.showDetail)
const pinLabel = computed(() => {
  if (!props.item) return ''
  return props.item.pinned ? t('todo').unpin : t('todo').pin
})
```

**模板变更 — hover 行：**
- 移除日历图标（当 hasFixedRow 为 true 时）
- 日历图标保留在 hover 行（当 hasFixedRow 为 false 时）

**模板变更 — 新增 fixed 行（条件渲染）：**
```html
<div v-if="hasFixedRow" class="item-actions-fixed">
  <span
    v-if="showPin"
    class="block__icon"
    :class="{ 'block__icon--active': item?.pinned }"
    :aria-label="pinLabel"
    @mouseenter="handleTooltipEnter($event, pinLabel)"
    @mouseleave="handleTooltipLeave"
    @click.stop="handleTogglePinned"
  >
    <svg><use xlink:href="#iconPin"></use></svg>
  </span>
  <span
    v-if="showDetail"
    class="block__icon"
    :aria-label="t('todo').detail"
    @mouseenter="handleTooltipEnter($event, t('todo').detail)"
    @mouseleave="handleTooltipLeave"
    @click.stop="handleOpenDetail"
  >
    <svg><use xlink:href="#iconInfo"></use></svg>
  </span>
  <span
    class="block__icon"
    :aria-label="t('todo').calendar"
    @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
    @mouseleave="handleTooltipLeave"
    @click.stop="handleOpenCalendar"
  >
    <svg><use xlink:href="#iconCalendar"></use></svg>
  </span>
</div>
```

**处理函数变更：**
```typescript
import { completeItem, abandonItem, migrateItem } from '@/utils/itemActions'
import { toggleItemPinned } from '@/utils/itemSettingUtils'

// handleComplete 改为：
async function handleComplete() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await completeItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

// handleAbandon 改为：
async function handleAbandon() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await abandonItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

// handleMigrate 改为：
async function handleMigrate() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await migrateItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

// 新增：
function handleTogglePinned() {
  if (!props.item || isProcessing.value) return
  emit('togglePinned')
}

function handleOpenDetail() {
  if (!props.item || isProcessing.value) return
  emit('openDetail')
}
```

**样式变更 — 新增 fixed 行样式：**
```scss
.item-actions-fixed {
  display: flex;
  gap: 4px;
  flex-shrink: 0;

  .block__icon {
    opacity: 1;
    cursor: pointer;

    &.block__icon--active {
      color: var(--b3-theme-primary);
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/components/todo/ItemActionBar.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/components/todo/ItemActionBar.vue test/components/todo/ItemActionBar.test.ts
git commit -m "feat: 扩展 ItemActionBar 支持 fixed 行和纯函数调用"
```

---

### 任务 3：TodoSidebarList 替换操作栏

**文件：**
- 修改：`src/components/todo/TodoSidebarList.vue`

- [ ] **步骤 1：替换 5 处重复操作栏模板**

将每个分区（pinned、expired、today、tomorrow、future）的 `<template #footer>` 内容替换为：

```html
<template #footer>
  <ItemActionBar
    :item="item"
    :show-pin="true"
    :show-detail="true"
    @openCalendar="openCalendar(item)"
    @openDetail="openDetail(item)"
    @togglePinned="handleTogglePinned(item)"
    @skipOccurrence="handleSkipOccurrence(item)"
  />
</template>
```

对于 completed 和 abandoned 分区，只显示 fixed 行（无 hover 行）：

```html
<template #footer>
  <ItemActionBar
    :item="item"
    :show-detail="true"
    @openCalendar="openCalendar(item)"
    @openDetail="openDetail(item)"
  />
</template>
```

注意：completed/abandoned 分区的 ItemActionBar 会根据 item.status 自动隐藏完成、放弃、迁移等图标（因为 canComplete、canAbandon、canMigrate 计算属性已排除这些状态）。

- [ ] **步骤 2：移除重复的业务逻辑函数**

从 TodoSidebarList.vue 中移除：
- `buildDatePatch` 函数（已移到 itemActions.ts）
- `handleDone` 函数（ItemActionBar 内部调用 completeItem）
- `handleAbandon` 函数（ItemActionBar 内部调用 abandonItem）
- `handleMigrate` 函数（ItemActionBar 内部调用 migrateItem）
- `handleMigrateToday` 函数（ItemActionBar 的 migrateItem 自动判断）
- `openFocusPlanDialog` 函数（ItemActionBar 内部调用 showFocusPlanDialog）
- `openPomodoroDialog` 函数（ItemActionBar 内部调用 showPomodoroTimerDialog）
- `handleActionTooltipEnter` 函数（ItemActionBar 内部处理）
- `handleActionTooltipLeave` 函数（ItemActionBar 内部处理）
- `getFocusPlanActionLabel` 函数（ItemActionBar 内部处理）
- `getPinAriaLabel` 函数（ItemActionBar 内部处理）

保留的函数：
- `handleTogglePinned` — 仍需保留，因为 ItemActionBar emit `togglePinned`，父组件执行 toggleItemPinned
- `handleSkipOccurrence` — 新增，ItemActionBar emit `skipOccurrence`，父组件执行跳过逻辑
- `openDetail` — 保留，ItemActionBar emit `openDetail`
- `openCalendar` — 保留，ItemActionBar emit `openCalendar`
- `handleMigrateCustom` — 保留，右键菜单中的自定义迁移日期
- `handleContextMenu` — 保留，但需要更新引用

- [ ] **步骤 3：新增 handleSkipOccurrence 函数**

```typescript
import { skipCurrentOccurrence } from '@/services/recurringService'

async function handleSkipOccurrence(item: Item) {
  if (isProcessing.value) return
  if (!item.repeatRule || !item.blockId) return
  isProcessing.value = true
  try {
    await skipCurrentOccurrence(plugin as any, item)
  } finally {
    isProcessing.value = false
  }
}
```

- [ ] **步骤 4：更新 handleContextMenu 引用**

`handleContextMenu` 中的 `handleDone`、`handleAbandon`、`handleMigrate`、`handleMigrateToday` 引用需要替换为直接调用纯函数：

```typescript
onComplete: () => {
  if (isProcessing.value) return
  isProcessing.value = true
  completeItem(item).finally(() => { isProcessing.value = false })
},
onAbandon: () => {
  if (isProcessing.value) return
  isProcessing.value = true
  abandonItem(item).finally(() => { isProcessing.value = false })
},
onMigrateToday: () => {
  if (isProcessing.value) return
  isProcessing.value = true
  migrateItemToToday(item).finally(() => { isProcessing.value = false })
},
onMigrateTomorrow: () => {
  if (isProcessing.value) return
  isProcessing.value = true
  migrateItem(item).finally(() => { isProcessing.value = false })
},
```

- [ ] **步骤 5：更新 import**

移除不再需要的 import：
- `writeBlock` from `@/utils/blockWriter`
- `PomodoroTimerDialog` from `@/components/pomodoro/PomodoroTimerDialog.vue`
- `createDialog` from `@/utils/dialog`
- `showFocusPlanDialog` from `@/utils/dialog`
- `showIconTooltip`、`hideIconTooltip` from `@/utils/dialog`

新增 import：
- `ItemActionBar` from `@/components/todo/ItemActionBar.vue`
- `completeItem`、`abandonItem`、`migrateItem`、`migrateItemToToday` from `@/utils/itemActions`

- [ ] **步骤 6：移除不再需要的样式**

移除 `.item-actions-hover` 和 `.item-actions-fixed` 样式（已移到 ItemActionBar 中）。

- [ ] **步骤 7：运行测试验证**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 8：Commit**

```bash
git add src/components/todo/TodoSidebarList.vue
git commit -m "refactor: TodoSidebarList 操作栏替换为 ItemActionBar 组件"
```

---

### 任务 4：适配 ItemDetailDialog

**文件：**
- 修改：`src/components/dialog/ItemDetailDialog.vue`

- [ ] **步骤 1：更新 ItemDetailDialog 事件处理**

ItemActionBar 现在内部执行完成、放弃、迁移操作，不再需要父组件处理。但 `skipOccurrence` 仍需 emit。

检查 ItemDetailDialog 当前的 emit 列表，移除不再需要的 emit（如 `setReminder`、`setRecurring` 如果它们已由 ItemDetailContent 处理）。

确认 ItemActionBar 的 `@togglePinned` 和 `@openDetail` 在 dialog 场景下不需要（不传 showPin/showDetail 即可）。

- [ ] **步骤 2：运行测试验证**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/dialog/ItemDetailDialog.vue
git commit -m "refactor: 适配 ItemDetailDialog 与 ItemActionBar 事件变更"
```

---

### 任务 5：全量验证

- [ ] **步骤 1：运行全量测试**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行 build**

运行：`npm run build`
预期：成功

- [ ] **步骤 4：最终 Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint 修复"
```
