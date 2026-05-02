<template>
  <div class="workbench-widget-mini-calendar" data-testid="workbench-widget-mini-calendar">
    <div class="workbench-widget-mini-calendar__meta">
      <span>{{ events.length }}</span>
      <span>{{ t('calendar').title }}</span>
    </div>
    <ul v-if="previewEvents.length" class="workbench-widget-mini-calendar__list">
      <li v-for="event in previewEvents" :key="event.id" class="workbench-widget-mini-calendar__item">
        {{ event.title }}
      </li>
    </ul>
    <div v-else class="workbench-widget-mini-calendar__empty">
      {{ t('workbench').dashboardPlaceholder }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { useSafeProjectStore } from './useSafeProjectStore';

const projectStore = useSafeProjectStore();

const events = computed(() => {
  return projectStore?.getFilteredCalendarEvents('') ?? [];
});

const previewEvents = computed(() => {
  return events.value.slice(0, 4);
});
</script>

<style lang="scss" scoped>
.workbench-widget-mini-calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workbench-widget-mini-calendar__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--b3-theme-on-surface);

  span:first-child {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.workbench-widget-mini-calendar__list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workbench-widget-mini-calendar__item {
  line-height: 1.5;
}

.workbench-widget-mini-calendar__empty {
  color: var(--b3-theme-on-surface);
}
</style>
