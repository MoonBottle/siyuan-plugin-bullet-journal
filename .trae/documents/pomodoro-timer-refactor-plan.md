# 番茄钟倒计时逻辑重构计划

## 问题分析

当前倒计时逻辑分散在多个地方，导致维护困难和潜在的不一致问题：

### 1. 现有逻辑分布

#### A. Pinia Store (`src/stores/pomodoroStore.ts`)
- **专注计时器逻辑** (第 217-311 行):
  - `startTimer()`: 启动 setInterval 定时器
  - `updateTimer()`: 每秒更新 remainingSeconds 和 accumulatedSeconds
  - `stopTimer()`: 清除定时器
  - `setupVisibilityListener()`: 页面可见性变化监听
  
- **休息计时器逻辑** (第 626-633, 670-677 行):
  - `startBreak()`: 启动休息倒计时
  - `restoreBreak()`: 恢复休息倒计时
  - 独立的 `breakInterval` 和 `breakRemainingSeconds`

#### B. 插件主文件 (`src/index.ts`)
- **底栏倒计时更新** (第 1211-1310 行):
  - `updateFloatingTomatoDisplay()`: 每秒从文件读取并计算时间
  - 独立的 `statusBarTimerInterval` 定时器
  - 直接计算 `effectiveAccumulatedSeconds` 和 `remainingSeconds`
  
- **悬浮按钮更新** (第 1037-1039 行):
  - 使用 `floatingTomatoTimer` 定时器
  - 调用 `updateFloatingTomatoDisplay()`

#### C. 组件层
- `PomodoroActiveTimer.vue`: 只从 store 读取状态，不维护独立计时逻辑
- `PomodoroBreakTimer.vue`: 只从 store 读取状态

### 2. 问题

1. **多处维护计时器**: Store 有 `timerInterval`, 插件主文件有 `statusBarTimerInterval` 和 `floatingTomatoTimer`
2. **重复计算**: 底栏倒计时独立计算时间，而不是从 store 获取
3. **状态不一致风险**: 不同地方的计算逻辑可能产生差异
4. **休息计时器独立**: 休息和专注的计时逻辑完全分离

## 重构目标

将所有倒计时逻辑统一放到 Pinia Store (`pomodoroStore`) 中维护，其他组件/模块只从 store 读取状态。

## 重构方案

### 阶段 1: 统一 Store 中的计时逻辑

**修改文件**: `src/stores/pomodoroStore.ts`

1. **保留并优化现有的 `startTimer/updateTimer/stopTimer`**
   - 这些逻辑已经是基于时间戳计算，比较准确
   - 确保 `updateTimer` 正确更新所有派生状态

2. **添加 computed 属性供外部使用**
   ```typescript
   // 已存在的 getters
   remainingTime: (state) => state.activePomodoro?.remainingSeconds || 0
   elapsedSeconds: (state) => state.activePomodoro?.accumulatedSeconds || 0
   isStopwatch: (state) => state.activePomodoro?.timerMode === 'stopwatch'
   
   // 需要确保这些 getter 是响应式的，可以被外部订阅
   ```

3. **休息计时器统一使用与专注相同的机制**
   - 为休息计时器添加 `breakTimerStartTimestamp` 和 `breakLastRemainingSeconds`
   - 使用基于时间戳的计算方式，与专注计时器保持一致
   - 添加 `updateBreakTimer()` 方法统一处理休息计时更新

### 阶段 2: 移除插件主文件中的独立计时器

**修改文件**: `src/index.ts`

1. **移除独立的定时器**
   - 删除 `statusBarTimerInterval` (第 882 行)
   - 删除 `floatingTomatoTimer` (第 74 行)
   - 删除 `startTimerUpdate/stopTimerUpdate` 方法 (第 887-910 行)

2. **改为订阅 Store 状态变化**
   ```typescript
   // 使用事件监听或响应式订阅
   eventBus.on(Events.POMODORO_STARTED, () => {
     this.showFloatingTomatoButton();
     this.showStatusBarTimer();
     // 不再启动独立定时器，而是依赖 store 的事件
   });
   ```

3. **简化 `updateFloatingTomatoDisplay`**
   - 不再从文件读取数据
   - 直接从 pinia store 获取当前状态
   - 只负责更新 DOM，不计算时间

### 阶段 3: 添加 Store 状态变化事件

**修改文件**: `src/stores/pomodoroStore.ts` 和 `src/utils/eventBus.ts`

1. **在 `updateTimer` 中每秒触发事件**
   ```typescript
   updateTimer() {
     // ... 现有逻辑 ...
     
     // 触发每秒更新事件，供外部订阅
     eventBus.emit(Events.POMODORO_TICK, {
       remainingSeconds: this.activePomodoro.remainingSeconds,
       accumulatedSeconds: this.activePomodoro.accumulatedSeconds,
       isPaused: this.activePomodoro.isPaused,
       isStopwatch: this.isStopwatch
     });
   }
   ```

2. **休息计时器同样添加事件**
   ```typescript
   // 在 breakInterval 回调中
   eventBus.emit(Events.BREAK_TICK, {
     remainingSeconds: this.breakRemainingSeconds,
     totalSeconds: this.breakTotalSeconds
   });
   ```

### 阶段 4: 插件主文件订阅 Store 事件

**修改文件**: `src/index.ts`

1. **订阅 POMODORO_TICK 事件更新底栏和悬浮按钮**
   ```typescript
   private initFloatingTomatoButton() {
     // ... 现有事件监听 ...
     
     // 订阅每秒更新
     eventBus.on(Events.POMODORO_TICK, (data) => {
       this.updateFloatingTomatoDisplay(data);
       this.updateStatusBarTimer(data);
     });
     
     eventBus.on(Events.BREAK_TICK, (data) => {
       this.updateFloatingTomatoDisplayForBreak(data);
       this.updateStatusBarTimerForBreak(data);
     });
   }
   ```

2. **简化更新方法**
   - `updateFloatingTomatoDisplay(data)`: 接收数据参数，不再自行计算
   - `updateStatusBarTimer(data)`: 接收数据参数，不再自行计算

## 具体代码变更

### 1. 统一 Store 中的休息计时器逻辑

**文件**: `src/stores/pomodoroStore.ts`

修改 state 定义，为休息计时器添加时间戳相关状态：
```typescript
interface PomodoroState {
  activePomodoro: ActivePomodoro | null;
  timerInterval: number | null;
  timerStartTimestamp: number | null;
  lastAccumulatedSeconds: number;
  // 休息状态
  isBreakActive: boolean;
  breakRemainingSeconds: number;
  breakTotalSeconds: number;
  breakInterval: number | null;
  // 新增：休息计时器时间戳相关状态
  breakTimerStartTimestamp: number | null;
  breakLastRemainingSeconds: number;
}
```

修改 `startBreak` 方法，使用与专注相同的基于时间戳的机制：
```typescript
async startBreak(minutes: number, plugin?: any): Promise<void> {
  this.stopBreak(plugin);
  const totalSeconds = minutes * 60;
  this.isBreakActive = true;
  this.breakRemainingSeconds = totalSeconds;
  this.breakTotalSeconds = totalSeconds;
  this.breakLastRemainingSeconds = totalSeconds;
  this.breakTimerStartTimestamp = Date.now();

  if (plugin) {
    await saveActiveBreak(plugin, { startTime: Date.now(), durationMinutes: minutes });
  }

  // 启动休息计时器
  this.breakInterval = window.setInterval(() => {
    this.updateBreakTimer(plugin);
  }, 1000);

  eventBus.emit(Events.BREAK_STARTED);
}
```

新增 `updateBreakTimer` 方法：
```typescript
/**
 * 更新休息计时器状态
 * 基于时间戳计算剩余时间
 */
updateBreakTimer(plugin?: any) {
  if (!this.isBreakActive) {
    this.stopBreak(plugin);
    return;
  }

  // 基于时间戳计算经过的时间
  const elapsedMs = Date.now() - this.breakTimerStartTimestamp!;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  // 更新剩余时间
  const remaining = Math.max(0, this.breakLastRemainingSeconds - elapsedSeconds);
  this.breakRemainingSeconds = remaining;

  // 触发每秒更新事件
  eventBus.emit(Events.BREAK_TICK, {
    remainingSeconds: this.breakRemainingSeconds,
    totalSeconds: this.breakTotalSeconds
  });

  // 检查是否结束
  if (this.breakRemainingSeconds <= 0) {
    this.stopBreak(plugin ?? usePlugin());
    showMessage(t('settings').pomodoro.breakEndMessage);
    this.playNotificationSound();
  }
}
```

修改 `restoreBreak` 方法：
```typescript
restoreBreak(plugin: any, remainingSeconds: number, totalSeconds?: number): void {
  if (this.isBreakActive) return;
  this.isBreakActive = true;
  this.breakRemainingSeconds = remainingSeconds;
  this.breakTotalSeconds = totalSeconds ?? remainingSeconds;
  this.breakLastRemainingSeconds = remainingSeconds;
  this.breakTimerStartTimestamp = Date.now();

  this.breakInterval = window.setInterval(() => {
    this.updateBreakTimer(plugin);
  }, 1000);

  eventBus.emit(Events.BREAK_STARTED);
}
```

修改 `stopBreak` 方法：
```typescript
async stopBreak(plugin?: any): Promise<void> {
  const wasActive = this.isBreakActive;
  if (this.breakInterval) {
    window.clearInterval(this.breakInterval);
    this.breakInterval = null;
  }
  this.isBreakActive = false;
  this.breakRemainingSeconds = 0;
  this.breakTotalSeconds = 0;
  this.breakTimerStartTimestamp = null;
  this.breakLastRemainingSeconds = 0;
  if (wasActive && plugin) {
    await removeActiveBreak(plugin);
  }
  if (wasActive) {
    eventBus.emit(Events.BREAK_ENDED);
  }
}
```

### 2. 添加新的事件类型

**文件**: `src/utils/eventBus.ts`

```typescript
export enum Events {
  // ... 现有事件 ...
  POMODORO_TICK = 'pomodoro:tick',      // 专注每秒更新
  BREAK_TICK = 'break:tick',            // 休息每秒更新
}
```

### 3. Store 中触发事件

**文件**: `src/stores/pomodoroStore.ts`

在 `updateTimer` 方法末尾添加：
```typescript
updateTimer() {
  // ... 现有逻辑 ...
  
  // 触发每秒更新事件
  eventBus.emit(Events.POMODORO_TICK, {
    remainingSeconds: this.activePomodoro.remainingSeconds,
    accumulatedSeconds: this.activePomodoro.accumulatedSeconds,
    isPaused: this.activePomodoro.isPaused,
    isStopwatch: this.activePomodoro.timerMode === 'stopwatch',
    targetDurationMinutes: this.activePomodoro.targetDurationMinutes
  });
}
```

休息计时器的事件触发已整合到新的 `updateBreakTimer` 方法中，无需单独添加。

### 4. 插件主文件移除独立定时器

**文件**: `src/index.ts`

删除：
- 第 74 行: `private floatingTomatoTimer: number | null = null;`
- 第 882 行: `private statusBarTimerInterval: number | null = null;`
- 第 887-910 行: `startTimerUpdate/stopTimerUpdate` 方法
- 第 1037-1039 行: `showFloatingTomatoButton` 中的定时器启动
- 第 1076-1078 行: `hideFloatingTomatoButton` 中的定时器清理

修改 `initFloatingTomatoButton`：
```typescript
private initFloatingTomatoButton() {
  // 监听专注状态变化
  eventBus.on(Events.POMODORO_STARTED, () => {
    this.showFloatingTomatoButton();
    this.showStatusBarTimer();
  });

  eventBus.on(Events.POMODORO_RESTORE, () => {
    this.showFloatingTomatoButton();
    this.showStatusBarTimer();
  });

  eventBus.on(Events.POMODORO_COMPLETED, () => {
    this.hideFloatingTomatoButton();
    this.updateStatusBarTimerDisplay(false, '', false);
  });

  eventBus.on(Events.POMODORO_CANCELLED, () => {
    this.hideFloatingTomatoButton();
    this.updateStatusBarTimerDisplay(false, '', false);
  });

  eventBus.on(Events.BREAK_STARTED, () => {
    this.showFloatingTomatoButton();
    this.showStatusBarTimer();
  });

  eventBus.on(Events.BREAK_ENDED, () => {
    this.hideFloatingTomatoButton();
    this.updateStatusBarTimerDisplay(false, '', false);
  });

  // 订阅每秒更新事件 - 这是新的统一更新机制
  eventBus.on(Events.POMODORO_TICK, (data) => {
    this.updateTimerDisplays(data, false);
  });

  eventBus.on(Events.BREAK_TICK, (data) => {
    this.updateTimerDisplays(data, true);
  });
}
```

修改 `updateFloatingTomatoDisplay` 为 `updateTimerDisplays`：
```typescript
/**
 * 统一更新悬浮按钮和底栏显示
 * @param data 计时数据
 * @param isBreak 是否休息中
 */
private updateTimerDisplays(data: {
  remainingSeconds: number;
  accumulatedSeconds: number;
  isPaused?: boolean;
  isStopwatch?: boolean;
  targetDurationMinutes?: number;
  totalSeconds?: number;
}, isBreak: boolean) {
  try {
    if (isBreak) {
      // 休息中显示
      const mins = Math.floor(data.remainingSeconds / 60);
      const secs = data.remainingSeconds % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      
      // 更新悬浮按钮
      if (this.floatingTomatoEl) {
        const iconEl = this.floatingTomatoEl.querySelector('.tomato-icon');
        const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
        if (iconEl) {
          iconEl.innerHTML = `<svg ...>咖啡图标</svg>`;
        }
        if (timeEl) timeEl.textContent = timeStr;
      }
      
      // 更新底栏进度条
      const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
      if (pomodoro.enableStatusBar === true) {
        this.showStatusBar();
        const fill = this.statusBarEl?.querySelector('.status-bar-fill') as HTMLElement;
        if (fill) {
          const total = data.totalSeconds || 5 * 60;
          const elapsed = Math.max(0, total - data.remainingSeconds);
          const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
          fill.style.width = `${progress * 100}%`;
        }
      }
      
      // 更新底栏倒计时
      if (pomodoro.enableStatusBarTimer === true) {
        this.showStatusBarTimer();
        this.updateStatusBarTimerDisplay(true, timeStr, false);
      }
    } else {
      // 专注中显示
      const isStopwatch = data.isStopwatch || false;
      const targetSeconds = (data.targetDurationMinutes || 25) * 60;
      const remainingSeconds = data.remainingSeconds;
      const accumulatedSeconds = data.accumulatedSeconds;
      
      // 倒计时模式且已过期时隐藏
      if (!isStopwatch && remainingSeconds <= 0) {
        this.hideFloatingTomatoButton();
        return;
      }
      
      // 显示时间：倒计时显示剩余，正计时显示已专注
      const displaySeconds = isStopwatch ? accumulatedSeconds : remainingSeconds;
      const minutes = Math.floor(displaySeconds / 60);
      const seconds = displaySeconds % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // 更新悬浮按钮
      if (this.floatingTomatoEl) {
        const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
        if (timeEl) timeEl.textContent = timeStr;
      }
      
      // 更新底栏进度条
      const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
      if (pomodoro.enableStatusBar === true) {
        this.showStatusBar();
        const fill = this.statusBarEl?.querySelector('.status-bar-fill') as HTMLElement;
        if (fill) {
          const refSeconds = isStopwatch ? 25 * 60 : targetSeconds;
          const progress = Math.min(1, accumulatedSeconds / refSeconds);
          fill.style.width = `${progress * 100}%`;
        }
      }
      
      // 更新底栏倒计时
      if (pomodoro.enableStatusBarTimer === true) {
        this.showStatusBarTimer();
        this.updateStatusBarTimerDisplay(false, timeStr, data.isPaused || false);
      }
    }
  } catch (error) {
    console.log('[Task Assistant] Failed to update timer displays:', error);
  }
}
```

## 验证清单

- [ ] Store 中的 `updateTimer` 正确触发 `POMODORO_TICK` 事件
- [ ] 休息计时器正确触发 `BREAK_TICK` 事件
- [ ] 插件主文件移除了所有独立的 `setInterval`
- [ ] 悬浮按钮正确显示专注/休息时间
- [ ] 底栏进度条正确更新
- [ ] 底栏倒计时正确更新
- [ ] 暂停/继续功能正常工作
- [ ] 页面后台切换后时间校准正常
- [ ] 恢复专注状态后显示正确

## 风险与注意事项

1. **事件频率**: `POMODORO_TICK` 每秒触发一次，确保事件处理函数性能良好
2. **内存泄漏**: 确保事件监听在插件卸载时正确清理
3. **跨上下文**: 如果 Dock 在 iframe 中，BroadcastChannel 仍然需要用于跨上下文同步
4. **向后兼容**: 确保其他可能依赖旧逻辑的组件不受影响
