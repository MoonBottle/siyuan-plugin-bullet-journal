<template>
  <div class="fn__flex-1 fn__flex-column habit-dock-container">
    <!-- 顶栏 -->
    <div class="block__icons">
      <template v-if="selectedHabit">
        <button class="block__icon" @click="selectedHabit = null" :aria-label="t('habit').backToList">
          <svg><use xlink:href="#iconLeft"></use></svg>
        </button>
        <div class="block__logo">{{ selectedHabit.name }}</div>
      </template>
      <template v-else>
        <div class="block__logo">
          <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>
          {{ t('habit').title }}
        </div>
      </template>
      <span class="fn__flex-1 fn__space"></span>
    </div>

    <div class="fn__flex-1 fn__flex-column habit-dock-body">
      <!-- 详情视图 -->
      <template v-if="selectedHabit && selectedStats && selectedDayState && selectedPeriodState">
        <div class="habit-detail fn__flex-1 fn__flex-column">
          <!-- 今日进度 -->
          <div class="habit-detail__today">
            <div class="habit-detail__today-label">{{ t('habit').todayProgress }}</div>
            <div v-if="selectedHabit.type === 'binary'" class="habit-detail__today-binary">
              <button
                :class="['habit-check-btn-lg', { 'habit-check-btn-lg--done': selectedDayState.isCompleted }]"
                @click="handleCheckIn(selectedHabit)"
              >
                {{ selectedDayState.isCompleted ? '✅ ' + t('habit').todayChecked : t('habit').checkIn }}
              </button>
            </div>
            <div v-else class="habit-detail__today-count">
              <HabitCountInput
                :current-value="selectedDayState.currentValue || 0"
                :target="selectedHabit.target"
                @change="handleCountChange"
              />
              <span class="habit-detail__target">
                {{ t('habit').target.replace('{target}', String(selectedHabit.target || 0)).replace('{unit}', selectedHabit.unit || '') }}
              </span>
            </div>
          </div>

          <!-- 统计卡片 -->
          <HabitStatsCards :stats="selectedStats" />

          <!-- 月历 -->
          <HabitMonthCalendar
            :habit="selectedHabit"
            :stats="selectedStats"
            :current-date="currentDate"
          />

          <!-- 打卡日志 -->
          <HabitRecordLog
            :habit="selectedHabit"
            @edit-record="handleEditRecord"
            @delete-record="handleDeleteRecord"
          />
        </div>
      </template>

      <!-- 列表视图 -->
      <template v-else>
        <!-- 周日期行 -->
        <HabitWeekBar
          v-model="selectedDate"
          :current-date="currentDate"
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
            @click="selectedHabit = $event"
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
import { ref, computed } from 'vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { calculateAllHabitStats } from '@/utils/habitStatsUtils';
import { checkIn, checkInCount, deleteCheckIn, setCheckInValue } from '@/services/habitService';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import HabitCountInput from '@/components/habit/HabitCountInput.vue';
import { showMessage } from '@/utils/dialog';
import type { CheckInRecord, Habit } from '@/types/models';

const plugin = usePlugin();
const store = useProjectStore();
const settingsStore = useSettingsStore();

const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const selectedHabit = ref<Habit | null>(null);
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

const selectedDayState = computed(() => {
  if (!selectedHabit.value) return null;
  return getHabitDayState(selectedHabit.value, selectedDate.value);
});

const selectedPeriodState = computed(() => {
  if (!selectedHabit.value) return null;
  return getHabitPeriodState(selectedHabit.value, selectedDate.value);
});

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
  if (success) {
    await refreshHabits();
  }
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, selectedDate.value, 1);
  if (success) {
    await refreshHabits();
  }
}

async function handleCountChange(newValue: number) {
  if (!selectedHabit.value || selectedHabit.value.type !== 'count') return;
  const success = await setCheckInValue(selectedHabit.value, selectedDate.value, newValue);
  if (success) {
    await refreshHabits();
  }
}

async function handleDeleteRecord(record: CheckInRecord) {
  const success = await deleteCheckIn(record);
  if (success) {
    await refreshHabits();
  }
}

async function handleEditRecord(record: CheckInRecord) {
  if (!selectedHabit.value) return;

  if (selectedHabit.value.type !== 'count') {
    showMessage('当前仅支持编辑计数型打卡', 'info');
    return;
  }

  const currentValue = record.currentValue ?? 0;
  const input = window.prompt('请输入新的打卡值', String(currentValue));
  if (input === null) return;

  const nextValue = Number(input);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    showMessage('请输入有效的非负数字', 'error');
    return;
  }

  const success = await setCheckInValue(selectedHabit.value, record.date, nextValue);
  if (success) {
    await refreshHabits();
  }
}
</script>

<style scoped>
.habit-dock-container {
  height: 100%;
}

.habit-dock-body {
  padding: 0 8px;
  overflow: hidden;
}

.habit-list {
  overflow-y: auto;
  padding: 4px 0;
}

.habit-detail {
  overflow-y: auto;
  padding: 4px 0;
}

.habit-detail__today {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  margin-bottom: 4px;
}

.habit-detail__today-label {
  font-size: 14px;
  font-weight: 500;
}

.habit-detail__today-binary {
  display: flex;
  align-items: center;
}

.habit-check-btn-lg {
  padding: 6px 16px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 14px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.habit-check-btn-lg:hover {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.habit-check-btn-lg--done {
  border-color: transparent;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  cursor: default;
}

.habit-detail__today-count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.habit-detail__target {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
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
