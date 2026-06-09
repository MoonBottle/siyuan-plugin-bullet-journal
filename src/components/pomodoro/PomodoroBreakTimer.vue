<template>
  <div class="pomodoro-break-timer">
    <div class="timer-header">
      <svg
        class="timer-icon coffee-icon"
        width="20"
        height="20"
      >
        <use xlink:href="#iconTaCoffee" />
      </svg>
      <span class="timer-title">{{ t('settings').pomodoro.breakLabel }}</span>
    </div>

    <div class="timer-display">
      <div class="timer-circle">
        <svg
          class="progress-ring"
          viewBox="0 0 120 120"
        >
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
          <div class="time-remaining">
            {{ formattedTime }}
          </div>
        </div>
      </div>
    </div>

    <div class="timer-actions">
      <button
        class="overlay-btn"
        @click="showBreakOverlay"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
            fill="currentColor"
          />
        </svg>
        {{ t('settings').pomodoro.breakOverlayReopen }}
      </button>
      <button
        class="skip-btn"
        @click="skipBreak"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"
            fill="currentColor"
          />
        </svg>
        {{ t('settings').pomodoro.skipBreak }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import { usePomodoroStore } from '@/stores'

const plugin = usePlugin() as any
const pomodoroStore = usePomodoroStore()

// 圆周长
const radius = 54
const circumference = 2 * Math.PI * radius

// 休息总时长（秒），用于进度环计算
const totalBreakSeconds = computed(() => {
  return pomodoroStore.breakTotalSeconds || 5 * 60
})

// 进度环：休息倒计时，从满到空（shrink）
const strokeDashoffset = computed(() => {
  const remaining = pomodoroStore.breakRemainingSeconds
  const total = totalBreakSeconds.value
  const elapsed = Math.max(0, total - remaining)
  const progress = total > 0 ? elapsed / total : 0
  return circumference * progress
})

// 格式化的剩余时间 MM:SS
const formattedTime = computed(() => {
  const secs = pomodoroStore.breakRemainingSeconds
  const mins = Math.floor(secs / 60)
  const s = secs % 60
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

// 跳过休息
const skipBreak = async () => {
  await pomodoroStore.stopBreak(plugin)
}

// 显示休息弹窗
const showBreakOverlay = () => {
  pomodoroStore.showBreakOverlay()
}
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

.timer-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.skip-btn,
.overlay-btn {
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
