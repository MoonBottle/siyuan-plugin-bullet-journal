# 跳过本次功能移动到 ItemActionBar

## 背景

"跳过本次"（skip occurrence）功能当前位于 `ItemDetailContent` → `TodoItemActionButtons` 中，以按钮+文字形式呈现。需要将其移动到 `ItemActionBar` 的图标操作栏中，并从原位置完全移除。

## 变更

### 1. ItemActionBar 新增跳过本次图标

文件：`src/components/todo/ItemActionBar.vue`

- 在迁移图标（`iconForward`）之后、放弃图标（`iconCloseRound`）之前，新增跳过本次图标
- 图标：`#iconAfter`
- 显示条件：`canSkipOccurrence` — item 有 `repeatRule` 且状态为过期或当天
- tooltip：`t('recurring.skipTooltip', { date: getNextOccurrenceDate(item.date, item.repeatRule) })`
- 点击行为：emit `skipOccurrence` 事件
- 新增 emit 定义：`skipOccurrence: []`
- 新增计算属性 `canSkipOccurrence`：复用 ItemDetailContent 中 `showSkipButton` 的逻辑

### 2. ItemDetailDialog 传递事件

文件：`src/components/dialog/ItemDetailDialog.vue`

- `ItemActionBar` 新增 `@skipOccurrence="handleSkipOccurrence"`
- `handleSkipOccurrence` 已存在，直接复用

### 3. ItemDetailContent 移除跳过按钮

文件：`src/components/dialog/ItemDetailContent.vue`

- 移除 `TodoItemActionButtons` 的 `showSkip`、`skipText`、`skipTooltip` props 传递
- 移除 `@skipOccurrence` 事件监听
- 移除 `skipOccurrence` emit 定义
- 移除 `showSkipButton`、`skipButtonTooltip` 计算属性
- 移除相关 import（`getNextOccurrenceDate` 如不再使用）

### 4. TodoItemActionButtons 清理

文件：`src/components/todo/TodoItemActionButtons.vue`

- 移除 `showSkip`、`skipText`、`skipTooltip` props
- 移除 `skipOccurrence` emit
- 移除模板中的跳过按钮
- 更新 `showActions` 计算属性：移除 `props.showSkip`

## 数据流

```
ItemActionBar (新增 skipOccurrence emit)
  → ItemDetailDialog (已有 handleSkipOccurrence)
    → 父组件处理 skipOccurrence
```

跳过的实际执行逻辑（`skipCurrentOccurrence`）在父组件/dialog.ts 中处理，不受影响。

## 验证

- `npm run test` 通过
- `npm run build` 通过
