# 甘特图 Task 点击详情 + ItemDetailDialog 事项切换 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 甘特图 Task 级别条形点击打开首个 Item 详情弹框，弹框内支持同 Task 下 Item 左右切换（箭头按钮 + 键盘快捷键），ItemActionBar 联动当前事项。

**架构：** 在 DataConverter 生成 Task 级别 gantt task 时填充 `firstItemBlockId` 和 `siblingBlockIds`；GanttView 点击 Task 时构建 CalendarEvent 并打开详情弹框；ItemDetailDialog 新增 `siblingBlockIds` prop 和内部导航状态，切换时更新 `activeBlockId` 使 `reactiveItem` 和 `ItemActionBar` 自动联动。

**技术栈：** Vue 3 + Pinia + TypeScript + dhtmlx-gantt

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/types/models.ts` | 类型定义：GanttTaskExtendedProps 和 CalendarEvent.extendedProps 增加 `firstItemBlockId`、`siblingBlockIds` |
| `src/utils/dataConverter.ts` | 数据转换：Task 级别 gantt task 填充 `firstItemBlockId` 和 `siblingBlockIds` |
| `src/components/gantt/GanttView.vue` | 交互：修改 `handleGanttTaskClick` 支持 Task 级别点击 |
| `src/components/dialog/ItemDetailDialog.vue` | UI + 状态：新增 `siblingBlockIds` prop、导航状态、导航栏 UI、键盘监听 |
| `src/utils/dialog.ts` | 弹框创建：`showEventDetailModal` 和 `showItemDetailModal` 传入 `siblingBlockIds` |

---

### 任务 1：类型定义 — 增加 `firstItemBlockId` 和 `siblingBlockIds`

**文件：**
- 修改：`src/types/models.ts`

- [ ] **步骤 1：在 `GanttTaskExtendedProps` 接口中增加两个字段**

在 `src/types/models.ts` 的 `GanttTaskExtendedProps` 接口中，在 `priority` 字段后添加：

```typescript
  /** Task 级别节点：该 Task 下第一个 Item 的 blockId */
  firstItemBlockId?: string
  /** Task 级别节点：该 Task 下所有 Item 的 blockId 列表（有序） */
  siblingBlockIds?: string[]
```

- [ ] **步骤 2：在 `CalendarEvent.extendedProps` 中增加 `siblingBlockIds` 字段**

在 `CalendarEvent` 接口的 `extendedProps` 中，在 `itemBlockId` 字段后添加：

```typescript
    /** 同一 Task 下所有 Item 的 blockId 列表（有序），用于弹框内左右切换 */
    siblingBlockIds?: string[]
```

注意：`CalendarEvent.extendedProps` 不需要 `firstItemBlockId`，因为甘特图点击 Task 时会直接构建一个指向首个 Item 的 CalendarEvent。

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：通过（新增可选字段不影响现有代码）

- [ ] **步骤 4：Commit**

```
git add src/types/models.ts
git commit -m "feat(types): GanttTask/CalendarEvent 增加 firstItemBlockId 和 siblingBlockIds 字段"
```

---

### 任务 2：DataConverter — Task 级别 gantt task 填充新字段

**文件：**
- 修改：`src/utils/dataConverter.ts`

- [ ] **步骤 1：修改 `showItems=true` 分支中 Task 级别 gantt task 的生成**

在 `projectsToGanttTasks` 函数中，`showItems=true` 分支生成 Task 级别 gantt task 的代码（约行 274-283），将：

```typescript
ganttTasks.push({
  id: taskId,
  text: task.name,
  start_date: start,
  end_date: end,
  parent: parentId,
  type: 'task',
  open: true,
  progress: 0,
})
```

改为：

```typescript
const taskItemBlockIds = task.items
  .filter(item => item.blockId)
  .map(item => item.blockId!)

ganttTasks.push({
  id: taskId,
  text: task.name,
  start_date: start,
  end_date: end,
  parent: parentId,
  type: 'task',
  open: true,
  progress: 0,
  extendedProps: {
    task: task.name,
    docId: task.items[0]?.docId ?? '',
    firstItemBlockId: taskItemBlockIds[0],
    siblingBlockIds: taskItemBlockIds.length > 1 ? taskItemBlockIds : undefined,
  },
})
```

- [ ] **步骤 2：修改 `showItems=false` 分支中 Task 级别 gantt task 的生成**

在 `showItems=false` 分支中（约行 447-456），做同样的修改：

```typescript
const taskItemBlockIds = task.items
  .filter(item => item.blockId)
  .map(item => item.blockId!)

ganttTasks.push({
  id: taskId,
  text: task.name,
  start_date: start,
  end_date: end,
  parent: parentId,
  type: 'task',
  open: true,
  progress: 0,
  extendedProps: {
    task: task.name,
    docId: task.items[0]?.docId ?? '',
    firstItemBlockId: taskItemBlockIds[0],
    siblingBlockIds: taskItemBlockIds.length > 1 ? taskItemBlockIds : undefined,
  },
})
```

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：通过

- [ ] **步骤 4：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 5：Commit**

```
git add src/utils/dataConverter.ts
git commit -m "feat(dataConverter): Task 级别 gantt task 填充 firstItemBlockId 和 siblingBlockIds"
```

---

### 任务 3：GanttView — 修改 `handleGanttTaskClick` 支持 Task 级别点击

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

- [ ] **步骤 1：修改 `handleGanttTaskClick` 函数**

将现有的 `handleGanttTaskClick` 函数（约行 151-156）：

```typescript
const handleGanttTaskClick = (id: string | number) => {
  const task = gantt.getTask(id)
  if (!task?.extendedProps?.item) return
  const eventData = buildCalendarEventFromGanttTask(task)
  showEventDetailModal(eventData)
}
```

改为：

```typescript
const handleGanttTaskClick = (id: string | number) => {
  const task = gantt.getTask(id)
  if (!task?.extendedProps) return

  // Item 级别：直接打开详情
  if (task.extendedProps.item) {
    const eventData = buildCalendarEventFromGanttTask(task)
    showEventDetailModal(eventData)
    return
  }

  // Task 级别：打开首个 Item 的详情
  const firstItemBlockId = task.extendedProps.firstItemBlockId
  if (!firstItemBlockId) return

  const firstItem = projectStore.getItemByBlockId(firstItemBlockId)
  if (!firstItem) return

  const eventData: CalendarEvent = {
    id: firstItemBlockId,
    title: firstItem.content || task.text,
    start: firstItem.startDateTime || firstItem.date,
    end: firstItem.endDateTime || firstItem.startDateTime || firstItem.date,
    allDay: !firstItem.startDateTime,
    extendedProps: {
      project: firstItem.project?.name,
      projectLinks: firstItem.project?.links,
      task: firstItem.task?.name,
      taskLinks: firstItem.task?.links,
      level: firstItem.task?.level,
      item: firstItem.content,
      itemStatus: firstItem.status,
      itemLinks: firstItem.links,
      hasItems: true,
      docId: firstItem.docId,
      lineNumber: firstItem.lineNumber,
      blockId: firstItem.blockId,
      date: firstItem.date,
      originalStartDateTime: firstItem.startDateTime,
      originalEndDateTime: firstItem.endDateTime,
      siblingItems: firstItem.siblingItems,
      dateRangeStart: firstItem.dateRangeStart,
      dateRangeEnd: firstItem.dateRangeEnd,
      pomodoros: firstItem.pomodoros,
      priority: firstItem.priority,
      siblingBlockIds: task.extendedProps.siblingBlockIds,
    },
  }
  showEventDetailModal(eventData)
}
```

注意：需要在文件顶部增加 `CalendarEvent` 的 import（已有 `CalendarEvent` 在 import type 中）。

- [ ] **步骤 2：确保 `projectStore` 已在 GanttView 中可用**

检查 GanttView.vue 中是否已导入 `useProjectStore`。如果没有，需要添加：

```typescript
import { useProjectStore } from '@/stores'
```

并在 setup 中：

```typescript
const projectStore = useProjectStore()
```

当前文件中**没有**导入 `useProjectStore`，需要添加。

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：通过

- [ ] **步骤 4：Commit**

```
git add src/components/gantt/GanttView.vue
git commit -m "feat(gantt): Task 级别条形点击打开首个 Item 详情弹框"
```

---

### 任务 4：ItemDetailDialog — 新增 `siblingBlockIds` prop 和导航状态

**文件：**
- 修改：`src/components/dialog/ItemDetailDialog.vue`

- [ ] **步骤 1：修改 Props 接口，增加 `siblingBlockIds`**

将 Props 接口从：

```typescript
interface Props {
  blockId: string
  fallbackItem: Item
  showAllDates?: boolean
}
```

改为：

```typescript
interface Props {
  blockId: string
  fallbackItem: Item
  showAllDates?: boolean
  siblingBlockIds?: string[]
}
```

将 `withDefaults` 从：

```typescript
const props = withDefaults(defineProps<Props>(), {
  showAllDates: false,
})
```

改为：

```typescript
const props = withDefaults(defineProps<Props>(), {
  showAllDates: false,
  siblingBlockIds: () => [],
})
```

- [ ] **步骤 2：添加导航状态和切换逻辑**

在 `const reactiveItem = computed(...)` 之前，添加导航状态：

```typescript
const activeBlockId = ref(props.blockId)

const currentIndex = computed(() => {
  if (!props.siblingBlockIds?.length) return -1
  return props.siblingBlockIds.indexOf(activeBlockId.value)
})

const canNavigatePrev = computed(() => currentIndex.value > 0)
const canNavigateNext = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < props.siblingBlockIds!.length - 1,
)

const showNavigation = computed(() => (props.siblingBlockIds?.length ?? 0) > 1)
```

修改 `reactiveItem` 使用 `activeBlockId`：

```typescript
const reactiveItem = computed(() => projectStore.getItemByBlockId(activeBlockId.value) ?? props.fallbackItem)
```

添加切换函数：

```typescript
function navigatePrev() {
  if (!canNavigatePrev.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value - 1]
}

function navigateNext() {
  if (!canNavigateNext.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value + 1]
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    navigatePrev()
  } else if (e.key === 'ArrowRight') {
    navigateNext()
  }
}
```

需要在 import 中添加 `ref`：

```typescript
import { computed, ref } from 'vue'
```

- [ ] **步骤 3：添加导航栏 UI**

在 template 中，在 `<ItemDetailContent>` 之前添加导航栏：

```html
<template>
  <div
    class="item-detail-dialog"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div
      v-if="showNavigation"
      class="item-navigation"
    >
      <button
        class="nav-btn"
        :disabled="!canNavigatePrev"
        @click="navigatePrev"
      >
        <svg><use xlink:href="#iconLeft"></use></svg>
      </button>
      <span class="nav-indicator">{{ currentIndex + 1 }} / {{ siblingBlockIds!.length }}</span>
      <button
        class="nav-btn"
        :disabled="!canNavigateNext"
        @click="navigateNext"
      >
        <svg><use xlink:href="#iconRight"></use></svg>
      </button>
    </div>

    <ItemDetailContent
      :item="reactiveItem"
      :show-all-dates="showAllDates"
      :show-action-row="true"
      :close-on-siyuan-link="true"
      @close="handleClose"
      @setReminder="handleSetReminder"
      @setRecurring="handleSetRecurring"
    />

    <ItemActionBar
      :item="reactiveItem"
      :show-separator="true"
      :after-action="handleAfterNavigate"
    />
  </div>
</template>
```

- [ ] **步骤 4：添加导航栏样式**

在 `<style>` 中添加：

```scss
.item-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--b3-border-color);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;

  &:hover:not(:disabled) {
    background: var(--b3-theme-background);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.nav-indicator {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  min-width: 40px;
  text-align: center;
  user-select: none;
}
```

- [ ] **步骤 5：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：通过

- [ ] **步骤 6：运行 lint 验证**

运行：`npm run lint`
预期：通过

- [ ] **步骤 7：Commit**

```
git add src/components/dialog/ItemDetailDialog.vue
git commit -m "feat(ItemDetailDialog): 同 Task 下 Item 左右切换导航（箭头按钮 + 键盘快捷键）"
```

---

### 任务 5：dialog.ts — 传入 `siblingBlockIds`

**文件：**
- 修改：`src/utils/dialog.ts`

- [ ] **步骤 1：修改 `showEventDetailModal`，传入 `siblingBlockIds`**

在 `showEventDetailModal` 函数中，找到 `createApp(ItemDetailDialog, {...})` 调用，在 props 中添加 `siblingBlockIds`：

将：

```typescript
  const app = createApp(ItemDetailDialog, {
    blockId: item.blockId,
    fallbackItem: item,
    showAllDates: hasSiblingItems,
    onClose: () => { dialog.destroy() },
    onSetReminder: () => { dialog.destroy(); showReminderSettingDialog(item) },
    onSetRecurring: () => { dialog.destroy(); showRecurringSettingDialog(item) },
  })
```

改为：

```typescript
  const app = createApp(ItemDetailDialog, {
    blockId: item.blockId,
    fallbackItem: item,
    showAllDates: hasSiblingItems,
    siblingBlockIds: event.extendedProps.siblingBlockIds,
    onClose: () => { dialog.destroy() },
    onSetReminder: () => { dialog.destroy(); showReminderSettingDialog(item) },
    onSetRecurring: () => { dialog.destroy(); showRecurringSettingDialog(item) },
  })
```

- [ ] **步骤 2：修改 `showItemDetailModal`，查找并传入 `siblingBlockIds`**

在 `showItemDetailModal` 函数中，找到 `createApp(ItemDetailDialog, {...})` 调用前，添加查找逻辑：

```typescript
  // 查找同一 Task 下的所有 Item 的 blockId 列表
  const siblingBlockIds = (() => {
    const taskItems = item.task?.items
    if (!taskItems?.length) return undefined
    const blockIds = taskItems
      .filter(i => i.blockId)
      .map(i => i.blockId!)
    return blockIds.length > 1 ? blockIds : undefined
  })()
```

然后在 `createApp` 调用中添加 `siblingBlockIds`：

```typescript
  const app = createApp(ItemDetailDialog, {
    blockId: item.blockId,
    fallbackItem: item,
    showAllDates,
    siblingBlockIds,
    onClose: () => { dialog.destroy() },
    onSetReminder: () => { dialog.destroy(); showReminderSettingDialog(item) },
    onSetRecurring: () => { dialog.destroy(); showRecurringSettingDialog(item) },
  })
```

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：通过

- [ ] **步骤 4：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 5：Commit**

```
git add src/utils/dialog.ts
git commit -m "feat(dialog): showEventDetailModal/showItemDetailModal 传入 siblingBlockIds 支持事项切换"
```

---

### 任务 6：验证和清理

- [ ] **步骤 1：运行完整测试套件**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：通过

- [ ] **步骤 3：运行 typecheck**

运行：`npx vue-tsc --noEmit`
预期：通过

- [ ] **步骤 4：构建验证**

运行：`npm run build`
预期：构建成功
