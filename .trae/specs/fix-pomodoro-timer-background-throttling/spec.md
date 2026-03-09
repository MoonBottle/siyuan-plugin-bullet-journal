# 修复番茄钟后台计时器节流问题 Spec

## Why

当用户最小化思源笔记窗口或将页面切换到后台时，浏览器会对 `setInterval` 进行节流（throttle），导致 dock 中的番茄钟计时器变慢。而悬浮窗由于使用了不同的机制（或浏览器对浮动窗口的处理不同），时间显示是正确的。这造成了用户看到的 dock 计时和实际经过时间不一致的问题。

## What Changes

- 修改 `src/stores/pomodoroStore.ts` 中的计时器逻辑
- 使用基于 `Date.now()` 的时间差计算，替代简单的 `setInterval` 累加
- 在页面可见性变化时（visibilitychange 事件）重新校准剩余时间
- **BREAKING**: 无破坏性变更，仅内部实现优化

## Impact

- 受影响代码：`src/stores/pomodoroStore.ts`
- 受影响功能：番茄钟倒计时准确性
- 用户体验：后台运行时计时依然准确

## ADDED Requirements

### Requirement: 后台计时准确性
The system SHALL ensure pomodoro timer accuracy even when the page is in background.

#### Scenario: 页面最小化后恢复
- **GIVEN** 用户正在进行番茄钟专注
- **WHEN** 用户最小化窗口，等待一段时间后再打开
- **THEN** dock 中显示的剩余时间与实际经过时间一致
- **AND** 悬浮窗和 dock 显示的时间保持一致

#### Scenario: 基于时间戳的计时
- **GIVEN** 专注正在进行中
- **WHEN** 每秒更新计时器
- **THEN** 使用 `Date.now()` 与开始时间的差值计算已专注时长
- **AND** 不依赖 `setInterval` 的调用次数

#### Scenario: 页面可见性变化校准
- **GIVEN** 专注正在进行中
- **WHEN** 页面从隐藏状态变为可见（visibilitychange 事件）
- **THEN** 立即重新计算并更新剩余时间
- **AND** 确保显示时间与实际时间同步

## MODIFIED Requirements

### Requirement: 计时器实现
```typescript
// 当前实现（问题）
startTimer() {
  this.timerInterval = window.setInterval(() => {
    this.activePomodoro.accumulatedSeconds++;
    // 页面后台时，setInterval 被节流，导致累加变慢
  }, 1000);
}

// 新实现（修复）
startTimer() {
  // 记录开始时间戳
  const timerStartTime = Date.now();
  
  this.timerInterval = window.setInterval(() => {
    // 基于时间戳计算，不受 setInterval 节流影响
    const elapsedMs = Date.now() - timerStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    // ... 更新剩余时间
  }, 1000);
}
```

## Technical Notes

### 浏览器节流行为
- 当页面处于后台标签页时，Chrome 会将 `setInterval` 节流至最低 1 秒间隔
- 如果页面被完全隐藏（最小化），节流可能更严重
- 使用 `Date.now()` 时间戳差值计算可以规避此问题

### visibilitychange 事件
- 监听 `document.visibilityState` 变化
- 当变为 `'visible'` 时，立即重新计算剩余时间
- 确保用户看到的时间是最新的

### 实现策略
1. **保留 `setInterval` 用于 UI 更新**：仍需要定期触发 UI 刷新
2. **使用 `Date.now()` 计算实际经过时间**：不依赖 interval 调用次数
3. **监听 visibilitychange 事件**：页面重新可见时立即校准
