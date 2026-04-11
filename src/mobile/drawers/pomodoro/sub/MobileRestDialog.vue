<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="rest-overlay" @click="handleClose">
        <Transition name="zoom">
          <div v-if="modelValue" class="rest-dialog" @click.stop>
            <!-- 成功图标 -->
            <div class="success-icon">
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            </div>

            <!-- 标题 -->
            <h3 class="dialog-title">{{ t('pomodoroComplete').focusComplete }}</h3>

            <!-- 休息选择 -->
            <div class="break-section">
              <p class="break-hint">{{ t('settings').pomodoro.breakHint }}</p>
              <div class="break-options">
                <button
                  v-for="duration in breakDurations"
                  :key="duration"
                  class="break-btn"
                  :class="{ active: selectedDuration === duration }"
                  @click="selectDuration(duration)"
                >
                  {{ duration }}{{ t('common').minutes }}
                </button>
              </div>
            </div>

            <!-- 按钮 -->
            <div class="dialog-footer">
              <button class="skip-btn" @click="handleSkip">
                {{ t('settings').pomodoro.skipBreak }}
              </button>
              <button class="start-btn" @click="handleStart">
                {{ t('settings').pomodoro.startBreak }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePlugin } from '@/main';
import { t } from '@/i18n';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  start: [duration: number];
  skip: [];
}>();

const plugin = usePlugin() as any;

const selectedDuration = ref(5);

// 从设置读取休息时长预设
const breakDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.breakDurationPresets ?? [5, 10, 15];
});

// 从设置读取默认休息时长
const defaultBreakDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultBreakDuration ?? 5;
});

// 默认选中设置的默认值
watch(() => props.modelValue, (visible) => {
  if (visible) {
    selectedDuration.value = defaultBreakDuration.value;
  }
}, { immediate: true });

function selectDuration(minutes: number) {
  selectedDuration.value = minutes;
}

function handleStart() {
  emit('start', selectedDuration.value);
  emit('update:modelValue', false);
}

function handleSkip() {
  emit('skip');
  emit('update:modelValue', false);
}

function handleClose() {
  emit('skip');
  emit('update:modelValue', false);
}
</script>

<style lang="scss" scoped>
.rest-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1004;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.rest-dialog {
  width: 100%;
  max-width: 320px;
  background: var(--b3-theme-background);
  border-radius: 20px;
  padding: 28px 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.success-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--b3-theme-success);
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 28px;
    height: 28px;
    fill: white;
  }
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 24px;
}

.break-section {
  margin-bottom: 24px;
}

.break-hint {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 16px;
}

.break-options {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.break-btn {
  padding: 12px 18px;
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-color: var(--b3-theme-primary);
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
}

.skip-btn {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-error);
    color: var(--b3-theme-error);
  }

  &:active {
    transform: scale(0.98);
  }
}

.start-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.98);
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.zoom-enter-from,
.zoom-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
</style>
