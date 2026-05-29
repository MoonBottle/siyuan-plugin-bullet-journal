# vue/custom-event-name-casing 修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 26 个 Vue 组件中所有 kebab-case 自定义事件名转为 camelCase，消除 `vue/custom-event-name-casing` lint 错误

**架构：** 机械重命名——每个事件名在 defineEmits 声明、emit()/$emit() 调用、@listener 监听三处同步修改。按模块分组，逐模块修复并验证。

**技术栈：** Vue 3 + TypeScript + ESLint

---

## 事件名映射表（完整）

| kebab-case | camelCase |
|-----------|-----------|
| `check-in` | `checkIn` |
| `mark-missed` | `markMissed` |
| `reset-record` | `resetRecord` |
| `open-doc` | `openDoc` |
| `open-detail` | `openDetail` |
| `month-cell-primary` | `monthCellPrimary` |
| `month-cell-mark-missed` | `monthCellMarkMissed` |
| `month-cell-reset` | `monthCellReset` |
| `select-habit` | `selectHabit` |
| `switch-conversation` | `switchConversation` |
| `set-reminder` | `setReminder` |
| `set-recurring` | `setRecurring` |
| `skip-occurrence` | `skipOccurrence` |
| `select-project` | `selectProject` |
| `drag-start` | `dragStart` |
| `reset-defaults` | `resetDefaults` |
| `add-tag-filter` | `addTagFilter` |
| `change:dateFilterType` | `changeDateFilterType` |
| `toggle-sort-panel` | `toggleSortPanel` |
| `toggle-priority` | `togglePriority` |
| `update-sort-field` | `updateSortField` |
| `update-sort-direction` | `updateSortDirection` |
| `move-sort-rule` | `moveSortRule` |
| `remove-sort-rule` | `removeSortRule` |
| `add-sort-rule` | `addSortRule` |
| `reset-sort-rules` | `resetSortRules` |
| `toggle-task` | `toggleTask` |
| `select-task` | `selectTask` |
| `select-item` | `selectItem` |
| `request-add-widget` | `requestAddWidget` |
| `toggle-sidebar` | `toggleSidebar` |
| `reorder-entries` | `reorderEntries` |
| `create-dashboard` | `createDashboard` |
| `create-view` | `createView` |
| `rename-entry` | `renameEntry` |
| `delete-entry` | `deleteEntry` |
| `date-click` | `dateClick` |
| `open-pomodoro` | `openPomodoro` |
| `open-habit` | `openHabit` |
| `long-press` | `longPress` |

**不修改：** `update:xxx` 事件（如 `update:viewMonth`、`update:searchQuery`）是 Vue v-model 标准约定，未被 lint 标记。

---

## 修改模式

每个事件名在以下 3 类位置同步修改：

1. **defineEmits 声明**：`'check-in': [habit: Habit]` → `checkIn: [habit: Habit]`（类型字面量风格）或 `(event: 'check-in', ...)` → `(event: 'checkIn', ...)`（函数签名风格）
2. **emit() / $emit() 调用**：`emit('check-in', ...)` → `emit('checkIn', ...)` 或 `$emit('check-in', ...)` → `$emit('checkIn', ...)`
3. **@listener 监听**：`@check-in="..."` → `@checkIn="..."`

---

### 任务 1：habit 模块（4 文件）

**文件：**
- 修改：`src/components/habit/HabitListItem.vue`
- 修改：`src/components/habit/HabitMonthCalendar.vue`
- 修改：`src/components/habit/HabitWorkspaceDetailPane.vue`
- 修改：`src/components/habit/HabitWorkspaceListPane.vue`

- [ ] **步骤 1：修改 HabitListItem.vue**

读取文件，在 defineEmits 和 emit() 调用中替换：
- `'check-in'` → `checkIn`
- `'mark-missed'` → `markMissed`
- `'reset-record'` → `resetRecord`
- `'open-doc'` → `openDoc`
- `'open-detail'` → `openDetail`

defineEmits 声明修改示例：
```typescript
// 修改前
const emit = defineEmits<{
  'check-in': [habit: Habit]
  'increment': [habit: Habit]
  'mark-missed': [habit: Habit, date: string]
  'reset-record': [habit: Habit, date: string]
  'open-doc': [habit: Habit]
  'open-detail': [habit: Habit]
}>()

// 修改后
const emit = defineEmits<{
  checkIn: [habit: Habit]
  'increment': [habit: Habit]
  markMissed: [habit: Habit, date: string]
  resetRecord: [habit: Habit, date: string]
  openDoc: [habit: Habit]
  openDetail: [habit: Habit]
}>()
```

emit() 调用修改：
- `emit('open-doc', habit)` → `emit('openDoc', habit)`
- `emit('open-detail', props.habit)` → `emit('openDetail', props.habit)`
- `emit('reset-record', props.habit, referenceDate.value)` → `emit('resetRecord', props.habit, referenceDate.value)`（3 处）
- `emit('check-in', props.habit)` → `emit('checkIn', props.habit)`
- `emit('mark-missed', props.habit, referenceDate.value)` → `emit('markMissed', props.habit, referenceDate.value)`

- [ ] **步骤 2：修改 HabitMonthCalendar.vue**

在 defineEmits 和 emit() 调用中替换：
- `'month-cell-primary'` → `monthCellPrimary`
- `'month-cell-mark-missed'` → `monthCellMarkMissed`
- `'month-cell-reset'` → `monthCellReset`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'update:viewMonth': [value: string]
  'month-cell-primary': [value: string]
  'month-cell-mark-missed': [value: string]
  'month-cell-reset': [value: string]
}>()

// 修改后
const emit = defineEmits<{
  'update:viewMonth': [value: string]
  monthCellPrimary: [value: string]
  monthCellMarkMissed: [value: string]
  monthCellReset: [value: string]
}>()
```

emit() 调用修改：
- `emit('month-cell-reset', cell.date)` → `emit('monthCellReset', cell.date)`（2 处）
- `emit('month-cell-primary', cell.date)` → `emit('monthCellPrimary', cell.date)`
- `emit('month-cell-mark-missed', date)` → `emit('monthCellMarkMissed', date)`

- [ ] **步骤 3：修改 HabitWorkspaceDetailPane.vue**

在 defineEmits、@listener 和 emit() 调用中替换：
- `'open-doc'` → `openDoc`
- `'month-cell-primary'` → `monthCellPrimary`
- `'month-cell-mark-missed'` → `monthCellMarkMissed`
- `'month-cell-reset'` → `monthCellReset`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  "refresh": []
  "archive": []
  "unarchive": []
  'open-doc': []
  'update:viewMonth': [value: string]
  'month-cell-primary': [value: string]
  'month-cell-mark-missed': [value: string]
  'month-cell-reset': [value: string]
}>()

// 修改后
const emit = defineEmits<{
  "refresh": []
  "archive": []
  "unarchive": []
  openDoc: []
  'update:viewMonth': [value: string]
  monthCellPrimary: [value: string]
  monthCellMarkMissed: [value: string]
  monthCellReset: [value: string]
}>()
```

模板 @listener 修改：
- `@month-cell-primary="emit('month-cell-primary', $event)"` → `@monthCellPrimary="emit('monthCellPrimary', $event)"`
- `@month-cell-mark-missed="emit('month-cell-mark-missed', $event)"` → `@monthCellMarkMissed="emit('monthCellMarkMissed', $event)"`
- `@month-cell-reset="emit('month-cell-reset', $event)"` → `@monthCellReset="emit('monthCellReset', $event)"`

- [ ] **步骤 4：修改 HabitWorkspaceListPane.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'select-habit'` → `selectHabit`
- `'open-doc'` → `openDoc`
- `'check-in'` → `checkIn`
- `'mark-missed'` → `markMissed`
- `'reset-record'` → `resetRecord`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'update:selectedDate': [value: string]
  'select-habit': [habit: Habit]
  'open-doc': [habit: Habit]
  'check-in': [habit: Habit]
  'increment': [habit: Habit]
  'mark-missed': [habit: Habit, date: string]
  'reset-record': [habit: Habit, date: string]
}>()

// 修改后
const emit = defineEmits<{
  'update:selectedDate': [value: string]
  selectHabit: [habit: Habit]
  openDoc: [habit: Habit]
  checkIn: [habit: Habit]
  'increment': [habit: Habit]
  markMissed: [habit: Habit, date: string]
  resetRecord: [habit: Habit, date: string]
}>()
```

模板 @listener 修改：
- `@check-in="emit('check-in', $event)"` → `@checkIn="emit('checkIn', $event)"`
- `@mark-missed="handleMarkMissed"` → `@markMissed="handleMarkMissed"`
- `@reset-record="handleResetRecord"` → `@resetRecord="handleResetRecord"`
- `@open-doc="emit('open-doc', $event)"` → `@openDoc="emit('openDoc', $event)"`
- `@open-detail="emit('select-habit', $event)"` → `@openDetail="emit('selectHabit', $event)"`

emit() 调用修改：
- `emit('mark-missed', habit, date)` → `emit('markMissed', habit, date)`
- `emit('reset-record', habit, date)` → `emit('resetRecord', habit, date)`

- [ ] **步骤 5：运行 lint 验证 habit 模块**

运行：`npx eslint src/components/habit/HabitListItem.vue src/components/habit/HabitMonthCalendar.vue src/components/habit/HabitWorkspaceDetailPane.vue src/components/habit/HabitWorkspaceListPane.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 6：Commit**

```bash
git add src/components/habit/HabitListItem.vue src/components/habit/HabitMonthCalendar.vue src/components/habit/HabitWorkspaceDetailPane.vue src/components/habit/HabitWorkspaceListPane.vue
git commit -m "fix(lint): convert habit module event names to camelCase"
```

---

### 任务 2：project 模块（4 文件）

**文件：**
- 修改：`src/components/project/ProjectListPane.vue`
- 修改：`src/components/project/ProjectTreeNode.vue`
- 修改：`src/components/project/ProjectTreePane.vue`
- 修改：`src/components/project/ResizeHandle.vue`

- [ ] **步骤 1：修改 ProjectListPane.vue**

在 defineEmits 和 $emit() 调用中替换：
- `'select-project'` → `'selectProject'`

defineEmits 修改：
```typescript
// 修改前
defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'select-project', projectId: string): void
}>()

// 修改后
defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'selectProject', projectId: string): void
}>()
```

$emit() 调用修改：
- `$emit('select-project', project.id)` → `$emit('selectProject', project.id)`

- [ ] **步骤 2：修改 ProjectTreeNode.vue**

在 defineEmits 和 $emit() 调用和 @listener 中替换：
- `'toggle-task'` → `'toggleTask'`
- `'select-task'` → `'selectTask'`
- `'select-item'` → `'selectItem'`

defineEmits 修改：
```typescript
// 修改前
defineEmits<{
  (event: 'toggle-task', taskId: string): void
  (event: 'select-task', taskId: string): void
  (event: 'select-item', itemId: string): void
}>()

// 修改后
defineEmits<{
  (event: 'toggleTask', taskId: string): void
  (event: 'selectTask', taskId: string): void
  (event: 'selectItem', itemId: string): void
}>()
```

$emit() 调用修改：
- `$emit('select-task', node.task.id)` → `$emit('selectTask', node.task.id)`
- `$emit('toggle-task', node.task.id)` → `$emit('toggleTask', node.task.id)`
- `$emit('select-item', getItemId(entry))` → `$emit('selectItem', getItemId(entry))`

@listener 修改：
- `@toggle-task="$emit('toggle-task', $event)"` → `@toggleTask="$emit('toggleTask', $event)"`
- `@select-task="$emit('select-task', $event)"` → `@selectTask="$emit('selectTask', $event)"`
- `@select-item="$emit('select-item', $event)"` → `@selectItem="$emit('selectItem', $event)"`

- [ ] **步骤 3：修改 ProjectTreePane.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'toggle-task'` → `'toggleTask'`
- `'select-task'` → `'selectTask'`
- `'select-item'` → `'selectItem'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'toggle-task', taskId: string): void
  (event: 'select-task', taskId: string): void
  (event: 'select-item', itemId: string): void
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'toggleTask', taskId: string): void
  (event: 'selectTask', taskId: string): void
  (event: 'selectItem', itemId: string): void
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
}>()
```

emit() 调用修改：
- `emit('select-task', first.id)` → `emit('selectTask', first.id)`
- `emit('select-item', first.id)` → `emit('selectItem', first.id)`
- `emit('select-task', next.id)` → `emit('selectTask', next.id)`
- `emit('select-item', next.id)` → `emit('selectItem', next.id)`
- `emit('select-task', taskId)` → `emit('selectTask', taskId)`
- `emit('select-item', itemId)` → `emit('selectItem', itemId)`

@listener 修改：
- `@toggle-task="$emit('toggle-task', $event)"` → `@toggleTask="$emit('toggleTask', $event)"`

- [ ] **步骤 4：修改 ResizeHandle.vue**

在 defineEmits 和 emit() 调用中替换：
- `'drag-start'` → `'dragStart'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (e: 'drag-start', event: MouseEvent): void
}>()

// 修改后
const emit = defineEmits<{
  (e: 'dragStart', event: MouseEvent): void
}>()
```

emit() 调用修改：
- `emit('drag-start', event)` → `emit('dragStart', event)`

- [ ] **步骤 5：运行 lint 验证 project 模块**

运行：`npx eslint src/components/project/ProjectListPane.vue src/components/project/ProjectTreeNode.vue src/components/project/ProjectTreePane.vue src/components/project/ResizeHandle.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 6：Commit**

```bash
git add src/components/project/ProjectListPane.vue src/components/project/ProjectTreeNode.vue src/components/project/ProjectTreePane.vue src/components/project/ResizeHandle.vue
git commit -m "fix(lint): convert project module event names to camelCase"
```

---

### 任务 3：todo 模块（6 文件）

**文件：**
- 修改：`src/components/todo/TodoFilterBar.vue`
- 修改：`src/components/todo/TodoContentPane.vue`
- 修改：`src/components/todo/TodoItemActionButtons.vue`
- 修改：`src/components/todo/TodoSidebar.vue`
- 修改：`src/components/todo/TodoSidebarList.vue`
- 修改：`src/components/todo/ItemActionBar.vue`

- [ ] **步骤 1：修改 TodoFilterBar.vue**

在 defineEmits 和 $emit() 调用中替换：
- `'change:dateFilterType'` → `'changeDateFilterType'`
- `'toggle-priority'` → `'togglePriority'`
- `'toggle-sort-panel'` → `'toggleSortPanel'`
- `'update-sort-field'` → `'updateSortField'`
- `'update-sort-direction'` → `'updateSortDirection'`
- `'move-sort-rule'` → `'moveSortRule'`
- `'remove-sort-rule'` → `'removeSortRule'`
- `'add-sort-rule'` → `'addSortRule'`
- `'reset-sort-rules'` → `'resetSortRules'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'update:selectedGroup', value: string): void
  (event: 'update:searchQuery', value: string): void
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
  (event: 'update:dateFilterType', value: TodoDateFilterType): void
  (event: 'change:dateFilterType', value: TodoDateFilterType): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'toggle-priority', value: PriorityLevel): void
  (event: 'toggle-sort-panel'): void
  (event: 'update-sort-field', index: number, value: string): void
  (event: 'update-sort-direction', index: number, value: string): void
  (event: 'move-sort-rule', index: number, delta: number): void
  (event: 'remove-sort-rule', index: number): void
  (event: 'add-sort-rule'): void
  (event: 'reset-sort-rules'): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'update:selectedGroup', value: string): void
  (event: 'update:searchQuery', value: string): void
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
  (event: 'update:dateFilterType', value: TodoDateFilterType): void
  (event: 'changeDateFilterType', value: TodoDateFilterType): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'togglePriority', value: PriorityLevel): void
  (event: 'toggleSortPanel'): void
  (event: 'updateSortField', index: number, value: string): void
  (event: 'updateSortDirection', index: number, value: string): void
  (event: 'moveSortRule', index: number, delta: number): void
  (event: 'removeSortRule', index: number): void
  (event: 'addSortRule'): void
  (event: 'resetSortRules'): void
}>()
```

$emit() 调用修改：
- `$emit('change:dateFilterType', value)` → `$emit('changeDateFilterType', value)`
- `$emit('toggle-sort-panel')` → `$emit('toggleSortPanel')`
- `$emit('toggle-priority', p.value)` → `$emit('togglePriority', p.value)`
- `$emit('update-sort-field', index, String(value ?? ''))` → `$emit('updateSortField', index, String(value ?? ''))`
- `$emit('update-sort-direction', index, String(value ?? ''))` → `$emit('updateSortDirection', index, String(value ?? ''))`
- `$emit('move-sort-rule', index, -1)` → `$emit('moveSortRule', index, -1)`
- `$emit('move-sort-rule', index, 1)` → `$emit('moveSortRule', index, 1)`
- `$emit('remove-sort-rule', index)` → `$emit('removeSortRule', index)`
- `$emit('add-sort-rule')` → `$emit('addSortRule')`
- `$emit('reset-sort-rules')` → `$emit('resetSortRules')`

- [ ] **步骤 2：修改 TodoContentPane.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'add-tag-filter'` → `addTagFilter`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'add-tag-filter', value: string): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'addTagFilter', value: string): void
}>()
```

@listener + emit 修改：
- `@add-tag-filter="emit('add-tag-filter', $event)"` → `@addTagFilter="emit('addTagFilter', $event)"`

- [ ] **步骤 3：修改 TodoItemActionButtons.vue**

在 defineEmits 和 $emit() 调用中替换：
- `'set-reminder'` → `'setReminder'`
- `'set-recurring'` → `'setRecurring'`

defineEmits 修改：
```typescript
// 修改前
defineEmits<{
  'set-reminder': []
  'set-recurring': []
}>()

// 修改后
defineEmits<{
  'setReminder': []
  'setRecurring': []
}>()
```

$emit() 调用修改：
- `$emit('set-reminder')` → `$emit('setReminder')`
- `$emit('set-recurring')` → `$emit('setRecurring')`

- [ ] **步骤 4：修改 TodoSidebar.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'add-tag-filter'` → `addTagFilter`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'add-tag-filter', value: string): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'addTagFilter', value: string): void
}>()
```

@listener + emit 修改：
- `@add-tag-filter="emit('add-tag-filter', $event)"` → `@addTagFilter="emit('addTagFilter', $event)"`

- [ ] **步骤 5：修改 TodoSidebarList.vue**

在 defineEmits 和 emit() 调用中替换：
- `'add-tag-filter'` → `addTagFilter`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'add-tag-filter', value: string): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'addTagFilter', value: string): void
}>()
```

emit() 调用修改：
- `emit('add-tag-filter', tag)` → `emit('addTagFilter', tag)`

- [ ] **步骤 6：修改 ItemActionBar.vue**

在 defineEmits 和 emit() 调用中替换：
- `'open-doc'` → `'openDoc'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'open-doc', docId: string, blockId: string): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'openDoc', docId: string, blockId: string): void
}>()
```

emit() 调用修改：
- `emit('open-doc', props.item.docId, props.item.blockId)` → `emit('openDoc', props.item.docId, props.item.blockId)`

- [ ] **步骤 7：运行 lint 验证 todo 模块**

运行：`npx eslint src/components/todo/TodoFilterBar.vue src/components/todo/TodoContentPane.vue src/components/todo/TodoItemActionButtons.vue src/components/todo/TodoSidebar.vue src/components/todo/TodoSidebarList.vue src/components/todo/ItemActionBar.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 8：Commit**

```bash
git add src/components/todo/TodoFilterBar.vue src/components/todo/TodoContentPane.vue src/components/todo/TodoItemActionButtons.vue src/components/todo/TodoSidebar.vue src/components/todo/TodoSidebarList.vue src/components/todo/ItemActionBar.vue
git commit -m "fix(lint): convert todo module event names to camelCase"
```

---

### 任务 4：dialog + ai + quadrant 模块（3 文件）

**文件：**
- 修改：`src/components/dialog/ItemDetailContent.vue`
- 修改：`src/components/ai/WeixinLoginDialog.vue`
- 修改：`src/components/quadrant/QuadrantRuleDialog.vue`

- [ ] **步骤 1：修改 ItemDetailContent.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'set-reminder'` → `setReminder`
- `'set-recurring'` → `setRecurring`
- `'skip-occurrence'` → `skipOccurrence`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  "close": []
  'set-reminder': []
  'set-recurring': []
  'skip-occurrence': []
}>()

// 修改后
const emit = defineEmits<{
  "close": []
  setReminder: []
  setRecurring: []
  skipOccurrence: []
}>()
```

@listener + emit 修改：
- `@set-reminder="emit('set-reminder')"` → `@setReminder="emit('setReminder')"`
- `@set-recurring="emit('set-recurring')"` → `@setRecurring="emit('setRecurring')"`
- `@click="emit('skip-occurrence')"` → `@click="emit('skipOccurrence')"`

- [ ] **步骤 2：修改 WeixinLoginDialog.vue**

在 defineEmits 和 emit() 调用中替换：
- `'switch-conversation'` → `switchConversation`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  "close": []
  'switch-conversation': [conversationId: string]
}>()

// 修改后
const emit = defineEmits<{
  "close": []
  switchConversation: [conversationId: string]
}>()
```

emit() 调用修改：
- `emit('switch-conversation', conversationId)` → `emit('switchConversation', conversationId)`

- [ ] **步骤 3：修改 QuadrantRuleDialog.vue**

在 defineEmits 和 emit() 调用中替换：
- `'reset-defaults'` → `'resetDefaults'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'save', panel: QuadrantPanelConfig): void
  (event: 'reset-defaults'): void
  (event: 'close'): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'save', panel: QuadrantPanelConfig): void
  (event: 'resetDefaults'): void
  (event: 'close'): void
}>()
```

emit() 调用修改：
- `emit('reset-defaults')` → `emit('resetDefaults')`

- [ ] **步骤 4：运行 lint 验证**

运行：`npx eslint src/components/dialog/ItemDetailContent.vue src/components/ai/WeixinLoginDialog.vue src/components/quadrant/QuadrantRuleDialog.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/dialog/ItemDetailContent.vue src/components/ai/WeixinLoginDialog.vue src/components/quadrant/QuadrantRuleDialog.vue
git commit -m "fix(lint): convert dialog/ai/quadrant module event names to camelCase"
```

---

### 任务 5：workbench 模块（5 文件）

**文件：**
- 修改：`src/components/workbench/WorkbenchContentHost.vue`
- 修改：`src/components/workbench/WorkbenchSidebar.vue`
- 修改：`src/components/workbench/dashboard/DashboardCanvas.vue`
- 修改：`src/components/workbench/widgets/DatePickerMonthGrid.vue`
- 修改：`src/components/workbench/widgets/DatePickerWeekGrid.vue`

- [ ] **步骤 1：修改 WorkbenchContentHost.vue**

在 defineEmits、emit() 调用和 @listener 中替换：
- `'request-add-widget'` → `requestAddWidget`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'request-add-widget'): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'requestAddWidget'): void
}>()
```

@listener + emit 修改：
- `@request-add-widget="emit('request-add-widget')"` → `@requestAddWidget="emit('requestAddWidget')"`

- [ ] **步骤 2：修改 WorkbenchSidebar.vue**

在 defineEmits 和 emit() 调用中替换：
- `'create-dashboard'` → `'createDashboard'`
- `'create-view'` → `'createView'`
- `'rename-entry'` → `'renameEntry'`
- `'delete-entry'` → `'deleteEntry'`
- `'reorder-entries'` → `'reorderEntries'`
- `'toggle-sidebar'` → `'toggleSidebar'`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'create-dashboard'): void
  (event: 'create-view', viewType: WorkbenchViewType): void
  (event: 'rename-entry', id: string, title: string): void
  (event: 'delete-entry', id: string): void
  (event: 'reorder-entries', orderedIds: string[]): void
  (event: 'toggle-sidebar'): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'createDashboard'): void
  (event: 'createView', viewType: WorkbenchViewType): void
  (event: 'renameEntry', id: string, title: string): void
  (event: 'deleteEntry', id: string): void
  (event: 'reorderEntries', orderedIds: string[]): void
  (event: 'toggleSidebar'): void
}>()
```

emit() 调用修改：
- `emit('toggle-sidebar')` → `emit('toggleSidebar')`
- `emit('reorder-entries', ids)` → `emit('reorderEntries', ids)`
- `emit('create-dashboard')` → `emit('createDashboard')`
- `emit('create-view', viewType)` → `emit('createView', viewType)`
- `emit('rename-entry', entry.id, nextTitle)` → `emit('renameEntry', entry.id, nextTitle)`
- `emit('delete-entry', entry.id)` → `emit('deleteEntry', entry.id)`

- [ ] **步骤 3：修改 DashboardCanvas.vue**

在 defineEmits 和 emit() 调用中替换：
- `'request-add-widget'` → `requestAddWidget`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  (event: 'request-add-widget'): void
}>()

// 修改后
const emit = defineEmits<{
  (event: 'requestAddWidget'): void
}>()
```

emit() 调用修改：
- `emit('request-add-widget')` → `emit('requestAddWidget')`

- [ ] **步骤 4：修改 DatePickerMonthGrid.vue**

在 defineEmits 和 emit() 调用中替换：
- `'date-click'` → `dateClick`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'date-click': [date: string, event: MouseEvent]
}>()

// 修改后
const emit = defineEmits<{
  dateClick: [date: string, event: MouseEvent]
}>()
```

emit() 调用修改：
- `emit('date-click', cell.date, $event)` → `emit('dateClick', cell.date, $event)`

- [ ] **步骤 5：修改 DatePickerWeekGrid.vue**

在 defineEmits 和 emit() 调用中替换：
- `'date-click'` → `dateClick`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'date-click': [date: string, event: MouseEvent]
}>()

// 修改后
const emit = defineEmits<{
  dateClick: [date: string, event: MouseEvent]
}>()
```

emit() 调用修改：
- `emit('date-click', date, $event)` → `emit('dateClick', date, $event)`

- [ ] **步骤 6：运行 lint 验证 workbench 模块**

运行：`npx eslint src/components/workbench/WorkbenchContentHost.vue src/components/workbench/WorkbenchSidebar.vue src/components/workbench/dashboard/DashboardCanvas.vue src/components/workbench/widgets/DatePickerMonthGrid.vue src/components/workbench/widgets/DatePickerWeekGrid.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 7：Commit**

```bash
git add src/components/workbench/WorkbenchContentHost.vue src/components/workbench/WorkbenchSidebar.vue src/components/workbench/dashboard/DashboardCanvas.vue src/components/workbench/widgets/DatePickerMonthGrid.vue src/components/workbench/widgets/DatePickerWeekGrid.vue
git commit -m "fix(lint): convert workbench module event names to camelCase"
```

---

### 任务 6：mobile 模块（4 文件）

**文件：**
- 修改：`src/mobile/components/todo/MobileBottomNav.vue`
- 修改：`src/mobile/components/todo/MobileTaskCard.vue`
- 修改：`src/mobile/drawers/weixin/MobileWeixinSheet.vue`
- 修改：`src/mobile/panels/MobileTodoPanel.vue`

- [ ] **步骤 1：修改 MobileBottomNav.vue**

在 defineEmits 和 emit() 调用中替换：
- `'open-pomodoro'` → `openPomodoro`
- `'open-habit'` → `openHabit`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'open-pomodoro': []
  'open-habit': []
  "create": []
}>()

// 修改后
const emit = defineEmits<{
  openPomodoro: []
  openHabit: []
  "create": []
}>()
```

emit() 调用修改：
- `emit('open-habit')` → `emit('openHabit')`
- `emit('open-pomodoro')` → `emit('openPomodoro')`

- [ ] **步骤 2：修改 MobileTaskCard.vue**

在 defineEmits 和 emit() 调用中替换：
- `'long-press'` → `longPress`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  "click": [item: Item]
  'long-press': [item: Item]
}>()

// 修改后
const emit = defineEmits<{
  "click": [item: Item]
  longPress: [item: Item]
}>()
```

emit() 调用修改：
- `emit('long-press', props.item)` → `emit('longPress', props.item)`

- [ ] **步骤 3：修改 MobileWeixinSheet.vue**

在 defineEmits 和 emit() 调用中替换：
- `'switch-conversation'` → `switchConversation`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'switch-conversation': [conversationId: string]
}>()

// 修改后
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  switchConversation: [conversationId: string]
}>()
```

emit() 调用修改：
- `emit('switch-conversation', conversationId)` → `emit('switchConversation', conversationId)`

- [ ] **步骤 4：修改 MobileTodoPanel.vue**

在 defineEmits 和 emit() 调用中替换：
- `'open-pomodoro'` → `openPomodoro`

defineEmits 修改：
```typescript
// 修改前
const emit = defineEmits<{
  'open-pomodoro': [{ blockId?: string }]
}>()

// 修改后
const emit = defineEmits<{
  openPomodoro: [{ blockId?: string }]
}>()
```

emit() 调用修改：
- `emit('open-pomodoro', { blockId: item.blockId })` → `emit('openPomodoro', { blockId: item.blockId })`

- [ ] **步骤 5：运行 lint 验证 mobile 模块**

运行：`npx eslint src/mobile/components/todo/MobileBottomNav.vue src/mobile/components/todo/MobileTaskCard.vue src/mobile/drawers/weixin/MobileWeixinSheet.vue src/mobile/panels/MobileTodoPanel.vue`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 6：Commit**

```bash
git add src/mobile/components/todo/MobileBottomNav.vue src/mobile/components/todo/MobileTaskCard.vue src/mobile/drawers/weixin/MobileWeixinSheet.vue src/mobile/panels/MobileTodoPanel.vue
git commit -m "fix(lint): convert mobile module event names to camelCase"
```

---

### 任务 7：全局验证 + 父组件 @listener 同步

**文件：**
- 可能修改：使用上述组件的父组件模板中的 @listener

- [ ] **步骤 1：搜索所有父组件中的 kebab-case @listener**

运行 grep 搜索所有 `.vue` 文件中引用已重命名事件的 `@kebab-case` 监听器：
```bash
grep -rn "@check-in\|@mark-missed\|@reset-record\|@open-doc\|@open-detail\|@month-cell-primary\|@month-cell-mark-missed\|@month-cell-reset\|@select-habit\|@switch-conversation\|@set-reminder\|@set-recurring\|@skip-occurrence\|@select-project\|@drag-start\|@reset-defaults\|@add-tag-filter\|@change:dateFilterType\|@toggle-sort-panel\|@toggle-priority\|@update-sort-field\|@update-sort-direction\|@move-sort-rule\|@remove-sort-rule\|@add-sort-rule\|@reset-sort-rules\|@toggle-task\|@select-task\|@select-item\|@request-add-widget\|@toggle-sidebar\|@reorder-entries\|@create-dashboard\|@create-view\|@rename-entry\|@delete-entry\|@date-click\|@open-pomodoro\|@open-habit\|@long-press" src/
```

将搜索到的所有 `@kebab-case` 监听器替换为对应的 `@camelCase`。

- [ ] **步骤 2：运行完整 lint 验证**

运行：`npm run lint`
预期：0 个 `vue/custom-event-name-casing` 错误

- [ ] **步骤 3：Commit 父组件修改（如有）**

```bash
git add -A
git commit -m "fix(lint): sync parent component @listeners to camelCase event names"
```

- [ ] **步骤 4：运行测试确保无回归**

运行：`npm run test`
预期：所有测试通过
