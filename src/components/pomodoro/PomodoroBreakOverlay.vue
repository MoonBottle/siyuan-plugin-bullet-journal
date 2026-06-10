<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div
        v-if="visible"
        class="break-overlay"
        @click.self="handleOverlayClick"
      >
        <div class="break-overlay-content">
          <!-- 关闭按钮 -->
          <button
            class="close-btn"
            :title="t('settings').pomodoro.breakOverlayClose"
            @click="closeOverlay"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
            >
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill="currentColor"
              />
            </svg>
          </button>

          <!-- 标题 -->
          <div class="overlay-header">
            <svg
              class="coffee-icon"
              width="48"
              height="48"
            >
              <use xlink:href="#iconTaCoffee" />
            </svg>
            <h2 class="overlay-title">
              {{ t('settings').pomodoro.breakOverlayTitle }}
            </h2>
          </div>

          <!-- 倒计时圆环 -->
          <div class="timer-display">
            <div class="timer-circle">
              <svg
                class="progress-ring"
                viewBox="0 0 200 200"
              >
                <circle
                  class="progress-ring-bg"
                  cx="100"
                  cy="100"
                  r="90"
                />
                <circle
                  class="progress-ring-fill"
                  cx="100"
                  cy="100"
                  r="90"
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

          <!-- 提示语 -->
          <div class="overlay-hint">
            {{ t('settings').pomodoro.breakOverlayHint }}
          </div>

          <!-- 操作按钮 -->
          <div class="overlay-actions">
            <button
              class="action-btn secondary"
              @click="closeOverlay"
            >
              {{ t('settings').pomodoro.breakOverlayClose }}
            </button>
            <button
              class="action-btn primary"
              @click="skipBreak"
            >
              <svg
                class="btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <use xlink:href="#iconTaSkipBreak" />
              </svg>
              {{ t('settings').pomodoro.skipBreak }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import { usePomodoroStore } from '@/stores'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const plugin = usePlugin() as any
const pomodoroStore = usePomodoroStore()

// 圆周长
const radius = 90
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

// 关闭弹窗
const closeOverlay = () => {
  pomodoroStore.hideBreakOverlay()
  emit('close')
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  closeOverlay()
}

// 跳过休息
const skipBreak = async () => {
  await pomodoroStore.stopBreak(plugin)
}
</script>

<style lang="scss" scoped>
.break-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.break-overlay-content {
  position: relative;
  background: var(--b3-theme-background);
  border-radius: 24px;
  padding: 48px 64px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-background);
  }

  svg {
    width: 24px;
    height: 24px;
  }
}

.overlay-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .coffee-icon {
    color: var(--b3-theme-primary);
    opacity: 0.9;
  }

  .overlay-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin: 0;
  }
}

.timer-display {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-circle {
  position: relative;
  width: 240px;
  height: 240px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  fill: none;
  stroke: var(--b3-theme-surface-lighter);
  stroke-width: 10;
}

.progress-ring-fill {
  fill: none;
  stroke: var(--b3-theme-primary);
  stroke-width: 10;
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
  font-size: 56px;
  font-weight: 700;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 4px;
  line-height: 1;
}

.overlay-hint {
  font-size: 18px;
  color: var(--b3-theme-on-surface);
  text-align: center;
  line-height: 1.6;
  max-width: 320px;
}

.overlay-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  width: 100%;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &.secondary {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);

    &:hover {
      background: var(--b3-theme-surface-lighter);
      color: var(--b3-theme-on-background);
    }
  }

  &.primary {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);

    &:hover {
      opacity: 0.9;
    }
  }
}

.btn-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: currentColor;
}

// 过渡动画
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.overlay-fade-enter-active .break-overlay-content,
.overlay-fade-leave-active .break-overlay-content {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.overlay-fade-enter-from .break-overlay-content,
.overlay-fade-leave-to .break-overlay-content {
  transform: scale(0.9);
  opacity: 0;
}
</style>
