<template>
  <div class="workbench-habit-view" data-testid="workbench-habit-view">
    <aside class="workbench-habit-view__sidebar">
      <HabitWorkspaceListPane
        :selected-date="selectedDate"
        :current-date="currentDate"
        :habits="habits"
        :habit-stats-map="habitStatsMap"
        :habit-day-state-map="habitDayStateMap"
        :habit-period-state-map="habitPeriodStateMap"
        :active-habit-id="selectedHabit?.blockId"
        item-open-behavior="detail"
        item-test-id-prefix="workbench-habit-item-"
        @update:selected-date="selectedDate = $event"
        @check-in="checkInHabit"
        @increment="incrementHabit"
        @select-habit="selectHabit"
      />
    </aside>

    <section class="workbench-habit-view__detail">
      <HabitWorkspaceDetailPane
        class="workbench-habit-view__detail-pane"
        :selected-habit="selectedHabit"
        :stats="displaySelectedStats"
        :current-date="currentDate"
        :view-month="selectedViewMonth"
        :empty-title="t('workbench').habitDetailEmptyTitle"
        :empty-desc="t('workbench').habitDetailEmptyDesc"
        header-test-id="workbench-habit-detail-header"
        content-test-id="workbench-habit-detail-content"
        empty-test-id="workbench-habit-empty-detail"
        refresh-button-test-id="workbench-habit-refresh-button"
        open-doc-button-test-id="workbench-habit-open-doc"
        @refresh="refreshHabits"
        @open-doc="openSelectedHabitDoc"
        @update:view-month="selectedViewMonth = $event"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';

const plugin = usePlugin();
const {
  selectedDate,
  selectedViewMonth,
  selectedHabit,
  currentDate,
  habits,
  habitStatsMap,
  habitDayStateMap,
  habitPeriodStateMap,
  displaySelectedStats,
  refreshHabits,
  selectHabit,
  checkInHabit,
  incrementHabit,
  openSelectedHabitDoc,
} = useHabitWorkspace();

const handleDataRefresh = async () => {
  await refreshHabits();
};

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(() => {
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin: () => plugin,
      onRefresh: () => handleDataRefresh(),
      viewName: 'WorkbenchHabitView',
    });
  }
  catch {
    // ignore
  }
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannelGuard) {
    refreshChannelGuard.dispose();
    refreshChannelGuard = null;
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});
</script>

<style scoped>
.workbench-habit-view {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
}

.workbench-habit-view__sidebar,
.workbench-habit-view__detail {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  overflow: hidden;
}

.workbench-habit-view__sidebar {
  padding: 12px;
  gap: 8px;
}

.workbench-habit-view__detail-pane {
  min-height: 0;
}
</style>
