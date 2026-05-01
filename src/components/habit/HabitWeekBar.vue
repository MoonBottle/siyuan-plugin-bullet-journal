<template>
  <div class="habit-week-bar">
    <button
      v-for="day in weekDays"
      :key="day.date"
      :data-testid="`habit-week-day-${day.date}`"
      :class="['habit-week-bar__day', {
        'habit-week-bar__day--today': day.date === currentDate,
        'habit-week-bar__day--selected': day.date === modelValue
      }]"
      @click="emit('update:modelValue', day.date)"
    >
      <span
        :class="['habit-week-bar__weekday', {
          'habit-week-bar__weekday--today': day.date === currentDate,
          'habit-week-bar__weekday--selected': day.date === modelValue,
        }]"
      >
        {{ day.weekday }}
      </span>
      <span
        :class="['habit-week-bar__date', {
          'habit-week-bar__date--today': day.date === currentDate,
          'habit-week-bar__date--selected': day.date === modelValue,
        }]"
      >
        {{ day.dayNum }}
      </span>
      <span class="habit-week-bar__marker">
        <span
          v-if="day.status === 'completed'"
          class="habit-week-bar__check"
          data-testid="habit-week-check"
        >
          ✓
        </span>
        <svg
          v-else-if="day.status === 'partial'"
          class="habit-week-bar__progress-ring"
          data-testid="habit-week-progress-ring"
          :data-progress="String(day.progress)"
          viewBox="0 0 24 24"
        >
          <circle class="habit-week-bar__progress-track" cx="12" cy="12" r="8" />
          <circle
            class="habit-week-bar__progress-value"
            cx="12"
            cy="12"
            r="8"
            :stroke-dasharray="`${day.progress * progressCircumference} ${progressCircumference}`"
          />
        </svg>
        <span v-else class="habit-week-bar__empty-dot"></span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { isDateEligibleForHabit, isHabitActiveOnDate } from '@/domain/habit/habitPeriod';
import type { Habit } from '@/types/models';

const props = defineProps<{
  modelValue: string;
  currentDate: string;
  habits?: Habit[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const weekDayLabels = computed(() => t('calendar').weekDays);
const progressCircumference = 2 * Math.PI * 8;

type WeekDayStatus = 'completed' | 'partial' | 'none';

function getDayProgress(date: string): { status: WeekDayStatus; progress: number } {
  if (!props.habits?.length) {
    return { status: 'none', progress: 0 };
  }

  let totalProgress = 0;
  let eligibleHabitCount = 0;

  for (const habit of props.habits) {
    if (!isHabitActiveOnDate(habit, date)) {
      continue;
    }

    const frequencyType = habit.frequency?.type ?? 'daily';
    const isDayScoped = frequencyType === 'daily'
      || frequencyType === 'every_n_days'
      || frequencyType === 'weekly_days';

    if (isDayScoped && !isDateEligibleForHabit(habit, date)) {
      continue;
    }

    eligibleHabitCount++;

    if (isDayScoped) {
      const dayState = getHabitDayState(habit, date);
      if (dayState.isCompleted) {
        totalProgress += 1;
        continue;
      }

      if (habit.type === 'count' && dayState.hasRecord) {
        const targetValue = habit.target ?? dayState.targetValue ?? 0;
        if (targetValue > 0) {
          totalProgress += Math.min((dayState.currentValue ?? 0) / targetValue, 1);
        }
      }

      continue;
    }

    const periodState = getHabitPeriodState(habit, date);
    if (periodState.requiredCount <= 0) {
      eligibleHabitCount--;
      continue;
    }

    totalProgress += Math.min(periodState.completedCount / periodState.requiredCount, 1);
  }

  if (eligibleHabitCount <= 0) {
    return { status: 'none', progress: 0 };
  }

  const progress = Math.min(totalProgress / eligibleHabitCount, 1);

  if (progress >= 1) {
    return { status: 'completed', progress: 1 };
  }

  if (progress > 0) {
    return { status: 'partial', progress };
  }

  return { status: 'none', progress: 0 };
}

const weekDays = computed(() => {
  const windowStart = dayjs(props.currentDate).subtract(6, 'day');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = windowStart.add(i, 'day');
    const weekdayIndex = d.day() === 0 ? 6 : d.day() - 1;
    const date = d.format('YYYY-MM-DD');
    const { status, progress } = getDayProgress(date);
    days.push({
      date,
      weekday: weekDayLabels.value[weekdayIndex] || '',
      dayNum: d.format('D'),
      status,
      progress,
    });
  }
  return days;
});
</script>

<style scoped>
.habit-week-bar {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
}

.habit-week-bar__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.habit-week-bar__day:hover {
  background: rgba(128, 162, 255, 0.08);
}

.habit-week-bar__day--today {
  border-color: rgba(128, 162, 255, 0.25);
  background: rgba(128, 162, 255, 0.06);
}

.habit-week-bar__day--selected {
  background: var(--b3-theme-primary-lightest);
  border-color: rgba(128, 162, 255, 0.35);
}

.habit-week-bar__weekday {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.1;
}

.habit-week-bar__weekday--today,
.habit-week-bar__weekday--selected {
  color: var(--b3-theme-primary);
}

.habit-week-bar__date {
  font-size: 14px;
  font-weight: 500;
  width: 30px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  line-height: 1;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.habit-week-bar__date--today,
.habit-week-bar__date--selected {
  color: var(--b3-theme-primary);
}

.habit-week-bar__marker {
  width: 20px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.habit-week-bar__check,
.habit-week-bar__empty-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.habit-week-bar__check {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  line-height: 1;
}

.habit-week-bar__empty-dot {
  background: var(--b3-theme-surface-lighter);
  opacity: 0.7;
}

.habit-week-bar__progress-ring {
  width: 20px;
  height: 20px;
  transform: rotate(-90deg);
}

.habit-week-bar__progress-track,
.habit-week-bar__progress-value {
  fill: none;
  stroke-width: 3;
}

.habit-week-bar__progress-track {
  stroke: var(--b3-theme-surface-lighter);
  opacity: 0.9;
}

.habit-week-bar__progress-value {
  stroke: var(--b3-theme-primary);
  stroke-linecap: round;
}
</style>
