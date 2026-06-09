# 甘特图事项日期优先过滤设计

## 背景

在甘特图中，当 `showItems=true` 且有日期过滤时，当前的处理顺序是：

1. 用**所有事项**计算任务日期（`calculateTaskDates`）
2. 用计算出的任务日期判断是否在过滤范围内（`isTaskInDateRange`）
3. 显示事项时仅按状态过滤，**不按日期过滤**

这导致：任务条显示的是所有事项的时间范围，而非过滤后事项的时间范围，视觉上不一致。

根据数据格式规范，**任务本身不带日期，事项必须带日期**，任务时间完全从子事项推导。因此，先过滤事项再计算任务时间更合理。

## 需求

- **`showItems=true`**：先按日期范围过滤事项，再从过滤后的事项计算任务和项目的开始/结束时间
- **`showItems=false`**：保持现有逻辑不变
- 事项过滤后为空的 task 应隐藏
- 事项与日期过滤范围有**交集**即保留（与 `isTaskInDateRange` 逻辑一致）

## 方案

### 新增 `filterItemsByDate` 方法

```typescript
private static filterItemsByDate(
  items: Item[],
  dateFilter?: { start?: string, end?: string },
): Item[]
```

- 对每个 item，计算其 start/end 日期
- 判断 item 日期范围是否与 `dateFilter` 有交集
- 无 `dateFilter` 时返回原数组
- 交集判断逻辑：`itemStart <= filterEnd && itemEnd >= filterStart`

### 修改 `projectsToGanttTasks` 处理顺序

**当 `showItems=true` 时**：

```
旧：task → isTaskInDateRange(全量items) → calculateTaskDates(全量items) → 过滤items(仅status) → 渲染
新：task → 过滤items(日期+status) → calculateTaskDates(过滤后items) → filteredItems为空则跳过 → 渲染
```

**当 `showItems=false` 时**：保持现有逻辑不变。

### 修改 `calculateTaskDates` 签名

```typescript
private static calculateTaskDates(
  task: Task,
  items?: Item[],  // 可选，优先使用传入的 items
): { start: Date | undefined, end: Date | undefined }
```

- 有 `items` 参数时，用传入的 items 计算日期（跳过 `task.date/startDateTime` 分支）
- 无 `items` 参数时，保持现有逻辑

### 任务可见性判断

- `showItems=true`：通过 `filteredItems.length === 0` 判断是否跳过任务，不再调用 `isTaskInDateRange`
- `showItems=false`：继续使用 `isTaskInDateRange`

## 影响范围

- `src/utils/dataConverter.ts`：核心改动文件
- `src/components/gantt/GanttView.vue`：无需改动（通过 props 传递的参数不变）
- `src/tabs/GanttTab.vue`：无需改动
- 日历视图 `projectsToCalendarEvents`：不受影响（日历无日期过滤）

## 测试要点

- `showItems=true` + 日期过滤：事项、任务条、项目条时间范围一致
- `showItems=true` + 日期过滤 + 状态过滤：两种过滤叠加正确
- `showItems=true` + 日期过滤后事项为空：任务不显示
- `showItems=false` + 日期过滤：行为与改动前一致
- 无日期过滤：行为与改动前一致
- 多日期事项的日期过滤：segments 逻辑不受影响
