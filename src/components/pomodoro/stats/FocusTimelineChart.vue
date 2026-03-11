<template>
  <div class="focus-timeline-chart chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').focusTimeline }}</span>
    </div>
    <div class="chart-controls">
      <button class="nav-btn" @click="prevWeek">‹</button>
      <span class="nav-label">{{ weekLabel }}</span>
      <button class="nav-btn" @click="nextWeek">›</button>
    </div>
    <div class="timeline-grid">
      <div class="timeline-y-labels">
        <div v-for="h in yLabels" :key="h" class="y-label">{{ h }}</div>
      </div>
      <div class="timeline-content">
        <div v-for="day in weekDays" :key="day.date" class="timeline-column">
          <div class="x-label">{{ day.label }}</div>
          <div class="timeline-cells">
            <div
              v-for="slot in hourlySlots"
              :key="slot"
              class="cell"
              :class="{ filled: getCellFocus(day.date, slot) > 0 }"
              :style="{ opacity: getCellOpacity(day.date, slot) }"
            />
          </div>
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
const weekOffset = ref(0);

const weekStart = computed(() => {
  return dayjs().add(weekOffset.value, 'week').startOf('week').add(1, 'day');
});

const weekLabel = computed(() => {
  if (weekOffset.value === 0) return t('pomodoroStats').week;
  return weekStart.value.format('YYYY-MM-DD');
});

const weekDays = computed(() => {
  const days: { date: string; label: string }[] = [];
  const dows = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 0; i < 7; i++) {
    const d = weekStart.value.add(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      label: dows[d.day()]
    });
  }
  return days;
});

const yLabels = computed(() => ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']);

const hourlySlots = computed(() => {
  const slots: number[] = [];
  for (let h = 0; h < 24; h++) slots.push(h);
  return slots;
});

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
  return mins > 0 ? Math.min(1, 0.3 + (mins / 60) * 0.7) : 0;
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
  margin-bottom: 12px;
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

.timeline-grid {
  display: flex;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.timeline-y-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  padding-top: 12px;
  padding-bottom: 12px;
}

.y-label {
  height: 20px;
}

.timeline-content {
  flex: 1;
  display: flex;
  gap: 4px;
  min-height: 0;
}

.timeline-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
}

.x-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 4px;
}

.timeline-cells {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.cell {
  flex: 1;
  min-height: 2px;
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  transition: opacity 0.2s;

  &.filled {
    background: var(--b3-theme-primary);
  }
}
</style>
