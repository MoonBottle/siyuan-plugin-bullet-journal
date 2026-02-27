# 调整待办事项操作按钮样式

## Why
TodoSidebar.vue 中的所有操作按钮当前使用自定义的 `action-btn` 样式，需要改为使用思源官方的 `block__icon` 样式，与 CalendarTab.vue 工具栏按钮保持一致。

## What Changes
- 将 TodoSidebar.vue 中所有操作按钮改为使用思源官方 `block__icon` 样式
- 涉及的按钮：
  - 待办事项：完成、迁移、放弃、详情、日历
  - 已过期事项：完成、迁移、放弃
- 移除不再需要的 `action-btn` 样式定义

## Impact
- Affected code: `src/components/todo/TodoSidebar.vue`

## ADDED Requirements
### Requirement: 操作按钮样式统一
待办事项列表的所有操作按钮 SHALL 使用思源官方的 `block__icon` 样式。

#### Scenario: 用户查看待办事项列表
- **WHEN** 用户打开待办事项列表
- **THEN** 所有操作按钮使用 `block__icon` 样式
- **AND** 按钮样式与日历标签页工具栏按钮一致
