<template>
  <div class="date-picker-week-grid">
    <div class="date-picker-week-grid__header">
      <button
        class="date-picker-week-grid__nav"
        type="button"
        @click="prevWeek"
      >
        ‹
      </button>
      <span class="date-picker-week-grid__title">{{ title }}</span>
      <button
        class="date-picker-week-grid__nav"
        type="button"
        @click="nextWeek"
      >
        ›
      </button>
    </div>

    <div class="date-picker-week-grid__weekdays">
      <span
        v-for="day in weekDayLabels"
        :key="day"
        class="date-picker-week-grid__weekday"
        >{{ day }}</span
      >
    </div>

    <div class="date-picker-week-grid__days">
      <button
        v-for="date in weekDates"
        :key="date"
        class="date-picker-week-grid__cell"
        :class="{
          'date-picker-week-grid__cell--today': date === today,
          'date-picker-week-grid__cell--selected': date === selectedDate,
          'date-picker-week-grid__cell--in-range': isInRange(date),
          'date-picker-week-grid__cell--range-start': date === rangeStart,
          'date-picker-week-grid__cell--range-end': date === rangeEnd,
          'date-picker-week-grid__cell--pending': hasPending(
            getSummaryByDate(date),
          ),
          'date-picker-week-grid__cell--overdue': hasOverdue(
            getSummaryByDate(date),
          ),
          'date-picker-week-grid__cell--completed':
            hasCompleted(getSummaryByDate(date)) && !hasPending(getSummaryByDate(date)) && !hasOverdue(getSummaryByDate(date)),
        }"
        :data-testid="`date-picker-week-cell-${date}`"
        type="button"
        :title="getCellMarkerLabel(getSummaryByDate(date))"
        @click="emit('date-click', date, $event)"
      >
        <span class="date-picker-week-grid__day-num">{{
          dayjs(date).format('D')
        }}</span>
        <span class="date-picker-week-grid__marker">
          <span
              v-if="hasMarker(getSummaryByDate(date))"
              class="date-picker-week-grid__dot"
              :class="{
                'date-picker-week-grid__dot--overdue': getDotType(getSummaryByDate(date)) === 'overdue',
                'date-picker-week-grid__dot--pending': getDotType(getSummaryByDate(date)) === 'pending',
                'date-picker-week-grid__dot--completed': getDotType(getSummaryByDate(date)) === 'completed',
              }"
            ></span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from '@/utils/dayjs';
import { getCurrentLocale, t } from '@/i18n';
import type { DatePickerDailySummary } from './datePickerUtils';
import {
  getCellMarkerLabel,
  getDotType,
  hasCompleted,
  hasMarker,
  hasOverdue,
  hasPending,
} from './datePickerUtils';

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
const weekDayLabels = computed(() => t('calendar').weekDays);

const viewWeekStart = ref(getMonday(props.selectedDate));

watch(
  () => props.selectedDate,
  (value) => {
    const nextMonday = getMonday(value);
    if (nextMonday !== viewWeekStart.value) {
      viewWeekStart.value = nextMonday;
    }
  },
);

function getMonday(dateStr: string): string {
  const d = dayjs(dateStr);
  let dow: number = d.day();
  if (dow === 0) dow = 7;
  return d.subtract(dow - 1, 'day').format('YYYY-MM-DD');
}

const weekDates = computed(() => {
  const monday = dayjs(viewWeekStart.value);
  return Array.from({ length: 7 }, (_, i) =>
    monday.add(i, 'day').format('YYYY-MM-DD'),
  );
});

const title = computed(() => {
  const monday = dayjs(viewWeekStart.value);
  const sunday = monday.add(6, 'day');
  const locale = getCurrentLocale();
  if (locale.startsWith('en')) {
    if (monday.month() === sunday.month()) {
      return `${monday.format('MMM D')} – ${sunday.format('D, YYYY')}`;
    }
    return `${monday.format('MMM D')} – ${sunday.format('MMM D, YYYY')}`;
  }
  if (monday.month() === sunday.month()) {
    return `${monday.format('M月D日')} – ${sunday.format('D日')}`;
  }
  return `${monday.format('M月D日')} – ${sunday.format('M月D日')}`;
});

function prevWeek() {
  viewWeekStart.value = dayjs(viewWeekStart.value)
    .subtract(1, 'week')
    .format('YYYY-MM-DD');
}

function nextWeek() {
  viewWeekStart.value = dayjs(viewWeekStart.value)
    .add(1, 'week')
    .format('YYYY-MM-DD');
}

function isInRange(date: string): boolean {
  if (!props.rangeStart || !props.rangeEnd || !date) return false;
  return date >= props.rangeStart && date <= props.rangeEnd;
}
</script>

<style lang="scss" scoped>
.date-picker-week-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-background);
}

.date-picker-week-grid__header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.date-picker-week-grid__nav {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.date-picker-week-grid__title {
  justify-self: center;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.date-picker-week-grid__weekdays,
.date-picker-week-grid__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.date-picker-week-grid__weekday {
  text-align: center;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  padding-bottom: 4px;
}

.date-picker-week-grid__days {
  flex: 1;
  min-height: 0;
  margin-top: 2px;
}

.date-picker-week-grid__cell {
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

.date-picker-week-grid__cell--today {
  border-color: var(--b3-theme-primary);
}

.date-picker-week-grid__cell--selected {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.date-picker-week-grid__cell--in-range:not(
  .date-picker-week-grid__cell--selected
) {
  background: var(--b3-theme-surface-lighter);
}

.date-picker-week-grid__cell--range-start,
.date-picker-week-grid__cell--range-end {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.date-picker-week-grid__cell--overdue:not(
  .date-picker-week-grid__cell--selected
) {
  background: rgba(210, 63, 49, 0.08);
}

.date-picker-week-grid__cell--completed:not(
  .date-picker-week-grid__cell--selected
) {
  background: var(--b3-theme-surface);
}

.date-picker-week-grid__cell--pending
  .date-picker-week-grid__day-num {
  font-weight: 600;
}

.date-picker-week-grid__day-num {
  font-size: 13px;
  line-height: 1;
}

.date-picker-week-grid__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 8px;
  margin-top: 4px;
}

.date-picker-week-grid__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.date-picker-week-grid__dot--overdue {
  background: var(--b3-theme-error);
}

.date-picker-week-grid__dot--pending {
  background: var(--b3-theme-secondary);
}

.date-picker-week-grid__dot--completed {
  background: var(--b3-theme-success);
}
</style>
