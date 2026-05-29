<template>
  <div
    class="workbench-widget-date-picker"
    data-testid="workbench-widget-date-picker"
  >
    <div
      v-if="currentView === 'month'"
      class="workbench-widget-date-picker__calendar"
    >
      <DatePickerMonthGrid
        :selected-date="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @dateClick="handleDateClick"
      />
    </div>

    <div
      v-else
      class="workbench-widget-date-picker__calendar"
    >
      <DatePickerWeekGrid
        :selected-date="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @dateClick="handleDateClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DatePickerDailySummary } from './datePickerUtils'
import type {
  WorkbenchDatePickerWidgetConfig,
  WorkbenchWidgetInstance,
} from '@/types/workbench'
import {
  computed,
  ref,
  watch,
} from 'vue'
import dayjs from '@/utils/dayjs'
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import DatePickerMonthGrid from './DatePickerMonthGrid.vue'
import { emptySummary } from './datePickerUtils'
import DatePickerWeekGrid from './DatePickerWeekGrid.vue'
import { useSafeProjectStore } from './useSafeProjectStore'

const props = defineProps<{
  widget?: WorkbenchWidgetInstance
}>()

const projectStore = useSafeProjectStore()
const pickerConfig = computed(() => (props.widget?.config ?? {}) as unknown as WorkbenchDatePickerWidgetConfig)
const currentView = ref(pickerConfig.value.view ?? 'month')
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const rangeStart = ref<string>('')
const rangeEnd = ref<string>('')
let lastClickedDate = ''

watch(
  () => pickerConfig.value.view,
  (v) => {
    if (v) currentView.value = v
  },
)

const getSummaryByDate = computed(() => {
  const gid = pickerConfig.value.groupId ?? ''
  return (date: string): DatePickerDailySummary =>
    projectStore?.getItemSummaryByDate(date, gid) ?? emptySummary()
})

function handleDateClick(date: string, mouseEvent: MouseEvent) {
  if (mouseEvent.shiftKey && lastClickedDate) {
    const d1 = dayjs(lastClickedDate)
    const d2 = dayjs(date)
    rangeStart.value = d1.isBefore(d2) ? lastClickedDate : date
    rangeEnd.value = d1.isBefore(d2) ? date : lastClickedDate
  } else {
    rangeStart.value = date
    rangeEnd.value = date
    lastClickedDate = date
  }
  selectedDate.value = date
  emitLinkageEvent(rangeStart.value, rangeEnd.value)
}

function emitLinkageEvent(start: string, end: string) {
  if (!props.widget?.id) return
  const linkages = pickerConfig.value.linkages ?? []
  for (const rule of linkages) {
    eventBus.emit(Events.WIDGET_DATE_RANGE_CHANGED, {
      sourceWidgetId: props.widget.id,
      targetWidgetId: rule.targetWidgetId,
      dateRange: {
        start,
        end,
      },
    })
  }
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

.workbench-widget-date-picker__calendar {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
