<template>
  <div class="workbench-widget-mini-calendar" data-testid="workbench-widget-mini-calendar">
    <CalendarView
      :events="events"
      :initial-view="view"
      @event-drop="handleEventDrop"
      @event-resize="handleEventResize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import CalendarView from '@/components/calendar/CalendarView.vue';
import { useSettingsStore } from '@/stores';
import type { WorkbenchCalendarWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { persistCalendarEventChange } from '@/utils/calendarEventChange';
import { useSafeProjectStore } from './useSafeProjectStore';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const projectStore = useSafeProjectStore();
const settingsStore = useSettingsStore();
const calendarConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchCalendarWidgetConfig;
});

const view = computed(() => calendarConfig.value.view ?? 'timeGridDay');
const groupId = computed(() => calendarConfig.value.groupId ?? '');

const events = computed(() => {
  return projectStore?.getFilteredCalendarEvents(groupId.value) ?? [];
});

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
});
</script>

<style lang="scss" scoped>
.workbench-widget-mini-calendar {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
