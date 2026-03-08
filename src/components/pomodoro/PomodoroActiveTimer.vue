<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <span class="timer-icon">⏱️</span>
      <span class="timer-title">专注中</span>
    </div>

    <div class="timer-display">
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
        </div>
      </div>
    </div>

    <div class="timer-actions">
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

const pomodoroStore = usePomodoroStore();

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 当前专注的事项内容
const itemContent = computed(() => {
  return pomodoroStore.activePomodoro?.itemContent || '未知事项';
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
  
  const totalSeconds = pomodoroStore.activePomodoro.durationMinutes * 60;
  const remainingSeconds = pomodoroStore.remainingTime;
  const progress = remainingSeconds / totalSeconds;
  
  return circumference * (1 - progress);
});

// 结束专注
const endPomodoro = async () => {
  if (confirm('确定要结束专注吗？这将删除当前的番茄钟记录。')) {
    await pomodoroStore.endPomodoroEarly();
  }
};

// 取消专注
const cancelPomodoro = async () => {
  if (confirm('确定要取消专注吗？这将删除当前的番茄钟记录。')) {
    await pomodoroStore.cancelPomodoro();
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
  margin-bottom: 24px;
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
  transition: stroke-dashoffset 1s linear;
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

.timer-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.end-btn,
.cancel-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;

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
