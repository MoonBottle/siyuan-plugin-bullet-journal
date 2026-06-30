# 跳过本次功能移动到 ItemActionBar 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将"跳过本次"功能从 ItemDetailContent 的 TodoItemActionButtons 按钮行移动到 ItemActionBar 图标操作栏，使用 iconAfter 图标。

**架构：** 在 ItemActionBar 中新增跳过图标（条件显示），从 TodoItemActionButtons 和 ItemDetailContent 中移除跳过相关代码，ItemDetailDialog 传递 skipOccurrence 事件。

**技术栈：** Vue 3 + TypeScript + SiYuan SVG 图标系统

---

## 文件结构

| 文件 | 变更类型 | 职责 |
|------|---------|------|
| `src/components/todo/ItemActionBar.vue` | 修改 | 新增跳过本次图标按钮 |
| `src/components/dialog/ItemDetailDialog.vue` | 修改 | 传递 skipOccurrence 事件 |
| `src/components/dialog/ItemDetailContent.vue` | 修改 | 移除跳过相关代码 |
| `src/components/todo/TodoItemActionButtons.vue` | 修改 | 移除跳过相关 props/emit/模板 |

---

### 任务 1：ItemActionBar 新增跳过本次图标

**文件：**
- 修改：`src/components/todo/ItemActionBar.vue`

- [ ] **步骤 1：添加 import 和 emit**

在 `ItemActionBar.vue` 的 `<script setup>` 中：

1. 添加 `getNextOccurrenceDate` 的 import：

```typescript
import { getNextOccurrenceDate } from '@/parser/recurringParser'
```

2. 在 `emit` 定义中新增 `skipOccurrence`：

```typescript
const emit = defineEmits<{
  (event: 'openDoc', docId: string, blockId: string): void
  (event: 'openCalendar', date: string): void
  (event: 'skipOccurrence'): void
}>()
```

- [ ] **步骤 2：添加 canSkipOccurrence 计算属性**

在 `canMigrate` 计算属性之后添加：

```typescript
const canSkipOccurrence = computed(() => {
  if (!props.item?.blockId || !props.item.repeatRule) return false
  if (props.item.status === 'completed' || props.item.status === 'abandoned') return false
  return props.item.date < dayjs().format('YYYY-MM-DD') || dayjs(props.item.date).isSame(dayjs(), 'day')
})
```

- [ ] **步骤 3：添加 skipTooltip 计算属性**

```typescript
const skipTooltip = computed(() => {
  if (!canSkipOccurrence.value || !props.item?.repeatRule) return ''
  return t('recurring.skipTooltip', { date: getNextOccurrenceDate(props.item.date, props.item.repeatRule) })
})
```

- [ ] **步骤 4：添加 handleSkipOccurrence 函数**

```typescript
function handleSkipOccurrence() {
  if (!props.item || isProcessing.value) return
  emit('skipOccurrence')
}
```

- [ ] **步骤 5：在模板中添加跳过图标**

在迁移图标（`iconForward` 的 `</span>`）之后、放弃图标（`iconCloseRound` 的 `<span>`）之前插入：

```html
    <span
      v-if="canSkipOccurrence"
      class="block__icon"
      :aria-label="t('recurring.skipThis')"
      @mouseenter="handleTooltipEnter($event, skipTooltip)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleSkipOccurrence"
    >
      <svg><use xlink:href="#iconAfter"></use></svg>
    </span>
```

- [ ] **步骤 6：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

---

### 任务 2：ItemDetailDialog 传递 skipOccurrence 事件

**文件：**
- 修改：`src/components/dialog/ItemDetailDialog.vue`

- [ ] **步骤 1：在 ItemActionBar 上添加事件监听**

将模板中：

```html
    <ItemActionBar
      :item="reactiveItem"
      @openDoc="handleOpenDoc"
      @openCalendar="handleOpenCalendar"
    />
```

改为：

```html
    <ItemActionBar
      :item="reactiveItem"
      @openDoc="handleOpenDoc"
      @openCalendar="handleOpenCalendar"
      @skipOccurrence="handleSkipOccurrence"
    />
```

`handleSkipOccurrence` 函数已存在，无需修改。

- [ ] **步骤 2：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

---

### 任务 3：ItemDetailContent 移除跳过相关代码

**文件：**
- 修改：`src/components/dialog/ItemDetailContent.vue`

- [ ] **步骤 1：移除模板中 TodoItemActionButtons 的 skip 相关 props 和事件**

将 `TodoItemActionButtons` 调用从：

```html
          <TodoItemActionButtons
            :has-reminder="hasReminder"
            :has-recurring="hasRecurring"
            :is-readonly="isCompletedOrAbandoned"
            :show-reminder="!isCompletedOrAbandoned || hasReminder"
            :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
            :show-skip="!readonly && showSkipButton"
            :reminder-text="reminderText"
            :recurring-text="recurringText"
            :skip-text="t('recurring.skipThis')"
            :reminder-tooltip="reminderButtonTooltip"
            :recurring-tooltip="recurringButtonTooltip"
            :skip-tooltip="skipButtonTooltip"
            @setReminder="emit('setReminder')"
            @setRecurring="emit('setRecurring')"
            @skipOccurrence="emit('skipOccurrence')"
          />
```

改为：

```html
          <TodoItemActionButtons
            :has-reminder="hasReminder"
            :has-recurring="hasRecurring"
            :is-readonly="isCompletedOrAbandoned"
            :show-reminder="!isCompletedOrAbandoned || hasReminder"
            :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
            :reminder-text="reminderText"
            :recurring-text="recurringText"
            :reminder-tooltip="reminderButtonTooltip"
            :recurring-tooltip="recurringButtonTooltip"
            @setReminder="emit('setReminder')"
            @setRecurring="emit('setRecurring')"
          />
```

- [ ] **步骤 2：更新 v-if 条件**

将 `item-actions-row` 的 `v-if` 从：

```html
          v-if="showActionRow && (((!isCompletedOrAbandoned) || hasReminder || hasRecurring || showSkipButton))"
```

改为：

```html
          v-if="showActionRow && (((!isCompletedOrAbandoned) || hasReminder || hasRecurring))"
```

- [ ] **步骤 3：移除 emit 定义中的 skipOccurrence**

将 `defineEmits` 从：

```typescript
const emit = defineEmits<{
  close: []
  setReminder: []
  setRecurring: []
  skipOccurrence: []
}>()
```

改为：

```typescript
const emit = defineEmits<{
  close: []
  setReminder: []
  setRecurring: []
}>()
```

- [ ] **步骤 4：移除 showSkipButton 和 skipButtonTooltip 计算属性**

删除以下两段代码：

```typescript
const showSkipButton = computed(() => hasRecurring.value && (itemStatus.value === 'expired' || dayjs(props.item.date).isSame(dayjs(), 'day')))
```

```typescript
const skipButtonTooltip = computed(() => {
  if (!props.item.repeatRule) return ''
  return t('recurring.skipTooltip', { date: getNextOccurrenceDate(props.item.date, props.item.repeatRule) })
})
```

- [ ] **步骤 5：检查 getNextOccurrenceDate 是否仍被使用**

在 `ItemDetailContent.vue` 中搜索 `getNextOccurrenceDate`。如果 `recurringButtonTooltip` 仍在使用它（它确实在使用），则保留 import。否则移除 import。

当前 `recurringButtonTooltip` 使用了 `getNextOccurrenceDate`，所以 import 保留。

- [ ] **步骤 6：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

---

### 任务 4：TodoItemActionButtons 清理 skip 相关代码

**文件：**
- 修改：`src/components/todo/TodoItemActionButtons.vue`

- [ ] **步骤 1：移除模板中的跳过按钮**

删除以下模板代码：

```html
    <button
      v-if="showSkip"
      class="action-btn"
      :aria-label="skipTooltip || skipText"
      @mouseenter="handleShowTooltip($event, skipTooltip || skipText)"
      @mouseleave="handleHideTooltip"
      @click.stop="$emit('skipOccurrence')"
    >
      <span class="action-icon">⏭</span>
      <span class="action-text">{{ skipText }}</span>
    </button>
```

- [ ] **步骤 2：移除 props 中的 skip 相关属性**

将 props 从：

```typescript
const props = defineProps<{
  hasReminder: boolean
  hasRecurring: boolean
  isReadonly: boolean
  showReminder: boolean
  showRecurring: boolean
  showSkip: boolean
  reminderText: string
  recurringText: string
  skipText: string
  reminderTooltip?: string
  recurringTooltip?: string
  skipTooltip?: string
}>()
```

改为：

```typescript
const props = defineProps<{
  hasReminder: boolean
  hasRecurring: boolean
  isReadonly: boolean
  showReminder: boolean
  showRecurring: boolean
  reminderText: string
  recurringText: string
  reminderTooltip?: string
  recurringTooltip?: string
}>()
```

- [ ] **步骤 3：移除 skipOccurrence emit**

将 emit 从：

```typescript
defineEmits<{
  setReminder: []
  setRecurring: []
  skipOccurrence: []
}>()
```

改为：

```typescript
defineEmits<{
  setReminder: []
  setRecurring: []
}>()
```

- [ ] **步骤 4：更新 showActions 计算属性**

将：

```typescript
const showActions = computed(() => props.showReminder || props.showRecurring || props.showSkip)
```

改为：

```typescript
const showActions = computed(() => props.showReminder || props.showRecurring)
```

- [ ] **步骤 5：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

---

### 任务 5：回归验证

- [ ] **步骤 1：运行测试**

运行：`npm run test`
预期：全部通过

- [ ] **步骤 2：运行构建**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 3：运行 lint**

运行：`npm run lint`
预期：无错误
