# Mobile 端 itemActionHandlers 适配设计

## 背景

桌面端已完成 `itemActionHandlers.ts` 统一抽取（见 `2026-06-11-item-action-handlers-design.md`）。Mobile 端仍有 4 个文件直接调用 `writeBlock` 实现事项操作，需要统一适配。

## Mobile 端现状

| 文件 | 操作 | 实现方式 |
|------|------|---------|
| ActionDrawer.vue | complete/abandon/migrate | 直接 `writeBlock` |
| MobileItemDetail.vue | complete/abandon/migrateToday/migrateTomorrow/setPriority/onDateChange | 直接 `writeBlock` |
| MobileTodoPanel.vue | quickComplete | 直接 `writeBlock` |
| MobileTodoList.vue | postponeAll (批量) | 直接 `writeBlock` 循环 |

## 与桌面端的差异

1. **MobileItemDetail 用自己的 MobileDatePicker**，不用 `showDatePickerDialog`，所以 `handlers.migrateCustom()` 不适用
2. **ActionDrawer 通过 emit 事件**（openPomodoro/openDetail）让父组件处理
3. **MobileTodoList.handlePostponeAll** 是批量操作，循环调用 `migrateItem`

## 方案

### 1. 新增 `migrateToDate(date: string)` 方法

在 `ItemActionHandlers` 接口和 `getItemActionHandlers` 实现中新增 `migrateToDate`，供 Mobile 端用自己的日期选择器后调用：

```ts
migrateToDate: (date: string) => Promise<void>
```

实现：`await withProcessing(() => migrateItemToDate(item, date))`

### 2. ActionDrawer.vue

- 新增 `getItemActionHandlers` import
- complete/abandon/migrate 改用 handlers
- 保留 emit 事件（openPomodoro/openDetail）
- 移除 `writeBlock`/`buildDatePatchFromItem`/`dayjs` import

### 3. MobileItemDetail.vue

- 新增 `getItemActionHandlers` import
- complete/abandon 改用 handlers
- migrateToday 改用 `handlers.migrateToToday()`
- migrateTomorrow 改用 `handlers.migrate()`（migrateItem 默认迁移到明天）
- onDateChange 改用 `handlers.migrateToDate(newDate)`
- onPriorityChange 改用 `handlers.setPriority(newPriority)`
- 保留 emit 事件和 MobileDatePicker/MobilePriorityPicker
- 移除 `writeBlock`/`buildDatePatchFromItem` import

### 4. MobileTodoPanel.vue

- quickComplete 改用 `completeItem()` from `@/utils/itemActions`（不需要整个 handlers 对象）
- 移除 `writeBlock` import

### 5. MobileTodoList.vue

- handlePostponeAll 改用循环调用 `migrateItem()` from `@/utils/itemActions`
- 移除 `writeBlock`/`buildDatePatchFromItem` import

### 不变的部分

- `itemActionHandlers.ts` 的现有方法不变（只新增 `migrateToDate`）
- `itemActions.ts`/`itemSettingUtils.ts` 不变
- Mobile 端的 UI 组件（MobileDatePicker、MobilePriorityPicker 等）不变
