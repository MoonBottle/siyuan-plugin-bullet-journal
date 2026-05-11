<template>
  <div
    :class="['habit-list-item', {
      'habit-list-item--completed': isCompleted,
      'habit-list-item--count': habit.type === 'count'
    }]"
  >
    <div
      class="habit-list-item__main"
      data-testid="habit-list-item-main"
      @click="handleMainClick"
    >
      <div class="habit-list-item__header">
        <span class="habit-list-item__name">{{ habit.name }}</span>
        <span v-if="stats" class="habit-list-item__streak">
          {{ t('habit').streakDays.replace('{n}', String(stats.currentStreak)) }}
        </span>
      </div>
      <div v-if="showPeriodCompletedStatus" class="habit-list-item__period-status">
        {{ periodCompletedText }}
      </div>

      <div v-if="habit.type !== 'binary'" class="habit-list-item__progress">
        <div class="habit-list-item__progress-bar">
          <div
            class="habit-list-item__progress-fill"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <span class="habit-list-item__progress-text">
          {{ dayCurrentValue }}/{{ habit.target || 0 }}{{ habit.unit || '' }}
        </span>
      </div>

      <div
        class="habit-list-item__meta"
        :class="{ 'habit-list-item__meta--due': isDueToday }"
        data-testid="habit-list-item-meta"
      >
        {{ frequencySummary }} · {{ scheduleHint }}
      </div>
    </div>

    <div class="habit-list-item__actions">
      <button
        v-if="!isMobile"
        class="habit-calendar-btn"
        data-testid="habit-list-item-open-doc"
        :aria-label="t('todo').openDoc"
        @click.stop="emit('open-doc', habit)"
      >
        <svg><use xlink:href="#iconFile"></use></svg>
      </button>

      <template v-if="!readonlyActions">
        <!-- 二元型打卡按钮 -->
        <button
          v-if="habit.type === 'binary'"
          :class="['habit-action-btn', {
            'habit-action-btn--done': dayState.isCompleted,
            'habit-action-btn--binary': true,
          }]"
          :disabled="dayState.isCompleted"
          data-testid="habit-list-item-check-in"
          :aria-label="dayState.isCompleted ? t('habit').completed : t('habit').checkIn"
          @click.stop="emit('check-in', habit)"
        >
          <span
            v-if="dayState.isCompleted"
            class="habit-action-btn__check"
            data-testid="habit-action-check"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M8.4 13.6 5.6 10.8l-1.2 1.2 4 4 7.2-7.2-1.2-1.2z" />
            </svg>
          </span>
          <span
            v-else
            class="habit-action-btn__empty"
            data-testid="habit-action-empty"
          ></span>
        </button>

        <!-- 计数型 +1 按钮 -->
        <button
          v-else
          :class="['habit-action-btn', {
            'habit-action-btn--done': dayState.isCompleted,
            'habit-action-btn--count': true,
          }]"
          :disabled="dayState.isCompleted"
          data-testid="habit-list-item-increment"
          :aria-label="dayState.isCompleted ? t('habit').completed : t('habit').addOne"
          @click.stop="emit('increment', habit)"
        >
          <span
            v-if="dayState.isCompleted"
            class="habit-action-btn__check"
            data-testid="habit-action-check"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M8.4 13.6 5.6 10.8l-1.2 1.2 4 4 7.2-7.2-1.2-1.2z" />
            </svg>
          </span>
          <svg
            v-else
            class="habit-action-btn__progress-ring"
            data-testid="habit-action-progress-ring"
            :data-progress="String(actionProgress)"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="habit-action-btn__progress-track" cx="12" cy="12" r="8" />
            <circle
              class="habit-action-btn__progress-value"
              cx="12"
              cy="12"
              r="8"
              :stroke-dasharray="`${actionProgress * progressCircumference} ${progressCircumference}`"
            />
          </svg>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getHabitEndDate } from '@/domain/habit/habitPeriod';
import { getNextEligibleHabitDate } from '@/domain/habit/habitStatus';
import { t } from '@/i18n';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  habit: Habit;
  dayState: HabitDayState;
  periodState: HabitPeriodState;
  stats?: HabitStats;
  currentDate?: string;
  isMobile?: boolean;
  readonlyActions?: boolean;
}>();

const emit = defineEmits<{
  'check-in': [habit: Habit];
  'increment': [habit: Habit];
  'open-doc': [habit: Habit];
  'open-detail': [habit: Habit];
}>();

const isMobile = computed(() => props.isMobile === true);

const isCompleted = computed(() => {
  return props.dayState.isCompleted;
});

const periodCompletedText = computed(() => {
  return props.periodState.periodType === 'day'
    ? t('habit').todayChecked
    : t('habit').periodCompleted;
});

const showPeriodCompletedStatus = computed(() => {
  if (!props.periodState.isCompleted) {
    return false;
  }

  if (props.periodState.periodType === 'interval') {
    return false;
  }

  return props.periodState.periodType !== 'day';
});

const dayCurrentValue = computed(() => {
  return props.dayState.currentValue ?? 0;
});

const progressCircumference = 2 * Math.PI * 8;

const progressPercent = computed(() => {
  if (!props.habit.target) return 0;
  return Math.min((dayCurrentValue.value / props.habit.target) * 100, 100);
});

const actionProgress = computed(() => progressPercent.value / 100);

const referenceDate = computed(() => props.currentDate || props.dayState.date);

const frequencySummary = computed(() => {
  const frequency = props.habit.frequency;
  if (!frequency || frequency.type === 'daily') {
    return t('habit').freqDaily;
  }

  if (frequency.type === 'every_n_days') {
    return t('habit').freqEveryNDays.replace('N', String(frequency.interval || 2));
  }

  if (frequency.type === 'weekly') {
    return t('habit').freqWeekly;
  }

  if (frequency.type === 'n_per_week') {
    return t('habit').freqNPerWeek.replace('N', String(frequency.daysPerWeek || 1));
  }

  if (frequency.type === 'weekly_days') {
    const labels = t('calendar').weekDays;
    const days = (frequency.daysOfWeek || [])
      .map(day => labels[(day + 6) % 7] || '')
      .filter(Boolean)
      .join('、');
    return days ? `${t('habit').freqWeekly}${days}` : t('habit').freqWeeklyDays;
  }

  return t('habit').frequencyLabel;
});

const isDueToday = computed(() => {
  return !props.habit.archivedAt
    && props.periodState.eligibleToday
    && !props.periodState.isCompleted
    && !props.dayState.isCompleted
    && !props.dayState.isMissed;
});

const scheduleHint = computed(() => {
  if (props.habit.archivedAt) {
    return t('habit').archived;
  }

  const endDate = getHabitEndDate(props.habit);
  if (endDate && referenceDate.value > endDate) {
    return t('habit').completed;
  }

  if (isDueToday.value) {
    return t('habit').dueToday;
  }

  if (!props.periodState.eligibleToday) {
    return t('habit').noNeedToday;
  }

  let searchFrom = dayjs(referenceDate.value).add(1, 'day').format('YYYY-MM-DD');
  if (props.habit.frequency?.type === 'weekly' || props.habit.frequency?.type === 'n_per_week') {
    searchFrom = dayjs(props.periodState.periodEnd).add(1, 'day').format('YYYY-MM-DD');
  }

  const nextDate = getNextEligibleHabitDate(props.habit, searchFrom);
  if (!nextDate) {
    return t('habit').completed;
  }

  if (nextDate === dayjs(referenceDate.value).add(1, 'day').format('YYYY-MM-DD')) {
    return t('habit').dueTomorrow;
  }

  return t('habit').dueOn.replace('{date}', dayjs(nextDate).format('M月D日'));
});

function handleMainClick() {
  emit('open-detail', props.habit);
}
</script>

<style scoped>
.habit-list-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.habit-list-item:hover {
  border-color: rgba(128, 162, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(128, 162, 255, 0.08);
}

.habit-list-item__main {
  flex: 1;
  min-width: 0;
  min-height: 56px;
}

.habit-list-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.habit-list-item__period-status {
  font-size: 11px;
  color: var(--b3-theme-primary);
  margin-bottom: 4px;
}

.habit-list-item__name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.habit-list-item__streak {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
}

.habit-list-item__progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.habit-list-item__progress-bar {
  flex: 1;
  height: 8px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 999px;
  overflow: hidden;
}

.habit-list-item__progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.habit-list-item__progress-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
}

.habit-list-item__meta {
  margin-top: 10px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.habit-list-item__meta--due {
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.habit-list-item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  align-self: center;
}

.habit-calendar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 50%;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.habit-calendar-btn:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  background: rgba(128, 162, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(128, 162, 255, 0.12);
}

.habit-calendar-btn svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.habit-action-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--b3-theme-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.habit-action-btn:hover:not(:disabled) {
  transform: scale(1.04);
}

.habit-action-btn:disabled {
  cursor: default;
}

.habit-action-btn__empty,
.habit-action-btn__check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.habit-action-btn__empty {
  background: #dedee3;
}

.habit-action-btn__check {
  background: #5b7cff;
  color: #fff;
  box-shadow: 0 1px 2px rgba(91, 124, 255, 0.22);
}

.habit-action-btn__check svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.habit-action-btn__progress-ring {
  width: 20px;
  height: 20px;
  transform: rotate(-90deg);
}

.habit-action-btn__progress-track,
.habit-action-btn__progress-value {
  fill: none;
  stroke-width: 3;
}

.habit-action-btn__progress-track {
  stroke: #dedee3;
}

.habit-action-btn__progress-value {
  stroke: #5b7cff;
  stroke-linecap: round;
}
</style>
