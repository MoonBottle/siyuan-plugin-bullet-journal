# 事项状态筛选条件实现计划

## 概要

为甘特图、日历、项目等所有视图添加事项状态（pending/completed/abandoned）多选筛选功能。筛选逻辑在 `DataConverter` 层统一实现，各视图通过 `itemStatusFilter` prop 传入要显示的状态列表。

## 当前状态分析

* **ItemStatus 类型**：`'pending' | 'completed' | 'abandoned'`（定义在 `src/types/models.ts:122`）

* **现有状态过滤**：仅 TodoDock 和 QuadrantTab 使用 `projectStore.hideCompleted/hideAbandoned` 做隐藏/显示

* **甘特图**：`DataConverter.projectsToGanttTasks()` 接收 `dateFilter` 但无状态过滤；`GanttTab` 工具栏有日期筛选但无状态筛选

* **日历图**：`DataConverter.projectsToCalendarEvents()` 无状态过滤；`CalendarTab` 无状态筛选 UI

* **项目视图**：`ProjectTab` 无状态筛选

* **SySelect 不支持多选**，但 TodoFilterBar 中优先级筛选使用按钮组实现多选（可参考该模式）

## 设计决策

1. **筛选模型**：使用 `ItemStatus[]` 数组表示要显示的状态列表，空数组或 undefined 表示显示全部（不过滤）
2. **筛选位置**：在 `DataConverter` 层统一过滤，各视图传入 `itemStatusFilter` 参数
3. **UI 方式**：在 GanttTab 工具栏和 CalendarTab 工具栏中使用按钮组多选（参考 TodoFilterBar 的优先级按钮模式），ProjectTab 中使用类似的按钮组
4. **Workbench 配置**：各 WorkbenchViewConfig 新增 `itemStatusFilter?: ItemStatus[]` 字段

## 修改清单

### 1. 类型定义 — `src/types/workbench.ts`

在 `WorkbenchGanttViewConfig`、`WorkbenchCalendarViewConfig`、`WorkbenchProjectViewConfig` 中新增 `itemStatusFilter` 字段：

```typescript
import type { ItemStatus } from '@/types/models'

// WorkbenchGanttViewConfig 新增：
itemStatusFilter?: ItemStatus[]

// WorkbenchCalendarViewConfig 新增：
itemStatusFilter?: ItemStatus[]

// WorkbenchProjectViewConfig 新增：
itemStatusFilter?: ItemStatus[]
```

### 2. DataConverter 层过滤 — `src/utils/dataConverter.ts`

#### 2.1 `projectsToGanttTasks` 方法

签名新增 `itemStatusFilter?: ItemStatus[]` 参数：

```typescript
public static projectsToGanttTasks(
  projects: Project[],
  showItems: boolean = false,
  dateFilter?: { start?: string, end?: string },
  itemStatusFilter?: ItemStatus[],
): GanttTask[]
```

在 `showItems && task.items.length > 0` 分支中，过滤 items：

```typescript
const filteredItems = itemStatusFilter && itemStatusFilter.length > 0
  ? task.items.filter(item => itemStatusFilter.includes(item.status))
  : task.items
```

将 `task.items` 替换为 `filteredItems`。

#### 2.2 `projectsToCalendarEvents` 方法

签名新增 `itemStatusFilter?: ItemStatus[]` 参数：

```typescript
public static projectsToCalendarEvents(
  projects: Project[],
  groupId?: string,
  itemStatusFilter?: ItemStatus[],
): CalendarEvent[]
```

在遍历 items 时加入状态过滤（与甘特图相同逻辑）。

### 3. GanttTab — `src/tabs/GanttTab.vue`

#### 3.1 新增 props

```typescript
itemStatusFilter?: ItemStatus[]
```

默认值：`undefined`（不过滤）

#### 3.2 工具栏新增状态筛选按钮组

在日期筛选区域之后、视图模式按钮之前，新增状态筛选按钮组（参考 TodoFilterBar 的优先级按钮模式）：

```vue
<div class="status-filter">
  <button
    v-for="s in statusOptions"
    :key="s.value"
    class="status-btn"
    :class="[{ active: !itemStatusFilter || itemStatusFilter.includes(s.value) }]"
    @click="toggleStatusFilter(s.value)"
  >
    {{ s.label }}
  </button>
</div>
```

其中 `statusOptions`：

```typescript
const statusOptions: Array<{ value: ItemStatus, label: string }> = [
  { value: 'pending', label: t('gantt').statusPending },
  { value: 'completed', label: t('gantt').statusCompleted },
  { value: 'abandoned', label: t('gantt').statusAbandoned },
]
```

`toggleStatusFilter` 逻辑：维护内部 `itemStatusFilter` ref，点击按钮切换该状态的显示/隐藏。当所有状态都选中时，`itemStatusFilter` 为 undefined（不过滤）。

#### 3.3 传递给 GanttView

```vue
<GanttView
  :projects="filteredProjects"
  :show-items="showItems"
  :start-date="startDate"
  :end-date="endDate"
  :view-mode="viewMode"
  :item-status-filter="itemStatusFilter"
/>
```

### 4. GanttView — `src/components/gantt/GanttView.vue`

#### 4.1 Props 新增

```typescript
interface Props {
  projects: Project[]
  showItems?: boolean
  startDate?: string
  endDate?: string
  viewMode?: 'day' | 'week' | 'month'
  itemStatusFilter?: ItemStatus[]
}
```

#### 4.2 ganttData computed 传递

```typescript
const ganttData = computed(() => {
  const dateFilter = props.startDate || props.endDate
    ? { start: props.startDate, end: props.endDate }
    : undefined
  return DataConverter.projectsToGanttTasks(props.projects, props.showItems, dateFilter, props.itemStatusFilter)
})
```

### 5. CalendarTab — `src/tabs/CalendarTab.vue`

#### 5.1 新增 props

```typescript
itemStatusFilter?: ItemStatus[]
```

#### 5.2 工具栏新增状态筛选按钮组

与 GanttTab 类似的按钮组模式。

#### 5.3 传递给 CalendarView

CalendarView 需要新增 `itemStatusFilter` prop，并在获取日历事件时传递给 `DataConverter.projectsToCalendarEvents()`。

### 6. CalendarView — `src/components/calendar/CalendarView.vue`

#### 6.1 Props 新增

```typescript
itemStatusFilter?: ItemStatus[]
```

#### 6.2 传递给 DataConverter

在获取日历事件数据时，将 `itemStatusFilter` 传递给 `DataConverter.projectsToCalendarEvents()`。

### 7. ProjectTab — `src/tabs/ProjectTab.vue`

#### 7.1 新增 props

```typescript
itemStatusFilter?: ItemStatus[]
```

#### 7.2 工具栏/筛选区域新增状态筛选按钮组

#### 7.3 传递给 ProjectView

ProjectView 需要在渲染事项时根据 `itemStatusFilter` 过滤。由于项目视图的事项渲染在 `ProjectTreeNode.vue` 中，需要在树构建阶段或渲染阶段过滤。

### 8. Workbench 视图适配

#### 8.1 WorkbenchGanttView\.vue

传递 `itemStatusFilter` prop 给 GanttTab。

#### 8.2 WorkbenchCalendarView\.vue

传递 `itemStatusFilter` prop 给 CalendarTab。

#### 8.3 WorkbenchProjectView\.vue

传递 `itemStatusFilter` prop 给 ProjectTab。

#### 8.4 各 ConfigDialog

GanttViewConfigDialog、CalendarViewConfigDialog、ProjectViewConfigDialog 中新增状态筛选多选配置。

### 9. viewRegistry — `src/workbench/viewRegistry.ts`

各视图的 `createDefaultConfig` 和 `openConfigDialog` 中新增 `itemStatusFilter` 字段。

### 10. i18n — `src/i18n/zh_CN.json` / `en_US.json`

新增状态筛选翻译 key：

* `gantt.statusPending` / `calendar.statusPending` → 待办 / Pending

* `gantt.statusCompleted` / `calendar.statusCompleted` → 已完成 / Completed

* `gantt.statusAbandoned` / `calendar.statusAbandoned` → 已放弃 / Abandoned

（考虑是否用 common 命名空间统一，避免重复）

## 验证步骤

1. `npm run test` — 确保现有测试通过
2. `npm run typecheck` — 类型检查通过
3. `npm run lint` — lint 通过
4. `npm run build` — 构建成功
5. 手动验证：在甘特图、日历、项目视图中切换状态筛选按钮，确认事项正确过滤

