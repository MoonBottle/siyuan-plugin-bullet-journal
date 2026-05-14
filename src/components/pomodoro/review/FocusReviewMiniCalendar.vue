<template>
  <div class="focus-review-mini-calendar">
    <div class="focus-review-mini-calendar__header">
      <button class="focus-review-mini-calendar__nav block__icon" type="button" @click="prevMonth">‹</button>
      <span class="focus-review-mini-calendar__title">{{ title }}</span>
      <button class="focus-review-mini-calendar__nav block__icon" type="button" @click="nextMonth">›</button>
    </div>

    <div class="focus-review-mini-calendar__weekdays">
      <span v-for="day in weekDayLabels" :key="day" class="focus-review-mini-calendar__weekday">{{ day }}</span>
    </div>

    <div class="focus-review-mini-calendar__days">
      <button
        v-for="(cell, index) in calendarCells"
        :key="cell.date || `empty-${index}`"
        class="focus-review-mini-calendar__cell"
        :class="{
          'focus-review-mini-calendar__cell--empty': !cell.date,
          'focus-review-mini-calendar__cell--today': cell.date === today,
          'focus-review-mini-calendar__cell--selected': cell.date === modelValue,
          'focus-review-mini-calendar__cell--planned': hasPlanned(cell.summary),
          'focus-review-mini-calendar__cell--focused': cell.summary.actualMinutes > 0,
          'focus-review-mini-calendar__cell--unplanned-focus': hasFocusedOnly(cell.summary),
        }"
        :data-testid="cell.date ? `focus-review-calendar-cell-${cell.date}` : undefined"
        :disabled="!cell.date"
        type="button"
        @click="cell.date && emit('update:modelValue', cell.date)"
      >
        <template v-if="cell.date">
          <span class="focus-review-mini-calendar__day-num">{{ cell.dayNum }}</span>
          <span class="focus-review-mini-calendar__marker">
            <span
              v-if="hasMarker(cell.summary)"
              class="focus-review-mini-calendar__dot"
              :class="{
                'focus-review-mini-calendar__dot--planned': hasPlannedOnly(cell.summary),
                'focus-review-mini-calendar__dot--focused': hasFocusedOnly(cell.summary),
                'focus-review-mini-calendar__dot--hybrid': hasPlannedAndFocused(cell.summary),
              }"
            ></span>
          </span>
        </template>
      </button>
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
  modelValue: string;
  getSummaryByDate: (date: string) => FocusPlanDailySummary;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const today = dayjs().format('YYYY-MM-DD');
const viewMonth = ref(props.modelValue.slice(0, 7));

watch(() => props.modelValue, (value) => {
  const nextMonth = value.slice(0, 7);
  if (nextMonth !== viewMonth.value) {
    viewMonth.value = nextMonth;
  }
});

const weekDayLabels = computed(() => t('calendar').weekDays);
const title = computed(() => dayjs(`${viewMonth.value}-01`).format('YYYY年M月'));

const calendarCells = computed(() => {
  const firstDay = dayjs(`${viewMonth.value}-01`);
  let startDow = firstDay.day();
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
  viewMonth.value = dayjs(`${viewMonth.value}-01`).subtract(1, 'month').format('YYYY-MM');
}

function nextMonth() {
  viewMonth.value = dayjs(`${viewMonth.value}-01`).add(1, 'month').format('YYYY-MM');
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
.focus-review-mini-calendar {
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-background);
}

.focus-review-mini-calendar__header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.focus-review-mini-calendar__nav {
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

.focus-review-mini-calendar__title {
  justify-self: center;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.focus-review-mini-calendar__weekdays,
.focus-review-mini-calendar__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.focus-review-mini-calendar__weekday {
  text-align: center;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.focus-review-mini-calendar__days {
  margin-top: 6px;
}

.focus-review-mini-calendar__cell {
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
  gap: 2px;
  cursor: pointer;
}

.focus-review-mini-calendar__cell--empty {
  cursor: default;
}

.focus-review-mini-calendar__cell--today {
  border-color: var(--b3-theme-primary);
}

.focus-review-mini-calendar__cell--selected {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.focus-review-mini-calendar__cell--focused:not(.focus-review-mini-calendar__cell--selected) {
  background: var(--b3-theme-surface);
}

.focus-review-mini-calendar__cell--planned .focus-review-mini-calendar__day-num {
  font-weight: 600;
}

.focus-review-mini-calendar__day-num {
  font-size: 12px;
  line-height: 1;
}

.focus-review-mini-calendar__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 8px;
}

.focus-review-mini-calendar__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--b3-theme-surface-lighter);
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.focus-review-mini-calendar__dot--planned {
  background: var(--b3-theme-surface-lighter);
}

.focus-review-mini-calendar__dot--focused {
  background: var(--b3-theme-primary);
}

.focus-review-mini-calendar__dot--hybrid {
  background: var(--b3-theme-primary);
  box-shadow: 0 0 0 1px var(--b3-theme-background), 0 0 0 2px var(--b3-theme-primary-light);
  transform: scale(1.1);
}
</style>
