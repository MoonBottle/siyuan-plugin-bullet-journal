<template>
  <div class="fn__flex-1 fn__flex-column habit-dock-container">
    <!-- 顶栏 -->
    <div class="block__icons">
      <template v-if="selectedHabit">
        <button class="block__icon" @click="handleBackToList" :aria-label="t('habit').backToList">
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
          <svg><use xlink:href="#iconRefresh"></use></svg>
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
      <template v-if="selectedHabit && displaySelectedStats">
        <div class="habit-detail fn__flex-1 fn__flex-column">
          <div class="habit-detail__header">
          </div>

          <div class="habit-detail__content" data-testid="habit-detail-content">
            <!-- 月历 -->
            <HabitMonthCalendar
              :habit="selectedHabit"
              :stats="displaySelectedStats"
              :current-date="currentDate"
              :view-month="selectedViewMonth"
              @update:view-month="selectedViewMonth = $event"
            />

            <!-- 统计卡片 -->
            <HabitStatsCards :stats="displaySelectedStats" />

            <!-- 打卡日志 -->
            <HabitRecordLog
              :habit="selectedHabit"
              :view-month="selectedViewMonth"
            />
          </div>
        </div>
      </template>

      <!-- 列表视图 -->
      <template v-else>
        <!-- 周日期行 -->
        <HabitWeekBar
          v-model="selectedDate"
          :current-date="currentDate"
          :habits="habits"
        />

        <!-- 习惯列表 -->
        <div class="habit-list fn__flex-1" v-if="habits.length > 0">
          <HabitListItem
            v-for="habit in habits"
            :key="habit.blockId"
            :habit="habit"
            :day-state="habitDayStateMap.get(habit.blockId)!"
            :period-state="habitPeriodStateMap.get(habit.blockId)!"
            :stats="habitStatsMap.get(habit.blockId)"
            @check-in="handleCheckIn"
            @increment="handleIncrement"
            @open-doc="handleOpenHabitDoc"
            @open-calendar="handleOpenHabitDetail"
          />
        </div>

        <!-- 空状态 -->
        <div class="habit-empty" v-else>
          <div class="habit-empty__icon">🎯</div>
          <div class="habit-empty__title">{{ t('habit').noHabits }}</div>
          <div class="habit-empty__desc">{{ t('habit').noHabitsDesc }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { calculateAllHabitStats } from '@/utils/habitStatsUtils';
import {
  checkIn,
  checkInCount,
} from '@/services/habitService';
import { t } from '@/i18n';
import { getCurrentPlugin, usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import { hideIconTooltip, showIconTooltip } from '@/utils/dialog';
import type { Habit, HabitStats } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { buildViewDebugContext } from '@/utils/viewDebug';
import { consumePendingHabitDockTarget, type HabitDockNavigationTarget } from '@/utils/habitDockNavigation';

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
  return habitStatsMap.value.get(selectedHabit.value.blockId);
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

async function handleCheckIn(habit: Habit) {
  const success = await checkIn(habit, selectedDate.value);
  if (success)
    selectedStatsCache.value = habitStatsMap.value.get(habit.blockId) ?? selectedStatsCache.value;
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, selectedDate.value, 1);
  if (success)
    selectedStatsCache.value = habitStatsMap.value.get(habit.blockId) ?? selectedStatsCache.value;
}

async function handleOpenHabitDoc(habit: Habit) {
  if (!habit.docId) {
    return;
  }

  await openDocumentAtLine(habit.docId, undefined, habit.blockId);
}

async function handleOpenSelectedHabitDoc() {
  hideIconTooltip();
  if (!selectedHabit.value?.docId) {
    return;
  }

  await openDocumentAtLine(selectedHabit.value.docId, undefined, selectedHabit.value.blockId);
}

function handleOpenHabitDetail(habit: Habit) {
  selectedViewMonth.value = currentDate.value.substring(0, 7);
  selectedHabit.value = habit;
  selectedStatsCache.value = habitStatsMap.value.get(habit.blockId) ?? selectedStatsCache.value;
}

function applyHabitDockNavigation(target: HabitDockNavigationTarget): boolean {
  const habit = habits.value.find(item => item.blockId === target.habitId);
  if (!habit) {
    return false;
  }
  const targetDate = target.date || currentDate.value;
  selectedDate.value = targetDate;
  selectedViewMonth.value = targetDate.substring(0, 7);
  selectedHabit.value = habit;
  selectedStatsCache.value = habitStatsMap.value.get(habit.blockId) ?? selectedStatsCache.value;
  return true;
}

function handleBackToList() {
  hideIconTooltip();
  selectedHabit.value = null;
}

const handleDataRefresh = async () => {
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', buildViewDebugContext('DesktopHabitDock', plugin));
  await refreshHabits();
};

let unsubscribeRefresh: (() => void) | null = null;
let unsubscribeHabitNavigate: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('DesktopHabitDock', plugin));
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
      onRefresh: () => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('DesktopHabitDock', plugin),
          data: { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh();
      },
      viewName: 'DesktopHabitDock',
    });
  } catch {
    // ignore
  }
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('DesktopHabitDock', plugin));
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
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.habit-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
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
  padding-bottom: 0;
}

.habit-detail__content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block__icons .block__icon {
  opacity: 1;
}

.habit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--b3-theme-on-surface-light);
}

.habit-empty__icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.habit-empty__title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.habit-empty__desc {
  font-size: 12px;
  opacity: 0.6;
}
</style>
