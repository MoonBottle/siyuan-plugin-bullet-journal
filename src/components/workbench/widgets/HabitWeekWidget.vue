<template>
  <div class="workbench-widget-habit-week" data-testid="workbench-widget-habit-week">
    <HabitWorkspaceListPane
      :selected-date="selectedDate"
      :current-date="currentDate"
      :habits="habits"
      :habit-stats-map="habitStatsMap"
      :habit-day-state-map="habitDayStateMap"
      :habit-period-state-map="habitPeriodStateMap"
      :archived-list="habitConfig.habitScope === 'archived'"
      item-open-behavior="detail"
      @update:selected-date="selectedDate = $event"
      @check-in="checkInHabit"
      @increment="incrementHabit"
      @select-habit="handleOpenDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import type { Dialog } from 'siyuan';
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import type { Habit } from '@/types/models';
import type { WorkbenchHabitWeekWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { openHabitWidgetDetailDialog } from '@/workbench/habitWidgetDetailDialog';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const habitConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchHabitWeekWidgetConfig;
});

const {
  selectedDate,
  currentDate,
  habits,
  habitStatsMap,
  habitDayStateMap,
  habitPeriodStateMap,
  checkInHabit,
  incrementHabit,
} = useHabitWorkspace({
  groupId: () => habitConfig.value.groupId,
  defaultListMode: () => habitConfig.value.habitScope ?? 'active',
});

let detailDialog: Dialog | null = null;

function handleOpenDetail(habit: Habit) {
  detailDialog?.destroy();
  detailDialog = openHabitWidgetDetailDialog({
    habitId: habit.blockId,
    habitName: habit.name,
    groupId: habitConfig.value.groupId,
  });
}

onBeforeUnmount(() => {
  detailDialog?.destroy();
  detailDialog = null;
});
</script>

<style lang="scss" scoped>
.workbench-widget-habit-week {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
