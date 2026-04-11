<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="break-timer-drawer" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>

            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('settings').pomodoro.breakLabel }}</h3>
            </div>

            <div class="drawer-content">
              <!-- Breathing Circle with Countdown -->
              <div class="timer-display">
                <div class="breathing-circle">
                  <!-- Progress Ring SVG -->
                  <svg class="progress-ring" viewBox="0 0 120 120">
                    <circle
                      class="progress-ring-bg"
                      cx="60"
                      cy="60"
                      :r="radius"
                    />
                    <circle
                      class="progress-ring-fill"
                      cx="60"
                      cy="60"
                      :r="radius"
                      :stroke-dasharray="circumference"
                      :stroke-dashoffset="circumference - (progress / 100) * circumference"
                    />
                  </svg>
                  <div class="circle-inner">
                    <div class="time-remaining">{{ formattedTime }}</div>
                  </div>
                </div>
              </div>

              <!-- Hint Text -->
              <div class="hint-text">{{ t('settings').pomodoro.breakHint }}</div>
            </div>

            <!-- Skip Button -->
            <div class="drawer-footer">
              <button class="skip-btn" @click="skipBreak">
                <svg class="btn-icon" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/>
                </svg>
                {{ t('settings').pomodoro.skipBreak }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// Break remaining seconds
const breakRemainingSeconds = computed(() => pomodoroStore.breakRemainingSeconds);
const breakTotalSeconds = computed(() => pomodoroStore.breakTotalSeconds);

// Processing lock to prevent double clicks
const isProcessing = ref(false);

// Progress ring calculation
const progress = computed(() => {
  const total = breakTotalSeconds.value;
  const remaining = breakRemainingSeconds.value;
  if (total <= 0) return 0;
  return ((total - remaining) / total) * 100;
});

// SVG circle properties
const radius = 54;
const circumference = 2 * Math.PI * radius;

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
    close();
  } finally {
    isProcessing.value = false;
  }
};

// Close drawer
const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.break-timer-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

// Timer Display with Breathing Animation
.timer-display {
  display: flex;
  align-items: center;
  justify-content: center;
}

.breathing-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--b3-theme-success);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 3s ease-in-out infinite;
  position: relative;
}

.progress-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 4;
}

.progress-ring-fill {
  fill: none;
  stroke: #fff;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.circle-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-remaining {
  font-size: 48px;
  font-weight: 300;
  color: #fff;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

// Breathing Animation
@keyframes breathe {
  0%, 100% { 
    transform: scale(1); 
    opacity: 0.8; 
  }
  50% { 
    transform: scale(1.1); 
    opacity: 1; 
  }
}

// Hint Text
.hint-text {
  font-size: 16px;
  color: var(--b3-theme-on-surface);
  text-align: center;
  font-weight: 400;
}

// Drawer Footer
.drawer-footer {
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: center;
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
  border: none;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-border-color);

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

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
