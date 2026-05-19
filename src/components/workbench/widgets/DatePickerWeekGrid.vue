<template>
  <div class="date-picker-week-grid">
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
          'date-picker-week-grid__cell--planned': hasPlanned(
            getSummaryByDate(date),
          ),
          'date-picker-week-grid__cell--focused':
            getSummaryByDate(date).actualMinutes > 0,
          'date-picker-week-grid__cell--unplanned-focus': hasFocusedOnly(
            getSummaryByDate(date),
          ),
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
              'date-picker-week-grid__dot--planned': hasPlannedOnly(
                getSummaryByDate(date),
              ),
              'date-picker-week-grid__dot--focused': hasFocusedOnly(
                getSummaryByDate(date),
              ),
              'date-picker-week-grid__dot--hybrid': hasPlannedAndFocused(
                getSummaryByDate(date),
              ),
            }"
          ></span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import type { FocusPlanDailySummary } from '@/utils/focusPlanReview';

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
const weekDayLabels = computed(() => t('calendar').weekDays);

const weekDates = computed(() => {
  const d = dayjs(props.selectedDate);
  let dow: number = d.day();
  if (dow === 0) dow = 7;
  const monday = d.subtract(dow - 1, 'day');
  return Array.from({ length: 7 }, (_, i) =>
    monday.add(i, 'day').format('YYYY-MM-DD'),
  );
});

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
</script>

<style scoped>
.date-picker-week-grid {
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-background);
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
  margin-top: 2px;
}

.date-picker-week-grid__cell {
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

.date-picker-week-grid__cell--focused:not(
  .date-picker-week-grid__cell--selected
) {
  background: var(--b3-theme-surface);
}

.date-picker-week-grid__cell--planned .date-picker-week-grid__day-num {
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
  background: var(--b3-theme-surface-lighter);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.date-picker-week-grid__dot--planned {
  background: var(--b3-theme-surface-lighter);
}

.date-picker-week-grid__dot--focused {
  background: var(--b3-theme-primary);
}

.date-picker-week-grid__dot--hybrid {
  background: var(--b3-theme-primary);
  box-shadow:
    0 0 0 1px var(--b3-theme-background),
    0 0 0 2px var(--b3-theme-primary-light);
  transform: scale(1.1);
}
</style>
