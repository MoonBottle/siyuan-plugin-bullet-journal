# vue/custom-event-name-casing 修复设计

## 问题

ESLint 规则 `vue/custom-event-name-casing` 要求 Vue 自定义事件名使用 camelCase，但项目中 26 个 Vue 组件使用了 kebab-case 事件名，产生 50+ 处 lint error。

## 方案

将所有 kebab-case 事件名机械转换为 camelCase，双边同步修改（defineEmits + emit() + @listener）。

## 事件名映射表

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

## 不修改的事件

`update:xxx` 事件（如 `update:viewMonth`、`update:searchQuery`）是 Vue v-model 标准约定，冒号后部分已是 camelCase，未被 lint 标记，无需修改。

## 涉及文件清单

### habit 模块（4 文件）

- `src/components/habit/HabitListItem.vue` — defineEmits + emit()
- `src/components/habit/HabitMonthCalendar.vue` — defineEmits + emit()
- `src/components/habit/HabitWorkspaceDetailPane.vue` — defineEmits + @listener
- `src/components/habit/HabitWorkspaceListPane.vue` — defineEmits + emit() + @listener

### project 模块（4 文件）

- `src/components/project/ProjectListPane.vue` — defineEmits + $emit()
- `src/components/project/ProjectTreeNode.vue` — defineEmits + $emit() + @listener
- `src/components/project/ProjectTreePane.vue` — defineEmits + emit() + @listener
- `src/components/project/ResizeHandle.vue` — defineEmits + emit()

### todo 模块（5 文件）

- `src/components/todo/TodoFilterBar.vue` — defineEmits + $emit()
- `src/components/todo/TodoContentPane.vue` — defineEmits + emit() + @listener
- `src/components/todo/TodoItemActionButtons.vue` — defineEmits + $emit()
- `src/components/todo/TodoSidebar.vue` — defineEmits + emit() + @listener
- `src/components/todo/TodoSidebarList.vue` — defineEmits + emit()
- `src/components/todo/ItemActionBar.vue` — defineEmits + emit()

### dialog 模块（1 文件）

- `src/components/dialog/ItemDetailContent.vue` — defineEmits + emit() + @listener

### ai 模块（1 文件）

- `src/components/ai/WeixinLoginDialog.vue` — defineEmits + emit()

### quadrant 模块（1 文件）

- `src/components/quadrant/QuadrantRuleDialog.vue` — defineEmits + emit()

### workbench 模块（4 文件）

- `src/components/workbench/WorkbenchContentHost.vue` — defineEmits + emit() + @listener
- `src/components/workbench/WorkbenchSidebar.vue` — defineEmits + emit()
- `src/components/workbench/dashboard/DashboardCanvas.vue` — defineEmits + emit()
- `src/components/workbench/widgets/DatePickerMonthGrid.vue` — defineEmits + emit()
- `src/components/workbench/widgets/DatePickerWeekGrid.vue` — defineEmits + emit()

### mobile 模块（4 文件）

- `src/mobile/components/todo/MobileBottomNav.vue` — defineEmits + emit()
- `src/mobile/components/todo/MobileTaskCard.vue` — defineEmits + emit()
- `src/mobile/drawers/weixin/MobileWeixinSheet.vue` — defineEmits + emit()
- `src/mobile/panels/MobileTodoPanel.vue` — defineEmits + emit()

## 修改模式

每个事件名在 3 个位置同步修改：

1. **defineEmits 声明**：`'check-in'` → `checkIn`（去掉引号，转为标识符）
2. **emit() / $emit() 调用**：`emit('check-in', ...)` → `emit('checkIn', ...)`
3. **@listener 监听**：`@check-in="..."` → `@checkIn="..."`

## 特殊处理

- `change:dateFilterType` → `changeDateFilterType`：冒号语法不是 Vue v-model 标准约定，直接转为 camelCase

## 验证

修改完成后运行 `npm run lint`，确认 `vue/custom-event-name-casing` 错误数为 0。
