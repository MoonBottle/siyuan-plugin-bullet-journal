# 番茄钟暂停/继续功能实现计划

## 目标
实现番茄钟的暂停和继续功能，暂停期间不计算累计时长，累计时长达到目标专注时长后番茄钟自动结束。

## 背景
目前已支持在番茄钟记录中记录实际专注时长（`actualDurationMinutes`），格式为 `🍅5,2026-03-08 15:45:32~15:50:32 描述`。现在需要在专注计时过程中支持暂停/继续功能。

## 多次暂停/继续的处理逻辑

### 核心设计
- **累计专注时长**: 使用 `accumulatedSeconds` 记录实际专注的总秒数（不含暂停时间）
- **暂停次数记录**: 使用 `pauseCount` 记录暂停次数，用于统计和调试
- **总暂停时长**: 使用 `totalPausedSeconds` 记录所有暂停时段的总和
- **当前暂停开始时间**: `currentPauseStartTime` 记录当前暂停的开始时间（如果有）

### 多次暂停/继续流程示例

```
开始专注 (10:00:00)
  ↓
专注中... (accumulatedSeconds 增加)
  ↓
第1次暂停 (10:05:00) - 专注了 300 秒
  • currentPauseStartTime = 10:05:00
  • pauseCount = 1
  • accumulatedSeconds = 300 (暂停期间不增加)
  ↓
第1次继续 (10:07:00) - 暂停了 120 秒
  • totalPausedSeconds += 120
  • currentPauseStartTime = null
  • 继续计时，accumulatedSeconds 从 300 继续增加
  ↓
专注中... 
  ↓
第2次暂停 (10:15:00) - 又专注了 480 秒
  • currentPauseStartTime = 10:15:00
  • pauseCount = 2
  • accumulatedSeconds = 780
  ↓
第2次继续 (10:16:00) - 暂停了 60 秒
  • totalPausedSeconds += 60 (现在总共 180 秒)
  • accumulatedSeconds 继续从 780 增加
  ↓
专注完成 (10:25:00) - 又专注了 540 秒
  • accumulatedSeconds = 1320 秒 (22 分钟)
  • totalPausedSeconds = 180 秒 (3 分钟)
  • 实际记录: 🍅22,2026-03-08 10:00:00~10:25:00
```

### 关键规则
1. **暂停期间**: `accumulatedSeconds` 不增加，不计入专注时长
2. **多次暂停**: 每次暂停都增加 `pauseCount`，累加 `totalPausedSeconds`
3. **继续后**: 从之前的 `accumulatedSeconds` 继续累加
4. **完成时**: 使用 `accumulatedSeconds` 作为实际专注时长，忽略暂停时间
5. **状态恢复**: 如果恢复时处于暂停状态，不启动定时器，保持 `accumulatedSeconds` 不变

## 实现方案

### 1. 数据模型扩展

**文件**: `src/types/models.ts`

#### ActivePomodoroData 接口
```typescript
export interface ActivePomodoroData {
  blockId: string;              // 事项块ID
  itemId: string;               // 事项ID
  itemContent: string;          // 事项内容
  startTime: number;            // 开始时间戳（毫秒）
  targetDurationMinutes: number;// 目标专注时长（分钟）
  accumulatedSeconds: number;   // 已累计专注秒数（不含暂停时间）
  isPaused: boolean;            // 是否处于暂停状态
  pauseCount: number;           // 暂停次数（用于统计）
  totalPausedSeconds: number;   // 总暂停秒数
  currentPauseStartTime?: number;// 当前暂停开始时间戳（如果有）
  projectId?: string;
  taskId?: string;
}
```

#### ActivePomodoro 接口
```typescript
export interface ActivePomodoro extends ActivePomodoroData {
  remainingSeconds: number;     // 剩余秒数 = targetDurationMinutes * 60 - accumulatedSeconds
}
```

### 2. Store 逻辑更新

**文件**: `src/stores/pomodoroStore.ts`

#### 2.1 修改 `startPomodoro` 方法
```typescript
const pomodoroData: ActivePomodoroData = {
  blockId: parentBlockId,
  itemId: item.id,
  itemContent: item.content,
  startTime: startTimestamp,
  targetDurationMinutes: durationMinutes,
  accumulatedSeconds: 0,
  isPaused: false,
  pauseCount: 0,
  totalPausedSeconds: 0,
  projectId: item.project?.id,
  taskId: item.task?.id
};
```

#### 2.2 新增 `pausePomodoro` 方法
```typescript
async pausePomodoro(plugin?: any): Promise<boolean> {
  if (!this.activePomodoro || this.activePomodoro.isPaused) return false;
  
  // 设置暂停状态
  this.activePomodoro.isPaused = true;
  this.activePomodoro.pauseCount++;
  this.activePomodoro.currentPauseStartTime = Date.now();
  
  // 停止定时器
  this.stopTimer();
  
  // 保存状态
  if (plugin) {
    await saveActivePomodoro(plugin, this.activePomodoro);
  }
  
  showMessage(`已暂停（第${this.activePomodoro.pauseCount}次）`);
  return true;
}
```

#### 2.3 新增 `resumePomodoro` 方法
```typescript
async resumePomodoro(plugin?: any): Promise<boolean> {
  if (!this.activePomodoro || !this.activePomodoro.isPaused) return false;
  
  // 计算本次暂停时长
  const pauseDuration = Math.floor(
    (Date.now() - this.activePomodoro.currentPauseStartTime!) / 1000
  );
  
  // 更新总暂停时长
  this.activePomodoro.totalPausedSeconds += pauseDuration;
  
  // 清除暂停状态
  this.activePomodoro.isPaused = false;
  this.activePomodoro.currentPauseStartTime = undefined;
  
  // 重新启动定时器
  this.startTimer();
  
  // 保存状态
  if (plugin) {
    await saveActivePomodoro(plugin, this.activePomodoro);
  }
  
  showMessage('继续专注');
  return true;
}
```

#### 2.4 修改 `startTimer` 方法
```typescript
startTimer() {
  if (this.timerInterval) {
    window.clearInterval(this.timerInterval);
  }

  this.timerInterval = window.setInterval(() => {
    if (!this.activePomodoro) {
      this.stopTimer();
      return;
    }

    // 如果处于暂停状态，不增加 accumulatedSeconds
    if (this.activePomodoro.isPaused) {
      return;
    }

    // 增加累计专注秒数
    this.activePomodoro.accumulatedSeconds++;
    
    // 更新剩余时间
    const targetSeconds = this.activePomodoro.targetDurationMinutes * 60;
    this.activePomodoro.remainingSeconds = targetSeconds - this.activePomodoro.accumulatedSeconds;

    // 检查是否达到目标时长
    if (this.activePomodoro.accumulatedSeconds >= targetSeconds) {
      this.completePomodoro();
    }
  }, 1000);
}
```

#### 2.5 修改 `completePomodoro` 方法
```typescript
async completePomodoro(plugin?: any): Promise<boolean> {
  if (!this.activePomodoro) return false;

  try {
    const { 
      blockId, 
      itemContent, 
      startTime, 
      accumulatedSeconds,
      targetDurationMinutes 
    } = this.activePomodoro;
    
    const now = dayjs();
    const dateStr = now.format('YYYY-MM-DD');
    const endTimeStr = now.format('HH:mm:ss');
    const startTimeStr = dayjs(startTime).format('HH:mm:ss');
    
    // 计算实际专注分钟数
    const actualMinutes = Math.floor(accumulatedSeconds / 60);

    // 生成带实际时长的番茄钟记录
    const pomodoroContent = `🍅${actualMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;
    await appendBlock('markdown', pomodoroContent, blockId);

    // 删除文件中的进行中的番茄钟记录
    if (plugin) {
      await removeActivePomodoro(plugin);
    }

    // 播放提示音和通知
    this.playNotificationSound();
    showPomodoroCompleteNotification(itemContent, actualMinutes);
    showMessage(`专注完成：${itemContent}（实际专注${actualMinutes}分钟）`);

    // 清理状态
    this.stopTimer();
    this.activePomodoro = null;

    return true;
  } catch (error) {
    console.error('[Pomodoro] 完成专注失败:', error);
    showMessage('完成专注失败', 'error');
    return false;
  }
}
```

#### 2.6 修改 `restorePomodoro` 方法
```typescript
async restorePomodoro(plugin: any): Promise<boolean> {
  try {
    const data = await loadActivePomodoro(plugin);
    if (!data) return false;

    // 如果处于暂停状态，不计算经过的时间
    let effectiveAccumulatedSeconds = data.accumulatedSeconds;
    if (!data.isPaused) {
      // 计算从上次保存到现在经过的时间（秒）
      const elapsedSinceLastSave = Math.floor((Date.now() - data.startTime) / 1000);
      effectiveAccumulatedSeconds = data.accumulatedSeconds + elapsedSinceLastSave;
    }

    const targetSeconds = data.targetDurationMinutes * 60;
    const remainingSeconds = targetSeconds - effectiveAccumulatedSeconds;

    if (remainingSeconds <= 0) {
      // 已经过期，自动标记为完成
      console.log('[Pomodoro] 专注已过期，自动标记为完成');
      await this.markExpiredPomodoroComplete(data, plugin);
      return false;
    }

    // 恢复专注状态
    this.activePomodoro = {
      ...data,
      accumulatedSeconds: effectiveAccumulatedSeconds,
      remainingSeconds
    };

    // 只有在非暂停状态才启动定时器
    if (!data.isPaused) {
      this.startTimer();
      console.log('[Pomodoro] 专注状态已恢复，剩余时间:', remainingSeconds, '秒');
      showMessage(`已恢复专注：${data.itemContent}`);
    } else {
      console.log('[Pomodoro] 专注状态已恢复（暂停中），已专注:', effectiveAccumulatedSeconds, '秒');
      showMessage(`已恢复专注（暂停中）：${data.itemContent}，第${data.pauseCount}次暂停`);
    }

    return true;
  } catch (error) {
    console.error('[Pomodoro] 恢复专注状态失败:', error);
    return false;
  }
}
```

### 3. UI 组件更新

**文件**: `src/components/pomodoro/PomodoroActiveTimer.vue`

#### 3.1 添加暂停/继续按钮
```vue
<div class="timer-actions">
  <template v-if="!isPaused">
    <button class="pause-btn" @click="pausePomodoro">
      <svg class="btn-icon"><use xlink:href="#iconPause"></use></svg>
      暂停
    </button>
  </template>
  <template v-else>
    <button class="resume-btn" @click="resumePomodoro">
      <svg class="btn-icon"><use xlink:href="#iconPlay"></use></svg>
      继续
    </button>
  </template>
  <button class="end-btn" @click="endPomodoro">结束专注</button>
  <button class="cancel-btn" @click="cancelPomodoro">取消</button>
</div>
```

#### 3.2 显示累计时长和暂停信息
```vue
<div class="timer-stats">
  <div class="stat-item">
    <span class="stat-label">已专注</span>
    <span class="stat-value">{{ accumulatedMinutes }}分钟</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">目标</span>
    <span class="stat-value">{{ targetMinutes }}分钟</span>
  </div>
  <div v-if="pauseCount > 0" class="stat-item">
    <span class="stat-label">暂停</span>
    <span class="stat-value">{{ pauseCount }}次</span>
  </div>
</div>
```

#### 3.3 暂停状态视觉反馈
```vue
<div class="timer-display" :class="{ 'is-paused': isPaused }">
  <!-- 暂停时添加遮罩或变灰效果 -->
  <div v-if="isPaused" class="pause-overlay">
    <span class="pause-text">⏸️ 已暂停</span>
  </div>
</div>
```

### 4. 文件存储

**文件**: `src/utils/pomodoroStorage.ts`

无需修改，现有的 `saveActivePomodoro` 和 `loadActivePomodoro` 会自动处理新字段。

## 任务清单

### Task 1: 数据模型扩展
- [ ] 在 `ActivePomodoroData` 接口添加新字段（targetDurationMinutes, accumulatedSeconds, isPaused, pauseCount, totalPausedSeconds, currentPauseStartTime）
- [ ] 更新 `ActivePomodoro` 接口

### Task 2: Store 方法实现
- [ ] 修改 `startPomodoro` 初始化所有新字段
- [ ] 实现 `pausePomodoro` 方法（支持多次暂停）
- [ ] 实现 `resumePomodoro` 方法（支持多次继续）
- [ ] 修改 `startTimer` 方法（暂停时不增加 accumulatedSeconds）
- [ ] 修改 `completePomodoro` 方法（输出实际时长格式）
- [ ] 修改 `restorePomodoro` 方法（支持暂停状态恢复）

### Task 3: UI 组件更新
- [ ] 添加暂停/继续按钮（根据 isPaused 状态切换）
- [ ] 添加累计时长、目标时长、暂停次数显示
- [ ] 添加暂停状态视觉反馈（遮罩、变灰等）

### Task 4: 测试
- [ ] 测试单次暂停/继续流程
- [ ] 测试多次暂停/继续流程
- [ ] 测试自动完成（accumulatedSeconds 达到目标）
- [ ] 测试状态恢复（暂停中恢复、专注中恢复）

## 注意事项

1. **多次暂停**: 每次暂停都会增加 pauseCount，totalPausedSeconds 累加所有暂停时长
2. **状态持久化**: 每次暂停和继续都保存到文件，确保重启后能正确恢复
3. **自动完成**: 当 accumulatedSeconds >= targetDurationMinutes * 60 时自动完成
4. **UI 反馈**: 暂停期间要有明显的视觉反馈，显示暂停次数和已专注时长
