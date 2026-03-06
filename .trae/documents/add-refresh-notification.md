# 为刷新按钮添加思源原生提示

## 需求

为日历、待办、项目、甘特图等视图的刷新按钮操作后添加思源原生提示，让用户知道刷新已完成。

## 思源原生提示方式

使用 `showMessage` 函数（来自 `siyuan` 包或 `@/utils/dialog`）：
- `showMessage(text: string, type: 'info' | 'error' = 'info')`
- 默认显示 3000ms（3秒）

## 实施步骤

### 1. 修改 TodoDock.vue

- 导入 `showMessage` 函数
- 在 `handleRefresh` 函数中，刷新成功后显示提示

### 2. 修改 CalendarTab.vue

- 导入 `showMessage` 函数（如果尚未导入）
- 在 `handleRefresh` 函数中，刷新成功后显示提示

### 3. 修改 ProjectTab.vue

- 导入 `showMessage` 函数
- 在 `handleRefresh` 函数中，刷新成功后显示提示

### 4. 修改 GanttTab.vue

- 导入 `showMessage` 函数
- 在 `handleRefresh` 函数中，刷新成功后显示提示

### 5. 添加 i18n 支持

- 在 `src/i18n/index.ts` 中添加刷新成功的提示文本
- 支持中文和英文

## 提示文本设计

- 中文："刷新成功" 或 "数据已刷新"
- 英文："Refresh successful" 或 "Data refreshed"
