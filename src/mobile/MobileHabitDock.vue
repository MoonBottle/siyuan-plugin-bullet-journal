<template>
  <div class="mobile-habit-dock">
    <!-- 习惯视图 -->
    <template v-if="!state.showHabitDetail">
      <!-- 顶栏 -->
      <div class="mobile-habit-header">
        <span class="mobile-habit-header__title">{{ t('habit').title }}</span>
      </div>

      <!-- 周日期行 -->
      <HabitWeekBar
        v-model="state.selectedDate"
        :current-date="currentDate"
      />

      <!-- 习惯列表 -->
      <div class="mobile-habit-list" v-if="habits.length > 0">
        <HabitListItem
          v-for="habit in habits"
          :key="habit.blockId"
          :habit="habit"
          :stats="habitStatsMap.get(habit.blockId)"
          :selected-date="state.selectedDate"
          :current-date="currentDate"
          @check-in="handleCheckIn"
          @increment="handleIncrement"
          @click="openHabitDetail"
        />
      </div>

      <!-- 空状态 -->
      <div class="mobile-habit-empty" v-else>
        <div class="mobile-habit-empty__icon">🎯</div>
        <div class="mobile-habit-empty__title">{{ t('habit').noHabits }}</div>
        <div class="mobile-habit-empty__desc">{{ t('habit').noHabitsDesc }}</div>
      </div>
    </template>

    <!-- 习惯详情 -->
    <template v-else>
      <div class="mobile-habit-detail">
        <!-- 详情顶栏 -->
        <div class="mobile-habit-detail__header">
          <button class="mobile-habit-detail__back" @click="state.showHabitDetail = false">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="mobile-habit-detail__title">{{ state.selectedHabit?.name }}</span>
        </div>

        <!-- 详情内容 -->
        <div class="mobile-habit-detail__body" v-if="state.selectedHabit && selectedStats">
          <!-- 今日进度 -->
          <div class="mobile-habit-detail__today">
            <div class="mobile-habit-detail__today-label">{{ t('habit').todayProgress }}</div>
            <div v-if="state.selectedHabit.type === 'binary'" class="mobile-habit-detail__today-binary">
              <button
                :class="['mobile-check-btn', { 'mobile-check-btn--done': selectedStats.isPeriodCompleted }]"
                @click="handleCheckIn(state.selectedHabit!)"
              >
                {{ selectedStats.isPeriodCompleted ? '✅ ' + t('habit').todayChecked : t('habit').checkIn }}
              </button>
            </div>
            <div v-else class="mobile-habit-detail__today-count">
              <HabitCountInput
                :current-value="todayCurrentValue"
                :target="state.selectedHabit.target"
                @change="handleCountChange"
              />
              <span class="mobile-habit-detail__target">
                {{ t('habit').target.replace('{target}', String(state.selectedHabit.target || 0)).replace('{unit}', state.selectedHabit.unit || '') }}
              </span>
            </div>
          </div>

          <!-- 统计卡片 -->
          <HabitStatsCards :stats="selectedStats" />

          <!-- 月历 -->
          <HabitMonthCalendar
            :habit="state.selectedHabit"
            :stats="selectedStats"
            :current-date="currentDate"
          />

          <!-- 打卡日志 -->
          <HabitRecordLog :habit="state.selectedHabit" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted, onUnmounted } from 'vue';
import { useProjectStore, useSettingsStore } from '@/stores';
import { calculateAllHabitStats } from '@/utils/habitStatsUtils';
import { checkIn, checkInCount } from '@/services/habitService';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import dayjs from '@/utils/dayjs';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import HabitCountInput from '@/components/habit/HabitCountInput.vue';
import type { Habit, HabitStats } from '@/types/models';

const plugin = usePlugin();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const state = reactive({
  selectedDate: dayjs().format('YYYY-MM-DD'),
  showHabitDetail: false,
  selectedHabit: null as Habit | null,
});

const currentDate = computed(() => projectStore.currentDate);

const habits = computed(() => projectStore.getHabits(''));

const habitStatsMap = computed(() => {
  return calculateAllHabitStats(habits.value, currentDate.value);
});

const selectedStats = computed(() => {
  if (!state.selectedHabit) return null;
  return habitStatsMap.value.get(state.selectedHabit.blockId);
});

const todayCurrentValue = computed(() => {
  if (!state.selectedHabit || state.selectedHabit.type !== 'count') return 0;
  const todayRecord = state.selectedHabit.records.find(r => r.date === state.selectedDate);
  return todayRecord?.currentValue ?? 0;
});

function openHabitDetail(habit: Habit) {
  state.selectedHabit = habit;
  state.showHabitDetail = true;
}

async function handleCheckIn(habit: Habit) {
  const success = await checkIn(habit, state.selectedDate);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  }
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, state.selectedDate, 1);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  }
}

async function handleCountChange(newValue: number) {
  if (!state.selectedHabit) return;
  const success = await checkInCount(state.selectedHabit, state.selectedDate, newValue);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  }
}

// 数据刷新（打卡后触发）
const handleDataRefresh = async () => {
  if (!plugin) return;
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

onMounted(async () => {
  // 不需要重复加载，projectStore 已在 MobileTodoDock 中初始化
  // 只监听数据刷新事件
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = () => handleDataRefresh();
  } catch { /* ignore */ }
});

onUnmounted(() => {
  if (unsubscribeRefresh) unsubscribeRefresh();
  if (refreshChannel) { refreshChannel.close(); refreshChannel = null; }
});
</script>

<style lang="scss" scoped>
.mobile-habit-dock {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  background: var(--b3-theme-surface);
  overflow: hidden;
}

.mobile-habit-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.mobile-habit-header__title {
  font-size: 18px;
  font-weight: 600;
}

.mobile-habit-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  -webkit-overflow-scrolling: touch;
}

.mobile-habit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--b3-theme-on-surface-light);
}

.mobile-habit-empty__icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.mobile-habit-empty__title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.mobile-habit-empty__desc {
  font-size: 12px;
  opacity: 0.6;
}

.mobile-habit-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.mobile-habit-detail__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.mobile-habit-detail__back {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
}

.mobile-habit-detail__title {
  font-size: 16px;
  font-weight: 600;
}

.mobile-habit-detail__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  -webkit-overflow-scrolling: touch;
}

.mobile-habit-detail__today {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  margin-bottom: 8px;
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
  align-items: center;
  gap: 12px;
}

.mobile-habit-detail__target {
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}
</style>
