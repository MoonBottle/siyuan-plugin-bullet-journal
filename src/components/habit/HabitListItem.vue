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
      @click="emit('open-doc', habit)"
    >
      <div class="habit-list-item__header">
        <span class="habit-list-item__name">{{ habit.name }}</span>
        <span v-if="stats" class="habit-list-item__streak">
          🔥 {{ t('habit').streakDays.replace('{n}', String(stats.currentStreak)) }}
        </span>
      </div>
      <div v-if="showPeriodCompletedStatus" class="habit-list-item__period-status">
        {{ periodCompletedText }}
      </div>

      <!-- 二元型 -->
      <div v-if="habit.type === 'binary'" class="habit-list-item__status">
        <span v-if="dayState.isCompleted" class="habit-list-item__checked">{{ t('habit').todayChecked }}</span>
        <span v-else class="habit-list-item__unchecked">{{ t('habit').todayUnchecked }}</span>
      </div>

      <!-- 计数型 -->
      <div v-else class="habit-list-item__progress">
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
    </div>

    <div class="habit-list-item__actions">
      <button
        class="habit-calendar-btn"
        data-testid="habit-list-item-calendar"
        :aria-label="t('habit').title"
        @click.stop="emit('open-calendar', habit)"
      >
        <svg><use xlink:href="#iconCalendar"></use></svg>
      </button>

      <!-- 二元型打卡按钮 -->
      <button
        v-if="habit.type === 'binary'"
        :class="['habit-check-btn', { 'habit-check-btn--done': dayState.isCompleted }]"
        :disabled="dayState.isCompleted"
        data-testid="habit-list-item-check-in"
        @click.stop="emit('check-in', habit)"
      >
        {{ dayState.isCompleted ? '✅' : t('habit').checkIn }}
      </button>

      <!-- 计数型 +1 按钮 -->
      <button
        v-else
        class="habit-increment-btn"
        :disabled="dayState.isCompleted"
        data-testid="habit-list-item-increment"
        @click.stop="emit('increment', habit)"
      >
        {{ t('habit').addOne }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';

const props = defineProps<{
  habit: Habit;
  dayState: HabitDayState;
  periodState: HabitPeriodState;
  stats?: HabitStats;
}>();

const emit = defineEmits<{
  'check-in': [habit: Habit];
  'increment': [habit: Habit];
  'open-doc': [habit: Habit];
  'open-calendar': [habit: Habit];
}>();

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

  return !(props.habit.type === 'binary' && props.periodState.periodType === 'day');
});

const dayCurrentValue = computed(() => {
  return props.dayState.currentValue ?? 0;
});

const progressPercent = computed(() => {
  if (!props.habit.target) return 0;
  return Math.min((dayCurrentValue.value / props.habit.target) * 100, 100);
});
</script>

<style scoped>
.habit-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: background 0.15s ease;
}

.habit-list-item:hover {
  background: var(--b3-theme-surface-lighter);
}

.habit-list-item--completed {
  opacity: 0.7;
}

.habit-list-item__main {
  flex: 1;
  min-width: 0;
}

.habit-list-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
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

.habit-list-item__status {
  font-size: 12px;
}

.habit-list-item__checked {
  color: var(--b3-theme-primary);
}

.habit-list-item__unchecked {
  color: var(--b3-theme-on-surface-light);
}

.habit-list-item__progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.habit-list-item__progress-bar {
  flex: 1;
  height: 6px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;
  overflow: hidden;
}

.habit-list-item__progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.habit-list-item__progress-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
}

.habit-list-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.habit-calendar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
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
}

.habit-calendar-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.habit-check-btn {
  padding: 4px 12px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 12px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.habit-check-btn:hover:not(:disabled) {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.habit-check-btn--done {
  border-color: transparent;
  background: transparent;
  cursor: default;
}

.habit-check-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.habit-increment-btn {
  padding: 4px 10px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 12px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.habit-increment-btn:hover:not(:disabled) {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.habit-increment-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
