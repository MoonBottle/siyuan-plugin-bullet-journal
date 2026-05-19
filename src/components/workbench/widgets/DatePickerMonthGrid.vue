<template>
  <div class="date-picker-month-grid">
    <div class="date-picker-month-grid__header">
      <button
        class="date-picker-month-grid__nav"
        type="button"
        @click="prevMonth"
      >
        ‹
      </button>
      <span class="date-picker-month-grid__title">{{ title }}</span>
      <button
        class="date-picker-month-grid__nav"
        type="button"
        @click="nextMonth"
      >
        ›
      </button>
    </div>

    <div class="date-picker-month-grid__weekdays">
      <span
        v-for="day in weekDayLabels"
        :key="day"
        class="date-picker-month-grid__weekday"
        >{{ day }}</span
      >
    </div>

    <div class="date-picker-month-grid__days">
      <button
        v-for="(cell, index) in calendarCells"
        :key="cell.date || `empty-${index}`"
        class="date-picker-month-grid__cell"
        :class="{
          'date-picker-month-grid__cell--empty': !cell.date,
          'date-picker-month-grid__cell--today': cell.date === today,
          'date-picker-month-grid__cell--selected':
            cell.date === selectedDate,
          'date-picker-month-grid__cell--in-range': isInRange(cell.date),
          'date-picker-month-grid__cell--range-start':
            cell.date && cell.date === rangeStart,
          'date-picker-month-grid__cell--range-end':
            cell.date && cell.date === rangeEnd,
          'date-picker-month-grid__cell--pending': hasPending(cell.summary),
          'date-picker-month-grid__cell--overdue': hasOverdue(cell.summary),
          'date-picker-month-grid__cell--completed':
            hasCompleted(cell.summary) && !hasPending(cell.summary) && !hasOverdue(cell.summary),
        }"
        :data-testid="
          cell.date ? `date-picker-month-cell-${cell.date}` : undefined
        "
        :disabled="!cell.date"
        type="button"
        :title="cell.date ? getCellMarkerLabel(cell.summary) : ''"
        @click="cell.date && (emit('date-click', cell.date, $event), ($event.currentTarget as HTMLElement)?.blur())"
      >
        <template v-if="cell.date">
          <span class="date-picker-month-grid__day-num">{{
            cell.dayNum
          }}</span>
          <span class="date-picker-month-grid__marker">
            <span
              v-if="hasMarker(cell.summary)"
              class="date-picker-month-grid__dot"
              :class="{
                'date-picker-month-grid__dot--overdue': getDotType(cell.summary) === 'overdue',
                'date-picker-month-grid__dot--pending': getDotType(cell.summary) === 'pending',
                'date-picker-month-grid__dot--completed': getDotType(cell.summary) === 'completed',
              }"
            ></span>
          </span>
        </template>
      </button>
    </div>

    <div class="date-picker-month-grid__legend">
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--overdue"
        ></span>
        <span>{{ t('datePicker').legendOverdue }}</span>
      </span>
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--pending"
        ></span>
        <span>{{ t('datePicker').legendPending }}</span>
      </span>
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--completed"
        ></span>
        <span>{{ t('datePicker').legendCompleted }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from '@/utils/dayjs';
import { getCurrentLocale, t } from '@/i18n';
import type { DatePickerDailySummary } from './datePickerUtils';
import {
  emptySummary,
  getCellMarkerLabel,
  getDotType,
  hasCompleted,
  hasMarker,
  hasOverdue,
  hasPending,
} from './datePickerUtils';

type CalendarCell = {
  date: string;
  dayNum: number;
  summary: DatePickerDailySummary;
};

const props = defineProps<{
  selectedDate: string;
  rangeStart: string;
  rangeEnd: string;
  getSummaryByDate: (date: string) => DatePickerDailySummary;
}>();

const emit = defineEmits<{
  'date-click': [date: string, event: MouseEvent];
}>();

const today = dayjs().format('YYYY-MM-DD');
const viewMonth = ref(props.selectedDate.slice(0, 7));

watch(
  () => props.selectedDate,
  (value) => {
    const nextMonth = value.slice(0, 7);
    if (nextMonth !== viewMonth.value) {
      viewMonth.value = nextMonth;
    }
  },
);

const weekDayLabels = computed(() => t('calendar').weekDays);
const title = computed(() => {
  const d = dayjs(`${viewMonth.value}-01`);
  const locale = getCurrentLocale();
  return locale.startsWith('en') ? d.format('MMMM YYYY') : d.format('YYYY年M月');
});

const calendarCells = computed(() => {
  const firstDay = dayjs(`${viewMonth.value}-01`);
  let startDow: number = firstDay.day();
  if (startDow === 0) startDow = 7;
  const offset = startDow - 1;
  const daysInMonth = firstDay.daysInMonth();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({
      date: '',
      dayNum: 0,
      summary: emptySummary(),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${viewMonth.value}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      dayNum: day,
      summary: props.getSummaryByDate(date) ?? emptySummary(),
    });
  }

  return cells;
});

function prevMonth() {
  viewMonth.value = dayjs(`${viewMonth.value}-01`)
    .subtract(1, 'month')
    .format('YYYY-MM');
}

function nextMonth() {
  viewMonth.value = dayjs(`${viewMonth.value}-01`)
    .add(1, 'month')
    .format('YYYY-MM');
}

function isInRange(date: string): boolean {
  if (!props.rangeStart || !props.rangeEnd || !date) return false;
  return date >= props.rangeStart && date <= props.rangeEnd;
}
</script>

<style lang="scss" scoped>
.date-picker-month-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-background);
}

.date-picker-month-grid__header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.date-picker-month-grid__nav {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  opacity: 1;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.date-picker-month-grid__title {
  justify-self: center;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.date-picker-month-grid__weekdays,
.date-picker-month-grid__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.date-picker-month-grid__weekday {
  text-align: center;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.date-picker-month-grid__days {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
}

.date-picker-month-grid__cell {
  min-width: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}

.date-picker-month-grid__cell--empty {
  cursor: default;
}

.date-picker-month-grid__cell--today {
  border-color: var(--b3-theme-primary);
}

.date-picker-month-grid__cell--selected {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.date-picker-month-grid__cell--in-range:not(
  .date-picker-month-grid__cell--selected
) {
  background: var(--b3-theme-surface-lighter);
}

.date-picker-month-grid__cell--range-start,
.date-picker-month-grid__cell--range-end {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.date-picker-month-grid__cell--overdue:not(
  .date-picker-month-grid__cell--selected
) {
  background: rgba(210, 63, 49, 0.08);
}

.date-picker-month-grid__cell--completed:not(
  .date-picker-month-grid__cell--selected
) {
  background: var(--b3-theme-surface);
}

.date-picker-month-grid__cell--pending
  .date-picker-month-grid__day-num {
  font-weight: 600;
}

.date-picker-month-grid__day-num {
  font-size: 12px;
  line-height: 1;
}

.date-picker-month-grid__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 8px;
  margin-top: 5px;
}

.date-picker-month-grid__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.date-picker-month-grid__dot--overdue {
  background: var(--b3-theme-error);
}

.date-picker-month-grid__dot--pending {
  background: var(--b3-theme-secondary);
}

.date-picker-month-grid__dot--completed {
  background: var(--b3-theme-success);
}

.date-picker-month-grid__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.date-picker-month-grid__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
