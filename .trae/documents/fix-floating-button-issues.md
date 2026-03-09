# 修复悬浮番茄按钮问题

## 问题描述

用户反馈悬浮番茄按钮存在以下问题：
1. **倒计时没有显示** - 按钮上显示的是 `--:--` 而不是实际倒计时
2. **无法拖动** - 拖拽功能不工作
3. **点击行为错误** - 点击后打开的是 Tab 而不是 Dock

## 问题分析

### 1. 倒计时没有显示

查看 `updateFloatingTomatoDisplay()` 方法：
- 它通过 `usePomodoroStore()` 获取 `remainingTime`
- 但悬浮按钮是在插件主上下文中运行的，而 PomodoroStore 是在 Vue 组件中初始化的
- 当 Dock 未打开时，PomodoroStore 可能还没有被创建，导致获取不到正确的剩余时间

**根本原因**：悬浮按钮更新逻辑依赖 Pinia Store，但 Store 的生命周期与 Dock 绑定。

### 2. 无法拖动

查看 `makeDraggable()` 方法：
- 拖拽逻辑看起来是正确的
- 但可能存在样式问题（如 `pointer-events`）阻止了鼠标事件
- 或者 z-index 问题导致事件被其他元素拦截

### 3. 点击行为错误

查看 `createFloatingTomatoButton()`：
```typescript
btn.addEventListener('click', (e) => {
  if (!btn.classList.contains('dragging')) {
    this.openCustomTab(TAB_TYPES.POMODORO);  // 错误：打开的是 Tab
  }
});
```

当前代码调用 `openCustomTab()` 打开的是一个 Tab 页面，但用户期望打开的是 Dock。

需要改为使用思源 API 打开 Dock。

## 解决方案

### 方案概述

1. **修复倒计时显示**：不依赖 Pinia Store，直接从存储文件读取番茄钟数据
2. **修复拖拽功能**：检查并修复样式和事件处理
3. **修复点击行为**：改为打开 Dock 而不是 Tab

### 详细实施步骤

#### 步骤 1: 修复倒计时显示

修改 `updateFloatingTomatoDisplay()` 方法，改为从存储文件读取数据：

```typescript
private async updateFloatingTomatoDisplay() {
  if (!this.floatingTomatoEl) return;

  try {
    // 从存储文件读取进行中的番茄钟数据，而不是依赖 Pinia Store
    const { loadActivePomodoro } = await import('@/utils/pomodoroStorage');
    const data = await loadActivePomodoro(this);

    if (!data) {
      this.hideFloatingTomatoButton();
      return;
    }

    // 计算剩余时间
    let effectiveAccumulatedSeconds = data.accumulatedSeconds;
    if (!data.isPaused) {
      const elapsedSinceLastSave = Math.floor((Date.now() - data.startTime) / 1000);
      effectiveAccumulatedSeconds = data.accumulatedSeconds + elapsedSinceLastSave;
    }

    const targetSeconds = data.targetDurationMinutes * 60;
    const remainingSeconds = targetSeconds - effectiveAccumulatedSeconds;

    if (remainingSeconds <= 0) {
      this.hideFloatingTomatoButton();
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
    if (timeEl) {
      timeEl.textContent = timeStr;
    }
  } catch (error) {
    console.log('[Task Assistant] Failed to update floating tomato display:', error);
  }
}
```

#### 步骤 2: 修复拖拽功能

检查样式文件 `src/index.scss` 中的 `.floating-tomato-btn`：
- 确认 `pointer-events: auto` 已设置
- 确认 `z-index: 2147483647` 足够高
- 确保没有其他元素覆盖在按钮上方

拖拽逻辑本身看起来是正确的，可能需要添加调试日志来定位问题。

#### 步骤 3: 修复点击行为（打开 Dock）

需要添加一个方法来打开 Dock，然后修改点击事件处理：

```typescript
/**
 * 打开番茄钟 Dock
 */
private openPomodoroDock() {
  // 使用思源的 openTab API 打开 Dock
  const { openTab } = require('siyuan');
  
  try {
    openTab({
      app: this.app,
      custom: {
        id: `${this.name}${TAB_TYPES.POMODORO}`,
        icon: 'iconClock',
        title: '番茄专注',
        data: { type: TAB_TYPES.POMODORO }
      }
    });
  } catch (error) {
    console.error('[Task Assistant] Failed to open pomodoro dock:', error);
  }
}
```

然后修改 `createFloatingTomatoButton()` 中的点击处理：

```typescript
btn.addEventListener('click', (e) => {
  if (!btn.classList.contains('dragging')) {
    this.openPomodoroDock();  // 改为打开 Dock
  }
});
```

## 相关文件

- `src/index.ts` - 插件主入口，包含悬浮按钮逻辑
- `src/index.scss` - 悬浮按钮样式
- `src/utils/pomodoroStorage.ts` - 番茄钟存储工具
