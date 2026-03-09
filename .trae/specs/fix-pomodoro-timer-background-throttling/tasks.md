# Tasks

## Task 1: 修改计时器核心逻辑
- [x] SubTask 1.1: 在 `startTimer()` 方法中使用时间戳计算
  - 记录计时器启动时的 `Date.now()` 时间戳
  - 在 `setInterval` 回调中使用时间差计算 `accumulatedSeconds`
  - 替换原有的 `accumulatedSeconds++` 累加方式

- [x] SubTask 1.2: 添加页面可见性监听
  - 在 store 中添加 `visibilitychange` 事件监听器
  - 当页面变为可见时，重新计算 `accumulatedSeconds`
  - 确保 dock 显示的时间与实际时间同步

- [x] SubTask 1.3: 清理事件监听器
  - 在 `stopTimer()` 中移除 `visibilitychange` 监听
  - 在组件卸载或专注结束时正确清理

## Task 2: 验证和测试
- [x] SubTask 2.1: 验证后台计时准确性
  - 开始一个番茄钟
  - 最小化窗口等待 2-3 分钟
  - 恢复窗口，检查 dock 计时是否正确

- [x] SubTask 2.2: 验证悬浮窗和 dock 一致性
  - 同时观察悬浮窗和 dock 的时间显示
  - 确保两者始终保持一致

# Task Dependencies
- Task 1.2 依赖 Task 1.1（需要先修改计时逻辑）
- Task 1.3 依赖 Task 1.2（需要在添加监听后才能清理）
- Task 2 依赖 Task 1（需要功能实现后才能验证）
