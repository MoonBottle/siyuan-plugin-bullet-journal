<template>
  <div class="focus-timeline-chart chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').focusTimeline }}</span>
      <div class="chart-controls">
        <button class="nav-btn" @click="prevWeek">‹</button>
        <span class="nav-label">{{ weekLabel }}</span>
        <button class="nav-btn" @click="nextWeek">›</button>
      </div>
    </div>
    <div class="timeline-container">
      <!-- Y轴标签 -->
      <div class="y-axis">
        <div v-for="(label, index) in yLabels" :key="index" class="y-label" :class="{ hidden: index === 6 }">
          {{ label }}
        </div>
      </div>
      <!-- 热力图网格 -->
      <div class="heatmap-grid">
        <!-- 横向虚线 -->
        <div class="grid-lines">
          <div v-for="i in 7" :key="i" class="grid-line"></div>
        </div>
        <!-- 每天的数据列 -->
        <div v-for="day in weekDays" :key="day.date" class="day-column">
          <div
            v-for="hour in 24"
            :key="hour - 1"
            class="hour-cell"
            :class="{ filled: getCellFocus(day.date, hour - 1) > 0 }"
            :style="{ opacity: getCellOpacity(day.date, hour - 1) }"
            @mouseenter="(e) => showCellTooltip(e, day.date, hour - 1)"
            @mouseleave="hideTooltip"
          />
        </div>
      </div>
      <!-- X轴标签 -->
      <div class="x-axis">
        <div class="x-label-spacer"></div>
        <div v-for="day in weekDays" :key="day.date" class="x-label">{{ day.label }}</div>
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
const weekOffset = ref(0);

const weekStart = computed(() => {
  return dayjs().add(weekOffset.value, 'week').startOf('week').add(1, 'day');
});

const weekLabel = computed(() => {
  if (weekOffset.value === 0) return t('pomodoroStats').week;
  if (weekOffset.value === -1) return t('pomodoroStats').lastWeek;
  const start = weekStart.value;
  const end = start.add(6, 'day');
  return `${start.format('M月D日')} - ${end.format('M月D日')}`;
});

const weekDays = computed(() => {
  const days: { date: string; label: string }[] = [];
  const dows = ['一', '二', '三', '四', '五', '六', '日'];
  for (let i = 0; i < 7; i++) {
    const d = weekStart.value.add(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      label: dows[i]
    });
  }
  return days;
});

const yLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', ''];

const focusByDateHour = computed(() => {
  const map = new Map<string, number>();
  const all = projectStore.getAllPomodoros('');
  const start = weekStart.value.format('YYYY-MM-DD');
  const end = weekStart.value.add(6, 'day').format('YYYY-MM-DD');

  for (const p of all) {
    if (p.date < start || p.date > end) continue;
    const [h] = p.startTime.split(':').map(Number);
    const mins = p.actualDurationMinutes ?? p.durationMinutes;
    const key = `${p.date}-${h}`;
    map.set(key, (map.get(key) ?? 0) + mins);
  }
  return map;
});

const maxMinutes = computed(() => {
  let max = 0;
  focusByDateHour.value.forEach(v => { if (v > max) max = v; });
  return max || 1;
});

function getCellFocus(date: string, hour: number): number {
  return focusByDateHour.value.get(`${date}-${hour}`) ?? 0;
}

function getCellOpacity(date: string, hour: number): number {
  const mins = getCellFocus(date, hour);
  return mins > 0 ? Math.min(1, 0.5 + (mins / 60) * 0.5) : 0;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function getCellTooltip(date: string, hour: number): string {
  const timeStr = `${String(hour).padStart(2, '0')}:00`;
  const mins = getCellFocus(date, hour);
  return `${timeStr}<br/>${t('pomodoroStats').focusDuration}: ${formatDuration(mins)}`;
}

const TOOLTIP_ID = 'focus-timeline-tooltip';

function showCellTooltip(e: MouseEvent, date: string, hour: number) {
  const mins = getCellFocus(date, hour);
  if (mins === 0) return;

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

  tooltip.innerHTML = getCellTooltip(date, hour);
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

function prevWeek() {
  weekOffset.value--;
}

function nextWeek() {
  weekOffset.value++;
}
</script>

<style lang="scss" scoped>
.focus-timeline-chart {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

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
  min-width: 80px;
  text-align: center;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  height: 200px;
  position: relative;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 176px;
  position: absolute;
  left: 0;
  top: 1px;
  width: 40px;
}

.y-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  text-align: right;
  line-height: 1;
  height: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  &.hidden {
    visibility: hidden;
  }
}

.heatmap-grid {
  flex: 1;
  display: flex;
  margin-left: 50px;
  position: relative;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.grid-line {
  height: 1px;
  background-image: repeating-linear-gradient(
    to right,
    var(--b3-theme-surface-lighter) 0,
    var(--b3-theme-surface-lighter) 4px,
    transparent 4px,
    transparent 8px
  );
}

.day-column {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hour-cell {
  flex: 1;
  min-height: 2px;
  background: transparent;
  transition: opacity 0.2s;

  &.filled {
    background: var(--b3-theme-primary);
  }
}

.x-axis {
  display: flex;
  margin-left: 50px;
  margin-top: 4px;
}

.x-label-spacer {
  width: 0;
}

.x-label {
  flex: 1;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  text-align: center;
}
</style>
