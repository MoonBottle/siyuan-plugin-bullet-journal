# 计划：短时事项单行显示

## 摘要

当日历事项持续时间 ≤30 分钟时，将事件内容从两行布局改为单行紧凑布局，避免在时间网格视图中显得拥挤。

## 当前状态分析

* `renderEventContent` 函数（第 102-215 行）始终创建两行 DOM 结构：

  * `line1`：时间 + 任务名

  * `line2`：状态 emoji + 标题 + 番茄钟总时长

* CSS `.fc-event-custom`（第 770-819 行）使用 `flex-direction: column`，`min-height: 2.6em`

* 短时事项在 timeGrid 视图中高度很小，两行布局导致内容挤压、可读性差

## 修改方案

### 1. 修改 `renderEventContent` 函数

**文件**: `src/components/calendar/CalendarView.vue`（第 102-215 行）

* 在函数开头计算事件持续时间（通过 `arg.event.startStr` 和 `arg.event.endStr`）

* 当持续时间 ≤30 分钟时，使用单行布局：

  * 所有内容（时间 + 状态emoji + 标题）放在一行

  * 为 container 添加 `fc-event-compact` CSS 类

* 当持续时间 >30 分钟或为全天事件时，保持现有两行布局不变

具体逻辑：

```
计算 duration = end - start（分钟）
isCompact = duration > 0 && duration <= 30

if (isCompact):
  container.className = 'fc-event-custom fc-event-compact'
  只创建一个 div，内容为：时间 + 状态emoji + 标题
else:
  保持现有两行布局
```

### 2. 添加 `.fc-event-compact` CSS 样式

**文件**: `src/components/calendar/CalendarView.vue`（全局样式区域，约第 770 行之后）

```scss
.fc-event-compact {
  flex-direction: row;
  align-items: center;
  gap: 4px;
  min-height: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .fc-event-time {
    font-size: 11px;
    flex-shrink: 0;
  }

  .fc-event-title-text {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

## 假设与决策

* **30 分钟阈值**：用户明确指定 ≤30 分钟为短时事项

* **全天事件**：不适用紧凑布局（`allDay` 事件无持续时间概念）

* **番茄钟背景事件**：已有单独处理逻辑，不受影响

* **无结束时间的事件**：无法计算持续时间，保持两行布局

* **紧凑模式下省略任务名和番茄钟总时长**：单行空间有限，只显示时间+状态+标题

## 验证步骤

1. `npm run lint` 确认无 lint 错误
2. `npm run typecheck` 确认无类型错误
3. `npm run test` 确认测试通过
4. 手动验证：在日历时间网格视图中，≤30 分钟的事项应显示为单行，>30 分钟的保持两行

