<template>
  <div class="mobile-break-timer">
    <!-- 顶部标题 -->
    <div class="break-header">
      <h2 class="break-title">{{ t('settings').pomodoro.breakTitle || '休息时间' }}</h2>
      <p class="break-subtitle">{{ t('settings').pomodoro.breakSubtitle || '放松身心，为下一轮专注做准备' }}</p>
    </div>

    <!-- 呼吸圆圈与倒计时 -->
    <div class="timer-section">
      <div class="breathing-circle">
        <div class="circle-inner">
          <div class="time-remaining">{{ formattedTime }}</div>
          <div class="time-label">{{ t('common').minutes }}</div>
        </div>
      </div>
    </div>
    <!-- 跳过按钮 -->
    <div class="action-section">
      <button class="skip-btn" @click="skipBreak">
        <svg class="btn-icon" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/>
        </svg>
        {{ t('settings').pomodoro.skipBreak }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';

const emit = defineEmits<{
  close: [];
}>();

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// Break remaining seconds
const breakRemainingSeconds = computed(() => pomodoroStore.breakRemainingSeconds);

// Processing lock to prevent double clicks
const isProcessing = ref(false);

// Formatted time MM:SS
const formattedTime = computed(() => {
  const secs = breakRemainingSeconds.value;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
});

// Skip break
const skipBreak = async () => {
  if (isProcessing.value) return;
  isProcessing.value = true;
  try {
    await pomodoroStore.stopBreak(plugin);
    emit('close');
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style lang="scss" scoped>
.mobile-break-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  height: 100%;
  padding: 24px 16px 32px;
  background: var(--b3-theme-background);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

// 顶部标题
.break-header {
  text-align: center;
  padding-top: 20px;
}

.break-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 8px;
}

.break-subtitle {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  margin: 0;
  opacity: 0.8;
}

// 计时器区域
.timer-section {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0 24px;
}

.breathing-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--b3-theme-success) 0%, #66BB6A 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 24px rgba(76, 175, 80, 0.18),
    0 0 56px rgba(76, 175, 80, 0.08),
    inset 0 0 14px rgba(255, 255, 255, 0.08);
  will-change: transform;
  transform: translateZ(0);
  animation: breathe-scale 3.6s ease-in-out infinite;
}

.circle-inner {
  text-align: center;
}

.time-remaining {
  font-size: 48px;
  font-weight: 300;
  color: #fff;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.time-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

// 轻量呼吸动画
@keyframes breathe-scale {
  0%, 100% {
    transform: translateZ(0) scale(0.985);
  }
  50% {
    transform: translateZ(0) scale(1.02);
  }
}

// 操作区域
.action-section {
  margin-top: auto;
  padding-top: 24px;
  padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
}

.skip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);

  &:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &:active {
    transform: scale(0.98);
  }
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
