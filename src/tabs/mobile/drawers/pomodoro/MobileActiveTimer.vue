<template>
  <div class="mobile-active-timer">
    <!-- Timer Circle Display -->
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
          <div v-if="!isStopwatch" class="focused-time-badge">
            {{ t('pomodoroActive').focusedFor.replace('{minutes}', String(accumulatedMinutes)) }}
          </div>
          <div v-else class="focused-time-badge">
            {{ t('pomodoroActive').stopwatchFocused.replace('{minutes}', String(accumulatedMinutes)) }}
          </div>
          <div v-if="isPaused" class="pause-badge">{{ t('pomodoroActive').pauseBadge }}</div>
        </div>
      </div>
    </div>

    <!-- Item Info Cards -->
    <div class="item-info-section">
      <!-- Project Card -->
      <div v-if="currentItem?.project" class="info-card">
        <div class="info-card-header">
          <span class="info-card-label">{{ t('todo').project }}</span>
        </div>
        <div class="info-card-content">
          <svg><use xlink:href="#iconFolder"></use></svg>
          <span>{{ currentItem.project.name }}</span>
        </div>
      </div>

      <!-- Task Card -->
      <div v-if="currentItem?.task" class="info-card">
        <div class="info-card-header">
          <span class="info-card-label">{{ t('todo').task }}</span>
          <span v-if="currentItem.task.level" class="task-level-badge" :class="'level-' + currentItem.task.level.toLowerCase()">
            {{ currentItem.task.level }}
          </span>
        </div>
        <div class="info-card-content">
          <svg><use xlink:href="#iconList"></use></svg>
          <span>{{ currentItem.task.name }}</span>
        </div>
      </div>

      <!-- Item Card -->
      <div class="info-card item-card">
        <div class="info-card-header">
          <span class="info-card-label">{{ t('todo').item }}</span>
        </div>
        <div class="info-card-content">
          <span class="status-emoji">{{ getStatusEmoji(currentItem) }}</span>
          <span>{{ itemContent }}</span>
        </div>
      </div>
    </div>

    <!-- Timer Actions -->
    <div class="timer-actions">
      <template v-if="!isPaused">
        <button class="pause-btn" @click="pausePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
          {{ t('pomodoroActive').pause }}
        </button>
      </template>
      <template v-else>
        <button class="resume-btn" @click="resumePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
          {{ t('pomodoroActive').resume }}
        </button>
      </template>
      <button class="end-btn" @click="endPomodoro">
        <svg class="btn-icon" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
        </svg>
        {{ t('pomodoroActive').endFocus }}
      </button>
    </div>

    <!-- Confirm Drawer -->
    <MobileConfirmDrawer
      v-model="showConfirmDrawer"
      :title="confirmTitle"
      :message="confirmMessage"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePomodoroStore, useProjectStore } from '@/stores';
import { usePlugin } from '@/main';
import { getSharedPinia } from '@/utils/sharedPinia';
import type { Item } from '@/types/models';
import { t } from '@/i18n';
import MobileConfirmDrawer from '../MobileConfirmDrawer.vue';
import { getProgressDirection } from '@/utils/progressDirection';

const emit = defineEmits<{
  close: [];
}>();

const plugin = usePlugin() as any;
const pinia = getSharedPinia();
const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;
const projectStore = pinia ? useProjectStore(pinia) : null;

// Prevent double-click execution lock
const isProcessing = ref(false);

// Confirm drawer state
const showConfirmDrawer = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
const onConfirmCallback = ref<(() => void) | null>(null);

// Circle circumference
const radius = 54;
const circumference = 2 * Math.PI * radius;

// Get current item from projectStore
const currentItem = computed<Item | undefined>(() => {
  if (!projectStore) return undefined;
  const blockId = pomodoroStore?.activePomodoro?.blockId;
  if (!blockId) return undefined;
  return projectStore.getItemByBlockId(blockId);
});

// Current item content
const itemContent = computed(() => {
  return currentItem.value?.content || pomodoroStore?.activePomodoro?.itemContent || '未知事项';
});

// Pause state
const isPaused = computed(() => {
  return pomodoroStore?.activePomodoro?.isPaused || false;
});

// Stopwatch mode
const isStopwatch = computed(() => pomodoroStore?.isStopwatch || false);

// Progress direction
const progressDirection = computed(() => getProgressDirection(pomodoroStore?.activePomodoro?.timerMode));

// Accumulated minutes
const accumulatedMinutes = computed(() => {
  if (!pomodoroStore?.activePomodoro) return 0;
  return Math.floor(pomodoroStore.activePomodoro.accumulatedSeconds / 60);
});

// Target minutes
const targetMinutes = computed(() => {
  return pomodoroStore?.activePomodoro?.targetDurationMinutes || 25;
});

// Stopwatch reference seconds (25 minutes)
const stopwatchReferenceSeconds = 25 * 60;

// Formatted time (MM:SS)
const formattedTime = computed(() => {
  if (!pomodoroStore) return '00:00';
  const seconds = isStopwatch.value ? pomodoroStore.elapsedSeconds : pomodoroStore.remainingTime;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

// Progress ring stroke offset
const strokeDashoffset = computed(() => {
  if (!pomodoroStore?.activePomodoro) {
    return progressDirection.value === 'shrink' ? 0 : circumference;
  }

  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const progress = Math.min(1, elapsedSeconds / totalSeconds);

  return progressDirection.value === 'shrink'
    ? circumference * progress
    : circumference * (1 - progress);
});

// Get status emoji
const getStatusEmoji = (item?: Item): string => {
  if (!item) return '⏳';
  if (item.status === 'completed') return '✅';
  if (item.status === 'abandoned') return '❌';
  return '⏳';
};

// Pause pomodoro
const pausePomodoro = async () => {
  if (isProcessing.value) return;
  isProcessing.value = true;
  try {
    await pomodoroStore?.pausePomodoro(plugin);
  } finally {
    isProcessing.value = false;
  }
};

// Resume pomodoro
const resumePomodoro = async () => {
  if (isProcessing.value) return;
  isProcessing.value = true;
  try {
    await pomodoroStore?.resumePomodoro(plugin);
  } finally {
    isProcessing.value = false;
  }
};

// End pomodoro
const endPomodoro = () => {
  confirmTitle.value = t('pomodoroActive').confirmEndTitle;
  confirmMessage.value = t('pomodoroActive').confirmEndMessage;
  onConfirmCallback.value = async () => {
    await pomodoroStore?.completePomodoro(plugin);
    emit('close');
  };
  showConfirmDrawer.value = true;
};

const handleConfirm = () => {
  if (onConfirmCallback.value) {
    onConfirmCallback.value();
  }
  showConfirmDrawer.value = false;
};
</script>

<style lang="scss" scoped>
.mobile-active-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 16px;
}

// Timer Display
.timer-display {
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
  font-size: 48px;
  font-weight: 300;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1;
  transition: color 0.3s;
}

.focused-time-badge {
  margin-top: 8px;
  font-size: 13px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.pause-badge {
  margin-top: 8px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

// Item Info Section
.item-info-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  background: var(--b3-theme-surface);
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.info-card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-card-content {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  word-break: break-word;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface);
    flex-shrink: 0;
  }
}

.status-emoji {
  font-size: 16px;
  flex-shrink: 0;
}

// Task level badge
.task-level-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;

  &.level-l1 {
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
  }

  &.level-l2 {
    background: rgba(255, 152, 0, 0.15);
    color: #FF9800;
  }

  &.level-l3 {
    background: rgba(33, 150, 243, 0.15);
    color: #2196F3;
  }
}

// Timer Actions
.timer-actions {
  width: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: center;
  gap: 12px;
}

.pause-btn,
.resume-btn,
.end-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  flex: 1;
  max-width: 160px;

  &:active {
    transform: scale(0.98);
  }
}

.pause-btn {
  background: var(--b3-theme-secondary);
  color: var(--b3-theme-on-secondary);

  &:hover {
    opacity: 0.9;
  }
}

.resume-btn {
  background: var(--b3-theme-success);
  color: #fff;

  &:hover {
    opacity: 0.9;
  }
}

.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);

  &:hover {
    opacity: 0.9;
  }
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
