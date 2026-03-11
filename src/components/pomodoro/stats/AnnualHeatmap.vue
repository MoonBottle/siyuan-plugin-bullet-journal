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
    <div class="heatmap-wrapper">
      <div class="heatmap-months">
        <span
          v-for="month in monthLabels"
          :key="month.index"
          class="month-label"
          :style="{ gridColumn: month.col }"
        >
          {{ month.label }}
        </span>
      </div>
      <div class="heatmap-content">
        <div class="heatmap-grid">
          <div
            v-for="item in heatmapData"
            :key="item.date"
            class="heatmap-cell"
            :class="item.level"
            @mouseenter="(e) => showCellTooltip(e, item)"
            @mouseleave="hideTooltip"
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

const monthLabels = computed(() => {
  const year = dayjs().add(yearOffset.value, 'year').year();
  const labels: { index: number; label: string; col: number }[] = [];
  const numRows = 14;
  const yearStart = dayjs(`${year}-01-01`);
  // 只显示 1、4、7、10 月
  const displayMonths = [0, 3, 6, 9]; // 0-based month index
  
  for (const m of displayMonths) {
    const monthStart = dayjs(`${year}-${String(m + 1).padStart(2, '0')}-01`);
    // 计算该月1日是一年中的第几天 (0-based)
    const dayOfYear = monthStart.diff(yearStart, 'day');
    const colIndex = Math.floor(dayOfYear / numRows) + 1; // 1-based for grid-column
    labels.push({
      index: m,
      label: `${m + 1}月`,
      col: colIndex
    });
  }
  return labels;
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

const TOOLTIP_ID = 'annual-heatmap-tooltip';

function showCellTooltip(e: MouseEvent, item: { date: string; minutes: number; level: string }) {
  let tooltip = document.getElementById(TOOLTIP_ID);
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s;
      line-height: 1.5;
    `;
    document.body.appendChild(tooltip);
  }

  tooltip.innerHTML = `${item.date}<br/>${t('pomodoroStats').focusDuration}: ${formatDuration(item.minutes)}`;
  tooltip.style.opacity = '1';

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  let top = rect.top - tooltipRect.height - 8;

  if (left < 8) left = 8;
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  if (top < 8) {
    top = rect.bottom + 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) {
    tooltip.style.opacity = '0';
  }
}
</script>

<style lang="scss" scoped>
.chart-card {
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

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
  padding: 2px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.nav-label {
  font-size: 13px;
  min-width: 40px;
  text-align: center;
}

.heatmap-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
}

.heatmap-months {
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  gap: 1px;
  padding-right: 60px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.month-label {
  text-align: left;
  padding-left: 2px;
  white-space: nowrap;
}

.heatmap-content {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  grid-template-rows: repeat(14, 1fr);
  gap: 2px;
  flex: 1;
  height: auto;
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
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.38);
  }

  &.level-2 {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.58);
  }

  &.level-3 {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.82);
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
    border-radius: 2px;
  }

  &.level-0::before {
    background: var(--b3-theme-surface-lighter);
  }

  &.level-1::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.38);
  }

  &.level-2::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.58);
  }

  &.level-3::before {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.82);
  }

  &.level-4::before {
    background: var(--b3-theme-primary);
  }
}
</style>
