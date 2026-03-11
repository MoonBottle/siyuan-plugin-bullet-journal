<template>
  <div class="focus-detail-section">
    <div class="section-header">
      <h4 class="section-title">{{ t('pomodoroStats').focusDetail }}</h4>
      <div class="chart-controls">
        <select
          class="range-select"
          v-model="aggregateBy"
        >
          <option value="task">{{ t('pomodoroStats').byTask }}</option>
          <option value="item">{{ t('pomodoroStats').byItem }}</option>
        </select>
        <select
          class="range-select"
          :value="range"
          @change="(e) => { emit('update:range', (e.target as HTMLSelectElement).value as 'today' | 'week' | 'month'); emit('update:rangeOffset', 0); }"
        >
          <option value="today">{{ t('pomodoroStats').today }}</option>
          <option value="week">{{ t('pomodoroStats').week }}</option>
          <option value="month">{{ t('pomodoroStats').month }}</option>
        </select>
        <button class="nav-btn" @click="prevRange">‹</button>
        <span class="nav-label">{{ rangeLabel }}</span>
        <button class="nav-btn" @click="nextRange">›</button>
      </div>
    </div>

    <div class="detail-content">
      <div class="circle-chart-wrapper">
        <div class="circle-chart" :style="pieStyle">
          <div class="circle-center">
            <div class="center-value">{{ formatDuration(totalMinutes) }}</div>
            <div class="center-label">{{ t('pomodoroStats').focusDuration }}</div>
          </div>
        </div>
      </div>
      <div class="stats-list">
        <div
          v-for="(item, index) in groupedData"
          :key="item.groupKey"
          class="stats-item"
        >
          <div class="stats-item-header">
            <span class="stats-item-name">{{ item.groupLabel }}</span>
            <span class="stats-item-value">{{ formatDuration(item.minutes) }} {{ item.proportion.toFixed(2) }}%</span>
          </div>
          <div class="stats-item-bar">
            <div
              class="stats-item-progress"
              :style="{ width: item.proportion + '%', backgroundColor: getColor(index) }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProjectStore } from '@/stores';
import { aggregatePomodorosFromProjects, groupPomodorosByProject, groupPomodorosByTask, groupPomodorosByItem, type GroupedPomodoroStats } from '@/utils/pomodoroUtils';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  range: 'today' | 'week' | 'month';
  rangeOffset: number;
}>();

const emit = defineEmits<{
  'update:range': [value: 'today' | 'week' | 'month'];
  'update:rangeOffset': [value: number];
}>();

const aggregateBy = ref<'task' | 'item'>('task');

const projectStore = useProjectStore();

const rangeDates = computed(() => {
  const base = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  switch (props.range) {
    case 'today': {
      const d = base.add(props.rangeOffset, 'day');
      const s = d.format('YYYY-MM-DD');
      return { startDate: s, endDate: s };
    }
    case 'week': {
      const d = base.add(props.rangeOffset, 'week');
      start = d.startOf('week').add(1, 'day');
      end = d.endOf('week').add(1, 'day');
      break;
    }
    case 'month': {
      const d = base.add(props.rangeOffset, 'month');
      start = d.startOf('month');
      end = d.endOf('month');
      break;
    }
    default:
      return { startDate: base.format('YYYY-MM-DD'), endDate: base.format('YYYY-MM-DD') };
  }
  return { startDate: start!.format('YYYY-MM-DD'), endDate: end!.format('YYYY-MM-DD') };
});

const rangeLabel = computed(() => {
  if (props.range === 'today') {
    const d = dayjs().add(props.rangeOffset, 'day');
    if (props.rangeOffset === 0) return t('pomodoroStats').today;
    return d.format('YYYY-MM-DD');
  }
  if (props.range === 'week') {
    if (props.rangeOffset === 0) return t('pomodoroStats').week;
    const w = dayjs().add(props.rangeOffset, 'week');
    const start = w.startOf('week').add(1, 'day');
    const end = w.endOf('week').add(1, 'day');
    return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`;
  }
  if (props.range === 'month') {
    const d = dayjs().add(props.rangeOffset, 'month');
    return d.format('YYYY-M月');
  }
  return '';
});

const enrichedPomodoros = computed(() => aggregatePomodorosFromProjects(projectStore.projects));

const groupedData = computed<GroupedPomodoroStats[]>(() => {
  const { startDate, endDate } = rangeDates.value;
  if (aggregateBy.value === 'task') {
    return groupPomodorosByTask(enrichedPomodoros.value, startDate, endDate);
  }
  return groupPomodorosByItem(enrichedPomodoros.value, startDate, endDate);
});

const totalMinutes = computed(() => {
  return groupedData.value.reduce((s, g) => s + g.minutes, 0);
});

const pieStyle = computed(() => {
  const groups = groupedData.value;
  if (groups.length === 0 || totalMinutes.value <= 0) {
    return { background: 'var(--b3-theme-surface-lighter)' };
  }
  const colors = ['var(--b3-theme-primary)', '#81c784', '#64b5f6', '#ffb74d', '#ba68c8', '#f06292', '#4db6ac', '#ff8a65'];
  let acc = 0;
  const parts = groups.map((g, i) => {
    const pct = (g.minutes / totalMinutes.value) * 100;
    const start = acc;
    acc += pct;
    return `${colors[i % colors.length]} ${start}% ${acc}%`;
  });
  return {
    background: `conic-gradient(${parts.join(', ')})`
  };
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

const colors = ['var(--b3-theme-primary)', '#81c784', '#64b5f6', '#ffb74d', '#ba68c8', '#f06292', '#4db6ac', '#ff8a65'];

function getColor(index: number): string {
  return colors[index % colors.length];
}

function prevRange() {
  emit('update:rangeOffset', props.rangeOffset - 1);
}

function nextRange() {
  emit('update:rangeOffset', props.rangeOffset + 1);
}
</script>

<style lang="scss" scoped>
.focus-detail-section {
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0;
}

.range-select {
  padding: 4px 24px 4px 10px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  padding: 4px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 16px;
  cursor: pointer;
}

.nav-btn:hover {
  border-color: var(--b3-theme-primary);
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
  min-width: 80px;
  text-align: center;
}

.detail-content {
  display: flex;
  gap: 24px;
  align-items: center;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.circle-chart-wrapper {
  flex-shrink: 0;
}

.circle-chart {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-background);
  border-radius: 50%;
  width: 100px;
  height: 100px;

  .center-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .center-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    margin-top: 2px;
  }
}

.stats-list {
  max-width: 280px;
  flex: 1;
  height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.stats-item-name {
  color: var(--b3-theme-on-background);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.stats-item-value {
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
}

.stats-item-bar {
  height: 6px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;
  overflow: hidden;
}

.stats-item-progress {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

</style>
