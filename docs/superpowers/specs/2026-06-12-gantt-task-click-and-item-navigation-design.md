# 甘特图 Task 点击详情 + ItemDetailDialog 事项切换设计

## 概述

两个关联功能：
1. 甘特图中点击 Task 级别条形，打开该 Task 下首个 Item 的详情弹框
2. ItemDetailDialog 弹框内支持在同一 Task 下的 Item 之间左右切换

## 功能 1：甘特图 Task 点击打开首个 Item 详情

### 现状

`GanttView.vue` 的 `handleGanttTaskClick` 检查 `task.extendedProps.item`，仅当存在 item 时才打开详情弹框。Task 级别的 gantt task 没有 `item` 字段，点击无响应。

### 改动

#### DataConverter

在 `projectsToGanttTasks` 生成 Task 级别的 gantt task 时，在 `extendedProps` 中新增：

- `firstItemBlockId: string | undefined` — 该 Task 下第一个 Item 的 blockId
- `siblingBlockIds: string[]` — 该 Task 下所有 Item 的 blockId 列表（有序）

#### GanttView

修改 `handleGanttTaskClick`：

```
1. 如果 extendedProps.item 存在 → 沿用现有逻辑，打开 Item 详情
2. 如果 extendedProps.item 不存在但 firstItemBlockId 存在 →
   a. 通过 projectStore.getItemByBlockId(firstItemBlockId) 获取 Item
   b. 构建 CalendarEvent（复用 buildCalendarEventFromGanttTask 或新建构建逻辑）
   c. 将 siblingBlockIds 传入 CalendarEvent.extendedProps
   d. 调用 showEventDetailModal(event)
```

#### 类型

`GanttTask.extendedProps` 和 `CalendarEvent.extendedProps` 增加 `firstItemBlockId` 和 `siblingBlockIds` 字段。

## 功能 2：ItemDetailDialog 事项左右切换

### 新增 Props

```typescript
interface Props {
  blockId: string            // 初始展示的 Item blockId
  fallbackItem: Item         // 备用 Item
  showAllDates?: boolean
  siblingBlockIds?: string[] // 同一 Task 下所有 Item 的 blockId 列表
}
```

### 内部状态

```typescript
const activeBlockId = ref(props.blockId)

const currentIndex = computed(() => {
  if (!props.siblingBlockIds?.length) return -1
  return props.siblingBlockIds.indexOf(activeBlockId.value)
})

const canNavigatePrev = computed(() => currentIndex.value > 0)
const canNavigateNext = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < props.siblingBlockIds!.length - 1
)

const reactiveItem = computed(() =>
  projectStore.getItemByBlockId(activeBlockId.value) ?? props.fallbackItem
)
```

### 切换逻辑

```typescript
function navigatePrev() {
  if (!canNavigatePrev.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value - 1]
}

function navigateNext() {
  if (!canNavigateNext.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value + 1]
}
```

### ItemActionBar 联动

`reactiveItem` 随 `activeBlockId` 变化自动更新，`ItemActionBar` 接收 `:item="reactiveItem"` 自然联动到当前展示的事项。

### UI

在弹框内容顶部添加导航栏（仅当 `siblingBlockIds` 有多个元素时显示）：

```
[<] 2/5 [>]
```

- 左箭头 `<`：`canNavigatePrev` 为 false 时禁用（灰色、cursor: not-allowed）
- 中间文字：`currentIndex + 1 / siblingBlockIds.length`
- 右箭头 `>`：`canNavigateNext` 为 false 时禁用

样式：使用思源主题变量，与现有弹框风格一致。导航栏水平居中，padding 适中。

### 键盘快捷键

在 `ItemDetailDialog` 的根元素上监听 `keydown`：

- `ArrowLeft` → `navigatePrev()`
- `ArrowRight` → `navigateNext()`

使用 `@keydown.left` / `@keydown.right` 绑定，弹框打开时自动可聚焦。

### 数据来源

**甘特图场景：** `showEventDetailModal` 从 `CalendarEvent.extendedProps.siblingBlockIds` 获取列表，传入 `ItemDetailDialog`。

**其他场景（showItemDetailModal）：** 在 `showItemDetailModal` 中，通过 `projectStore` 查找同一 Task 下的所有 Item 的 blockId 列表，传入 `ItemDetailDialog`。查找逻辑：
1. 从 item 获取 task name 和 docId
2. 在 projectStore 的 items 中筛选同一 task（同 docId + 同 task name）的 items
3. 提取 blockId 列表

## 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/types/models.ts` | GanttTask/CalendarEvent extendedProps 增加 `firstItemBlockId`、`siblingBlockIds` |
| `src/utils/dataConverter.ts` | 生成 Task 级别 gantt task 时填充 `firstItemBlockId` 和 `siblingBlockIds` |
| `src/components/gantt/GanttView.vue` | 修改 `handleGanttTaskClick` 支持 Task 级别点击 |
| `src/components/dialog/ItemDetailDialog.vue` | 新增 `siblingBlockIds` prop、导航状态、导航 UI、键盘监听 |
| `src/utils/dialog.ts` | `showEventDetailModal` 和 `showItemDetailModal` 传入 `siblingBlockIds` |
