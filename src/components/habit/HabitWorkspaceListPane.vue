<template>
  <div class="habit-workspace-list-pane">
    <HabitWeekBar
      :model-value="selectedDate"
      :current-date="currentDate"
      :habits="habits"
      @update:model-value="emit('update:selectedDate', $event)"
    />

    <div v-if="habits.length > 0" class="habit-workspace-list-pane__list">
      <div
        v-for="habit in habits"
        :key="habit.blockId"
        :class="['habit-workspace-list-pane__item', {
          'habit-workspace-list-pane__item--active': activeHabitId === habit.blockId,
        }]"
        :data-testid="itemTestIdPrefix ? `${itemTestIdPrefix}${habit.blockId}` : undefined"
      >
        <HabitListItem
          :habit="habit"
          :day-state="habitDayStateMap.get(habit.blockId)!"
          :period-state="habitPeriodStateMap.get(habit.blockId)!"
          :stats="habitStatsMap.get(habit.blockId)"
          :is-mobile="itemOpenBehavior === 'detail'"
          @check-in="emit('check-in', $event)"
          @increment="emit('increment', $event)"
          @open-doc="emit('open-doc', $event)"
          @open-detail="emit('select-habit', $event)"
        />
      </div>
    </div>

    <div v-else class="habit-workspace-list-pane__empty">
      <div class="habit-workspace-list-pane__empty-icon">🎯</div>
      <div class="habit-workspace-list-pane__empty-title">{{ t('habit').noHabits }}</div>
      <div class="habit-workspace-list-pane__empty-desc">{{ t('habit').noHabitsDesc }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import { t } from '@/i18n';
import type {
  Habit,
  HabitDayState,
  HabitPeriodState,
  HabitStats,
} from '@/types/models';

withDefaults(defineProps<{
  selectedDate: string;
  currentDate: string;
  habits: Habit[];
  habitStatsMap: Map<string, HabitStats>;
  habitDayStateMap: Map<string, HabitDayState>;
  habitPeriodStateMap: Map<string, HabitPeriodState>;
  activeHabitId?: string | null;
  itemOpenBehavior?: 'document' | 'detail';
  itemTestIdPrefix?: string;
}>(), {
  activeHabitId: null,
  itemOpenBehavior: 'document',
  itemTestIdPrefix: '',
});

const emit = defineEmits<{
  'update:selectedDate': [value: string];
  'select-habit': [habit: Habit];
  'open-doc': [habit: Habit];
  'check-in': [habit: Habit];
  'increment': [habit: Habit];
}>();
</script>

<style scoped>
.habit-workspace-list-pane {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.habit-workspace-list-pane__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.habit-workspace-list-pane__item {
  border-radius: 10px;
}

.habit-workspace-list-pane__item--active :deep(.habit-list-item) {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 1px rgba(128, 162, 255, 0.18);
  background: var(--b3-theme-primary-lightest);
}

.habit-workspace-list-pane__empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  padding: 24px;
}

.habit-workspace-list-pane__empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.habit-workspace-list-pane__empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
}

.habit-workspace-list-pane__empty-desc {
  font-size: 12px;
}
</style>
