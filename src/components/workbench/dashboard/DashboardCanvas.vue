<template>
  <div class="workbench-dashboard-canvas" data-testid="workbench-dashboard-canvas">
    <div
      v-if="!dashboard || widgets.length === 0"
      class="workbench-dashboard-canvas__empty"
      data-testid="workbench-dashboard-empty"
    >
      <div class="workbench-dashboard-canvas__empty-title" data-testid="workbench-dashboard-placeholder">
        {{ t('workbench').dashboardEmptyTitle }}
      </div>
      <div class="workbench-dashboard-canvas__empty-desc">
        {{ t('workbench').dashboardEmptyDesc }}
      </div>
      <button
        class="workbench-dashboard-canvas__empty-action"
        data-testid="workbench-dashboard-add-widget-empty"
        type="button"
        @click="emit('request-add-widget')"
      >
        {{ t('workbench').addWidget }}
      </button>
    </div>

    <GridLayout
      v-else
      class="workbench-dashboard-canvas__layout"
      :layout="gridLayout"
      :col-num="GRID_COLUMNS"
      :row-height="GRID_ROW_HEIGHT"
      :margin="GRID_MARGIN"
      :is-draggable="true"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
      :prevent-collision="false"
      data-testid="workbench-dashboard-layout"
      @layout-updated="handleLayoutUpdated"
    >
      <GridItem
        v-for="widget in orderedWidgets"
        :key="widget.id"
        :x="normalizeLayout(widget).x"
        :y="normalizeLayout(widget).y"
        :w="normalizeLayout(widget).w"
        :h="normalizeLayout(widget).h"
        :i="widget.id"
        :drag-allow-from="'.workbench-widget-card__drag'"
        :drag-ignore-from="'.workbench-widget-card__menu-trigger, .workbench-widget-card__menu, button, a, input, textarea, select'"
        :resize-ignore-from="'.workbench-widget-card__menu-trigger, .workbench-widget-card__menu, button, a, input, textarea, select'"
        :data-testid="`workbench-widget-grid-item-${widget.id}`"
      >
        <WorkbenchWidgetCard
          :title="widget.title || getWidgetDefinition(widget.type).name"
          :data-testid="`workbench-widget-card-${widget.id}`"
          @rename="handleRenameWidget(widget.id)"
          @delete="handleDeleteWidget(widget.id)"
        >
          <component
            :is="widgetComponents[widget.type]"
            :widget="widget"
          />
        </WorkbenchWidgetCard>
      </GridItem>
    </GridLayout>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { GridItem, GridLayout } from 'grid-layout-plus';
import type { Layout } from 'grid-layout-plus';
import WorkbenchWidgetCard from '@/components/workbench/dashboard/WorkbenchWidgetCard.vue';
import MiniCalendarWidget from '@/components/workbench/widgets/MiniCalendarWidget.vue';
import PomodoroStatsWidget from '@/components/workbench/widgets/PomodoroStatsWidget.vue';
import QuadrantSummaryWidget from '@/components/workbench/widgets/QuadrantSummaryWidget.vue';
import TodoListWidget from '@/components/workbench/widgets/TodoListWidget.vue';
import HabitWeekWidget from '@/components/workbench/widgets/HabitWeekWidget.vue';
import { t } from '@/i18n';
import { useWorkbenchStore } from '@/stores';
import type { Component } from 'vue';
import type { WorkbenchDashboard, WorkbenchEntry, WorkbenchWidgetInstance, WorkbenchWidgetType } from '@/types/workbench';
import { showConfirmDialog, showInputDialog } from '@/utils/dialog';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';

const GRID_COLUMNS = 12;
const GRID_ROW_HEIGHT = 56;
const GRID_MARGIN = [16, 16];

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

const emit = defineEmits<{
  (event: 'request-add-widget'): void;
}>();

function resolveWorkbenchStore() {
  try {
    return useWorkbenchStore();
  }
  catch {
    return {
      dashboards: [] as WorkbenchDashboard[],
      removeWidget: async () => {},
      renameWidget: async () => {},
      updateWidgetLayouts: async () => {},
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
const orderedWidgets = computed(() => {
  return [...widgets.value].sort((left, right) => {
    if (left.layout.y !== right.layout.y) {
      return left.layout.y - right.layout.y;
    }

    return left.layout.x - right.layout.x;
  });
});

const gridLayout = computed<Layout>(() => {
  return orderedWidgets.value.map(widget => {
    const layout = normalizeLayout(widget);

    return {
      i: widget.id,
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
    };
  });
});

const widgetComponents: Record<WorkbenchWidgetType, Component> = {
  todoList: TodoListWidget,
  quadrantSummary: QuadrantSummaryWidget,
  habitWeek: HabitWeekWidget,
  miniCalendar: MiniCalendarWidget,
  pomodoroStats: PomodoroStatsWidget,
};

function normalizeLayout(widget: WorkbenchWidgetInstance) {
  const width = Math.min(Math.max(widget.layout.w, 1), GRID_COLUMNS);
  const height = Math.max(widget.layout.h, 1);
  const x = Math.min(Math.max(widget.layout.x, 0), GRID_COLUMNS - width);
  const y = Math.max(widget.layout.y, 0);

  return {
    x,
    y,
    w: width,
    h: height,
  };
}

async function handleLayoutUpdated(layout: Layout) {
  if (!dashboard.value) {
    return;
  }

  const nextLayouts = layout.map(item => ({
    id: String(item.i),
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));

  await workbenchStore.updateWidgetLayouts(dashboard.value.id, nextLayouts);
}

function handleRenameWidget(widgetId: string) {
  if (!dashboard.value) {
    return;
  }

  const widget = dashboard.value.widgets.find(item => item.id === widgetId);
  if (!widget) {
    return;
  }

  const currentTitle = widget.title || getWidgetDefinition(widget.type).name;
  showInputDialog(
    t('workbench').rename,
    t('workbench').widgetRenamePrompt,
    currentTitle,
    async (nextTitle) => {
      if (!nextTitle || nextTitle === currentTitle) {
        return;
      }

      await workbenchStore.renameWidget(dashboard.value!.id, widgetId, nextTitle);
    },
  );
}

function handleDeleteWidget(widgetId: string) {
  if (!dashboard.value) {
    return;
  }

  const widget = dashboard.value.widgets.find(item => item.id === widgetId);
  if (!widget) {
    return;
  }

  const currentTitle = widget.title || getWidgetDefinition(widget.type).name;
  showConfirmDialog(
    t('workbench').delete,
    t('workbench').widgetDeleteConfirm.replace('{name}', currentTitle),
    async () => {
      await workbenchStore.removeWidget(dashboard.value!.id, widgetId);
    },
  );
}
</script>

<style lang="scss" scoped>
.workbench-dashboard-canvas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workbench-dashboard-canvas__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}

.workbench-dashboard-canvas__empty-title {
  font-size: 16px;
  font-weight: 600;
}

.workbench-dashboard-canvas__empty-desc {
  max-width: 520px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  line-height: 1.5;
}

.workbench-dashboard-canvas__empty-action {
  padding: 6px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.workbench-dashboard-canvas__layout {
  min-height: 420px;
}

.workbench-dashboard-canvas__layout :deep(.vgl-item) {
  overflow: visible;
}

.workbench-dashboard-canvas__layout :deep(.vgl-item__resizer) {
  z-index: 4;
}
</style>
