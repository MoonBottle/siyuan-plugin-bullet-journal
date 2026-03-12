<template>
  <div ref="wrapperRef" class="annual-heatmap heatmap-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').annualHeatmap }}</span>
      <span v-if="summaryText" class="chart-summary">{{ summaryText }}</span>
    </div>
    <div class="heatmap-body">
      <div class="heatmap-week-labels">
        <span v-for="d in weekDayLabels" :key="d" class="week-label">{{ d }}</span>
      </div>
      <div class="heatmap-main">
        <div
          class="heatmap-months"
          :style="{ gridTemplateColumns: `repeat(${numCols}, ${CELL_SIZE}px)` }"
        >
          <span
            v-for="m in monthLabels"
            :key="m.key"
            class="month-label"
            :style="{ gridColumn: m.col }"
          >
            {{ m.label }}
          </span>
        </div>
        <div class="heatmap-grid-wrap">
          <div
            class="heatmap-grid"
            :style="{
              gridTemplateColumns: `repeat(${numCols}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`
            }"
          >
            <div
              v-for="cell in heatmapCells"
              :key="cell.key"
              class="heatmap-cell"
              :class="cell.level"
              @mouseenter="(e) => showCellTooltip(e, cell)"
              @mouseleave="hideTooltip"
            />
          </div>
          <div class="heatmap-legend-row">
            <div class="heatmap-legend">
              <span class="legend-text">{{ t('pomodoroStats').focusDuration }}</span>
              <span class="legend-item level-0">0m</span>
              <span class="legend-item level-1">0-1h</span>
              <span class="legend-item level-2">1-3h</span>
              <span class="legend-item level-3">3-5h</span>
              <span class="legend-item level-4">>5h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

const projectStore = useProjectStore();
const wrapperRef = ref<HTMLElement | null>(null);
const containerWidth = ref(800);

const GAP = 1;
const WEEK_LABEL_WIDTH = 24;
const CELL_SIZE = 12;

// 按格子数算：根据容器宽度计算可容纳的列数，尽量撑满
const numCols = computed(() => {
  const w = containerWidth.value - WEEK_LABEL_WIDTH - 36;
  const cellTotal = CELL_SIZE + GAP;
  const cols = Math.floor(w / cellTotal);
  return Math.max(52, Math.min(520, cols)); // 最少1年，最多10年
});

const dateRange = computed(() => {
  const end = dayjs();
  const weekStart = end.startOf('isoWeek').subtract(numCols.value - 1, 'week');
  return {
    startDate: weekStart.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD')
  };
});

// 参考 GitHub：只显示周一、周三、周五，不展示全部七个
const weekDayLabels = ['一', '', '三', '', '五', '', ''];

const monthLabels = computed(() => {
  const { startDate } = dateRange.value;
  const weekStart = dayjs(startDate).startOf('isoWeek');
  const labels: { key: string; label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let c = 0; c < numCols.value; c++) {
    const d = weekStart.add(c * 7, 'day');
    const month = d.month();
    if (month !== lastMonth) {
      lastMonth = month;
      labels.push({
        key: `m-${c}-${month}`,
        label: `${month + 1}月`,
        col: c + 1
      });
    }
  }
  return labels;
});

const focusByDay = computed(() => {
  const { startDate, endDate } = dateRange.value;
  return projectStore.getFocusMinutesByDateRange(startDate, endDate, '');
});

function getLevel(minutes: number): string {
  if (minutes > 5 * 60) return 'level-4';
  if (minutes > 3 * 60) return 'level-3';
  if (minutes > 60) return 'level-2';
  if (minutes > 0) return 'level-1';
  return 'level-0';
}

const heatmapCells = computed(() => {
  const { startDate, endDate } = dateRange.value;
  const weekStart = dayjs(startDate).startOf('isoWeek');
  const end = dayjs(endDate);
  const cells: { key: string; date: string; minutes: number; level: string }[] = [];

  // 按列优先生成数据，与 grid-auto-flow: column 对应
  for (let c = 0; c < numCols.value; c++) {
    for (let r = 0; r < 7; r++) {
      const d = weekStart.add(c * 7 + r, 'day');
      if (d.isAfter(end)) {
        cells.push({ key: `e-${c}-${r}`, date: '', minutes: 0, level: 'level-0' });
        continue;
      }
      const dateStr = d.format('YYYY-MM-DD');
      const mins = focusByDay.value.get(dateStr) ?? 0;
      cells.push({
        key: `${dateStr}`,
        date: dateStr,
        minutes: mins,
        level: getLevel(mins)
      });
    }
  }
  return cells;
});

const totalMinutes = computed(() => {
  let sum = 0;
  focusByDay.value.forEach((m) => (sum += m));
  return sum;
});

const summaryText = computed(() => {
  const m = totalMinutes.value;
  const { startDate, endDate } = dateRange.value;
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const daysDiff = end.diff(start, 'day');
  const weeks = Math.round(daysDiff / 7);

  let label: string;
  if (weeks >= 52) {
    const years = Math.round(weeks / 52);
    label = `过去 ${years} 年`;
  } else {
    label = `过去 ${weeks} 周`;
  }

  if (m < 60) return `${label}专注 ${m}m`;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return mins === 0 ? `${label}专注 ${h}h` : `${label}专注 ${h}h ${mins}m`;
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

const TOOLTIP_ID = 'annual-heatmap-tooltip';

function showCellTooltip(
  e: MouseEvent,
  cell: { date: string; minutes: number; level: string }
) {
  if (!cell.date) return;
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

  tooltip.innerHTML = `${cell.date}<br/>${t('pomodoroStats').focusDuration}: ${formatDuration(cell.minutes)}`;
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

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (wrapperRef.value) {
    containerWidth.value = wrapperRef.value.offsetWidth;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) containerWidth.value = w;
      }
    });
    resizeObserver.observe(wrapperRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver && wrapperRef.value) {
    resizeObserver.unobserve(wrapperRef.value);
    resizeObserver = null;
  }
});
</script>

<style lang="scss" scoped>
.heatmap-card {
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-shrink: 0;

  .chart-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .chart-summary {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }
}

.heatmap-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  justify-content: center;
  align-items: center;
}

.heatmap-week-labels {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-right: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  width: 14px;
  margin-top: 1px;
}

.week-label {
  height: 12px;
  line-height: 12px;
}

.heatmap-main {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.heatmap-months {
  display: grid;
  gap: 1px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 4px;
  flex-shrink: 0;
}

.month-label {
  text-align: center;
  white-space: nowrap;
}

.heatmap-grid-wrap {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.heatmap-legend-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}

.heatmap-grid {
  display: grid;
  gap: 1px;
  grid-auto-flow: column;
  flex-shrink: 0;
  width: fit-content;
}

.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
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
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
}

.legend-text {
  margin-right: 4px;
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
