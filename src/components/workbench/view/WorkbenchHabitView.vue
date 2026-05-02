<template>
  <div class="workbench-habit-view" data-testid="workbench-habit-view">
    <aside class="workbench-habit-view__sidebar">
      <HabitWeekBar
        v-model="selectedDate"
        :current-date="currentDate"
        :habits="habits"
      />

      <div v-if="habits.length > 0" class="workbench-habit-view__list">
        <div
          v-for="habit in habits"
          :key="habit.blockId"
          :class="['workbench-habit-view__list-item', {
            'workbench-habit-view__list-item--active': selectedHabit?.blockId === habit.blockId,
          }]"
          :data-testid="`workbench-habit-item-${habit.blockId}`"
        >
          <HabitListItem
            :habit="habit"
            :day-state="habitDayStateMap.get(habit.blockId)!"
            :period-state="habitPeriodStateMap.get(habit.blockId)!"
            :stats="habitStatsMap.get(habit.blockId)"
            :is-mobile="true"
            @check-in="handleCheckIn"
            @increment="handleIncrement"
            @open-detail="handleSelectHabit"
          />
        </div>
      </div>

      <div v-else class="workbench-habit-view__empty-list">
        <div class="workbench-habit-view__empty-icon">🎯</div>
        <div class="workbench-habit-view__empty-title">{{ t('habit').noHabits }}</div>
        <div class="workbench-habit-view__empty-desc">{{ t('habit').noHabitsDesc }}</div>
      </div>
    </aside>

    <section class="workbench-habit-view__detail">
      <template v-if="selectedHabit && displaySelectedStats">
        <div class="workbench-habit-view__detail-header">
          <div class="workbench-habit-view__detail-title" data-testid="workbench-habit-detail-header">
            {{ selectedHabit.name }}
          </div>
          <div class="workbench-habit-view__detail-actions">
            <button
              class="block__icon"
              data-testid="workbench-habit-refresh-button"
              :aria-label="t('common').refresh"
              @click="refreshHabits"
            >
              <svg><use xlink:href="#iconRefresh"></use></svg>
            </button>
            <button
              class="block__icon"
              data-testid="workbench-habit-open-doc"
              :aria-label="t('todo').openDoc"
              @click="handleOpenSelectedHabitDoc"
            >
              <svg><use xlink:href="#iconFile"></use></svg>
            </button>
          </div>
        </div>

        <div class="workbench-habit-view__detail-content" data-testid="workbench-habit-detail-content">
          <HabitMonthCalendar
            :habit="selectedHabit"
            :stats="displaySelectedStats"
            :current-date="currentDate"
            :view-month="selectedViewMonth"
            @update:view-month="selectedViewMonth = $event"
          />

          <HabitStatsCards :stats="displaySelectedStats" />

          <HabitRecordLog
            :habit="selectedHabit"
            :view-month="selectedViewMonth"
          />
        </div>
      </template>

      <div v-else class="workbench-habit-view__empty-detail" data-testid="workbench-habit-empty-detail">
        <div class="workbench-habit-view__empty-detail-title">{{ t('workbench').habitDetailEmptyTitle }}</div>
        <div class="workbench-habit-view__empty-detail-desc">{{ t('workbench').habitDetailEmptyDesc }}</div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import {
  checkIn,
  checkInCount,
} from '@/services/habitService';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit, HabitStats } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';
import dayjs from '@/utils/dayjs';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { calculateAllHabitStats, calculateHabitStats } from '@/utils/habitStatsUtils';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';

const plugin = usePlugin();
const store = useProjectStore();
const settingsStore = useSettingsStore();

const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const selectedViewMonth = ref(dayjs().format('YYYY-MM'));
const selectedHabit = ref<Habit | null>(null);
const selectedStatsCache = ref<HabitStats | null>(null);
const currentDate = computed(() => store.currentDate);

const habits = computed(() => store.getHabits(''));

const habitStatsMap = computed(() => {
  return calculateAllHabitStats(habits.value, currentDate.value);
});

const habitDayStateMap = computed(() => {
  return new Map(habits.value.map(habit => [habit.blockId, getHabitDayState(habit, selectedDate.value)]));
});

const habitPeriodStateMap = computed(() => {
  return new Map(habits.value.map(habit => [habit.blockId, getHabitPeriodState(habit, selectedDate.value)]));
});

const selectedStats = computed(() => {
  if (!selectedHabit.value) return null;
  return calculateHabitStats(selectedHabit.value, currentDate.value, selectedViewMonth.value);
});

const displaySelectedStats = computed(() => selectedStats.value ?? selectedStatsCache.value);

watch(selectedStats, (value) => {
  if (value) {
    selectedStatsCache.value = value;
  }
}, { immediate: true });

function syncSelectedHabit() {
  if (!selectedHabit.value) return;
  selectedHabit.value = habits.value.find(habit => habit.blockId === selectedHabit.value?.blockId) ?? null;
}

async function refreshHabits() {
  if (!plugin) return;
  await store.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  syncSelectedHabit();
}

function handleSelectHabit(habit: Habit) {
  selectedViewMonth.value = currentDate.value.substring(0, 7);
  selectedHabit.value = habit;
  selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
}

async function handleCheckIn(habit: Habit) {
  const success = await checkIn(habit, selectedDate.value);
  if (success) {
    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }
  }
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, selectedDate.value, 1);
  if (success) {
    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }
  }
}

async function handleOpenSelectedHabitDoc() {
  if (!selectedHabit.value?.docId) {
    return;
  }

  await openDocumentAtLine(selectedHabit.value.docId, undefined, selectedHabit.value.blockId);
}

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

.workbench-habit-view__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.workbench-habit-view__list-item {
  border-radius: 10px;
}

.workbench-habit-view__list-item--active :deep(.habit-list-item) {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 1px rgba(128, 162, 255, 0.18);
  background: var(--b3-theme-primary-lightest);
}

.workbench-habit-view__empty-list,
.workbench-habit-view__empty-detail {
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

.workbench-habit-view__empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.workbench-habit-view__empty-title,
.workbench-habit-view__empty-detail-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
}

.workbench-habit-view__empty-desc,
.workbench-habit-view__empty-detail-desc {
  font-size: 12px;
}

.workbench-habit-view__detail-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.workbench-habit-view__detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.workbench-habit-view__detail-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.workbench-habit-view__detail-actions .block__icon {
  opacity: 1;
}

.workbench-habit-view__detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
