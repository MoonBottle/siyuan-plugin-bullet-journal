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
            cell.date === rangeStart,
          'date-picker-month-grid__cell--range-end':
            cell.date === rangeEnd,
          'date-picker-month-grid__cell--planned': hasPlanned(cell.summary),
          'date-picker-month-grid__cell--focused':
            cell.summary.actualMinutes > 0,
          'date-picker-month-grid__cell--unplanned-focus': hasFocusedOnly(
            cell.summary,
          ),
        }"
        :data-testid="
          cell.date ? `date-picker-month-cell-${cell.date}` : undefined
        "
        :disabled="!cell.date"
        type="button"
        :title="cell.date ? getCellMarkerLabel(cell.summary) : ''"
        @click="cell.date && emit('date-click', cell.date, $event)"
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
                'date-picker-month-grid__dot--planned': hasPlannedOnly(
                  cell.summary,
                ),
                'date-picker-month-grid__dot--focused': hasFocusedOnly(
                  cell.summary,
                ),
                'date-picker-month-grid__dot--hybrid': hasPlannedAndFocused(
                  cell.summary,
                ),
              }"
            ></span>
          </span>
        </template>
      </button>
    </div>

    <div class="date-picker-month-grid__legend">
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--planned"
        ></span>
        <span>{{ t('focusWorkbench').calendarLegendPlanned }}</span>
      </span>
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--focused"
        ></span>
        <span>{{ t('focusWorkbench').calendarLegendFocused }}</span>
      </span>
      <span class="date-picker-month-grid__legend-item">
        <span
          class="date-picker-month-grid__dot date-picker-month-grid__dot--hybrid"
        ></span>
        <span>{{ t('focusWorkbench').calendarLegendHybrid }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import type { FocusPlanDailySummary } from '@/utils/focusPlanReview';

type CalendarCell = {
  date: string;
  dayNum: number;
  summary: FocusPlanDailySummary;
};

const props = defineProps<{
  selectedDate: string;
  rangeStart: string;
  rangeEnd: string;
  getSummaryByDate: (date: string) => FocusPlanDailySummary;
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
const title = computed(() =>
  dayjs(`${viewMonth.value}-01`).format('YYYY年M月'),
);

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

function hasPlanned(summary: FocusPlanDailySummary): boolean {
  return summary.estimatedMinutes > 0;
}

function hasFocused(summary: FocusPlanDailySummary): boolean {
  return summary.actualMinutes > 0;
}

function hasPlannedOnly(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) && !hasFocused(summary);
}

function hasFocusedOnly(summary: FocusPlanDailySummary): boolean {
  return !hasPlanned(summary) && hasFocused(summary);
}

function hasPlannedAndFocused(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) && hasFocused(summary);
}

function hasMarker(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) || hasFocused(summary);
}

function getCellMarkerLabel(summary: FocusPlanDailySummary): string {
  if (hasPlannedAndFocused(summary))
    return t('focusWorkbench').calendarLegendHybrid;
  if (hasFocusedOnly(summary)) return t('focusWorkbench').calendarLegendFocused;
  if (hasPlannedOnly(summary)) return t('focusWorkbench').calendarLegendPlanned;
  return '';
}

function emptySummary(): FocusPlanDailySummary {
  return {
    date: '',
    total: 0,
    estimatedMinutes: 0,
    actualMinutes: 0,
    matched: 0,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 0,
    unplanned: 0,
  };
}
</script>

<style scoped>
.date-picker-month-grid {
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
  margin-top: 6px;
}

.date-picker-month-grid__cell {
  min-width: 0;
  aspect-ratio: 1 / 1;
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

.date-picker-month-grid__cell--focused:not(
  .date-picker-month-grid__cell--selected
) {
  background: var(--b3-theme-surface);
}

.date-picker-month-grid__cell--planned
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
  background: var(--b3-theme-surface-lighter);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.date-picker-month-grid__dot--planned {
  background: var(--b3-theme-surface-lighter);
}

.date-picker-month-grid__dot--focused {
  background: var(--b3-theme-primary);
}

.date-picker-month-grid__dot--hybrid {
  background: var(--b3-theme-primary);
  box-shadow:
    0 0 0 1px var(--b3-theme-background),
    0 0 0 2px var(--b3-theme-primary-light);
  transform: scale(1.1);
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
