<template>
  <div class="pomodoro-break-timer">
    <div class="timer-header">
      <svg class="timer-icon coffee-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M18 8h1a4 4 0 1 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      </svg>
      <span class="timer-title">{{ t('settings').pomodoro.breakLabel || '休息中' }}</span>
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
          <div class="break-badge">☕ {{ t('settings').pomodoro.breakLabel || '休息中' }}</div>
        </div>
      </div>
    </div>

    <div class="timer-actions">
      <button class="skip-btn" @click="skipBreak">
        <svg class="btn-icon" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/>
        </svg>
        {{ t('settings').pomodoro.skipBreak || '跳过休息' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 休息总时长（秒），用于进度环计算
const totalBreakSeconds = computed(() => {
  return pomodoroStore.breakTotalSeconds || 5 * 60;
});

// 进度环：已休息比例
const strokeDashoffset = computed(() => {
  const remaining = pomodoroStore.breakRemainingSeconds;
  const total = totalBreakSeconds.value;
  const elapsed = Math.max(0, total - remaining);
  const progress = total > 0 ? elapsed / total : 0;
  return circumference * (1 - progress);
});

// 格式化的剩余时间 MM:SS
const formattedTime = computed(() => {
  const secs = pomodoroStore.breakRemainingSeconds;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
});

// 跳过休息
const skipBreak = async () => {
  await pomodoroStore.stopBreak(plugin);
};
</script>

<style lang="scss" scoped>
.pomodoro-break-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: 100%;
  background: var(--b3-theme-background);
  overflow-y: auto;
  gap: 16px;
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timer-icon.coffee-icon {
  color: var(--b3-theme-primary);
}

.timer-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.timer-display {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-circle {
  position: relative;
  width: 160px;
  height: 160px;
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
  font-size: 32px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
}

.break-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.timer-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.skip-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-border-color);

  &:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
