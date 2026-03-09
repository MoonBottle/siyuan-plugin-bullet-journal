# 悬浮番茄钟功能计划

## 需求描述

当有专注进行中时，在思源笔记界面增加一个悬浮的小番茄图标，点击可打开番茄 Dock，并显示剩余时间。

## 功能细节

1. **悬浮番茄按钮**
   - 当有专注进行中时显示
   - 显示为一个小番茄图标（iconFocus）
   - 位置：右下角（默认）
   - 显示剩余时间（分:秒格式）
   - 可拖拽移动位置

2. **点击行为**
   - 点击打开番茄 Dock（使用 `openCustomTab(TAB_TYPES.POMODORO)`）

3. **状态同步**
   - 专注开始时显示悬浮按钮，启动定时器更新剩余时间
   - 专注结束/取消时隐藏悬浮按钮，清理定时器

## 实现方案

在 `index.ts` 的 `HKWorkPlugin` 类中添加悬浮按钮管理。

## 实现步骤

### 1. 修改 `index.ts`

**添加悬浮按钮相关属性和方法：**

```typescript
// 悬浮番茄按钮元素
private floatingTomatoEl: HTMLElement | null = null;
// 更新定时器
private floatingTomatoTimer: number | null = null;

// 创建悬浮番茄按钮
private createFloatingTomatoButton() {
  // 创建按钮 DOM（圆形按钮 + 图标 + 时间显示）
  // 设置样式（固定定位、右下角、圆形、番茄色背景）
  // 添加点击事件（打开番茄 Dock）
  // 添加拖拽功能
}

// 显示悬浮按钮
private showFloatingTomatoButton() {
  // 创建并显示按钮
  // 启动定时器每秒更新剩余时间显示
}

// 隐藏悬浮按钮
private hideFloatingTomatoButton() {
  // 移除按钮
  // 清理定时器
}

// 更新悬浮按钮显示（剩余时间）
private updateFloatingTomatoDisplay() {
  // 从 pomodoroStore 获取剩余时间
  // 更新按钮上的时间显示（MM:SS 格式）
}
```

**在 `onload` 中注册事件监听和初始化：**

```typescript
// 检查是否有进行中的专注，如果有则显示悬浮按钮
if (pomodoroStore.isFocusing) {
  this.showFloatingTomatoButton();
}

// 监听专注状态变化
eventBus.on(Events.POMODORO_STARTED, () => {
  this.showFloatingTomatoButton();
});

eventBus.on(Events.POMODORO_COMPLETED, () => {
  this.hideFloatingTomatoButton();
});

eventBus.on(Events.POMODORO_CANCELLED, () => {
  this.hideFloatingTomatoButton();
});
```

**在 `onunload` 中清理：**

```typescript
this.hideFloatingTomatoButton();
```

### 2. 添加事件类型

在 `eventBus.ts` 中添加新事件：

```typescript
export const Events = {
  // ... 现有事件
  POMODORO_STARTED: 'pomodoro:started',
  POMODORO_COMPLETED: 'pomodoro:completed',
  POMODORO_CANCELLED: 'pomodoro:cancelled',
};
```

### 3. 在 `pomodoroStore.ts` 中触发事件

在 `startPomodoro` 方法中：
```typescript
// 设置当前专注状态后
eventBus.emit(Events.POMODORO_STARTED);
```

在 `completePomodoro` 方法中：
```typescript
// 清理状态后
eventBus.emit(Events.POMODORO_COMPLETED);
```

在取消/结束专注的方法中：
```typescript
eventBus.emit(Events.POMODORO_CANCELLED);
```

## 样式设计

```scss
.floating-tomato-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  transition: transform 0.2s, box-shadow 0.2s;
  user-select: none;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    cursor: grabbing;
  }

  .tomato-icon {
    font-size: 20px;
    margin-bottom: 2px;
  }

  .remaining-time {
    font-size: 11px;
    font-weight: 500;
    font-family: monospace;
  }
}
```

## 文件修改清单

1. **index.ts**
   - 添加悬浮按钮相关属性（`floatingTomatoEl`、`floatingTomatoTimer`）
   - 添加悬浮按钮管理方法（`createFloatingTomatoButton`、`showFloatingTomatoButton`、`hideFloatingTomatoButton`、`updateFloatingTomatoDisplay`）
   - 在 `onload` 中初始化并注册事件监听
   - 在 `onunload` 中清理

2. **eventBus.ts**
   - 添加番茄钟相关事件（POMODORO_STARTED、POMODORO_COMPLETED、POMODORO_CANCELLED）

3. **pomodoroStore.ts**
   - 在 `startPomodoro` 中触发 POMODORO_STARTED 事件
   - 在 `completePomodoro` 中触发 POMODORO_COMPLETED 事件
   - 在取消专注时触发 POMODORO_CANCELLED 事件

4. **index.scss**
   - 添加悬浮按钮样式

## 测试验证点

1. 开始专注后悬浮按钮出现，显示剩余时间
2. 剩余时间每秒更新（MM:SS 格式）
3. 点击悬浮按钮打开番茄 Dock
4. 专注结束后悬浮按钮消失
5. 悬浮按钮可拖拽移动位置
6. 刷新页面后，如果有进行中的专注，悬浮按钮自动显示
