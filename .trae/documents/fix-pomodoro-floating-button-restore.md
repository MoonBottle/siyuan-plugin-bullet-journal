# 修复番茄钟恢复时悬浮图标不显示问题

## 问题描述

当插件发现进行中的番茄钟并触发恢复事件时：
- 在番茄 Dock 未打开时：仅有日志输出，悬浮图标没有显示
- 打开番茄 Dock 后：悬浮图标才出现

## 问题分析

### 代码流程梳理

1. **插件加载流程** (`src/index.ts`):
   - `onload()` 方法中调用 `initFloatingTomatoButton()` 初始化悬浮按钮监听
   - 延迟 1 秒后调用 `checkAndRestorePomodoro()` 检查并恢复番茄钟
   - `checkAndRestorePomodoro()` 读取存储文件，如果发现有进行中的番茄钟，触发 `POMODORO_RESTORE` 事件

2. **悬浮按钮显示逻辑** (`src/index.ts`):
   - 监听 `POMODORO_STARTED` 事件来显示悬浮按钮
   - 监听 `POMODORO_COMPLETED` 和 `POMODORO_CANCELLED` 事件来隐藏悬浮按钮
   - **问题**：没有监听 `POMODORO_RESTORE` 事件！

3. **PomodoroDock 恢复逻辑** (`src/tabs/PomodoroDock.vue`):
   - 监听 `POMODORO_RESTORE` 事件
   - 在 `handlePomodoroRestore` 中调用 `pomodoroStore.restorePomodoro()` 恢复状态
   - `restorePomodoro()` 方法在恢复成功后会触发 `POMODORO_STARTED` 事件

### 根本原因

问题出在事件处理的时序上：

1. 插件 `onload` 时触发 `POMODORO_RESTORE` 事件
2. 此时 PomodoroDock 可能还没有被打开（没有初始化），所以事件没有被处理
3. `initFloatingTomatoButton()` 只监听了 `POMODORO_STARTED` 事件，但 `POMODORO_STARTED` 是由 PomodoroDock 恢复时触发的
4. 由于 PomodoroDock 未打开，`POMODORO_STARTED` 事件永远不会被触发，悬浮按钮也就不会显示

### 解决方案

有两种解决方案：

**方案一：让悬浮按钮也监听 `POMODORO_RESTORE` 事件**
- 在 `initFloatingTomatoButton()` 中添加对 `POMODORO_RESTORE` 事件的监听
- 当收到恢复事件时，直接显示悬浮按钮（不需要等待 `POMODORO_STARTED`）

**方案二：在 `checkAndRestorePomodoro` 中直接显示悬浮按钮**
- 发现进行中的番茄钟后，不依赖事件，直接调用 `showFloatingTomatoButton()`

**推荐方案一**，因为：
1. 保持事件驱动的架构一致性
2. 悬浮按钮的显示逻辑统一由事件触发
3. 避免在 `checkAndRestorePomodoro` 中直接操作 UI

## 实施步骤

### 步骤 1: 修改 `src/index.ts`

在 `initFloatingTomatoButton()` 方法中添加对 `POMODORO_RESTORE` 事件的监听：

```typescript
private initFloatingTomatoButton() {
  // 监听专注状态变化（无论是否有进行中的专注都要监听）
  eventBus.on(Events.POMODORO_STARTED, () => {
    this.showFloatingTomatoButton();
  });

  // 监听番茄钟恢复事件 - 新增
  eventBus.on(Events.POMODORO_RESTORE, () => {
    this.showFloatingTomatoButton();
  });

  eventBus.on(Events.POMODORO_COMPLETED, () => {
    this.hideFloatingTomatoButton();
  });

  eventBus.on(Events.POMODORO_CANCELLED, () => {
    this.hideFloatingTomatoButton();
  });
}
```

### 步骤 2: 验证修复

1. 启动插件时不打开番茄 Dock
2. 检查日志是否显示 "发现进行中的番茄钟，触发恢复事件"
3. 验证悬浮按钮是否正常显示
4. 打开番茄 Dock，验证状态是否正确恢复

## 相关文件

- `src/index.ts` - 插件主入口，包含悬浮按钮逻辑和恢复检查
- `src/tabs/PomodoroDock.vue` - 番茄 Dock 组件，处理恢复事件
- `src/stores/pomodoroStore.ts` - 番茄钟状态管理
- `src/utils/eventBus.ts` - 事件总线定义
