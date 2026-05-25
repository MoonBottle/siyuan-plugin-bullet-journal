# 甘特图多日期事项合并展示设计

## 问题

多日期事项（如 `整理资料 @2026-03-01, 2026-03-10~03-12`）在甘特图中被拆分为多行独立展示，占用大量纵向空间，且无法传达"这是同一件事"的语义。

## 方案

在 DataConverter 层将同一 `blockId` 的多日期 Item 合并为一个 `render: "split"` 的父任务 + 多个分段子任务，利用 dhtmlx-gantt 9.1 原生 Split Tasks 功能在同一行展示多个分段条。

Parser 层不变，日历、Todo、blockWriter 等其他视图不受影响。

## 数据结构

### 合并前（3 个日期 = 3 行）

```
task-yyy (任务行)
  ├── item-xxx-0: 整理资料, 3/1   ← 独立行
  ├── item-xxx-1: 整理资料, 3/10  ← 独立行
  └── item-xxx-2: 整理资料, 3/12  ← 独立行
```

### 合并后（3 个日期 = 1 行，内含分段条）

```
task-yyy (任务行)
  └── split-zzz: 整理资料 (type: project, render: split)  ← 合并行
        ├── item-xxx-0: 整理资料, 3/1   ← 分段条
        └── item-xxx-1: 整理资料, 3/10~3/12  ← 连续分段条
```

## 分段合并算法

同 `blockId` 下的多个 Item 按日期排序后，按以下规则合并为段（segment）：

**只有全天事项（无 startDateTime）且日期连续时，才合并为一根条。有时间的事项，每个 Item 独立一根条。**

### 示例

| 语法 | Parser 产出 | 合并结果 |
|---|---|---|
| `整理资料 @2026-03-01, 2026-03-10~03-12` | 3/1(全天), 3/10(全天), 3/11(全天), 3/12(全天) | 2 根条：3/1 一根，3/10~3/12 一根 |
| `整理资料 @2026-03-10~03-12 14:00~15:00` | 3/10(14-15), 3/11(14-15), 3/12(14-15) | 3 根条：每天各一根 |
| `整理资料 @2026-03-06 09:00~09:30, 2026-03-10 14:00~15:00` | 3/6(9-9:30), 3/10(14-15) | 2 根条：各一根 |
| `整理资料 @2026-03-01, 2026-03-02, 2026-03-10` | 3/1(全天), 3/2(全天), 3/10(全天) | 2 根条：3/1~3/2 一根，3/10 一根 |
| `整理资料 @2026-03-01, 2026-03-10 14:00~15:00` | 3/1(全天), 3/10(14-15) | 2 根条：3/1 一根，3/10 一根 |

### 算法伪代码

```typescript
interface Segment {
  items: Item[];
}

function mergeItemsToSegments(items: Item[]): Segment[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const item of sorted) {
    if (item.startDateTime) {
      segments.push({ items: [item] });
      current = null;
      continue;
    }

    if (current && isNextDay(lastDateOf(current), item.date)) {
      current.items.push(item);
    } else {
      current = { items: [item] };
      segments.push(current);
    }
  }

  return segments;
}
```

## 改动范围

### 1. DataConverter.projectsToGanttTasks()

文件：`src/utils/dataConverter.ts`

在 `showItems` 分支中，遍历 `task.items` 前先按 `blockId` 分组：

- 同 `blockId` 只有 1 个 Item → 保持原逻辑，直接生成 GanttTask
- 同 `blockId` 有多个 Item → 调用 `mergeItemsToSegments()` 合并为段，生成 split 父任务 + 段子任务

Split 父任务属性：

```typescript
{
  id: `split-${item.blockId}`,
  text: item.content,
  type: 'project',
  render: 'split',
  parent: taskId,
  open: true,
  progress: 0,
  start_date: minDate,   // 所有子任务的最早日期
  end_date: maxDate,     // 所有子任务的最晚日期
}
```

段子任务属性：

```typescript
{
  id: `item-${firstItem.id}`,
  text: firstItem.content,
  start_date: segmentStartDate,
  end_date: segmentEndDate,
  parent: `split-${item.blockId}`,
  type: 'task',
  progress: 0,
  extendedProps: {
    // 段首 Item 的属性
    segmentDates: datesInSegment,  // 段内所有日期列表，供 tooltip 使用
  }
}
```

### 2. GanttView.vue 交互适配

文件：`src/components/gantt/GanttView.vue`

#### 2.1 配置

```typescript
gantt.config.open_split_tasks = true;
```

#### 2.2 点击事件

`handleGanttTaskClick` 中，split 父任务（id 以 `split-` 开头）跳过处理。

#### 2.3 右键菜单

`handleGanttContextMenu` 中，split 父任务跳过，返回 `true`。

#### 2.4 Tooltip

`showGanttEventTooltip` 中，split 父任务不显示 tooltip。

#### 2.5 任务条样式

`task_class` 模板新增 split 父任务样式：

```typescript
if (String(task.id).startsWith('split-')) return 'gantt-split-parent';
```

CSS：

```scss
.gantt-split-parent {
  visibility: hidden;
}
```

#### 2.6 任务条文本

`task_text` 模板对 split 父任务返回空字符串，避免条内文字重叠。

#### 2.7 右侧文本

`rightside_text` 模板对 split 父任务返回空字符串。

### 3. 不改动的部分

- `src/parser/` — Parser 层不变，Item 仍然按日期拆分
- `src/stores/` — Store 层不变
- 日历视图 — 不受影响
- Todo 视图 — 不受影响
- blockWriter — 不受影响
- dateRangeUtils — 不受影响

## 测试策略

1. **单元测试**：`mergeItemsToSegments()` 函数的纯逻辑测试，覆盖全天连续、全天不连续、有时间混合等场景
2. **单元测试**：`DataConverter.projectsToGanttTasks()` 的集成测试，验证 split 结构正确生成
3. **手动验证**：在甘特图中确认多日期事项合并展示效果
