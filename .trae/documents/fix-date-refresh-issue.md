# 修复日期刷新问题

## 问题描述

用户反馈：已经过了12点（到了3月7号），但是待办侧边栏中的"今天"和"已过期"任务仍然按照3月6号计算，点击右上角的刷新按钮也没有用。

## 问题分析

问题根源在于 `projectStore.ts` 中的 getter 函数使用了 `new Date().toISOString().split('T')[0]` 来获取当前日期，但 Vue/Pinia 会缓存 getter 的计算结果。由于这些 getter 没有声明任何会导致重新计算的响应式依赖（除了 state 中的数据），当日期变化时（过了12点），getter 不会自动重新计算。

具体受影响的 getter：
1. `getFutureItems` - 获取今日及以后的待办事项
2. `getExpiredItems` - 获取已过期的事项
3. `getGroupedFutureItems` - 按日期分组的待办事项

## 解决方案

引入一个 `currentDate` 响应式状态，在每次刷新数据时更新它，这样所有依赖当前日期的 getter 都会自动重新计算。

## 实施步骤

### 1. 修改 projectStore.ts

- 在 `ProjectState` 接口中添加 `currentDate: string` 字段
- 在 state 初始化中添加 `currentDate: new Date().toISOString().split('T')[0]`
- 修改 `getFutureItems`、`getExpiredItems`、`getGroupedFutureItems` getter，使用 `state.currentDate` 代替 `new Date()`
- 在 `loadProjects` 和 `refresh` action 中更新 `currentDate`

### 2. 验证

- 刷新后，侧边栏应该正确显示基于当前日期的任务分组
- "今天"应该显示3月7日的任务
- "已过期"应该显示3月6日及之前的未完成任务
