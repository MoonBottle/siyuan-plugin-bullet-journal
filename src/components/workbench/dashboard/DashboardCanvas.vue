<template>
  <div class="workbench-dashboard-canvas" data-testid="workbench-dashboard-canvas">
    <div
      v-if="!dashboard || widgets.length === 0"
      class="workbench-dashboard-canvas__empty"
      data-testid="workbench-dashboard-empty"
    >
      <span data-testid="workbench-dashboard-placeholder">
        {{ t('workbench').dashboardPlaceholder }}
      </span>
    </div>

    <div v-else class="workbench-dashboard-canvas__grid">
      <WorkbenchWidgetCard
        v-for="widget in widgets"
        :key="widget.id"
        :title="widget.title || getWidgetDefinition(widget.type).name"
      >
        <component
          :is="widgetComponents[widget.type]"
          :widget="widget"
        />
        <button
          class="workbench-dashboard-canvas__move-button"
          :data-testid="`workbench-widget-move-${widget.id}`"
          type="button"
          @click="handleMoveWidget(widget.id)"
        >
          Move
        </button>
      </WorkbenchWidgetCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TodoListWidget from '@/components/workbench/widgets/TodoListWidget.vue';
import QuadrantSummaryWidget from '@/components/workbench/widgets/QuadrantSummaryWidget.vue';
import HabitWeekWidget from '@/components/workbench/widgets/HabitWeekWidget.vue';
import MiniCalendarWidget from '@/components/workbench/widgets/MiniCalendarWidget.vue';
import PomodoroStatsWidget from '@/components/workbench/widgets/PomodoroStatsWidget.vue';
import { t } from '@/i18n';
import { useWorkbenchStore } from '@/stores';
import type { Component } from 'vue';
import type { WorkbenchDashboard, WorkbenchEntry, WorkbenchWidgetType } from '@/types/workbench';
import WorkbenchWidgetCard from '@/components/workbench/dashboard/WorkbenchWidgetCard.vue';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

function resolveWorkbenchStore() {
  try {
    return useWorkbenchStore();
  }
  catch {
    return {
      dashboards: [] as WorkbenchDashboard[],
      updateWidgetLayout: async () => {},
    };
  }
}

const workbenchStore = resolveWorkbenchStore();

const dashboard = computed(() => {
  if (props.entry.type !== 'dashboard' || !props.entry.dashboardId) {
    return null;
  }

  return workbenchStore.dashboards.find(item => item.id === props.entry.dashboardId) ?? null;
});

const widgets = computed(() => dashboard.value?.widgets ?? []);

const widgetComponents: Record<WorkbenchWidgetType, Component> = {
  todoList: TodoListWidget,
  quadrantSummary: QuadrantSummaryWidget,
  habitWeek: HabitWeekWidget,
  miniCalendar: MiniCalendarWidget,
  pomodoroStats: PomodoroStatsWidget,
};

async function handleMoveWidget(widgetId: string) {
  if (!dashboard.value) {
    return;
  }

  const widget = dashboard.value.widgets.find(item => item.id === widgetId);
  if (!widget) {
    return;
  }

  await workbenchStore.updateWidgetLayout(dashboard.value.id, widgetId, {
    x: widget.layout.x + 1,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
  });
}
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

.workbench-dashboard-canvas__move-button {
  margin-top: 12px;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}
</style>
