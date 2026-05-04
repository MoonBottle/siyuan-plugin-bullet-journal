<template>
  <div class="fn__flex-1 fn__flex-column habit-dock-container">
    <!-- 顶栏 -->
    <div class="block__icons">
      <template v-if="selectedHabit">
        <button
          class="block__icon"
          data-testid="habit-detail-back-button"
          :aria-label="t('habit').backToList"
          @click="handleBackToList"
        >
          <svg
            @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('habit').backToList)"
            @mouseleave="hideIconTooltip"
          ><use xlink:href="#iconLeft"></use></svg>
        </button>
        <div class="block__logo" data-testid="habit-detail-header">{{ selectedHabit.name }}</div>
        <span class="fn__flex-1 fn__space"></span>
        <button
          class="block__icon"
          data-testid="habit-dock-refresh-button"
          :aria-label="t('common').refresh"
          @click="refreshHabits"
        >
          <svg
            @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('common').refresh)"
            @mouseleave="hideIconTooltip"
          ><use xlink:href="#iconRefresh"></use></svg>
        </button>
        <button
          class="block__icon"
          :data-testid="selectedHabit.archivedAt ? 'habit-detail-unarchive' : 'habit-detail-archive'"
          :aria-label="selectedHabit.archivedAt ? t('habit').unarchive : t('habit').archive"
          @click="handleToggleArchiveSelectedHabit"
        >
          <svg
            @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, selectedHabit.archivedAt ? t('habit').unarchive : t('habit').archive)"
            @mouseleave="hideIconTooltip"
          ><use :xlink:href="selectedHabit.archivedAt ? '#iconRestore' : '#iconInbox'"></use></svg>
        </button>
        <button
          class="block__icon"
          data-testid="habit-detail-open-doc"
          :aria-label="t('todo').openDoc"
          @click="handleOpenSelectedHabitDoc"
        >
          <svg
            @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('todo').openDoc)"
            @mouseleave="hideIconTooltip"
          ><use xlink:href="#iconFile"></use></svg>
        </button>
      </template>
      <template v-else>
        <div class="block__logo">
          <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>
          {{ t('habit').title }}
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <button
          class="block__icon"
          data-testid="habit-dock-refresh-button"
          :aria-label="t('common').refresh"
          @click="refreshHabits"
        >
          <svg><use xlink:href="#iconRefresh"></use></svg>
        </button>
      </template>
    </div>

    <div class="fn__flex-1 fn__flex-column habit-dock-body">
      <!-- 详情视图 -->
      <template v-if="selectedHabit">
        <div class="habit-detail fn__flex-1 fn__flex-column">
          <div class="habit-detail__header"></div>
          <HabitWorkspaceDetailPane
            :selected-habit="selectedHabit"
            :stats="displaySelectedStats"
            :current-date="currentDate"
            :view-month="selectedViewMonth"
            :show-header="false"
            :show-refresh-action="false"
            :show-open-doc-action="false"
            :empty-title="t('workbench').habitDetailEmptyTitle"
            :empty-desc="t('workbench').habitDetailEmptyDesc"
            content-test-id="habit-detail-content"
            @update:view-month="selectedViewMonth = $event"
          />
        </div>
      </template>

      <!-- 列表视图 -->
      <template v-else>
        <HabitWorkspaceListPane
          :selected-date="selectedDate"
          :current-date="currentDate"
          :habits="habits"
          :habit-stats-map="habitStatsMap"
          :habit-day-state-map="habitDayStateMap"
          :habit-period-state-map="habitPeriodStateMap"
          @update:selected-date="selectedDate = $event"
          @check-in="checkInHabit"
          @increment="incrementHabit"
          @open-doc="openHabitDoc"
          @select-habit="selectHabit"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import { t } from '@/i18n';
import { getCurrentPlugin, usePlugin } from '@/main';
import { hideIconTooltip, showIconTooltip } from '@/utils/dialog';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { consumePendingHabitDockTarget, type HabitDockNavigationTarget } from '@/utils/habitDockNavigation';

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
  selectHabitById,
  clearSelectedHabit,
  checkInHabit,
  incrementHabit,
  openHabitDoc,
  openSelectedHabitDoc,
  archiveSelectedHabit,
  unarchiveSelectedHabit,
} = useHabitWorkspace();

async function handleOpenSelectedHabitDoc() {
  hideIconTooltip();
  await openSelectedHabitDoc();
}

async function handleToggleArchiveSelectedHabit() {
  hideIconTooltip();
  if (selectedHabit.value?.archivedAt) {
    await unarchiveSelectedHabit();
    return;
  }

  await archiveSelectedHabit();
}

function applyHabitDockNavigation(target: HabitDockNavigationTarget): boolean {
  return selectHabitById(target.habitId, target.date || currentDate.value);
}

function handleBackToList() {
  hideIconTooltip();
  clearSelectedHabit();
}

const handleDataRefresh = async () => {
  await refreshHabits();
};

let unsubscribeRefresh: (() => void) | null = null;
let unsubscribeHabitNavigate: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(() => {
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
  unsubscribeHabitNavigate = eventBus.on(Events.HABIT_DOCK_NAVIGATE, applyHabitDockNavigation);

  const pendingTarget = consumePendingHabitDockTarget();
  if (pendingTarget) {
    applyHabitDockNavigation(pendingTarget);
  }

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: () => handleDataRefresh(),
      viewName: 'DesktopHabitDock',
    });
  } catch {
    // ignore
  }
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (unsubscribeHabitNavigate) {
    unsubscribeHabitNavigate();
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
.habit-dock-container {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.habit-dock-body {
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.habit-detail {
  overflow: hidden;
  padding: 4px 0 0;
  min-height: 0;
  min-width: 0;
}

.habit-detail__header {
  flex: 0 0 auto;
}

.block__icons .block__icon {
  opacity: 1;
}

</style>
