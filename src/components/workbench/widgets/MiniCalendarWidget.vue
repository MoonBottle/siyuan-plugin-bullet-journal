<template>
  <div class="workbench-widget-mini-calendar" data-testid="workbench-widget-mini-calendar">
    <div
      v-if="showDayHeader"
      class="workbench-widget-mini-calendar__header"
      data-testid="workbench-mini-calendar-day-header"
    >
      <CalendarDayHeader
        :title="currentTitle"
        :duration-label="dayTotalDurationLabel"
        @prev="handlePrev"
        @next="handleNext"
        @today="handleToday"
      />
    </div>
    <CalendarView
      ref="calendarRef"
      :events="events"
      :initial-view="view"
      @event-drop="handleEventDrop"
      @event-resize="handleEventResize"
      @navigated="updateTitle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import CalendarDayHeader from '@/components/calendar/CalendarDayHeader.vue';
import CalendarView from '@/components/calendar/CalendarView.vue';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores';
import type { WorkbenchCalendarWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { persistCalendarEventChange } from '@/utils/calendarEventChange';
import { calculateDayTotalDurationMinutes, formatTotalDuration } from '@/utils/calendarDuration';
import dayjs from '@/utils/dayjs';
import { useSafeProjectStore } from './useSafeProjectStore';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const calendarRef = ref<any>(null);
const projectStore = useSafeProjectStore();
const settingsStore = useSettingsStore();
const calendarConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchCalendarWidgetConfig;
});

const view = computed(() => calendarConfig.value.view ?? 'timeGridDay');
const groupId = computed(() => calendarConfig.value.groupId ?? '');
const currentTitle = ref('');
const currentDateStr = ref(dayjs().format('YYYY-MM-DD'));
const showDayHeader = computed(() => view.value === 'timeGridDay');

const events = computed(() => {
  return projectStore?.getFilteredCalendarEvents(groupId.value) ?? [];
});

const dayTotalDurationMinutes = computed(() => {
  if (view.value !== 'timeGridDay') {
    return 0;
  }

  return calculateDayTotalDurationMinutes(
    events.value,
    currentDateStr.value,
    settingsStore.lunchBreakStart,
    settingsStore.lunchBreakEnd,
  );
});

const showDayTotalDuration = computed(() => {
  return view.value === 'timeGridDay' && dayTotalDurationMinutes.value > 0;
});

const dayTotalDurationLabel = computed(() => {
  if (!showDayTotalDuration.value) {
    return '';
  }

  const duration = formatTotalDuration(dayTotalDurationMinutes.value);
  return t('calendar').dayTotalDuration.replace('{duration}', duration);
});

function updateTitle() {
  if (!calendarRef.value) {
    return;
  }

  currentTitle.value = calendarRef.value.getTitle?.() || '';
  const currentDate = calendarRef.value.getDate?.();
  if (currentDate) {
    currentDateStr.value = dayjs(currentDate).format('YYYY-MM-DD');
  }
}

function handlePrev() {
  calendarRef.value?.prev?.();
  updateTitle();
}

function handleNext() {
  calendarRef.value?.next?.();
  updateTitle();
}

function handleToday() {
  calendarRef.value?.today?.();
  updateTitle();
}

async function handleEventDrop(eventInfo: any) {
  await persistCalendarEventChange(eventInfo, 'move');
}

async function handleEventResize(eventInfo: any) {
  await persistCalendarEventChange(eventInfo, 'resize');
}

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin();
  }

  nextTick(() => {
    setTimeout(() => {
      updateTitle();
    }, 100);
  });
});
</script>

<style lang="scss" scoped>
.workbench-widget-mini-calendar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-mini-calendar__header {
  flex-shrink: 0;
  padding: 0 0 8px;
}

.workbench-widget-mini-calendar :deep(.calendar-view) {
  flex: 1;
  min-height: 0;
}
</style>
