<template>
  <div class="workbench-widget-pomodoro-stats" data-testid="workbench-widget-pomodoro-stats">
    <div class="workbench-widget-pomodoro-stats__content">
      <StatsOverview
        v-if="section === 'overview'"
        data-testid="workbench-pomodoro-widget-overview"
      />
      <AnnualHeatmap
        v-else-if="section === 'annualHeatmap'"
        data-testid="workbench-pomodoro-widget-annual-heatmap"
      />
      <FocusDetailSection
        v-else-if="section === 'focusDetail'"
        v-model:range="focusDetailRange"
        v-model:range-offset="focusDetailRangeOffset"
        data-testid="workbench-pomodoro-widget-focus-detail"
      />
      <FocusTrendChart
        v-else-if="section === 'focusTrend'"
        data-testid="workbench-pomodoro-widget-focus-trend"
      />
      <FocusTimelineChart
        v-else-if="section === 'focusTimeline'"
        data-testid="workbench-pomodoro-widget-focus-timeline"
      />
      <BestFocusTimeChart
        v-else
        data-testid="workbench-pomodoro-widget-best-focus-time"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BestFocusTimeChart from '@/components/pomodoro/stats/BestFocusTimeChart.vue';
import AnnualHeatmap from '@/components/pomodoro/stats/AnnualHeatmap.vue';
import FocusDetailSection from '@/components/pomodoro/stats/FocusDetailSection.vue';
import FocusTimelineChart from '@/components/pomodoro/stats/FocusTimelineChart.vue';
import FocusTrendChart from '@/components/pomodoro/stats/FocusTrendChart.vue';
import StatsOverview from '@/components/pomodoro/stats/StatsOverview.vue';
import type { WorkbenchPomodoroStatsWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const pomodoroConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchPomodoroStatsWidgetConfig;
});

const section = computed(() => pomodoroConfig.value.section ?? 'overview');
const focusDetailRange = ref<'today' | 'week' | 'month' | 'year'>('week');
const focusDetailRangeOffset = ref(0);
</script>

<style lang="scss" scoped>
.workbench-widget-pomodoro-stats {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-pomodoro-stats__content {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-pomodoro-stats__content > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.chart-card),
.workbench-widget-pomodoro-stats__content :deep(.heatmap-card),
.workbench-widget-pomodoro-stats__content :deep(.focus-detail-section) {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.stats-overview) {
  width: 100%;
  min-height: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.chart-header),
.workbench-widget-pomodoro-stats__content :deep(.chart-subtitle-row) {
  flex-shrink: 0;
  min-width: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.chart-container) {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.focus-trend-chart .chart-container),
.workbench-widget-pomodoro-stats__content :deep(.best-focus-time-chart .chart-container) {
  height: auto;
}

.workbench-widget-pomodoro-stats__content :deep(.focus-trend-chart canvas),
.workbench-widget-pomodoro-stats__content :deep(.best-focus-time-chart canvas) {
  width: 100% !important;
  height: 100% !important;
}

.workbench-widget-pomodoro-stats__content :deep(.focus-timeline-chart .timeline-container) {
  flex: 1;
  height: auto;
  min-height: 0;
}

.workbench-widget-pomodoro-stats__content :deep(.focus-timeline-chart .y-axis) {
  top: 1px;
  bottom: 20px;
  height: auto;
}

.workbench-widget-pomodoro-stats__content :deep(.focus-timeline-chart .x-axis) {
  flex-shrink: 0;
}
</style>
