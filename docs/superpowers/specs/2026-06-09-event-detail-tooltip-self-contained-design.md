# EventDetailTooltip 自包含 Tooltip 组件设计

## 问题

CalendarView.vue 和 GanttView.vue 中的悬浮提示（tooltip）代码高度重复：

- **模板层**：各自声明 `<Teleport>` + tooltip div，结构几乎一致
- **状态层**：`eventTooltipEl`、`eventTooltipVisible`、`eventTooltipStyle`、`eventTooltipTimer` 四个 ref 完全相同
- **逻辑层**：show/hide 函数逻辑相同（延迟 → 构建数据 → innerHTML → 定位 → 显示）
- **样式层**：`.calendar-event-tooltip` 和 `.gantt-event-tooltip` 仅 padding/border-radius 微差

EventDetailTooltip.vue 目前只负责内容渲染（ItemDetailContent 薄壳），不负责 tooltip 的定位/显隐/样式。

## 方案：EventDetailTooltip 升级为自包含 Tooltip 组件

将 EventDetailTooltip 从"纯内容壳"升级为包含 Teleport、定位、显隐、样式、延迟的完整 tooltip 组件。CalendarView 和 GanttView 只需放置组件 + 调用 `show()`/`hide()`。

### 组件 API

```ts
interface EventDetailTooltipExposed {
  /** 延迟显示 tooltip（默认 300ms） */
  show: (event: CalendarEvent, anchorEl: HTMLElement, delay?: number) => void
  /** 立即隐藏 tooltip */
  hide: () => void
}
```

### 模板结构

```vue
<template>
  <Teleport to="body">
    <div
      ref="tooltipEl"
      class="event-detail-tooltip"
      :class="{ 'event-detail-tooltip--visible': visible }"
      :style="positionStyle"
      @mouseenter="onTooltipMouseEnter"
      @mouseleave="onTooltipMouseLeave"
    >
      <ItemDetailContent
        v-if="currentItem"
        :item="currentItem"
        :readonly="true"
        :embedded="true"
      />
    </div>
  </Teleport>
</template>
```

### 内部状态

- `visible: ref<boolean>` — 控制 opacity 过渡
- `positionStyle: ref<{ left?: string, top?: string }>` — fixed 定位坐标
- `currentItem: ref<Item | null>` — 当前渲染的事项数据
- `timer: ReturnType<typeof setTimeout> | null` — 延迟显示计时器
- `isHoveringTooltip: boolean` — 鼠标是否在 tooltip 上（防止误隐藏）

### 内部逻辑

1. `show(event, anchorEl, delay=300)`：
   - 清除已有 timer
   - 设置新 timer，延迟后执行：
     - 调用 `buildItemFromEventProps(event)` 转为 Item
     - 设置 `currentItem`
     - `nextTick` 后调用 `computeTooltipPosition(anchorEl.getBoundingClientRect(), tooltipEl)` 计算位置
     - 设置 `visible = true`

2. `hide()`：
   - 清除 timer
   - 若鼠标不在 tooltip 上，设置 `visible = false`

3. `onTooltipMouseEnter` / `onTooltipMouseLeave`：
   - 维护 `isHoveringTooltip` 标志
   - mouseleave 时若 `isHoveringTooltip` 为 false，隐藏 tooltip

### 样式

统一为一份 `.event-detail-tooltip` 样式（非 scoped，因 Teleport 到 body）：

```scss
.event-detail-tooltip {
  position: fixed;
  z-index: 10000;
  min-width: 350px;
  max-width: 440px;
  overflow: visible;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.15s ease;

  &.event-detail-tooltip--visible {
    opacity: 1;
  }

  .sy-dialog-content { padding: 0 !important; }
  .sy-dialog-cards { display: flex; flex-direction: column; gap: 8px; }
  .sy-dialog-card { font-size: 12px; padding: 10px 14px; border-radius: 4px; border: 1px solid var(--b3-border-color); }
}
```

## 视图侧改造

### CalendarView.vue

**移除：**
- `eventTooltipEl`, `eventTooltipVisible`, `eventTooltipStyle`, `eventTooltipTimer` 状态
- `showEventTooltip()`, `hideEventTooltip()` 函数
- `<Teleport>` 模板块
- `.calendar-event-tooltip` 样式块
- `buildEventDetailContent`, `computeTooltipPosition` import

**替换为：**
```vue
<EventDetailTooltip ref="eventTooltipRef" />
```
```ts
const eventTooltipRef = ref<InstanceType<typeof EventDetailTooltip> | null>(null)

// eventDidMount 中：
info.el.addEventListener('mouseenter', () => {
  const eventData: CalendarEvent = { id, title, start, end, allDay, extendedProps }
  eventTooltipRef.value?.show(eventData, info.el)
})
info.el.addEventListener('mouseleave', () => {
  eventTooltipRef.value?.hide()
})
```

### GanttView.vue

**移除：**
- `eventTooltipEl`, `eventTooltipVisible`, `eventTooltipStyle`, `eventTooltipTimer` 状态
- `showGanttEventTooltip()`, `hideGanttEventTooltip()`, `handleGanttTooltipMouseOver()`, `handleGanttTooltipMouseOut()` 函数
- `<Teleport>` 模板块
- `.gantt-event-tooltip` 样式块
- `buildEventDetailContent`, `computeTooltipPosition` import

**替换为：**
```vue
<EventDetailTooltip ref="eventTooltipRef" />
```
```ts
const eventTooltipRef = ref<InstanceType<typeof EventDetailTooltip> | null>(null)

// mouseover handler：
const anchor = bar || rightsideText
if (anchor) {
  const taskId = gantt.locate(e)
  if (taskId != null && gantt.isTaskExists(taskId)) {
    const task = gantt.getTask(taskId)
    if (task?.extendedProps?.item) {
      const eventData = buildCalendarEventFromGanttTask(task)
      eventTooltipRef.value?.show(eventData, anchor, GANTT_TOOLTIP_HOVER_DELAY)
    }
  }
} else {
  eventTooltipRef.value?.hide()
}

// mouseout handler：
const related = e.relatedTarget as HTMLElement
if (!related?.closest('.event-detail-tooltip') && !related?.closest('.gantt_task_line') && !related?.closest('.gantt-rightside-text')) {
  eventTooltipRef.value?.hide()
}
```

## 清理

- **`buildEventDetailContent`**：删除（仅被 CalendarView 和 GanttView 的 tooltip 使用，重构后不再需要 innerHTML 方式）
- **`buildItemFromEventProps`**：保留，EventDetailTooltip 内部使用它将 CalendarEvent 转为 Item
- **`computeTooltipPosition`**：保留，EventDetailTooltip 内部使用

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/components/dialog/EventDetailTooltip.vue` | 重写为自包含 tooltip 组件 |
| `src/components/calendar/CalendarView.vue` | 移除 tooltip 状态/逻辑/模板/样式，改用 EventDetailTooltip |
| `src/components/gantt/GanttView.vue` | 移除 tooltip 状态/逻辑/模板/样式，改用 EventDetailTooltip |
| `src/utils/dialog.ts` | 删除 `buildEventDetailContent` 函数 |
