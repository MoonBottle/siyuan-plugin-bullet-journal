# EventDetailTooltip 自包含 Tooltip 组件 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 CalendarView 和 GanttView 中重复的 tooltip 代码（状态/逻辑/模板/样式）收进 EventDetailTooltip 组件，视图只需 `<EventDetailTooltip ref>` + `show()`/`hide()` API。

**架构：** EventDetailTooltip 从纯内容壳升级为自包含 tooltip 组件，内部管理 Teleport、延迟显示、定位计算、显隐动画、内容渲染。CalendarView 和 GanttView 移除各自的 tooltip 状态/逻辑/模板/样式，改用 EventDetailTooltip 的 `show(event, anchorEl, delay?)` / `hide()` API。删除不再需要的 `buildEventDetailContent` 函数。

**技术栈：** Vue 3.5 + TypeScript + SCSS

---

## 文件结构

| 文件 | 职责 | 变更 |
|------|------|------|
| `src/components/dialog/EventDetailTooltip.vue` | 自包含 tooltip 组件：Teleport + 定位 + 显隐 + 内容渲染 | 重写 |
| `src/components/calendar/CalendarView.vue` | 日历视图：移除 tooltip 代码，改用 EventDetailTooltip | 修改 |
| `src/components/gantt/GanttView.vue` | 甘特视图：移除 tooltip 代码，改用 EventDetailTooltip | 修改 |
| `src/utils/dialog.ts` | 删除 `buildEventDetailContent` 函数 | 修改 |

---

### 任务 1：重写 EventDetailTooltip.vue 为自包含 tooltip 组件

**文件：**
- 重写：`src/components/dialog/EventDetailTooltip.vue`

- [ ] **步骤 1：重写 EventDetailTooltip.vue**

将现有内容替换为以下完整代码：

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

<script setup lang="ts">
import type { CalendarEvent, Item } from '@/types/models'
import { nextTick, ref } from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import { buildItemFromEventProps } from '@/utils/dialog'
import { computeTooltipPosition } from '@/utils/tooltipPosition'

const tooltipEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const positionStyle = ref<{ left?: string, top?: string }>({})
const currentItem = ref<Item | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let isHoveringTooltip = false

const show = (event: CalendarEvent, anchorEl: HTMLElement, delay = 300) => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  timer = setTimeout(() => {
    timer = null
    currentItem.value = buildItemFromEventProps(event)
    nextTick(() => {
      if (tooltipEl.value) {
        const rect = anchorEl.getBoundingClientRect()
        positionStyle.value = computeTooltipPosition(rect, tooltipEl.value, 4)
        visible.value = true
      }
    })
  }, delay)
}

const hide = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!isHoveringTooltip) {
    visible.value = false
  }
}

const onTooltipMouseEnter = () => {
  isHoveringTooltip = true
}

const onTooltipMouseLeave = () => {
  isHoveringTooltip = false
  visible.value = false
}

defineExpose({ show, hide })
</script>

<style lang="scss">
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

  .sy-dialog-content {
    padding: 0 !important;
  }

  .sy-dialog-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sy-dialog-card {
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
  }
}
</style>
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npm run typecheck`
预期：无类型错误

- [ ] **步骤 3：运行 lint 验证**

运行：`npm run lint`
预期：无 lint 错误

- [ ] **步骤 4：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 5：Commit**

```bash
git add src/components/dialog/EventDetailTooltip.vue
git commit -m "refactor: EventDetailTooltip 升级为自包含 tooltip 组件`n`n包含 Teleport、延迟显示、定位计算、显隐动画、内容渲染，`n暴露 show(event, anchorEl, delay?) / hide() API。"
```

---

### 任务 2：改造 CalendarView.vue 使用 EventDetailTooltip

**文件：**
- 修改：`src/components/calendar/CalendarView.vue`

- [ ] **步骤 1：添加 EventDetailTooltip import 和 ref**

在 `<script setup>` 中添加 import：

```ts
import EventDetailTooltip from '@/components/dialog/EventDetailTooltip.vue'
```

在 `const calendarEl = ref<HTMLElement | null>(null)` 附近添加：

```ts
const eventTooltipRef = ref<InstanceType<typeof EventDetailTooltip> | null>(null)
```

- [ ] **步骤 2：移除 tooltip 相关状态和 import**

删除以下状态变量（约第 256-259 行）：

```ts
const eventTooltipEl = ref<HTMLElement | null>(null)
const eventTooltipVisible = ref(false)
const eventTooltipStyle = ref<{ left?: string, top?: string }>({})
let eventTooltipTimer: ReturnType<typeof setTimeout> | null = null
```

删除 `buildEventDetailContent` 的 import（第 63 行）：

```ts
  buildEventDetailContent,
```

删除 `computeTooltipPosition` 的 import（第 74 行）：

```ts
import { computeTooltipPosition } from '@/utils/tooltipPosition'
```

- [ ] **步骤 3：移除 showEventTooltip 和 hideEventTooltip 函数**

删除 `showEventTooltip` 函数（约第 268-295 行）和 `hideEventTooltip` 函数（约第 298-304 行）。

- [ ] **步骤 4：修改 eventDidMount 中的 mouseenter/mouseleave 处理**

将第 574-575 行：

```ts
        info.el.addEventListener('mouseenter', () => showEventTooltip(info))
        info.el.addEventListener('mouseleave', () => hideEventTooltip())
```

替换为：

```ts
        info.el.addEventListener('mouseenter', () => {
          const eventData: CalendarEvent = {
            id: info.event.id,
            title: info.event.title,
            start: info.event.startStr,
            end: info.event.endStr,
            allDay: info.event.allDay,
            extendedProps: info.event.extendedProps as CalendarEvent['extendedProps'],
          }
          eventTooltipRef.value?.show(eventData, info.el)
        })
        info.el.addEventListener('mouseleave', () => {
          eventTooltipRef.value?.hide()
        })
```

- [ ] **步骤 5：替换模板中的 Teleport tooltip 为 EventDetailTooltip 组件**

将模板中第 7-14 行的 Teleport 块：

```vue
    <Teleport to="body">
      <div
        ref="eventTooltipEl"
        class="calendar-event-tooltip"
        :class="{ 'calendar-event-tooltip--visible': eventTooltipVisible }"
        :style="eventTooltipStyle"
      />
    </Teleport>
```

替换为：

```vue
    <EventDetailTooltip ref="eventTooltipRef" />
```

- [ ] **步骤 6：删除 .calendar-event-tooltip 样式块**

删除第 717-753 行的 `.calendar-event-tooltip` 样式块（整个 `<style lang="scss">` 块，注意不要删除后面的 FullCalendar 全局样式块）。

- [ ] **步骤 7：运行 typecheck 验证**

运行：`npm run typecheck`
预期：无类型错误

- [ ] **步骤 8：运行 lint 验证**

运行：`npm run lint`
预期：无 lint 错误

- [ ] **步骤 9：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 10：Commit**

```bash
git add src/components/calendar/CalendarView.vue
git commit -m "refactor(calendar): 使用 EventDetailTooltip 替换内联 tooltip 代码`n`n移除 CalendarView 中的 tooltip 状态/逻辑/模板/样式，`n改用 EventDetailTooltip 组件的 show/hide API。"
```

---

### 任务 3：改造 GanttView.vue 使用 EventDetailTooltip

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

- [ ] **步骤 1：添加 EventDetailTooltip import 和 ref**

在 `<script setup>` 中添加 import：

```ts
import EventDetailTooltip from '@/components/dialog/EventDetailTooltip.vue'
```

在 `const ganttEl = ref<HTMLElement | null>(null)` 附近添加：

```ts
const eventTooltipRef = ref<InstanceType<typeof EventDetailTooltip> | null>(null)
```

- [ ] **步骤 2：移除 tooltip 相关状态和 import**

删除以下状态变量（约第 100-103 行）：

```ts
const eventTooltipEl = ref<HTMLElement | null>(null)
const eventTooltipVisible = ref(false)
const eventTooltipStyle = ref<{ left?: string, top?: string }>({})
let eventTooltipTimer: ReturnType<typeof setTimeout> | null = null
```

删除 `buildEventDetailContent` 的 import（第 59 行）：

```ts
  buildEventDetailContent,
```

删除 `computeTooltipPosition` 的 import（第 65 行）：

```ts
import { computeTooltipPosition } from '@/utils/tooltipPosition'
```

- [ ] **步骤 3：提取 buildCalendarEventFromGanttTask 辅助函数**

在 GanttView.vue 的 `<script setup>` 中，`GANTT_TOOLTIP_HOVER_DELAY` 常量之后，添加辅助函数：

```ts
const buildCalendarEventFromGanttTask = (task: any): CalendarEvent => {
  const props = task.extendedProps
  const start = props.originalStartDateTime || props.date || ''
  const end = props.originalEndDateTime || props.originalStartDateTime || props.date || ''
  const allDay = !props.originalStartDateTime
  return {
    id: String(task.id),
    title: task.text,
    start,
    end: end !== start ? end : undefined,
    allDay,
    extendedProps: {
      project: props.project,
      projectLinks: props.projectLinks,
      task: props.task,
      taskLinks: props.taskLinks,
      level: props.level,
      item: props.item,
      itemStatus: props.itemStatus,
      itemLinks: props.itemLinks,
      hasItems: props.hasItems ?? true,
      docId: props.docId ?? '',
      lineNumber: props.lineNumber ?? 0,
      blockId: props.blockId,
      date: props.date,
      originalStartDateTime: props.originalStartDateTime,
      originalEndDateTime: props.originalEndDateTime,
      siblingItems: props.siblingItems,
      dateRangeStart: props.dateRangeStart,
      dateRangeEnd: props.dateRangeEnd,
      pomodoros: props.pomodoros,
    },
  }
}
```

- [ ] **步骤 4：移除 showGanttEventTooltip 和 hideGanttEventTooltip 函数**

删除 `showGanttEventTooltip` 函数（约第 105-163 行）和 `hideGanttEventTooltip` 函数（约第 165-171 行）。

- [ ] **步骤 5：重写 handleGanttTooltipMouseOver**

将 `handleGanttTooltipMouseOver` 函数（约第 173-183 行）替换为：

```ts
const handleGanttTooltipMouseOver = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const bar = target.closest('.gantt_task_line')
  const rightsideText = target.closest('.gantt-rightside-text')
  const anchor = bar || rightsideText
  if (anchor) {
    const taskId = gantt.locate(e)
    if (taskId != null && gantt.isTaskExists(taskId)) {
      const task = gantt.getTask(taskId)
      if (task?.extendedProps?.item) {
        const eventData = buildCalendarEventFromGanttTask(task)
        eventTooltipRef.value?.show(eventData, anchor as HTMLElement, GANTT_TOOLTIP_HOVER_DELAY)
      }
    }
  } else {
    eventTooltipRef.value?.hide()
  }
}
```

- [ ] **步骤 6：重写 handleGanttTooltipMouseOut**

将 `handleGanttTooltipMouseOut` 函数（约第 185-189 行）替换为：

```ts
const handleGanttTooltipMouseOut = (e: MouseEvent) => {
  const related = e.relatedTarget as HTMLElement
  if (related?.closest('.event-detail-tooltip') || related?.closest('.gantt_task_line') || related?.closest('.gantt-rightside-text')) return
  eventTooltipRef.value?.hide()
}
```

- [ ] **步骤 7：简化 handleGanttTaskClick 中的 CalendarEvent 构建**

将 `handleGanttTaskClick` 函数（约第 212-250 行）中的 CalendarEvent 构建替换为使用辅助函数：

```ts
const handleGanttTaskClick = (id: string | number) => {
  const task = gantt.getTask(id)
  if (!task?.extendedProps?.item) return
  const eventData = buildCalendarEventFromGanttTask(task)
  showEventDetailModal(eventData)
}
```

- [ ] **步骤 8：简化 handleGanttContextMenu 中 onShowDetail 的 CalendarEvent 构建**

在 `handleGanttContextMenu` 函数中，将 `onShowDetail` 回调（约第 358-372 行）替换为：

```ts
      onShowDetail: () => {
        const eventData = buildCalendarEventFromGanttTask(gantt.getTask(taskId))
        showEventDetailModal(eventData)
      },
```

- [ ] **步骤 9：移除 onUnmounted 中的 eventTooltipTimer 清理**

删除 `onUnmounted` 中的以下代码（约第 747-750 行）：

```ts
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer)
    eventTooltipTimer = null
  }
```

- [ ] **步骤 10：替换模板中的 Teleport tooltip 为 EventDetailTooltip 组件**

将模板中第 12-19 行的 Teleport 块：

```vue
    <Teleport to="body">
      <div
        ref="eventTooltipEl"
        class="gantt-event-tooltip"
        :class="{ 'gantt-event-tooltip--visible': eventTooltipVisible }"
        :style="eventTooltipStyle"
      />
    </Teleport>
```

替换为：

```vue
    <EventDetailTooltip ref="eventTooltipRef" />
```

- [ ] **步骤 11：删除 .gantt-event-tooltip 样式块**

删除 `.gantt-event-tooltip` 样式块（约第 810-844 行）。

- [ ] **步骤 12：运行 typecheck 验证**

运行：`npm run typecheck`
预期：无类型错误

- [ ] **步骤 13：运行 lint 验证**

运行：`npm run lint`
预期：无 lint 错误

- [ ] **步骤 14：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 15：Commit**

```bash
git add src/components/gantt/GanttView.vue
git commit -m "refactor(gantt): 使用 EventDetailTooltip 替换内联 tooltip 代码`n`n移除 GanttView 中的 tooltip 状态/逻辑/模板/样式，`n改用 EventDetailTooltip 组件的 show/hide API。`n提取 buildCalendarEventFromGanttTask 辅助函数消除重复的 CalendarEvent 构建。"
```

---

### 任务 4：删除 buildEventDetailContent 函数

**文件：**
- 修改：`src/utils/dialog.ts`

- [ ] **步骤 1：删除 buildEventDetailContent 函数**

删除 `src/utils/dialog.ts` 中第 274-293 行的 `buildEventDetailContent` 函数及其 JSDoc 注释：

```ts
/**
 * 构建日历事件详情内容 HTML（供弹框与悬浮预览复用）
 * @param event 日历事件
 */
export function buildEventDetailContent(
  event: CalendarEvent,
): string {
  const item = buildItemFromEventProps(event)

  const container = document.createElement('div')
  const app = createApp(EventDetailTooltip, { item })

  app.use(getSharedPinia())
  app.mount(container)

  const html = container.innerHTML
  app.unmount()

  return html
}
```

- [ ] **步骤 2：检查 EventDetailTooltip import 是否仍被使用**

`EventDetailTooltip` 在 `dialog.ts` 中的 `buildEventDetailContent` 被删除后，检查是否还有其他引用。如果没有，删除第 24 行的 import：

```ts
import EventDetailTooltip from '@/components/dialog/EventDetailTooltip.vue'
```

注意：`createApp` 可能仍被其他函数使用（如 `showEventDetailModal` 中的 `ItemDetailDialog`），所以 `createApp` 的 import 保留。

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npm run typecheck`
预期：无类型错误

- [ ] **步骤 4：运行 lint 验证**

运行：`npm run lint`
预期：无 lint 错误

- [ ] **步骤 5：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 6：Commit**

```bash
git add src/utils/dialog.ts
git commit -m "refactor: 删除 buildEventDetailContent 函数`n`ntooltip 内容渲染已由 EventDetailTooltip 组件直接处理，`n不再需要 innerHTML 方式的 buildEventDetailContent。"
```
