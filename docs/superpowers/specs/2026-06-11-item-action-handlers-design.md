# ItemActionHandlers 统一抽取设计

## 背景

事项操作（complete、abandon、migrate 等）在 4 个消费方各自实现，逻辑重复且不一致：

| 消费方 | 实现方式 |
|--------|---------|
| `ItemActionBar.vue` | 内聚调用 `itemActions`/`itemSettingUtils` |
| `TodoSidebarList.vue` 右键菜单 | 内联 `writeBlock`/`itemActions` |
| `CalendarView.vue` 右键菜单 | 直接 `writeBlock`（绕过 `itemActions` 封装） |
| `GanttView.vue` 右键菜单 | 直接 `writeBlock` + `requestRefresh` |

问题：
1. 同一操作多处重复实现，维护成本高
2. CalendarView/GanttView 绕过 `itemActions` 封装，行为可能不一致
3. 右键菜单缺少 togglePinned、skipOccurrence 操作
4. setPriority 散落在各组件内联实现

## 方案

创建 `src/utils/itemActionHandlers.ts`，提供 `getItemActionHandlers()` 函数，返回所有事项操作的 handler 对象。

### API

```ts
interface ItemActionHandlers {
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
  setPriority: (priority: PriorityLevel | undefined) => Promise<void>
}

function getItemActionHandlers(
  item: Item,
  plugin: any,
  options?: {
    afterAction?: () => void
    openDocMode?: 'navigate' | 'preview'
  }
): ItemActionHandlers
```

### 各操作实现

| 操作 | 底层调用 | afterAction 时机 |
|------|---------|-----------------|
| complete | `completeItem(item)` | 成功后 |
| abandon | `abandonItem(item)` | 成功后 |
| migrate | `migrateItem(item)` | 成功后 |
| migrateToToday | `migrateItemToToday(item)` | 成功后 |
| migrateCustom | `showDatePickerDialog` + `migrateItemToDate` | 成功后 |
| startFocus | `showPomodoroTimerDialog(blockId)` | 无 |
| focusPlan | `showFocusPlanDialog(item)` | 无 |
| openDoc | `openDocumentAtLine(...)` | 调用后 |
| openDetail | `showItemDetailModal(item)` | 无 |
| openCalendar | `plugin.openCustomTab(CALENDAR, ...)` | 调用后 |
| togglePinned | `toggleItemPinned(item)` | 成功后 |
| skipOccurrence | `skipOccurrenceItem(plugin, item)` | 成功后 |
| setPriority | `writeBlock({ type: 'setPriority' })` | 成功后 |

### 消费方变更

**ItemActionBar.vue**：
- 移除所有 handler 函数实现，改用 `getItemActionHandlers` 返回的 handler
- 移除 `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` 三个 prop，统一为 `afterAction`
- 移除 `isProcessing` ref，使用 handler 对象中的

**contextMenu.ts 的 `createItemMenu`**：
- 参数从 10 个独立 callback 改为 `handlers: ItemActionHandlers`
- 补上 togglePinned、skipOccurrence 菜单项
- 菜单项可见性由 `createItemMenu` 根据 item 状态自动判断

**TodoSidebarList.vue**：
- 右键菜单改用 `getItemActionHandlers`，移除内联 handlers
- 移除 `openDetail`/`openCalendar` 函数（已被 handler 覆盖）

**CalendarView.vue**：
- 右键菜单改用 `getItemActionHandlers`，移除内联 handlers

**GanttView.vue**：
- 右键菜单改用 `getItemActionHandlers`，`requestRefresh` 通过 `afterAction` 回调实现

**ItemDetailDialog.vue**：
- `afterOpenDoc`/`afterOpenCalendar`/`afterSkipOccurrence` 合并为 `afterAction`

### 不变的部分

- `itemActions.ts`（底层 writeBlock 封装）不变
- `itemSettingUtils.ts`（togglePinned 等）不变
- `contextMenu.ts` 的 `showContextMenu` 不变
