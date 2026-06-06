# ItemActionBar 复用到 TodoSidebarList 设计

## 背景

TodoSidebarList 中有 5 处重复的操作栏模板（pinned、expired、today、tomorrow、future 分区），每处包含 hover 行（完成/专注/计划/迁移/放弃）和 fixed 行（置顶/详情/日历）。ItemActionBar 已有 hover 行的图标实现。需要扩展 ItemActionBar 使其能复用到 sidebar 场景，消除重复代码，并将操作逻辑提取为纯函数供移动端/AI 复用。

## 变更

### 1. 提取操作纯函数

文件：`src/utils/itemActions.ts`（新建）

从 ItemActionBar 和 TodoSidebarList 中提取以下纯函数：

- `completeItem(item: Item)` — writeBlock setStatus completed
- `abandonItem(item: Item)` — writeBlock setStatus abandoned
- `migrateItem(item: Item)` — 自动判断迁移到今天/明天，writeBlock addDate
- `migrateItemToToday(item: Item)` — 迁移到今天，writeBlock addDate
- `skipOccurrenceItem(item: Item)` — 调用 skipCurrentOccurrence

这些函数封装 writeBlock 调用和 buildDatePatch 逻辑，返回 Promise<boolean> 表示成功/失败。

### 2. ItemActionBar 重构

文件：`src/components/todo/ItemActionBar.vue`

**新增 Props：**
- `showPin?: boolean`（默认 false）— 是否显示置顶图标
- `showDetail?: boolean`（默认 false）— 是否显示详情图标

**新增 Emits（导航类）：**
- `openDetail` — 打开详情
- `togglePinned` — 置顶/取消置顶（由父组件执行 toggleItemPinned）

**内部执行的操作改为调用纯函数：**
- 完成 → `completeItem(item)`
- 放弃 → `abandonItem(item)`
- 迁移 → `migrateItem(item)`

**保留 emit 的操作：**
- `openDoc(docId, blockId)` — 导航行为，依赖父组件上下文
- `openCalendar(date)` — 导航行为，依赖父组件上下文
- `skipOccurrence` — 跳过逻辑依赖外部上下文（dialog.ts 中的处理）

**保留内部调用的操作：**
- 专注 → `showPomodoroTimerDialog(item.blockId)`
- 专注计划 → `showFocusPlanDialog(item)`
- 置顶 → emit `togglePinned`（toggleItemPinned 涉及 store 更新，由父组件执行）

**新增图标：**
- 置顶（iconPin）— 条件：`showPin`，aria-label 根据 item.pinned 动态显示
- 详情（iconInfo）— 条件：`showDetail`

**布局变更：**
- 当 `showPin || showDetail` 为 true 时，渲染 fixed 行
- fixed 行包含：置顶 → 详情 → 日历
- 日历图标从 hover 行移到 fixed 行（仅当 fixed 行存在时）
- 不启用 showPin/showDetail 时，日历保持在 hover 行（保持现有行为）

**hover 行图标顺序：**
完成 → 专注 → 专注计划 → 迁移 → 跳过本次 → 放弃 → [打开文档] → [日历(无fixed行时)]

**fixed 行图标顺序（条件渲染）：**
置顶 → 详情 → 日历

**移除的内部逻辑：**
- `buildDatePatch` 函数 → 移到 itemActions.ts
- `handleComplete` 中的 writeBlock 调用 → 改为调用 completeItem
- `handleAbandon` 中的 writeBlock 调用 → 改为调用 abandonItem
- `handleMigrate` 中的 writeBlock 调用 → 改为调用 migrateItem

### 3. TodoSidebarList 替换操作栏

文件：`src/components/todo/TodoSidebarList.vue`

- 5 处重复的 `item-actions-hover` + `item-actions-fixed` 模板替换为 `<ItemActionBar :item="item" :show-pin="true" :show-detail="true" @openCalendar="openCalendar(item)" @openDetail="openDetail(item)" @togglePinned="handleTogglePinned(item)" @skipOccurrence="handleSkipOccurrence(item)" />`
- 移除重复的业务逻辑函数：`handleDone`、`handleMigrate`、`handleMigrateToday`、`handleAbandon`、`buildDatePatch`
- 保留 TodoSidebarList 特有的逻辑：`openPomodoroDialog`（通过 ItemActionBar 内部调用）、`openCalendar`、`openDetail`、`handleTogglePinned`、`handleSkipOccurrence`、`handleContextMenu`、`handleMigrateCustom`
- 移除不再需要的 import：`writeBlock`、`PomodoroTimerDialog`、`createDialog`
- 注意：`handleMigrateCustom` 仍需保留（右键菜单中的自定义迁移日期），但 `handleMigrateToday` 可移除（ItemActionBar 的 migrateItem 已自动判断）

### 4. ItemDetailDialog 调整

文件：`src/components/dialog/ItemDetailDialog.vue`

- ItemActionBar 的 `@skipOccurrence` emit 保留
- `@openDoc`、`@openCalendar` 保留（导航行为）
- 移除不再需要的 emit 处理（完成、放弃、迁移等操作已在 ItemActionBar 内部执行）

## 数据流

```
ItemActionBar
  ├── 内部执行：completeItem、abandonItem、migrateItem（纯函数）
  ├── 内部调用：showPomodoroTimerDialog、showFocusPlanDialog（工具函数）
  └── emit：openDoc、openCalendar、skipOccurrence、openDetail、togglePinned
      → 父组件处理导航和上下文相关操作
```

## 测试用例

### itemActions 纯函数测试

文件：`test/utils/itemActions.test.ts`（新建）

- `completeItem` — 调用 writeBlock setStatus completed，返回 true
- `completeItem` — 无 blockId 时返回 false，不调用 writeBlock
- `abandonItem` — 调用 writeBlock setStatus abandoned
- `abandonItem` — 无 blockId 时返回 false
- `migrateItem` — 过期事项迁移到今天，正确构建 addDate patch（含 siblingItems）
- `migrateItem` — 当天事项迁移到明天
- `migrateItem` — 无 blockId 时返回 false
- `migrateItemToToday` — 迁移到今天
- `skipOccurrenceItem` — 调用 skipCurrentOccurrence

### ItemActionBar 组件测试

文件：`test/components/todo/ItemActionBar.test.ts`（扩展现有）

**新增测试用例：**

- `showPin=true` 时显示置顶图标，`showPin=false`（默认）时不显示
- `showDetail=true` 时显示详情图标，`showDetail=false`（默认）时不显示
- `showPin || showDetail` 为 true 时渲染 fixed 行（含置顶、详情、日历图标）
- `showPin && showDetail` 均为 false 时，日历图标在 hover 行（保持现有行为）
- fixed 行存在时，日历图标在 fixed 行而非 hover 行
- 置顶图标点击时 emit `togglePinned`
- 详情图标点击时 emit `openDetail`
- 置顶图标的 aria-label 根据 item.pinned 动态变化
- `canSkipOccurrence` — 有 repeatRule 且过期时显示跳过图标
- `canSkipOccurrence` — 无 repeatRule 时不显示跳过图标
- `canSkipOccurrence` — 已完成/已放弃时不显示跳过图标
- 跳过图标点击时 emit `skipOccurrence`
- 完成/放弃/迁移操作调用纯函数（completeItem/abandonItem/migrateItem）而非直接调用 writeBlock

## 验证

- `npm run test` 通过
- `npm run build` 通过
