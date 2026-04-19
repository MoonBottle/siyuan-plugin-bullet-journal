<template>
  <div class="habit-month-calendar">
    <div class="habit-month-calendar__header">
      <button class="habit-month-calendar__nav" @click="prevMonth">‹</button>
      <span class="habit-month-calendar__title">{{ title }}</span>
      <button class="habit-month-calendar__nav" @click="nextMonth">›</button>
    </div>
    <div class="habit-month-calendar__weekdays">
      <span v-for="d in weekDayLabels" :key="d" class="habit-month-calendar__weekday">{{ d }}</span>
    </div>
    <div class="habit-month-calendar__days">
      <div
        v-for="(cell, i) in calendarCells"
        :key="i"
        :class="['habit-month-calendar__cell', {
          'habit-month-calendar__cell--empty': !cell.date,
          'habit-month-calendar__cell--today': cell.date === currentDate,
          'habit-month-calendar__cell--completed': cell.status === 'completed',
          'habit-month-calendar__cell--partial': cell.status === 'partial',
        }]"
      >
        <span v-if="cell.date" class="habit-month-calendar__day-num">{{ cell.dayNum }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import type { Habit, HabitStats } from '@/types/models';
import { isRecordCompleted } from '@/utils/habitStatsUtils';

const props = defineProps<{
  habit: Habit;
  stats?: HabitStats;
  currentDate: string;
}>();

const viewMonth = ref(props.currentDate.substring(0, 7));

const weekDayLabels = computed(() => t('calendar').weekDays);

const title = computed(() => {
  const d = dayjs(viewMonth.value + '-01');
  return d.format('YYYY年M月');
});

function prevMonth() {
  const d = dayjs(viewMonth.value + '-01').subtract(1, 'month');
  viewMonth.value = d.format('YYYY-MM');
}

function nextMonth() {
  const d = dayjs(viewMonth.value + '-01').add(1, 'month');
  viewMonth.value = d.format('YYYY-MM');
}

type CellStatus = 'completed' | 'partial' | 'none' | null;

const calendarCells = computed(() => {
  const firstDay = dayjs(viewMonth.value + '-01');
  // 周一开始: 1=Mon..7=Sun
  let startDow = firstDay.day(); // 0=Sun
  if (startDow === 0) startDow = 7;
  const offset = startDow - 1; // 偏移量（周一开始）

  const daysInMonth = firstDay.daysInMonth();
  const cells: { date: string; dayNum: number; status: CellStatus }[] = [];

  // 前面的空白
  for (let i = 0; i < offset; i++) {
    cells.push({ date: '', dayNum: 0, status: null });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = viewMonth.value + '-' + String(d).padStart(2, '0');
    const records = props.habit.records.filter(r => r.date === date);
    let status: CellStatus = 'none';

    if (records.length > 0) {
      if (props.habit.type === 'binary') {
        status = 'completed';
      } else {
        // 计数型：检查是否达标
        const anyCompleted = records.some(r => isRecordCompleted(r, props.habit));
        status = anyCompleted ? 'completed' : 'partial';
      }
    }

    cells.push({ date, dayNum: d, status });
  }

  return cells;
});
</script>

<style scoped>
.habit-month-calendar {
  padding: 8px 0;
}

.habit-month-calendar__header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.habit-month-calendar__nav {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.habit-month-calendar__nav:hover {
  background: var(--b3-theme-surface-light);
}

.habit-month-calendar__title {
  font-size: 14px;
  font-weight: 500;
}

.habit-month-calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
}

.habit-month-calendar__weekday {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  padding: 2px 0;
}

.habit-month-calendar__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.habit-month-calendar__cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
}

.habit-month-calendar__cell--empty {
  background: transparent;
}

.habit-month-calendar__cell--today {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: -2px;
}

.habit-month-calendar__cell--completed {
  background: var(--b3-theme-primary-light);
}

.habit-month-calendar__cell--partial {
  background: var(--b3-theme-primary-lightest);
}

.habit-month-calendar__day-num {
  color: var(--b3-theme-on-surface);
}
</style>
