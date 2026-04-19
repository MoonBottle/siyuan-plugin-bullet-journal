<template>
  <div class="fn__flex-1 fn__flex-column habit-dock-container">
    <!-- 顶栏 -->
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>
        {{ t('habit').title }}
      </div>
      <span class="fn__flex-1 fn__space"></span>
    </div>

    <div class="fn__flex-1 fn__flex-column habit-dock-body">
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
          :stats="habitStatsMap.get(habit.blockId)"
          :selected-date="selectedDate"
          :current-date="currentDate"
          @check-in="handleCheckIn"
          @increment="handleIncrement"
        />
      </div>

      <!-- 空状态 -->
      <div class="habit-empty" v-else>
        <div class="habit-empty__icon">🎯</div>
        <div class="habit-empty__title">{{ t('habit').noHabits }}</div>
        <div class="habit-empty__desc">{{ t('habit').noHabitsDesc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { calculateAllHabitStats } from '@/utils/habitStatsUtils';
import { checkIn, checkInCount } from '@/services/habitService';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import type { Habit, HabitStats } from '@/types/models';

const store = useProjectStore();

const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const currentDate = computed(() => store.currentDate);

const habits = computed(() => store.getHabits(''));

const habitStatsMap = computed(() => {
  return calculateAllHabitStats(habits.value, currentDate.value);
});

async function handleCheckIn(habit: Habit) {
  const success = await checkIn(habit, selectedDate.value);
  if (success) {
    // 触发数据刷新
    console.log('[HabitDock] Check-in successful');
  }
}

async function handleIncrement(habit: Habit) {
  const success = await checkInCount(habit, selectedDate.value, 1);
  if (success) {
    console.log('[HabitDock] Increment successful');
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
