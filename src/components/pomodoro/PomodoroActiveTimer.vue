<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <span class="timer-icon">⏱️</span>
      <span class="timer-title">{{ isPaused ? '已暂停' : '专注中' }}</span>
    </div>

    <div class="timer-display" :class="{ 'is-paused': isPaused }">
      <div class="timer-circle">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <circle
            class="progress-ring-bg"
            cx="60"
            cy="60"
            r="54"
          />
          <circle
            class="progress-ring-fill"
            cx="60"
            cy="60"
            r="54"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
          />
        </svg>
        <div class="timer-content">
          <div class="time-remaining">{{ formattedTime }}</div>
          <div class="item-name" :title="itemContent">{{ itemContent }}</div>
          <div v-if="isPaused" class="pause-badge">⏸️ 已暂停</div>
        </div>
      </div>
    </div>

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

    <div class="timer-actions">
      <template v-if="!isPaused">
        <button class="pause-btn" @click="pausePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
          暂停
        </button>
      </template>
      <template v-else>
        <button class="resume-btn" @click="resumePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
          继续
        </button>
      </template>
      <button class="end-btn" @click="endPomodoro">
        <svg class="btn-icon"><use xlink:href="#iconCheck"></use></svg>
        结束专注
      </button>
      <button class="cancel-btn" @click="cancelPomodoro">
        <svg class="btn-icon"><use xlink:href="#iconClose"></use></svg>
        取消
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 当前专注的事项内容
const itemContent = computed(() => {
  return pomodoroStore.activePomodoro?.itemContent || '未知事项';
});

// 是否处于暂停状态
const isPaused = computed(() => {
  return pomodoroStore.activePomodoro?.isPaused || false;
});

// 已专注分钟数
const accumulatedMinutes = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  return Math.floor(pomodoroStore.activePomodoro.accumulatedSeconds / 60);
});

// 目标分钟数
const targetMinutes = computed(() => {
  return pomodoroStore.activePomodoro?.targetDurationMinutes || 25;
});

// 暂停次数
const pauseCount = computed(() => {
  return pomodoroStore.activePomodoro?.pauseCount || 0;
});

// 格式化的剩余时间（MM:SS）
const formattedTime = computed(() => {
  const seconds = pomodoroStore.remainingTime;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

// 进度环偏移量
const strokeDashoffset = computed(() => {
  if (!pomodoroStore.activePomodoro) return circumference;

  const totalSeconds = pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const remainingSeconds = pomodoroStore.remainingTime;
  const progress = remainingSeconds / totalSeconds;

  return circumference * (1 - progress);
});

// 暂停专注
const pausePomodoro = async () => {
  await pomodoroStore.pausePomodoro(plugin);
};

// 继续专注
const resumePomodoro = async () => {
  await pomodoroStore.resumePomodoro(plugin);
};

// 结束专注
const endPomodoro = async () => {
  if (confirm('确定要结束专注吗？这将删除当前的番茄钟记录。')) {
    await pomodoroStore.endPomodoroEarly(plugin);
  }
};

// 取消专注
const cancelPomodoro = async () => {
  if (confirm('确定要取消专注吗？这将删除当前的番茄钟记录。')) {
    await pomodoroStore.cancelPomodoro(plugin);
  }
};
</script>

<style lang="scss" scoped>
.pomodoro-active-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  height: 100%;
  background: var(--b3-theme-background);
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.timer-icon {
  font-size: 20px;
}

.timer-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.timer-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-paused {
    .progress-ring-fill {
      stroke: var(--b3-theme-on-surface);
      opacity: 0.5;
    }

    .time-remaining {
      color: var(--b3-theme-on-surface);
    }
  }
}

.timer-circle {
  position: relative;
  width: 200px;
  height: 200px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  fill: none;
  stroke: var(--b3-theme-surface-lighter);
  stroke-width: 8;
}

.progress-ring-fill {
  fill: none;
  stroke: var(--b3-theme-primary);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear, stroke 0.3s, opacity 0.3s;
}

.timer-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.time-remaining {
  font-size: 36px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  transition: color 0.3s;
}

.item-name {
  margin-top: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pause-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  padding: 2px 8px;
  border-radius: 12px;
}

.timer-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.stat-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.timer-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.pause-btn,
.resume-btn,
.end-btn,
.cancel-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--b3-border-radius);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.pause-btn {
  background: var(--b3-theme-warning);
  color: var(--b3-theme-on-warning, #fff);

  &:hover {
    opacity: 0.9;
  }
}

.resume-btn {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-success, #fff);

  &:hover {
    opacity: 0.9;
  }
}

.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &:hover {
    opacity: 0.9;
  }
}

.cancel-btn {
  background: transparent;
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-theme-surface-lighter);

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
