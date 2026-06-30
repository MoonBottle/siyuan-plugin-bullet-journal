# 日历视图「仅任务」展示模式

## 背景

当前日历视图只显示 Item（事项）级别事件。甘特图已有「仅任务/含事项」切换，日历缺少类似的宏观概览能力。

日历是平铺结构（无层级关系），Task 和 Item 混在一起会视觉混乱，因此选择「仅事项/仅任务」两个互斥模式，而非甘特图的「含事项」（Task+Item 同时显示）。

## 需求

- 日历工具栏新增显示层级切换控件：「仅事项」（默认）/「仅任务」
- 仅任务模式下，每个 Task 显示为一条日历事件，日期从子 Items 推算
- 仅任务模式下，Task 事件**只可查看，不可拖拽/调整大小**
- 点击 Task 事件，打开该 Task 下首个 Item 的详情弹框（含导航切换）

## 设计

### 1. UI 控件

CalendarTab 工具栏新增 `SySelect`，位于状态筛选和视图切换之间：

```
[分组] [状态筛选] [仅事项/仅任务 ▾] [视图切换] [刷新]
```

选项：
- `item` — 仅事项（默认，当前行为）
- `task` — 仅任务

i18n key 复用甘特图已有的 `gantt.tasksOnly` / 新增 `calendar.itemsOnly`。

### 2. 数据层

#### `DataConverter.projectsToCalendarEvents`

新增 `showItems` 参数（默认 `true`）：

```typescript
public static projectsToCalendarEvents(
  projects: Project[],
  itemStatusFilter?: ItemStatus[],
  showItems: boolean = true,
): CalendarEvent[]
```

- `showItems=true`：只生成 Item 事件（当前行为，保持不变）
- `showItems=false`：只生成 Task 事件

#### `taskToCalendarEvent` 增强

仅任务模式下，Task 事件需要：

1. **日期推算**：Task 无自身日期时，从子 Items 推算日期范围（复用 `calculateTaskDates`）
2. **extendedProps 补充**：
   - `firstItemBlockId` — 首个 Item 的 blockId，用于点击打开详情
   - `siblingBlockIds` — 同 Task 下所有 Item 的 blockId 列表（去重），用于导航切换
   - `taskProgress` — `{ completed: number, total: number }` 进度信息

```typescript
private static taskToCalendarEvent(
  task: Task,
  project: Project,
  showItems: boolean = true,
): CalendarEvent
```

当 `showItems=false` 时：
- 日期使用 `calculateTaskDates(task)` 推算（与甘特图仅任务模式一致）
- 如果推算不出日期（Task 无自身日期且无子 Item），跳过该 Task

#### `projectStore` 修改

新增 `getCalendarEvents(showItems)` getter，替代当前直接调用 `DataConverter.projectsToCalendarEvents` 的 `calendarEvents` getter：

```typescript
getCalendarEvents: (state) => (showItems: boolean, itemStatusFilter?: ItemStatus[]) => {
  return DataConverter.projectsToCalendarEvents(state.projects, itemStatusFilter, showItems)
}
```

保留原 `calendarEvents` getter（默认 showItems=true）以兼容其他调用方。

### 3. CalendarView 修改

新增 `showItems` prop（默认 `true`）：

```typescript
interface Props {
  events: CalendarEvent[]
  initialView?: string
  dateClickBehavior?: 'click' | 'dblclick'
  itemStatusFilter?: ItemStatus[]
  showItems?: boolean  // 新增
}
```

#### 拖拽控制

`eventAllow` 回调中，当 `showItems=false` 且事件为 Task 级别（`item === undefined`）时返回 `false`：

```typescript
eventAllow: (dropInfo: any, event: any) => {
  if (event.extendedProps?.isPomodoroBlock) return false
  if (!props.showItems && event.extendedProps?.item === undefined) return false  // 仅任务模式禁用拖拽
  return true
}
```

#### 点击行为

仅任务模式下点击 Task 事件：
- 通过 `firstItemBlockId` 查找首个 Item
- 构建 CalendarEvent 并调用 `showEventDetailModal`，传入 `siblingBlockIds`

#### 渲染区分

`renderEventContent` 中，Task 级别事件（`isItem === false`）渲染：
- 任务名 + 进度标签（如 `2/5`）
- 不显示 taskName 前缀（因为本身就是 Task）
- 不显示番茄钟时长
- 使用与 Item 不同的视觉样式（左侧色条或背景色区分）

### 4. CalendarTab 修改

新增 `displayLevel` 状态和 `SySelect` 控件：

```typescript
const displayLevelOptions = [
  { value: 'item', label: t('calendar').itemsOnly },
  { value: 'task', label: t('gantt').tasksOnly },
]

const displayLevel = ref<string | number>('item')
const showItems = computed(() => displayLevel.value === 'item')
```

将 `showItems` 传入 CalendarView，并根据 `showItems` 选择调用 `projectStore.getCalendarEvents(showItems)` 还是直接用 `calendarEvents`。

### 5. i18n

新增 key：
- `calendar.itemsOnly` — "仅事项"（中文）/ "Items Only"（英文）

复用已有 key：
- `gantt.tasksOnly` — "仅任务"

### 6. 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/utils/dataConverter.ts` | `projectsToCalendarEvents` 添加 `showItems` 参数；`taskToCalendarEvent` 增强日期推算和 extendedProps |
| `src/stores/projectStore.ts` | 新增 `getCalendarEvents(showItems, itemStatusFilter?)` getter |
| `src/components/calendar/CalendarView.vue` | 接收 `showItems` prop；Task 事件禁用拖拽；渲染区分 Task/Item |
| `src/tabs/CalendarTab.vue` | 新增显示层级 SySelect；传递 showItems |
| `src/i18n/zh-CN.json` | 添加 `calendar.itemsOnly` |
| `src/i18n/en-US.json` | 添加 `calendar.itemsOnly` |
