<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <PomodoroIcon
        :width="20"
        :height="20"
        class="timer-icon"
      />
      <span class="timer-title">{{ isPaused ? t('pomodoroActive').paused : t('pomodoroActive').focusing }}</span>
    </div>

    <div
      class="timer-display"
      :class="{ 'is-paused': isPaused }"
    >
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
          <div
            v-if="!isStopwatch"
            class="focused-time-badge"
          >
            {{ t('pomodoroActive').focusedFor.replace('{minutes}', String(accumulatedMinutes)) }}
          </div>
          <div
            v-else
            class="focused-time-badge"
          >
            {{ t('pomodoroActive').stopwatchFocused.replace('{minutes}', String(accumulatedMinutes)) }}
          </div>
          <div
            v-if="isPaused"
            class="pause-badge"
          >
            {{ t('pomodoroActive').pauseBadge }}
          </div>
        </div>
      </div>
    </div>

    <!-- 专注时间线 -->
    <div class="pomodoro-timeline">
      <div class="timeline-header">
        <span class="timeline-label">{{ t('pomodoroActive').pomodoroTimer }}</span>
        <span
          v-if="!isStopwatch"
          class="timeline-duration"
        >{{ t('pomodoroActive').target.replace('{minutes}', String(targetMinutes)) }}</span>
        <span
          v-else
          class="timeline-duration"
        >{{ t('pomodoroActive').stopwatch }}</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-point start">
          <div class="timeline-time">
            {{ formattedStartTime }}
          </div>
          <PlayIcon
            :width="14"
            :height="14"
            class="timeline-icon"
          />
          <div class="timeline-desc">
            {{ t('pomodoroActive').start }}
          </div>
        </div>
        <div class="timeline-progress-container">
          <div class="timeline-progress-bar">
            <div
              class="timeline-progress-fill"
              :style="{ width: `${timelineProgress}%` }"
            ></div>
            <div
              class="timeline-progress-indicator"
              :style="{ left: `${timelineProgress}%` }"
            ></div>
          </div>
        </div>
        <div class="timeline-point end">
          <div class="timeline-time">
            {{ formattedEndTime }}
          </div>
          <StopIcon
            :width="14"
            :height="14"
            class="timeline-icon"
          />
          <div class="timeline-desc">
            {{ isStopwatch ? t('pomodoroActive').manualEnd : t('pomodoroActive').estimatedEnd }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="focusPlanDisplay"
      class="focus-plan-progress"
    >
      <div class="focus-plan-progress-header">
        <span class="focus-plan-progress-label">{{ t('focusPlan').currentPlan }}</span>
        <span class="focus-plan-progress-value">{{ focusPlanDisplay }}</span>
      </div>
      <div
        v-if="focusPlanProgressDisplay"
        class="focus-plan-progress-body"
      >
        {{ t('focusPlan').actualShort }} {{ focusPlanProgressDisplay }}
      </div>
    </div>

    <!-- 事项信息卡片 - 复用 ItemDetailContent + ItemActionBar -->
    <div
      v-if="currentItem"
      class="item-info-section"
    >
      <ItemDetailContent
        :item="currentItem"
        :embedded="true"
        :show-action-row="false"
      />
      <ItemActionBar
        :item="currentItem"
        :show-separator="true"
        :show-actions="['complete', 'abandon', 'openDoc', 'detail', 'calendar']"
      />
    </div>

    <div class="timer-actions">
      <template v-if="!isPaused">
        <button
          class="pause-btn"
          @click="pausePomodoro"
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
            <use xlink:href="#iconTaPause" />
          </svg>
          {{ t('pomodoroActive').pause }}
        </button>
      </template>
      <template v-else>
        <button
          class="resume-btn"
          @click="resumePomodoro"
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
            <use xlink:href="#iconTaPlay" />
          </svg>
          {{ t('pomodoroActive').resume }}
        </button>
      </template>
      <button
        class="end-btn"
        @click="endPomodoro"
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
          <use xlink:href="#iconTaCheck" />
        </svg>
        {{ t('pomodoroActive').endFocus }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import {
  computed,
} from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import PlayIcon from '@/components/icons/PlayIcon.vue'
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
import StopIcon from '@/components/icons/StopIcon.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import {
  usePomodoroStore,
  useProjectStore,
} from '@/stores'
import dayjs from '@/utils/dayjs'
import {
  showConfirmDialog,
} from '@/utils/dialog'
import {
  formatFocusPlanDisplay,
  formatFocusPlanProgress,
} from '@/utils/focusPlanReview'
import { getProgressDirection } from '@/utils/progressDirection'

const plugin = usePlugin() as any
const pomodoroStore = usePomodoroStore()
const projectStore = useProjectStore()

// 圆周长
const radius = 54
const circumference = 2 * Math.PI * radius

// 根据 blockId 从 projectStore 中查找对应的 item（使用 Map 索引，O(1) 查找）
const currentItem = computed<Item | undefined>(() => {
  const blockId = pomodoroStore.activePomodoro?.blockId
  if (!blockId) return undefined
  return projectStore.getItemByBlockId(blockId)
})

// 当前专注的事项内容（优先使用 store 中的，但用 currentItem 作为后备）
const focusPlanDisplay = computed(() => formatFocusPlanDisplay(currentItem.value?.focusPlan))
const currentItemHistoricalFocusMinutes = computed(() => {
  return (currentItem.value?.pomodoros ?? []).reduce((sum, record) => {
    return sum + (record.actualDurationMinutes ?? record.durationMinutes)
  }, 0)
})
const accumulatedMinutes = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0
  return Math.floor(pomodoroStore.activePomodoro.accumulatedSeconds / 60)
})
const currentItemTotalFocusMinutes = computed(() => {
  return currentItemHistoricalFocusMinutes.value + accumulatedMinutes.value
})
const focusPlanProgressDisplay = computed(() => {
  return formatFocusPlanProgress(currentItem.value?.focusPlan, currentItemTotalFocusMinutes.value)
})

// 是否处于暂停状态
const isPaused = computed(() => {
  return pomodoroStore.activePomodoro?.isPaused || false
})

// 是否正计时模式
const isStopwatch = computed(() => pomodoroStore.isStopwatch)

// 进度条方向：正计时延长，倒计时缩短
const progressDirection = computed(() => getProgressDirection(pomodoroStore.activePomodoro?.timerMode))

// 目标分钟数
const targetMinutes = computed(() => {
  return pomodoroStore.activePomodoro?.targetDurationMinutes || 25
})

// 格式化的时间（MM:SS）：倒计时显示剩余，正计时显示已专注
const formattedTime = computed(() => {
  const seconds = isStopwatch.value ? pomodoroStore.elapsedSeconds : pomodoroStore.remainingTime
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

// 专注开始时间戳
const startTime = computed(() => {
  return pomodoroStore.activePomodoro?.startTime || 0
})

// 格式化的开始时间（HH:mm）
const formattedStartTime = computed(() => {
  if (!startTime.value) return '--:--'
  return dayjs(startTime.value).format('HH:mm')
})

// 预计结束时间戳（正计时无预计结束）
const endTime = computed(() => {
  if (!startTime.value || isStopwatch.value) return 0
  return startTime.value + targetMinutes.value * 60 * 1000
})

// 格式化的预计结束时间（HH:mm），正计时显示 "--"
const formattedEndTime = computed(() => {
  if (!endTime.value) return '--:--'
  return dayjs(endTime.value).format('HH:mm')
})

// 正计时参考时长（25分钟），用于进度显示
const stopwatchReferenceSeconds = 25 * 60

// 时间线进度（0-100）：根据方向决定显示效果
const timelineProgress = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0
  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60
  const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
  return progressDirection.value === 'shrink' ? 100 - progress : progress
})

// 进度环偏移量：根据方向决定填充效果
const strokeDashoffset = computed(() => {
  if (!pomodoroStore.activePomodoro) {
    return progressDirection.value === 'shrink' ? 0 : circumference
  }

  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60
  const progress = Math.min(1, elapsedSeconds / totalSeconds)

  return progressDirection.value === 'shrink'
    ? circumference * progress
    : circumference * (1 - progress)
})

// 暂停专注
const pausePomodoro = async () => {
  await pomodoroStore.pausePomodoro(plugin)
}

// 继续专注
const resumePomodoro = async () => {
  await pomodoroStore.resumePomodoro(plugin)
}

// 结束专注
const endPomodoro = () => {
  showConfirmDialog(
    t('pomodoroActive').confirmEndTitle,
    t('pomodoroActive').confirmEndMessage,
    async () => {
      await pomodoroStore.completePomodoro(plugin)
    },
  )
}
</script>

<style lang="scss" scoped>
.pomodoro-active-timer {
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

.timer-icon {
  font-size: 20px;
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
  transition:
    stroke-dashoffset 1s linear,
    stroke 0.3s,
    opacity 0.3s;
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
  transition: color 0.3s;
}

.pause-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  padding: 2px 8px;
  border-radius: 12px;
}

.focused-time-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

// 专注时间线
.pomodoro-timeline {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  box-sizing: border-box;
}

.focus-plan-progress {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  box-sizing: border-box;
}

.focus-plan-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.focus-plan-progress-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-plan-progress-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-plan-progress-body {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.timeline-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.timeline-duration {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.timeline-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timeline-point {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &.start {
    .timeline-dot {
      background: var(--b3-theme-primary);
    }
  }

  &.end {
    .timeline-dot {
      background: var(--b3-theme-surface-lighter);
      border: 2px solid var(--b3-theme-on-surface-light);
    }
  }
}

.timeline-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.timeline-icon {
  color: var(--b3-theme-primary);
}

.timeline-desc {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
}

.timeline-progress-container {
  flex: 1;
  padding: 0 12px;
  margin-top: -12px;
}

.timeline-progress-bar {
  position: relative;
  height: 4px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}

.timeline-progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 2px;
  transition: width 1s linear;
}

.timeline-progress-indicator {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: var(--b3-theme-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--b3-theme-surface);
  transition: left 1s linear;
}

// 事项信息区域
.item-info-section {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  box-sizing: border-box;
}

.timer-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.pause-btn,
.resume-btn,
.end-btn {
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
  width: 16px;
  height: 16px;
  fill: currentColor;
  stroke: currentColor;
}
</style>
