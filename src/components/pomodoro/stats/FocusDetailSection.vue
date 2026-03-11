<template>
  <div class="focus-detail-section">
    <h4 class="section-title">{{ t('pomodoroStats').focusDetail }}</h4>

    <div class="detail-header">
      <div class="range-tabs">
        <button
          v-for="r in ['today', 'week', 'month']"
          :key="r"
          class="range-tab"
          :class="{ active: range === r }"
          @click="emit('update:range', r); emit('update:rangeOffset', 0)"
        >
          {{ r === 'today' ? t('pomodoroStats').today : r === 'week' ? t('pomodoroStats').week : t('pomodoroStats').month }}
        </button>
      </div>
      <div class="date-nav">
        <button class="nav-btn" @click="prevRange">‹</button>
        <span class="nav-label">{{ rangeLabel }}</span>
        <button class="nav-btn" @click="nextRange">›</button>
      </div>
    </div>

    <div class="detail-content">
      <div class="circle-chart-wrapper">
        <div class="circle-chart" :style="pieStyle">
          <div class="circle-center">{{ t('pomodoroStats').focusDuration }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import { aggregatePomodorosFromProjects, groupPomodorosByProject } from '@/utils/pomodoroUtils';
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

const groupedByProject = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  return groupPomodorosByProject(enrichedPomodoros.value, startDate, endDate);
});

const totalMinutes = computed(() => {
  return groupedByProject.value.reduce((s, g) => s + g.minutes, 0);
});

const pieStyle = computed(() => {
  const groups = groupedByProject.value;
  if (groups.length === 0 || totalMinutes.value <= 0) {
    return { background: 'var(--b3-theme-surface-lighter)' };
  }
  const colors = ['var(--b3-theme-primary)', '#81c784', '#64b5f6', '#ffb74d', '#ba68c8'];
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
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 12px 0;
}

.detail-header {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.range-tabs {
  display: flex;
  gap: 4px;
}

.range-tab {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.range-tab.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.date-nav {
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
  flex-wrap: wrap;
}

.circle-chart-wrapper {
  flex-shrink: 0;
}

.circle-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle-center {
  position: absolute;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-background);
  padding: 4px 8px;
  border-radius: var(--b3-border-radius);
}

</style>
