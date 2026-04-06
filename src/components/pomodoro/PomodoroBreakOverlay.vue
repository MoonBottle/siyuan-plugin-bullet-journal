<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="visible" class="break-overlay" @click.self="handleOverlayClick">
        <div class="break-overlay-content">
          <!-- 关闭按钮 -->
          <button class="close-btn" @click="closeOverlay" :title="t('settings').pomodoro.breakOverlayClose">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>
          </button>

          <!-- 标题 -->
          <div class="overlay-header">
            <svg class="coffee-icon" viewBox="0 0 1024 1024" width="48" height="48" fill="currentColor">
              <path d="M828.36 955.46h-738C75.8 955.46 64 943.66 64 929.1s11.8-26.36 26.36-26.36h738c14.56 0 26.36 11.8 26.36 26.36s-11.81 26.36-26.36 26.36zM512.17 876.39H406.53c-159.87 0-289.93-130.06-289.93-289.93V481.04c0-43.6 35.47-79.07 79.07-79.07h527.36c43.6 0 79.07 35.47 79.07 79.07v105.43c0 159.86-130.06 289.92-289.93 289.92z m-316.5-421.71c-14.53 0-26.36 11.82-26.36 26.36v105.43c0 130.8 106.42 237.21 237.21 237.21h105.65c130.79 0 237.21-106.41 237.21-237.21V481.04c0-14.54-11.83-26.36-26.36-26.36H195.67z"/>
              <path d="M828.19 705.07h-65.65c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h65.65c43.62 0 79.1-35.47 79.1-79.07s-35.48-79.07-79.1-79.07h-52.47c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h52.47c72.68 0 131.81 59.12 131.81 131.79s-59.14 131.79-131.81 131.79zM458.82 384.85c-11.24 0-21.65-7.24-25.16-18.53-7.08-22.77-10.67-46.5-10.67-70.56 0-35.32 7.58-69.32 22.55-101.05 6.2-13.17 21.92-18.81 35.07-12.6 13.17 6.21 18.82 21.91 12.6 35.08-11.61 24.64-17.5 51.07-17.5 78.56 0 18.74 2.79 37.21 8.3 54.9 4.32 13.9-3.45 28.67-17.35 33-2.61 0.81-5.24 1.2-7.84 1.2zM326.71 384.85c-11.26 0-21.69-7.27-25.17-18.6-1.25-4.04-2.55-7.62-3.8-11.11-5.28-14.63-10.73-29.76-10.73-61.45 0-32.51 6.14-48.33 12.07-63.63 1.43-3.67 2.91-7.48 4.38-11.8 1.58-5.19 3.46-9.94 5.28-14.5 4.09-10.29 6.81-17.08 6.81-40.95 0-24.25-3.28-32.4-8.24-44.74-1.81-4.52-3.71-9.25-5.56-14.75-4.65-13.8 2.77-28.74 16.56-33.39 13.8-4.68 28.74 2.76 33.4 16.56 1.49 4.45 3.04 8.26 4.52 11.92 5.91 14.73 12.03 29.96 12.03 64.4 0 31.55-4.38 44.97-10.55 60.47-1.35 3.36-2.75 6.85-4.09 11.17-1.94 5.78-3.69 10.32-5.38 14.66-5.12 13.2-8.51 21.92-8.51 44.57 0 22.47 3.19 31.32 7.61 43.57 1.52 4.22 3.08 8.56 4.58 13.45 4.29 13.91-3.51 28.66-17.41 32.95-2.6 0.82-5.23 1.2-7.8 1.2zM595.87 384.85c-11.24 0-21.65-7.24-25.16-18.53-7.08-22.77-10.67-46.5-10.67-70.56 0-22.92 3.27-45.61 9.73-67.42 4.13-13.97 18.83-21.89 32.75-17.8 13.96 4.13 21.93 18.8 17.8 32.75-5.02 16.96-7.57 34.61-7.57 52.47 0 18.74 2.79 37.21 8.3 54.9 4.32 13.9-3.45 28.67-17.35 33-2.6 0.8-5.24 1.19-7.83 1.19z"/>
            </svg>
            <h2 class="overlay-title">{{ t('settings').pomodoro.breakOverlayTitle }}</h2>
          </div>

          <!-- 倒计时圆环 -->
          <div class="timer-display">
            <div class="timer-circle">
              <svg class="progress-ring" viewBox="0 0 200 200">
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
                <div class="time-remaining">{{ formattedTime }}</div>
              </div>
            </div>
          </div>

          <!-- 提示语 -->
          <div class="overlay-hint">
            {{ t('settings').pomodoro.breakOverlayHint }}
          </div>

          <!-- 操作按钮 -->
          <div class="overlay-actions">
            <button class="action-btn secondary" @click="closeOverlay">
              {{ t('settings').pomodoro.breakOverlayClose }}
            </button>
            <button class="action-btn primary" @click="skipBreak">
              <svg class="btn-icon" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/>
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
import { computed } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// 圆周长
const radius = 90;
const circumference = 2 * Math.PI * radius;

// 休息总时长（秒），用于进度环计算
const totalBreakSeconds = computed(() => {
  return pomodoroStore.breakTotalSeconds || 5 * 60;
});

// 进度环：休息倒计时，从满到空（shrink）
const strokeDashoffset = computed(() => {
  const remaining = pomodoroStore.breakRemainingSeconds;
  const total = totalBreakSeconds.value;
  const elapsed = Math.max(0, total - remaining);
  const progress = total > 0 ? elapsed / total : 0;
  return circumference * progress;
});

// 格式化的剩余时间 MM:SS
const formattedTime = computed(() => {
  const secs = pomodoroStore.breakRemainingSeconds;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
});

// 关闭弹窗
const closeOverlay = () => {
  pomodoroStore.hideBreakOverlay();
  emit('close');
};

// 点击遮罩层关闭
const handleOverlayClick = () => {
  closeOverlay();
};

// 跳过休息
const skipBreak = async () => {
  await pomodoroStore.stopBreak(plugin);
};
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
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.overlay-fade-enter-from .break-overlay-content,
.overlay-fade-leave-to .break-overlay-content {
  transform: scale(0.9);
  opacity: 0;
}
</style>
