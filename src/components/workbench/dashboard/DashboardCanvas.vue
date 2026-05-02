<template>
  <div class="workbench-dashboard-canvas" data-testid="workbench-dashboard-canvas">
    <div
      v-if="!dashboard || widgets.length === 0"
      class="workbench-dashboard-canvas__empty"
      data-testid="workbench-dashboard-empty"
    >
      {{ t('workbench').dashboardPlaceholder }}
    </div>

    <div v-else class="workbench-dashboard-canvas__grid">
      <WorkbenchWidgetCard
        v-for="widget in widgets"
        :key="widget.id"
        :title="widget.title || getWidgetDefinition(widget.type).name"
      >
        <div :data-testid="`widget-${widget.type}`">
          {{ widget.title || getWidgetDefinition(widget.type).name }}
        </div>
      </WorkbenchWidgetCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { useWorkbenchStore } from '@/stores';
import type { WorkbenchEntry } from '@/types/workbench';
import WorkbenchWidgetCard from '@/components/workbench/dashboard/WorkbenchWidgetCard.vue';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

const workbenchStore = useWorkbenchStore();

const dashboard = computed(() => {
  if (props.entry.type !== 'dashboard' || !props.entry.dashboardId) {
    return null;
  }

  return workbenchStore.dashboards.find(item => item.id === props.entry.dashboardId) ?? null;
});

const widgets = computed(() => dashboard.value?.widgets ?? []);
</script>

<style lang="scss" scoped>
.workbench-dashboard-canvas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workbench-dashboard-canvas__empty {
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}

.workbench-dashboard-canvas__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
</style>
