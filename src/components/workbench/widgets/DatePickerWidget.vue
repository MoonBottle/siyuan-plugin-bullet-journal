<template>
  <div class="workbench-widget-date-picker" data-testid="workbench-widget-date-picker">
    <div class="workbench-widget-date-picker__toolbar">
      <button
        class="workbench-widget-date-picker__view-btn"
        :class="{ 'is-active': currentView === 'month' }"
        type="button"
        @click="currentView = 'month'"
      >{{ t('datePicker').month }}</button>
      <button
        class="workbench-widget-date-picker__view-btn"
        :class="{ 'is-active': currentView === 'week' }"
        type="button"
        @click="currentView = 'week'"
      >{{ t('datePicker').week }}</button>
    </div>

    <div v-if="currentView === 'month'" class="workbench-widget-date-picker__calendar">
      <DatePickerMonthGrid
        :selected-date="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @date-click="handleDateClick"
      />
    </div>

    <div v-else class="workbench-widget-date-picker__calendar">
      <DatePickerWeekGrid
        :selected-date="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @date-click="handleDateClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '@/i18n';
import { eventBus, Events } from '@/utils/eventBus';
import { useSafeProjectStore } from './useSafeProjectStore';
import type { WorkbenchDatePickerWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import dayjs from '@/utils/dayjs';
import DatePickerMonthGrid from './DatePickerMonthGrid.vue';
import DatePickerWeekGrid from './DatePickerWeekGrid.vue';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const projectStore = useSafeProjectStore();
const pickerConfig = computed(() => (props.widget?.config ?? {}) as unknown as WorkbenchDatePickerWidgetConfig);
const currentView = ref(pickerConfig.value.view ?? 'month');
const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const rangeStart = ref<string>('');
const rangeEnd = ref<string>('');
let lastClickedDate = '';

watch(
  () => pickerConfig.value.view,
  (v) => {
    if (v) currentView.value = v;
  },
);

function getSummaryByDate(date: string) {
  return projectStore?.getFocusPlanSummaryByDate(date, '') ?? emptySummary();
}

function handleDateClick(date: string, mouseEvent: MouseEvent) {
  if (mouseEvent.shiftKey && lastClickedDate) {
    const d1 = dayjs(lastClickedDate);
    const d2 = dayjs(date);
    rangeStart.value = d1.isBefore(d2) ? lastClickedDate : date;
    rangeEnd.value = d1.isBefore(d2) ? date : lastClickedDate;
  } else {
    rangeStart.value = date;
    rangeEnd.value = date;
    lastClickedDate = date;
  }
  selectedDate.value = date;
  emitLinkageEvent(rangeStart.value, rangeEnd.value);
}

function emitLinkageEvent(start: string, end: string) {
  if (!props.widget?.id) return;
  const linkages = pickerConfig.value.linkages ?? [];
  for (const rule of linkages) {
    eventBus.emit(Events.WIDGET_DATE_RANGE_CHANGED, {
      sourceWidgetId: props.widget.id,
      targetWidgetId: rule.targetWidgetId,
      dateRange: { start, end },
    });
  }
}

function emptySummary() {
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

<style lang="scss" scoped>
.workbench-widget-date-picker {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-date-picker__toolbar {
  display: flex;
  gap: 4px;
  padding: 0 4px 8px;
  flex-shrink: 0;
}

.workbench-widget-date-picker__view-btn {
  padding: 2px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;

  &.is-active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.workbench-widget-date-picker__calendar {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
