# EventDetailTooltip 复用 ItemDetailContent 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 给 ItemDetailContent 加 `readonly` prop，让 EventDetailTooltip 作为薄壳复用 ItemDetailContent，消除重复的卡片渲染逻辑。

**架构：** ItemDetailContent 新增 `readonly` prop 控制隐藏交互元素（复制按钮/优先级/标签/操作行/预计专注/偏差），EventDetailTooltip 简化为只含边距样式 + 嵌入 ItemDetailContent 的薄壳。dialog.ts 提取共享的 Item 构建函数。

**技术栈：** Vue 3 + TypeScript + SCSS

---

## 文件结构

| 文件 | 职责 | 变更类型 |
|------|------|---------|
| `src/components/dialog/ItemDetailContent.vue` | 内容渲染组件，新增 `readonly` 模式 | 修改 |
| `src/components/dialog/EventDetailTooltip.vue` | tooltip 薄壳，嵌入 ItemDetailContent | 重写 |
| `src/utils/dialog.ts` | 提取 `buildItemFromEventProps`，简化 tooltip 调用 | 修改 |
| `test/utils/dialog.tooltip.test.ts` | 更新 EventDetailTooltip mock | 修改 |

---

### 任务 1：ItemDetailContent 新增 `readonly` prop + 条件渲染

**文件：**
- 修改：`src/components/dialog/ItemDetailContent.vue`

- [ ] **步骤 1：在 props 接口中新增 `readonly` prop**

在 `withDefaults(defineProps<{...}>(), {...})` 中新增：

```typescript
readonly?: boolean  // 默认 false
```

defaults 中添加 `readonly: false`。

- [ ] **步骤 2：根容器 class 绑定增加 `readonly` 条件**

将第 4 行的 `:class` 改为：

```html
:class="{
  'item-detail-content--embedded': embedded,
  'item-detail-content--readonly': readonly,
}"
```

- [ ] **步骤 3：隐藏复制按钮**

在所有 `copy-btn` 元素上添加 `v-if="!readonly"` 条件。涉及 5 处：
- 第 19-28 行：项目名复制按钮 → `v-if="!readonly"`
- 第 57-66 行：任务名复制按钮 → `v-if="!readonly"`
- 第 132-141 行：时长复制按钮 → `v-if="!readonly"`
- 第 153-163 行：专注时间复制按钮 → `v-if="!readonly"`
- 第 196-205 行：内容复制按钮 → `v-if="!readonly"`

- [ ] **步骤 4：隐藏优先级徽章**

第 95-99 行，优先级徽章添加条件：

```html
<span
  v-if="props.item.priority && !readonly"
  class="priority-badge-header"
>
```

- [ ] **步骤 5：隐藏标签行**

第 68-77 行任务标签行：`v-if="taskTags.length"` → `v-if="taskTags.length && !readonly"`
第 208-217 行事项标签行：`v-if="itemTags.length"` → `v-if="itemTags.length && !readonly"`

- [ ] **步骤 6：隐藏预计专注和偏差 meta 项**

第 165-175 行预计专注：`v-if="focusPlanDisplay"` → `v-if="focusPlanDisplay && !readonly"`
第 176-186 行偏差：`v-if="focusPlanReview"` → `v-if="focusPlanReview && !readonly"`

- [ ] **步骤 7：添加 `readonly` 样式**

在 `<style>` 中添加：

```scss
.item-detail-content--readonly {
  :deep(.typed-link) {
    pointer-events: none;
    cursor: default;
  }
}
```

- [ ] **步骤 8：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 9：Commit**

```bash
git add src/components/dialog/ItemDetailContent.vue
git commit -m "feat: add readonly prop to ItemDetailContent"
```

---

### 任务 2：EventDetailTooltip 简化为薄壳

**文件：**
- 重写：`src/components/dialog/EventDetailTooltip.vue`

- [ ] **步骤 1：重写 EventDetailTooltip.vue**

将整个文件替换为：

```vue
<template>
  <div class="event-detail-tooltip">
    <ItemDetailContent
      :item="item"
      :readonly="true"
      :embedded="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'

defineProps<{
  item: Item
}>()
</script>

<style lang="scss" scoped>
.event-detail-tooltip {
  padding: 3px;
  min-width: 280px;
  max-width: 400px;
}
</style>
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/dialog/EventDetailTooltip.vue
git commit -m "refactor: simplify EventDetailTooltip to thin wrapper using ItemDetailContent"
```

---

### 任务 3：dialog.ts 提取共享 Item 构建函数 + 简化 tooltip 调用

**文件：**
- 修改：`src/utils/dialog.ts`

- [ ] **步骤 1：提取 `buildItemFromEventProps` 函数**

在 `buildEventDetailContent` 函数之前（约第 367 行），新增共享函数：

```typescript
/**
 * 从日历事件的 extendedProps 构建 Item 对象
 * 供 tooltip 和弹框复用
 */
function buildItemFromEventProps(event: CalendarEvent): Item {
  const props = event.extendedProps
  const start = event.start
  const end = event.end
  const rawDate = props.date
    || (typeof start === 'string' ? (start.includes('T') ? start.split('T')[0] : start.split(' ')[0]) : '')
    || (start ? dayjs(start).format('YYYY-MM-DD') : '')

  return {
    id: props.blockId || '',
    content: props.item || '',
    date: rawDate,
    status: props.itemStatus || 'pending',
    priority: props.priority,
    docId: props.docId,
    lineNumber: props.lineNumber,
    blockId: props.blockId,
    project: props.project
      ? {
          id: '',
          name: props.project,
          tasks: [],
          habits: [],
          path: '',
          links: props.projectLinks || [],
        }
      : undefined,
    task: props.task
      ? {
          id: '',
          name: props.task,
          level: props.level as 'L1' | 'L2' | 'L3' ?? 'L1',
          items: [],
          lineNumber: 0,
          links: props.taskLinks || [],
        }
      : undefined,
    links: props.itemLinks || [],
    pomodoros: props.pomodoros || [],
    startDateTime: props.originalStartDateTime,
    endDateTime: props.originalEndDateTime,
    siblingItems: props.siblingItems,
    dateRangeStart: props.dateRangeStart,
    dateRangeEnd: props.dateRangeEnd,
    reminder: props.reminder,
    repeatRule: props.repeatRule,
    endCondition: props.endCondition,
  }
}
```

- [ ] **步骤 2：简化 `buildEventDetailContent` 函数**

将 `buildEventDetailContent`（第 367-421 行）中的 `createApp(EventDetailTooltip, {...})` 调用简化为：

```typescript
export function buildEventDetailContent(
  event: CalendarEvent,
  options?: { preview?: boolean },
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

注意：`options?.preview` 参数不再需要，但为保持 API 兼容性保留参数签名（调用方可能传了 preview）。如果确认无外部调用方依赖 preview，可移除。

- [ ] **步骤 3：简化 `showEventDetailModal` 函数**

将 `showEventDetailModal`（第 426 行起）中的 Item 构建逻辑替换为 `buildItemFromEventProps`：

```typescript
export function showEventDetailModal(
  event: CalendarEvent,
  options?: { plugin?: Plugin | null },
): Dialog {
  const plugin = (options?.plugin ?? usePlugin()) as Plugin | null
  const props = event.extendedProps
  const item = buildItemFromEventProps(event)
  const rawDate = item.date
  const dateStr = rawDate || dayjs().format('YYYY-MM-DD')

  // 单例守卫：关闭已存在的事项详情弹框，避免重复点击创建多个
  if (lastEventDetailDialog) {
    lastEventDetailDialog.destroy()
    lastEventDetailDialog = null
  }

  const container = document.createElement('div')
  const hasSiblingItems = !!(props.siblingItems?.length)

  let dialog: Dialog
  const app = createApp(ItemDetailDialog, {
    item,
    showAllDates: hasSiblingItems,
    onClose: () => { dialog.destroy() },
    onOpenDoc: async () => {
      if (!plugin) return
      await openDocumentAtLine(plugin, props.docId, props.lineNumber, props.blockId)
      dialog.destroy()
    },
    onOpenCalendar: () => {
      if (plugin && (plugin as any).openCustomTab) {
        (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: dateStr })
      }
      dialog.destroy()
    },
    onSetReminder: () => { dialog.destroy(); showReminderSettingDialog(item) },
    onSetRecurring: () => { dialog.destroy(); showRecurringSettingDialog(item) },
    onSkipOccurrence: () => { dialog.destroy(); void skipCurrentOccurrence(plugin, item) },
  })

  app.use(getSharedPinia())
  app.mount(container)

  // ... 后续 dialog 创建逻辑不变
```

- [ ] **步骤 4：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 5：运行测试**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 6：Commit**

```bash
git add src/utils/dialog.ts
git commit -m "refactor: extract buildItemFromEventProps and simplify tooltip/modal calls"
```

---

### 任务 4：更新测试 mock

**文件：**
- 修改：`test/utils/dialog.tooltip.test.ts`

- [ ] **步骤 1：确认 EventDetailTooltip mock 无需变更**

当前测试文件第 22 行已有 `vi.mock('@/components/dialog/EventDetailTooltip.vue', () => ({ default: {} }))`。由于 EventDetailTooltip 仍然存在（只是内部实现变了），mock 不需要修改。测试内容是 icon tooltip helpers，与组件内部实现无关。

- [ ] **步骤 2：运行测试验证**

运行：`npx vitest run test/utils/dialog.tooltip.test.ts`
预期：所有测试通过

- [ ] **步骤 3：运行完整测试套件**

运行：`npm run test`
预期：所有测试通过
