<template>
  <div class="pomodoro-stats">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">
          {{ t('pomodoroStats').todayPomodoros }}
        </div>
        <div class="stat-value">
          {{ todayCount }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          {{ t('pomodoroStats').todayFocusDuration }}
        </div>
        <div class="stat-value">
          {{ formatDuration(todayMinutes) }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          {{ t('pomodoroStats').totalPomodoros }}
        </div>
        <div class="stat-value">
          {{ totalCount }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          {{ t('pomodoroStats').totalFocusDuration }}
        </div>
        <div class="stat-value">
          {{ formatDuration(totalMinutes) }}
        </div>
      </div>
      <button
        class="stat-card stat-card--action"
        data-testid="focus-workbench-entry-estimated"
        type="button"
        @click="openFocusWorkbench"
      >
        <div class="stat-card__action">
          <div class="stat-label">
            {{ t('focusPlan').estimatedShort }}
          </div>
          <span
            class="stat-card__action-icon"
            :aria-label="t('focusWorkbench').openReview"
          >
            <svg><use xlink:href="#iconRight"></use></svg>
          </span>
        </div>
        <div class="stat-value">
          {{ formatDuration(todayFocusPlanSummary.estimatedMinutes) }}
        </div>
      </button>
      <button
        class="stat-card stat-card--action"
        data-testid="focus-workbench-entry-variance"
        type="button"
        @click="openFocusWorkbench"
      >
        <div class="stat-card__action">
          <div class="stat-label">
            {{ t('focusPlan').variance }}
          </div>
          <span
            class="stat-card__action-icon"
            :aria-label="t('focusWorkbench').openReview"
          >
            <svg><use xlink:href="#iconRight"></use></svg>
          </span>
        </div>
        <div class="stat-value">
          {{ varianceDisplay }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TAB_TYPES } from '@/constants'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import { useProjectStore } from '@/stores'

const projectStore = useProjectStore()
const plugin = usePlugin() as any

const todayCount = computed(() => projectStore.getTodayPomodoros('').length)
const todayMinutes = computed(() => projectStore.getTodayFocusMinutes(''))
const totalCount = computed(() => projectStore.getTotalPomodoros(''))
const totalMinutes = computed(() => projectStore.getTotalFocusMinutes(''))
const todayFocusPlanSummary = computed(() => projectStore.getTodayFocusPlanSummary(''))
const varianceDisplay = computed(() => {
  const delta = todayFocusPlanSummary.value.actualMinutes - todayFocusPlanSummary.value.estimatedMinutes
  const absValue = Math.abs(delta)
  const prefix = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${prefix}${formatDuration(absValue)}`
})

function openFocusWorkbench() {
  plugin?.openCustomTab?.(TAB_TYPES.FOCUS_WORKBENCH)
}

/**
 * 格式化时长为可读字符串
 * 如：25m, 1h 30m, 10h 5m
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}
</script>

<style lang="scss" scoped>
.pomodoro-stats {
  padding: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  padding: 12px;
  text-align: left;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--b3-theme-surface-lighter);
}

.stat-card--action {
  appearance: none;
  width: 100%;
  cursor: pointer;
  border-color: var(--b3-theme-surface-lighter);

  &:hover {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.stat-card__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat-card__action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--b3-theme-on-surface);

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}

.stat-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
  opacity: 0.8;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}
</style>
