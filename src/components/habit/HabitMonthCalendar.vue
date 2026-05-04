<template>
  <div class="habit-month-calendar">
    <div class="habit-month-calendar__grid">
      <div class="habit-month-calendar__header">
        <button class="habit-month-calendar__nav habit-month-calendar__nav--prev" @click="prevMonth">‹</button>
        <span class="habit-month-calendar__title">{{ title }}</span>
        <button class="habit-month-calendar__nav habit-month-calendar__nav--next" @click="nextMonth">›</button>
      </div>
      <div class="habit-month-calendar__weekdays">
        <span v-for="d in weekDayLabels" :key="d" class="habit-month-calendar__weekday">{{ d }}</span>
      </div>
      <div class="habit-month-calendar__days">
        <div
          v-for="(cell, i) in calendarCells"
          :key="i"
          :data-testid="cell.date ? `habit-month-cell-${cell.date}` : undefined"
          :class="['habit-month-calendar__cell', {
            'habit-month-calendar__cell--empty': !cell.date,
            'habit-month-calendar__cell--completed': cell.status === 'completed',
            'habit-month-calendar__cell--partial': cell.status === 'partial',
          }]"
        >
          <template v-if="cell.date">
            <span
              :class="['habit-month-calendar__day-num', {
                'habit-month-calendar__day-num--today': cell.date === currentDate,
              }]"
            >
              {{ cell.dayNum }}
            </span>
            <div class="habit-month-calendar__marker">
              <span
                v-if="cell.status === 'completed'"
                class="habit-month-calendar__check"
                data-testid="habit-month-check"
              >
                ✓
              </span>
              <svg
                v-else-if="cell.status === 'partial'"
                class="habit-month-calendar__progress-ring"
                data-testid="habit-month-progress-ring"
                :data-progress="String(cell.progress)"
                viewBox="0 0 24 24"
              >
                <circle class="habit-month-calendar__progress-track" cx="12" cy="12" r="8" />
                <circle
                  class="habit-month-calendar__progress-value"
                  cx="12"
                  cy="12"
                  r="8"
                  :stroke-dasharray="`${cell.progress * progressCircumference} ${progressCircumference}`"
                />
              </svg>
              <span v-else class="habit-month-calendar__empty-dot"></span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import type { Habit, HabitStats } from '@/types/models';
import { isRecordCompleted } from '@/utils/habitStatsUtils';

const props = defineProps<{
  habit: Habit;
  stats?: HabitStats;
  currentDate: string;
  viewMonth?: string;
}>();

const emit = defineEmits<{
  'update:viewMonth': [value: string];
}>();

const viewMonth = ref(props.viewMonth || props.currentDate.substring(0, 7));

watch(() => props.viewMonth, (value) => {
  if (value && value !== viewMonth.value) {
    viewMonth.value = value;
  }
});

const weekDayLabels = computed(() => t('calendar').weekDays);

const title = computed(() => {
  const d = dayjs(viewMonth.value + '-01');
  return d.format('YYYY年M月');
});

function prevMonth() {
  const d = dayjs(viewMonth.value + '-01').subtract(1, 'month');
  viewMonth.value = d.format('YYYY-MM');
  emit('update:viewMonth', viewMonth.value);
}

function nextMonth() {
  const d = dayjs(viewMonth.value + '-01').add(1, 'month');
  viewMonth.value = d.format('YYYY-MM');
  emit('update:viewMonth', viewMonth.value);
}

type CellStatus = 'completed' | 'partial' | 'none' | null;
type CalendarCell = {
  date: string;
  dayNum: number;
  status: CellStatus;
  progress: number;
};

const progressCircumference = 2 * Math.PI * 8;

const calendarCells = computed(() => {
  const firstDay = dayjs(viewMonth.value + '-01');
  // 周一开始: 1=Mon..7=Sun
  let startDow = firstDay.day(); // 0=Sun
  if (startDow === 0) startDow = 7;
  const offset = startDow - 1; // 偏移量（周一开始）

  const daysInMonth = firstDay.daysInMonth();
  const cells: CalendarCell[] = [];

  // 前面的空白
  for (let i = 0; i < offset; i++) {
    cells.push({ date: '', dayNum: 0, status: null, progress: 0 });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = viewMonth.value + '-' + String(d).padStart(2, '0');
    const records = props.habit.records.filter(r => r.date === date);
    let status: CellStatus = 'none';
    let progress = 0;

    if (records.length > 0) {
      if (props.habit.type === 'binary') {
        status = 'completed';
      } else {
        // 计数型：检查是否达标
        const anyCompleted = records.some(r => isRecordCompleted(r, props.habit));
        if (anyCompleted) {
          status = 'completed';
          progress = 1;
        } else {
          status = 'partial';
          const bestCurrentValue = records.reduce((maxValue, record) => Math.max(maxValue, record.currentValue ?? 0), 0);
          const targetValue = props.habit.target || records[0]?.targetValue || 0;
          progress = targetValue > 0 ? Math.min(bestCurrentValue / targetValue, 1) : 0;
        }
      }
    }

    cells.push({ date, dayNum: d, status, progress });
  }

  return cells;
});
</script>

<style scoped>
.habit-month-calendar {
  padding: 12px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
}

.habit-month-calendar__header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
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
  padding: 0;
}

.habit-month-calendar__nav:hover {
  background: var(--b3-theme-surface-light);
}

.habit-month-calendar__nav--prev {
  justify-self: start;
}

.habit-month-calendar__nav--next {
  justify-self: end;
}

.habit-month-calendar__title {
  justify-self: center;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.habit-month-calendar__grid {
  width: 100%;
  min-width: 0;
}

.habit-month-calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  text-align: center;
  margin-bottom: 2px;
  width: 100%;
  min-width: 0;
}

.habit-month-calendar__weekday {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  padding: 1px 0;
  min-width: 0;
}

.habit-month-calendar__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  width: 100%;
  min-width: 0;
}

.habit-month-calendar__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border-radius: 4px;
  font-size: 12px;
  min-height: 44px;
  padding: 2px 0;
  box-sizing: border-box;
  min-width: 0;
  cursor: default;
}

.habit-month-calendar__cell--empty {
  background: transparent;
}

.habit-month-calendar__day-num {
  color: var(--b3-theme-on-surface);
  line-height: 1.1;
  margin-bottom: 3px;
  cursor: default;
}

.habit-month-calendar__day-num--today {
  color: var(--b3-theme-primary);
  font-weight: 600;
}

.habit-month-calendar__marker {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.habit-month-calendar__check,
.habit-month-calendar__empty-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.habit-month-calendar__check {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  line-height: 1;
}

.habit-month-calendar__empty-dot {
  background: var(--b3-theme-surface-lighter);
  opacity: 0.7;
}

.habit-month-calendar__progress-ring {
  width: 20px;
  height: 20px;
  transform: rotate(-90deg);
  cursor: default;
}

.habit-month-calendar__progress-track,
.habit-month-calendar__progress-value {
  fill: none;
  stroke-width: 3;
  cursor: default;
}

.habit-month-calendar__progress-track {
  stroke: var(--b3-theme-surface-lighter);
  opacity: 0.9;
}

.habit-month-calendar__progress-value {
  stroke: var(--b3-theme-primary);
  stroke-linecap: round;
}
</style>
