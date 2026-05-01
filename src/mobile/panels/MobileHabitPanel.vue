<template>
  <section class="mobile-habit-panel" data-testid="habit-panel">
    <div class="mobile-habit-panel__header">
      <span class="mobile-habit-panel__title">{{ t('habit').title }}</span>
    </div>

    <div
      class="mobile-habit-panel__week-bar-wrap"
      data-testid="habit-week-bar-wrap"
    >
      <HabitWeekBar
        v-model="state.selectedDate"
        :current-date="currentDate"
        :habits="habits"
      />
    </div>

    <div v-if="habits.length > 0" class="mobile-habit-panel__list">
      <HabitListItem
        v-for="habit in habits"
        :key="habit.blockId"
        :habit="habit"
        :day-state="habitDayStateMap.get(habit.blockId)!"
        :period-state="habitPeriodStateMap.get(habit.blockId)!"
        :stats="habitStatsMap.get(habit.blockId)"
        :is-mobile="true"
        @check-in="handleCheckIn"
        @increment="handleIncrement"
        @open-detail="openHabitDetail"
      />
    </div>

    <div v-else class="mobile-habit-panel__empty">
      <div class="mobile-habit-panel__empty-icon">🎯</div>
      <div class="mobile-habit-panel__empty-title">{{ t('habit').noHabits }}</div>
      <div class="mobile-habit-panel__empty-desc">{{ t('habit').noHabitsDesc }}</div>
    </div>

    <MobileHabitDetailSheet
      :open="state.showHabitDetail && !!state.selectedHabit"
      :habit="state.selectedHabit"
      :selected-date="state.selectedDate"
      :view-month="state.selectedViewMonth"
      :stats="selectedStats"
      @close="handleCloseHabitDetail"
      @update:view-month="state.selectedViewMonth = $event"
    >
      <div v-if="state.selectedHabit && selectedStats && selectedDayState" class="mobile-habit-detail__body">
        <div class="mobile-habit-detail__today">
          <div class="mobile-habit-detail__today-label">{{ t('habit').todayProgress }}</div>
          <div v-if="state.selectedHabit.type === 'binary'" class="mobile-habit-detail__today-binary">
            <button
              :class="['mobile-check-btn', { 'mobile-check-btn--done': selectedDayState.isCompleted }]"
              :disabled="selectedDayState.isCompleted"
              @click="handleCheckIn(state.selectedHabit)"
            >
              {{ selectedDayState.isCompleted ? '✅ ' + t('habit').todayChecked : t('habit').checkIn }}
            </button>
          </div>
          <div v-else class="mobile-habit-detail__today-count">
            <HabitCountInput
              :current-value="selectedDayState.currentValue || 0"
              :target="state.selectedHabit.target"
              @change="handleCountChange"
            />
            <span class="mobile-habit-detail__target">
              {{ t('habit').target.replace('{target}', String(state.selectedHabit.target || 0)).replace('{unit}', state.selectedHabit.unit || '') }}
            </span>
          </div>
        </div>

        <HabitStatsCards :stats="selectedStats" />

        <HabitMonthCalendar
          :habit="state.selectedHabit"
          :stats="selectedStats"
          :current-date="currentDate"
          :view-month="state.selectedViewMonth"
          @update:view-month="state.selectedViewMonth = $event"
        />

        <HabitRecordLog
          :habit="state.selectedHabit"
          :view-month="state.selectedViewMonth"
        />
      </div>
    </MobileHabitDetailSheet>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import HabitCountInput from '@/components/habit/HabitCountInput.vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import MobileHabitDetailSheet from '@/mobile/components/habit/MobileHabitDetailSheet.vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import {
  checkIn,
  checkInCount,
  setCheckInValue,
} from '@/services/habitService';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { Habit } from '@/types/models';
import {
  eventBus,
  Events,
  DATA_REFRESH_CHANNEL,
} from '@/utils/eventBus';
import { calculateAllHabitStats } from '@/utils/habitStatsUtils';
import {
  consumePendingHabitDockTarget,
  type HabitDockNavigationTarget,
} from '@/utils/habitDockNavigation';
import dayjs from '@/utils/dayjs';

const plugin = usePlugin();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const initialDate = projectStore.currentDate || dayjs().format('YYYY-MM-DD');

const state = reactive({
  selectedDate: initialDate,
  selectedViewMonth: initialDate.substring(0, 7),
  showHabitDetail: false,
  selectedHabit: null as Habit | null,
});

const currentDate = computed(() => projectStore.currentDate);
const habits = computed(() => projectStore.getHabits(''));

const habitStatsMap = computed(() => {
  return calculateAllHabitStats(habits.value, currentDate.value);
});

const habitDayStateMap = computed(() => {
  return new Map(habits.value.map(habit => [habit.blockId, getHabitDayState(habit, state.selectedDate)]));
});

const habitPeriodStateMap = computed(() => {
  return new Map(habits.value.map(habit => [habit.blockId, getHabitPeriodState(habit, state.selectedDate)]));
});

const selectedStats = computed(() => {
  if (!state.selectedHabit)
    return null;

  return habitStatsMap.value.get(state.selectedHabit.blockId);
});

const selectedDayState = computed(() => {
  if (!state.selectedHabit)
    return null;

  return getHabitDayState(state.selectedHabit, state.selectedDate);
});

watch(currentDate, (nextDate, previousDate) => {
  if (!nextDate) {
    return;
  }

  if (!state.selectedDate || state.selectedDate === previousDate) {
    state.selectedDate = nextDate;
  }

  const previousMonth = previousDate?.substring(0, 7);
  if (!state.selectedViewMonth || state.selectedViewMonth === previousMonth) {
    state.selectedViewMonth = state.selectedDate.substring(0, 7);
  }
});

function openHabitDetail(habit: Habit) {
  state.selectedViewMonth = state.selectedDate.substring(0, 7);
  state.selectedHabit = habit;
  state.showHabitDetail = true;
}

function applyHabitDockNavigation(target: HabitDockNavigationTarget): boolean {
  const habit = habits.value.find(item => item.blockId === target.habitId);
  if (!habit) {
    return false;
  }

  const targetDate = target.date || currentDate.value;
  state.selectedDate = targetDate;
  state.selectedViewMonth = targetDate.substring(0, 7);
  state.selectedHabit = habit;
  state.showHabitDetail = true;
  return true;
}

function syncSelectedHabit() {
  if (!state.selectedHabit)
    return;

  state.selectedHabit = habits.value.find(habit => habit.blockId === state.selectedHabit?.blockId) ?? null;
}

function handleCloseHabitDetail() {
  state.showHabitDetail = false;
}

async function refreshHabits() {
  if (!plugin)
    return;

  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  syncSelectedHabit();
}

async function handleCheckIn(habit: Habit) {
  const dayState = getHabitDayState(habit, state.selectedDate);
  if (dayState.isCompleted) {
    return;
  }

  const success = await checkIn(habit, state.selectedDate);
  if (success) {
    await refreshHabits();
  }
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, state.selectedDate, 1);
  if (success) {
    await refreshHabits();
  }
}

async function handleCountChange(newValue: number) {
  if (!state.selectedHabit || state.selectedHabit.type !== 'count')
    return;

  const success = await setCheckInValue(state.selectedHabit, state.selectedDate, newValue);
  if (success) {
    await refreshHabits();
  }
}

const handleDataRefresh = async () => {
  await refreshHabits();
};

let unsubscribeRefresh: (() => void) | null = null;
let unsubscribeHabitNavigate: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

onMounted(() => {
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
  unsubscribeHabitNavigate = eventBus.on(Events.HABIT_DOCK_NAVIGATE, applyHabitDockNavigation);

  const pendingTarget = consumePendingHabitDockTarget();
  if (pendingTarget) {
    applyHabitDockNavigation(pendingTarget);
  }

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = () => handleDataRefresh();
  } catch {
    // ignore
  }
});

onUnmounted(() => {
  if (unsubscribeRefresh)
    unsubscribeRefresh();

  if (unsubscribeHabitNavigate)
    unsubscribeHabitNavigate();

  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});
</script>

<style lang="scss" scoped>
.mobile-habit-panel {
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  background: var(--b3-theme-surface);
  overflow: hidden;
}

.mobile-habit-panel__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.mobile-habit-panel__title {
  font-size: 18px;
  font-weight: 600;
}

.mobile-habit-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 8px;
  -webkit-overflow-scrolling: touch;
}

.mobile-habit-panel__week-bar-wrap {
  padding: 8px 16px 4px;
}

.mobile-habit-panel__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface-light);
}

.mobile-habit-panel__empty-icon {
  margin-bottom: 12px;
  font-size: 48px;
}

.mobile-habit-panel__empty-title {
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 500;
}

.mobile-habit-panel__empty-desc {
  font-size: 12px;
  opacity: 0.6;
}

.mobile-habit-detail__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-habit-detail__today {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
}

.mobile-habit-detail__today-label {
  font-size: 15px;
  font-weight: 500;
}

.mobile-check-btn {
  padding: 8px 20px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 16px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 14px;
  cursor: pointer;
}

.mobile-check-btn--done {
  border-color: transparent;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.mobile-habit-detail__today-count {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.mobile-habit-detail__target {
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}
</style>
