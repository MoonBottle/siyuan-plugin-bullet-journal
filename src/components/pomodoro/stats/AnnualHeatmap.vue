<template>
  <div class="annual-heatmap chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').annualHeatmap }}</span>
      <div class="chart-controls">
        <button class="nav-btn" @click="prevYear">‹</button>
        <span class="nav-label">{{ yearLabel }}</span>
        <button class="nav-btn" @click="nextYear">›</button>
      </div>
    </div>
    <div class="heatmap-content">
      <div class="heatmap-grid">
        <div
          v-for="item in heatmapData"
          :key="item.date"
          class="heatmap-cell"
          :class="item.level"
          :title="`${item.date}: ${formatDuration(item.minutes)}`"
        />
      </div>
      <div class="heatmap-legend">
        <span class="legend-item level-0">0m</span>
        <span class="legend-item level-1">0-1h</span>
        <span class="legend-item level-2">1-3h</span>
        <span class="legend-item level-3">3-5h</span>
        <span class="legend-item level-4">>5h</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

const projectStore = useProjectStore();
const yearOffset = ref(0);

const yearRange = computed(() => {
  const y = dayjs().add(yearOffset.value, 'year');
  return {
    startDate: y.startOf('year').format('YYYY-MM-DD'),
    endDate: y.endOf('year').format('YYYY-MM-DD')
  };
});

const yearLabel = computed(() => {
  return dayjs().add(yearOffset.value, 'year').format('YYYY');
});

const focusByDay = computed(() => {
  const { startDate, endDate } = yearRange.value;
  return projectStore.getFocusMinutesByDateRange(startDate, endDate, '');
});

const heatmapData = computed(() => {
  const { startDate, endDate } = yearRange.value;
  const byDate = new Map<string, { minutes: number; level: string }>();
  let current = dayjs(startDate);
  const end = dayjs(endDate);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const d = current.format('YYYY-MM-DD');
    const mins = focusByDay.value.get(d) ?? 0;
    let level = 'level-0';
    if (mins > 5 * 60) level = 'level-4';
    else if (mins > 3 * 60) level = 'level-3';
    else if (mins > 60) level = 'level-2';
    else if (mins > 0) level = 'level-1';
    byDate.set(d, { minutes: mins, level });
    current = current.add(1, 'day');
  }

  // 纵向排列：14行，26列 (365/14 ≈ 26)
  // 第1列：1-1, 1-2, 1-3...1-14  第2列：1-15, 1-16...
  const numRows = 14;
  const numCols = 26;
  const cols: { date: string; minutes: number; level: string }[][] = [];
  
  for (let c = 0; c < numCols; c++) {
    cols.push([]);
  }
  
  const start = dayjs(startDate);
  const endD = dayjs(endDate);
  let cur = start;
  let dayIndex = 0;

  while (cur.isBefore(endD) || cur.isSame(endD, 'day')) {
    const d = cur.format('YYYY-MM-DD');
    const data = byDate.get(d) ?? { minutes: 0, level: 'level-0' };
    const colIndex = Math.floor(dayIndex / numRows);
    if (colIndex < numCols) {
      cols[colIndex].push({ date: d, ...data });
    }
    dayIndex++;
    cur = cur.add(1, 'day');
  }
  
  // 按列优先展开：第1列所有行，然后第2列所有行...
  const result: { date: string; minutes: number; level: string }[] = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (cols[c][r]) {
        result.push(cols[c][r]);
      }
    }
  }
  return result;
});

function prevYear() {
  yearOffset.value--;
}

function nextYear() {
  yearOffset.value++;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}
</script>

<style lang="scss" scoped>
.chart-card {
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .chart-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  padding: 4px 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.nav-label {
  font-size: 13px;
  min-width: 50px;
  text-align: center;
}

.heatmap-content {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 220px;
  overflow: hidden;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  grid-template-rows: repeat(14, minmax(0, 1fr));
  gap: 1px;
  flex: 1;
  height: 100%;
  max-height: 100%;
  aspect-ratio: 26 / 14;
}

.heatmap-cell {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 2px;
  transition: background 0.2s;

  &.level-0 {
    background: var(--b3-theme-surface-lighter);
  }

  &.level-1 {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2);
  }

  &.level-2 {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.5);
  }

  &.level-3 {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.75);
  }

  &.level-4 {
    background: var(--b3-theme-primary);
  }
}

.heatmap-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: var(--b3-border-radius);
  }

  &.level-0::before {
    background: var(--b3-theme-surface-lighter);
  }

  &.level-1::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2);
  }

  &.level-2::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.5);
  }

  &.level-3::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.75);
  }

  &.level-4::before {
    background: var(--b3-theme-primary);
  }
}
</style>
