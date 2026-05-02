<template>
  <div class="habit-widget-detail-dialog">
    <HabitWorkspaceDetailPane
      :selected-habit="selectedHabit"
      :stats="displaySelectedStats"
      :current-date="currentDate"
      :view-month="selectedViewMonth"
      :empty-title="t('workbench').habitDetailEmptyTitle"
      :empty-desc="t('workbench').habitDetailEmptyDesc"
      header-test-id="habit-widget-detail-header"
      content-test-id="habit-widget-detail-content"
      empty-test-id="habit-widget-empty-detail"
      refresh-button-test-id="habit-widget-refresh-button"
      open-doc-button-test-id="habit-widget-open-doc"
      @refresh="refreshHabits"
      @open-doc="openSelectedHabitDoc"
      @update:view-month="selectedViewMonth = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import { t } from '@/i18n';

const props = defineProps<{
  habitId: string;
  groupId?: string;
}>();

const {
  selectedHabit,
  selectedViewMonth,
  currentDate,
  displaySelectedStats,
  refreshHabits,
  selectHabitById,
  openSelectedHabitDoc,
} = useHabitWorkspace({
  groupId: () => props.groupId,
});

onMounted(() => {
  selectHabitById(props.habitId);
});
</script>

<style scoped>
.habit-widget-detail-dialog {
  width: 100%;
  height: min(72vh, 760px);
  min-height: 420px;
}
</style>
