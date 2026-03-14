<template>
  <div class="focus-detail-section">
    <div class="section-header">
      <h4 class="section-title">{{ t('pomodoroStats').focusDetail }}</h4>
      <div class="chart-controls">
        <SySelect
          v-model="aggregateBy"
          :options="aggregateOptions"
          class="range-dropdown"
        />
        <SySelect
          :model-value="range"
          :options="rangeOptions"
          class="range-dropdown"
          @update:model-value="(val) => { emit('update:range', val as 'today' | 'week' | 'month'); emit('update:rangeOffset', 0); }"
        />
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
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

const props = defineProps<{
  range: 'today' | 'week' | 'month' | 'year';
  rangeOffset: number;
}>();

const emit = defineEmits<{
  'update:range': [value: 'today' | 'week' | 'month' | 'year'];
  'update:rangeOffset': [value: number];
}>();

const aggregateBy = ref<'task' | 'item'>('task');

const aggregateOptions = computed(() => [
  { label: t('pomodoroStats').byTask, value: 'task' },
  { label: t('pomodoroStats').byItem, value: 'item' }
]);

const rangeOptions = computed(() => [
  { label: t('pomodoroStats').day, value: 'today' },
  { label: t('pomodoroStats').week, value: 'week' },
  { label: t('pomodoroStats').month, value: 'month' }
]);

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
      start = d.startOf('isoWeek');
      end = d.endOf('isoWeek');
      break;
    }
    case 'month': {
      const d = base.add(props.rangeOffset, 'month');
      start = d.startOf('month');
      end = d.endOf('month');
      break;
    }
    case 'year': {
      const y = base.add(props.rangeOffset, 'year');
      start = y.startOf('year');
      end = y.endOf('year');
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
    if (props.rangeOffset === 0) return t('pomodoroStats').thisWeek;
    if (props.rangeOffset === -1) return t('pomodoroStats').lastWeek;
    const w = dayjs().add(props.rangeOffset, 'week');
    const start = w.startOf('isoWeek');
    const end = w.endOf('isoWeek');
    const fmt = (t('pomodoroStats') as any).formatMonthDay ?? 'M/D';
    return `${start.format(fmt)} - ${end.format(fmt)}`;
  }
  if (props.range === 'month') {
    const d = dayjs().add(props.rangeOffset, 'month');
    const fmt = (t('pomodoroStats') as any).formatYearMonth ?? 'YYYY-MMM';
    return d.format(fmt);
  }
  if (props.range === 'year') {
    const y = dayjs().add(props.rangeOffset, 'year');
    return y.format('YYYY');
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

.range-dropdown {
  width: 80px;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  padding: 0 10px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  cursor: pointer;
  box-sizing: border-box;
  line-height: 1;
}

.nav-btn:hover {
  background: var(--b3-theme-surface);
}

.nav-label {
  font-size: 13px;
  font-weight: 400;
  min-width: 80px;
  text-align: center;
  color: var(--b3-theme-on-surface);
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
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    white-space: nowrap;
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
