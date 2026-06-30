# ItemActionHandlers 统一抽取 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 `itemActionHandlers.ts`，将所有事项操作逻辑统一抽取，供 ItemActionBar 和右键菜单共用。

**架构：** 新增 `getItemActionHandlers()` 函数返回 handler 对象，ItemActionBar 和各视图的右键菜单改为消费该对象。`createItemMenu` 参数从多个 callback 简化为 handler 对象。

**技术栈：** Vue 3 + TypeScript

---

### 任务 1：创建 `itemActionHandlers.ts`

**文件：**
- 创建：`src/utils/itemActionHandlers.ts`
- 测试：`test/utils/itemActionHandlers.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// test/utils/itemActionHandlers.test.ts
import { describe, expect, it, vi } from 'vitest'

const mockCompleteItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockAbandonItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToToday = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToDate = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockToggleItemPinned = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSkipOccurrenceItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockShowPomodoroTimerDialog = vi.fn()
const mockShowFocusPlanDialog = vi.fn()
const mockShowItemDetailModal = vi.fn()
const mockShowDatePickerDialog = vi.fn()
const mockOpenDocumentAtLine = vi.fn()
const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('@/utils/itemActions', () => ({
  completeItem: mockCompleteItem,
  abandonItem: mockAbandonItem,
  migrateItem: mockMigrateItem,
  migrateItemToToday: mockMigrateItemToToday,
  migrateItemToDate: mockMigrateItemToDate,
  skipOccurrenceItem: mockSkipOccurrenceItem,
}))

vi.mock('@/utils/itemSettingUtils', () => ({
  toggleItemPinned: mockToggleItemPinned,
}))

vi.mock('@/utils/dialog', () => ({
  showPomodoroTimerDialog: mockShowPomodoroTimerDialog,
  showFocusPlanDialog: mockShowFocusPlanDialog,
  showItemDetailModal: mockShowItemDetailModal,
  showDatePickerDialog: mockShowDatePickerDialog,
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: mockOpenDocumentAtLine,
}))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

describe('getItemActionHandlers', () => {
  const mockItem = {
    id: 'item-1',
    blockId: 'block-1',
    docId: 'doc-1',
    lineNumber: 5,
    date: '2026-06-11',
    status: 'pending',
    content: '测试事项',
  } as any

  const mockPlugin = { openCustomTab: vi.fn() }

  it('complete 调用 completeItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.complete()
    expect(mockCompleteItem).toHaveBeenCalledWith(mockItem)
  })

  it('abandon 调用 abandonItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.abandon()
    expect(mockAbandonItem).toHaveBeenCalledWith(mockItem)
  })

  it('migrate 调用 migrateItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.migrate()
    expect(mockMigrateItem).toHaveBeenCalledWith(mockItem)
  })

  it('migrateToToday 调用 migrateItemToToday', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.migrateToToday()
    expect(mockMigrateItemToToday).toHaveBeenCalledWith(mockItem)
  })

  it('togglePinned 调用 toggleItemPinned', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.togglePinned()
    expect(mockToggleItemPinned).toHaveBeenCalledWith(mockItem)
  })

  it('skipOccurrence 调用 skipOccurrenceItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.skipOccurrence()
    expect(mockSkipOccurrenceItem).toHaveBeenCalledWith(mockPlugin, mockItem)
  })

  it('startFocus 调用 showPomodoroTimerDialog', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.startFocus()
    expect(mockShowPomodoroTimerDialog).toHaveBeenCalledWith(mockItem.blockId)
  })

  it('focusPlan 调用 showFocusPlanDialog', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.focusPlan()
    expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(mockItem)
  })

  it('openDetail 调用 showItemDetailModal', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openDetail()
    expect(mockShowItemDetailModal).toHaveBeenCalledWith(mockItem, { showAllDates: true })
  })

  it('openCalendar 调用 plugin.openCustomTab', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openCalendar()
    expect(mockPlugin.openCustomTab).toHaveBeenCalled()
  })

  it('openDoc 调用 openDocumentAtLine', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openDoc()
    expect(mockOpenDocumentAtLine).toHaveBeenCalledWith(mockItem.docId, mockItem.lineNumber, mockItem.blockId)
  })

  it('setPriority 调用 writeBlock', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.setPriority('high')
    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: mockItem.blockId },
      { type: 'setPriority', priority: 'high' },
    )
  })

  it('afterAction 在操作成功后调用', async () => {
    const afterAction = vi.fn()
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin, { afterAction })
    await handlers.complete()
    expect(afterAction).toHaveBeenCalled()
  })

  it('isProcessing 在异步操作期间为 true', async () => {
    let resolveComplete: () => void
    mockCompleteItem.mockReturnValueOnce(new Promise<boolean>((resolve) => { resolveComplete = resolve }))
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    expect(handlers.isProcessing.value).toBe(false)
    const promise = handlers.complete()
    expect(handlers.isProcessing.value).toBe(true)
    resolveComplete!()
    await promise
    expect(handlers.isProcessing.value).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/itemActionHandlers.test.ts`
预期：FAIL，报错模块找不到

- [ ] **步骤 3：编写实现代码**

```ts
// src/utils/itemActionHandlers.ts
import type { Item } from '@/types/models'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { TAB_TYPES } from '@/constants'
import { writeBlock } from '@/utils/blockWriter'
import {
  showDatePickerDialog,
  showFocusPlanDialog,
  showItemDetailModal,
  showPomodoroTimerDialog,
} from '@/utils/dialog'
import { openDocumentAtLine } from '@/utils/fileUtils'
import {
  abandonItem,
  completeItem,
  migrateItem,
  migrateItemToDate,
  migrateItemToToday,
  skipOccurrenceItem,
} from '@/utils/itemActions'
import { toggleItemPinned } from '@/utils/itemSettingUtils'

export interface ItemActionHandlers {
  isProcessing: Readonly<Ref<boolean>>
  complete: () => Promise<void>
  abandon: () => Promise<void>
  migrate: () => Promise<void>
  migrateToToday: () => Promise<void>
  migrateCustom: () => void
  startFocus: () => void
  focusPlan: () => void
  openDoc: () => void
  openDetail: () => void
  openCalendar: () => void
  togglePinned: () => Promise<void>
  skipOccurrence: () => Promise<void>
  setPriority: (priority: Item['priority']) => Promise<void>
}

export function getItemActionHandlers(
  item: Item,
  plugin: any,
  options?: {
    afterAction?: () => void
  },
): ItemActionHandlers {
  const isProcessing = ref(false)
  const afterAction = options?.afterAction

  async function withProcessing<T>(fn: () => Promise<T>): Promise<void> {
    if (isProcessing.value) return
    isProcessing.value = true
    try {
      await fn()
      afterAction?.()
    } finally {
      isProcessing.value = false
    }
  }

  return {
    isProcessing,

    async complete() {
      await withProcessing(() => completeItem(item))
    },

    async abandon() {
      await withProcessing(() => abandonItem(item))
    },

    async migrate() {
      await withProcessing(() => migrateItem(item))
    },

    async migrateToToday() {
      await withProcessing(() => migrateItemToToday(item))
    },

    migrateCustom() {
      if (isProcessing.value || !item.blockId) return
      showDatePickerDialog('', item.date, async (newDate) => {
        if (isProcessing.value) return
        isProcessing.value = true
        try {
          await migrateItemToDate(item, newDate)
          afterAction?.()
        } finally {
          isProcessing.value = false
        }
      })
    },

    startFocus() {
      if (isProcessing.value || !item.blockId) return
      showPomodoroTimerDialog(item.blockId)
    },

    focusPlan() {
      if (isProcessing.value) return
      showFocusPlanDialog(item)
    },

    openDoc() {
      if (isProcessing.value || !item.docId) return
      openDocumentAtLine(item.docId, item.lineNumber, item.blockId)
      afterAction?.()
    },

    openDetail() {
      if (isProcessing.value) return
      showItemDetailModal(item, { showAllDates: true })
    },

    openCalendar() {
      if (isProcessing.value) return
      if (plugin?.openCustomTab) {
        plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date })
      }
      afterAction?.()
    },

    async togglePinned() {
      await withProcessing(() => toggleItemPinned(item))
    },

    async skipOccurrence() {
      await withProcessing(() => skipOccurrenceItem(plugin, item))
    },

    async setPriority(priority: Item['priority']) {
      if (isProcessing.value || !item.blockId) return
      isProcessing.value = true
      try {
        await writeBlock({ blockId: item.blockId }, { type: 'setPriority', priority })
        afterAction?.()
      } finally {
        isProcessing.value = false
      }
    },
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/itemActionHandlers.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/itemActionHandlers.ts test/utils/itemActionHandlers.test.ts
git commit -m "feat: 创建 itemActionHandlers 统一事项操作逻辑"
```

---

### 任务 2：重构 ItemActionBar.vue

**文件：**
- 修改：`src/components/todo/ItemActionBar.vue`
- 修改：`test/components/todo/ItemActionBar.test.ts`

- [ ] **步骤 1：重构 ItemActionBar.vue 使用 getItemActionHandlers**

将 ItemActionBar 中所有 handler 函数替换为 `getItemActionHandlers` 返回的 handler。移除 `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` 三个 prop，统一为 `afterAction`。移除 `isProcessing` ref，使用 handler 对象中的。

关键变更：
- 移除 `completeItem`/`abandonItem`/`migrateItem`/`skipOccurrenceItem`/`toggleItemPinned`/`showItemDetailModal`/`showPomodoroTimerDialog`/`showFocusPlanDialog` 等 import
- 新增 `getItemActionHandlers` import
- 移除 `isProcessing` ref
- 移除 `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` props，新增 `afterAction` prop
- 所有 `handleXxx` 函数改为调用 `handlers.xxx()`
- 保留 `openDocMode` prop 和 preview 相关逻辑（preview 模式下 openDoc 行为不同）

- [ ] **步骤 2：更新测试**

更新 `test/components/todo/ItemActionBar.test.ts`：
- mock `@/utils/itemActionHandlers` 而非各个底层模块
- 验证 handler 方法被调用

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run test/components/todo/ItemActionBar.test.ts`
预期：PASS

- [ ] **步骤 4：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/components/todo/ItemActionBar.vue test/components/todo/ItemActionBar.test.ts
git commit -m "refactor(ItemActionBar): 使用 getItemActionHandlers 替代内联 handler"
```

---

### 任务 3：重构 contextMenu.ts

**文件：**
- 修改：`src/utils/contextMenu.ts`

- [ ] **步骤 1：重构 createItemMenu 接收 ItemActionHandlers**

将 `createItemMenu` 的第二个参数从多个独立 callback 改为 `handlers: ItemActionHandlers`。补上 togglePinned、skipOccurrence 菜单项。

关键变更：
- import `ItemActionHandlers` 类型
- handlers 参数类型从 `{ onComplete?, onMigrateToday?, ... }` 改为 `ItemActionHandlers`
- 菜单项 click 改为调用 `handlers.complete()` 等
- 新增 togglePinned、skipOccurrence 菜单项
- 保留 `showCalendarMenu`/`isFocusing` options

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：可能有类型错误（消费方还没更新），先确认 contextMenu.ts 本身无错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/contextMenu.ts
git commit -m "refactor(contextMenu): createItemMenu 改为接收 ItemActionHandlers"
```

---

### 任务 4：重构 TodoSidebarList.vue

**文件：**
- 修改：`src/components/todo/TodoSidebarList.vue`
- 修改：`test/components/todo/TodoSidebarList.test.ts`

- [ ] **步骤 1：重构右键菜单使用 getItemActionHandlers**

将 `handleContextMenu` 中的内联 handlers 替换为 `getItemActionHandlers` 返回的 handler。移除 `openDetail`/`openCalendar` 函数（已被 handler 覆盖）。

关键变更：
- import `getItemActionHandlers`
- `handleContextMenu` 中调用 `getItemActionHandlers(item, plugin)` 获取 handlers
- 传给 `createItemMenu` 的第二个参数改为 handlers 对象
- 移除 `openDetail`/`openCalendar` 函数（如果右键菜单仍在用则保留，但改为调用 handler）
- 移除不再需要的 import（`completeItem`/`abandonItem`/`migrateItem`/`migrateItemToDate`/`migrateItemToToday`）

- [ ] **步骤 2：更新测试**

更新 `test/components/todo/TodoSidebarList.test.ts` 中 `createItemMenu` 的 mock。

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run test/components/todo/TodoSidebarList.test.ts`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/components/todo/TodoSidebarList.vue test/components/todo/TodoSidebarList.test.ts
git commit -m "refactor(TodoSidebarList): 右键菜单使用 getItemActionHandlers"
```

---

### 任务 5：重构 CalendarView.vue

**文件：**
- 修改：`src/components/calendar/CalendarView.vue`

- [ ] **步骤 1：重构右键菜单使用 getItemActionHandlers**

将 CalendarView 中 `handleContextMenu` 的内联 handlers 替换为 `getItemActionHandlers` 返回的 handler。

关键变更：
- import `getItemActionHandlers`
- 右键菜单 handler 改为 `getItemActionHandlers(item, plugin)`
- 移除 `buildDatePatchFromItem` 相关的 migrate 内联实现
- 移除 `writeBlock` 的直接调用（complete/abandon/setPriority）

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/calendar/CalendarView.vue
git commit -m "refactor(CalendarView): 右键菜单使用 getItemActionHandlers"
```

---

### 任务 6：重构 GanttView.vue

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

- [ ] **步骤 1：重构右键菜单使用 getItemActionHandlers**

将 GanttView 中右键菜单的内联 handlers 替换为 `getItemActionHandlers` 返回的 handler。GanttView 特有的 `requestRefresh` 通过 `afterAction` 回调实现。

关键变更：
- import `getItemActionHandlers`
- 右键菜单 handler 改为 `getItemActionHandlers(item, plugin, { afterAction: () => plugin?.requestRefresh?.({ type: 'full', reason: 'gantt-view:action' }) })`
- 移除 `buildDatePatchFromItem` 相关的 migrate 内联实现
- 移除 `writeBlock` 的直接调用

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/gantt/GanttView.vue
git commit -m "refactor(GanttView): 右键菜单使用 getItemActionHandlers"
```

---

### 任务 7：重构 ItemDetailDialog.vue

**文件：**
- 修改：`src/components/dialog/ItemDetailDialog.vue`

- [ ] **步骤 1：将三个 after 回调合并为 afterAction**

将 `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` 三个 prop 合并为 `afterAction`。

关键变更：
- 移除 `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` props
- 新增 `afterAction` prop
- 传给 ItemActionBar 的 `afterAction` prop

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/dialog/ItemDetailDialog.vue
git commit -m "refactor(ItemDetailDialog): 合并 after 回调为 afterAction"
```

---

### 任务 8：全量验证

- [ ] **步骤 1：运行全部测试**

运行：`npm run test`
预期：PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 4：Commit（如有 lint 自动修复的变更）**

```bash
git add -A && git commit -m "chore: lint 修复"
```
