<template>
  <div class="pomodoro-stats-tab">
    <!-- 主 Tab：专注统计 / 按日统计 -->
    <div class="main-tabs">
      <button
        class="main-tab"
        :class="{ active: activeTab === 'focus' }"
        @click="activeTab = 'focus'"
      >
        {{ t('pomodoroStats').focusTab }}
      </button>
      <button
        class="main-tab"
        :class="{ active: activeTab === 'daily' }"
        @click="activeTab = 'daily'"
      >
        {{ t('pomodoroStats').dailyTab }}
      </button>
    </div>

    <!-- 日期筛选 -->
    <div class="stats-tab-header">
      <div class="range-tabs">
        <button
          v-for="r in rangeOptions"
          :key="r.value"
          class="range-tab"
          :class="{ active: range === r.value }"
          @click="range = r.value"
        >
          {{ r.label }}
        </button>
      </div>
      <label v-if="range === 'today'" class="unrecorded-toggle">
        <input v-model="showUnrecorded" type="checkbox" />
        显示未记录时间
      </label>
    </div>

    <!-- 汇总卡片 -->
    <div class="stats-summary">
      <div class="summary-item">
        <span class="summary-label">{{ t('pomodoroStats').totalFocus }}</span>
        <span class="summary-value">{{ formatDuration(totalMinutes) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t('pomodoroStats').pomodoroCount }}</span>
        <span class="summary-value">{{ totalCount }}</span>
      </div>
      <div v-if="range === 'today' && showUnrecorded" class="summary-item">
        <span class="summary-label">{{ t('pomodoroStats').unrecordedTime }}</span>
        <span class="summary-value">{{ formatDuration(unrecordedMinutes) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t('pomodoroStats').periodTotal }}</span>
        <span class="summary-value">{{ formatDuration(periodTotalMinutes) }}</span>
      </div>
    </div>

    <!-- 专注统计 Tab 内容 -->
    <template v-if="activeTab === 'focus'">
      <!-- 分组明细表 -->
      <div class="grouped-details">
        <h4 class="section-title">{{ t('pomodoroStats').groupedDetails }}</h4>
        <div v-if="groupedData.length === 0" class="chart-empty">{{ t('pomodoroStats').noData }}</div>
        <table v-else class="details-table">
          <thead>
            <tr>
              <th>{{ t('pomodoroStats').group }}</th>
              <th>{{ t('pomodoroStats').focus }}</th>
              <th>{{ t('pomodoroStats').pomodoroCount }}</th>
              <th>{{ t('pomodoroStats').proportion }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in groupedData" :key="row.groupKey">
              <td>{{ row.groupLabel }}</td>
              <td>{{ formatDuration(row.minutes) }}</td>
              <td>{{ row.count }}</td>
              <td>{{ row.proportion.toFixed(1) }}%</td>
            </tr>
            <tr v-if="range === 'today' && showUnrecorded && unrecordedMinutes > 0" class="unrecorded-row">
              <td>{{ t('pomodoroStats').unrecordedRow }}</td>
              <td>-</td>
              <td>-</td>
              <td>{{ unrecordedProportion.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 时间占比饼图（仅今日 + 未记录时间开启） -->
      <div v-if="range === 'today' && showUnrecorded && (totalMinutes > 0 || unrecordedMinutes > 0)" class="pie-section">
        <h4 class="section-title">时间占比</h4>
        <div class="pie-chart" :style="pieStyle">
          <div class="pie-legend">
            <span class="legend-item focus">专注 {{ formatDuration(totalMinutes) }}</span>
            <span class="legend-item unrecorded">未记录 {{ formatDuration(unrecordedMinutes) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 按日统计 Tab 内容 -->
    <template v-else>
      <div class="chart-container">
        <div v-if="chartData.length === 0" class="chart-empty">{{ t('pomodoroStats').noData }}</div>
        <div v-else class="chart-bars">
          <div
            v-for="item in chartData"
            :key="item.date"
            class="chart-bar-wrapper"
          >
            <div
              class="chart-bar"
              :style="{ height: barHeight(item.minutes) + '%' }"
            />
            <div class="chart-label">{{ formatDateLabel(item.date) }}</div>
          </div>
        </div>
        <div v-if="dailyTarget > 0 && maxMinutes > 0" class="chart-target-line" :style="{ bottom: targetLineBottom + '%' }">
          <span class="target-label">{{ t('pomodoroStats').target }} {{ dailyTarget }}m</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { defaultPomodoroSettings } from '@/settings';
import {
  aggregatePomodorosFromProjects,
  groupPomodorosByTask,
  type GroupedPomodoroStats
} from '@/utils/pomodoroUtils';

const projectStore = useProjectStore();
const plugin = usePlugin() as any;

type RangeType = 'today' | 'week' | 'month' | 'year';

const activeTab = ref<'focus' | 'daily'>('focus');
const range = ref<RangeType>('week');
const showUnrecorded = ref(false);

const rangeOptions = [
  { value: 'today' as RangeType, label: t('pomodoroStats').today },
  { value: 'week' as RangeType, label: t('pomodoroStats').week },
  { value: 'month' as RangeType, label: t('pomodoroStats').month },
  { value: 'year' as RangeType, label: t('pomodoroStats').year }
];

const rangeDates = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  switch (range.value) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'week': {
      const start = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');
      const end = dayjs().endOf('week').add(1, 'day').format('YYYY-MM-DD');
      return { startDate: start, endDate: end };
    }
    case 'month': {
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');
      return { startDate: start, endDate: end };
    }
    case 'year': {
      const start = dayjs().startOf('year').format('YYYY-MM-DD');
      const end = dayjs().endOf('year').format('YYYY-MM-DD');
      return { startDate: start, endDate: end };
    }
    default:
      return { startDate: today, endDate: today };
  }
});

const dailyTarget = computed(() => {
  const pomodoro = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
  return pomodoro?.dailyFocusTargetMinutes ?? 0;
});

const focusByDay = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  return projectStore.getFocusMinutesByDateRange(startDate, endDate, '');
});

const chartData = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  const result: { date: string; minutes: number }[] = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const mins = focusByDay.value.get(dateStr) ?? 0;
    result.push({ date: dateStr, minutes: mins });
    current = current.add(1, 'day');
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
});

const maxMinutes = computed(() => {
  const max = Math.max(...chartData.value.map(d => d.minutes), 1);
  return max;
});

const totalMinutes = computed(() => {
  return chartData.value.reduce((sum, d) => sum + d.minutes, 0);
});

const totalCount = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  const all = projectStore.getAllPomodoros('');
  return all.filter(p => p.date >= startDate && p.date <= endDate).length;
});

// 统计周期总时长（今日=24h，多日=天数*24h）
const periodTotalMinutes = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
  return days * 24 * 60;
});

// 未记录时间（仅今日：24h - 专注）
const unrecordedMinutes = computed(() => {
  if (range.value !== 'today') return 0;
  return Math.max(0, 24 * 60 - totalMinutes.value);
});

const unrecordedProportion = computed(() => {
  const total = 24 * 60;
  if (total <= 0) return 0;
  return (unrecordedMinutes.value / total) * 100;
});

// 分组明细（按任务）
const enrichedPomodoros = computed(() => {
  return aggregatePomodorosFromProjects(projectStore.projects);
});

const groupedData = computed((): GroupedPomodoroStats[] => {
  const { startDate, endDate } = rangeDates.value;
  return groupPomodorosByTask(enrichedPomodoros.value, startDate, endDate);
});

// 饼图样式（conic-gradient）
const pieStyle = computed(() => {
  const focus = totalMinutes.value;
  const unrecorded = unrecordedMinutes.value;
  const total = focus + unrecorded;
  if (total <= 0) return { background: 'var(--b3-theme-surface-lighter)' };
  const focusDeg = (focus / total) * 360;
  return {
    background: `conic-gradient(var(--b3-theme-primary) 0deg ${focusDeg}deg, var(--b3-theme-surface-lighter) ${focusDeg}deg 360deg)`
  };
});

const barHeight = (minutes: number) => {
  if (maxMinutes.value <= 0) return 0;
  return Math.min(100, (minutes / maxMinutes.value) * 100);
};

const targetLineBottom = computed(() => {
  if (dailyTarget.value <= 0 || maxMinutes.value <= 0) return 0;
  const pct = (dailyTarget.value / maxMinutes.value) * 100;
  return Math.min(95, pct);
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDateLabel(dateStr: string): string {
  const d = dayjs(dateStr);
  const today = dayjs();
  if (d.isSame(today, 'day')) return '今天';
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天';
  return d.format('MM-DD');
}
</script>

<style lang="scss" scoped>
.pomodoro-stats-tab {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.main-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.main-tab {
  padding: 8px 16px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.main-tab:hover {
  border-color: var(--b3-theme-primary);
}

.main-tab.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.stats-tab-header {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.unrecorded-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
}

.range-tabs {
  display: flex;
  gap: 8px;
}

.range-tab {
  padding: 6px 14px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.range-tab:hover {
  border-color: var(--b3-theme-primary);
}

.range-tab.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.stats-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .summary-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .summary-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-primary);
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 12px 0;
}

.grouped-details {
  margin-bottom: 24px;
}

.details-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
  }

  th {
    color: var(--b3-theme-on-surface);
    font-weight: 500;
  }

  td {
    color: var(--b3-theme-on-background);
  }

  .unrecorded-row {
    background: var(--b3-theme-surface);
  }
}

.pie-section {
  margin-bottom: 24px;
}

.pie-chart {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  margin-bottom: 12px;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.legend-item.focus {
  color: var(--b3-theme-primary);
}

.legend-item.unrecorded {
  color: var(--b3-theme-on-surface);
}

.chart-container {
  position: relative;
  min-height: 200px;
  padding: 16px 0;
}

.chart-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 180px;
  padding-bottom: 28px;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.chart-bar {
  width: 100%;
  max-width: 32px;
  min-height: 4px;
  background: var(--b3-theme-primary);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
}

.chart-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.chart-target-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--b3-theme-error);
  opacity: 0.6;
  pointer-events: none;

  .target-label {
    position: absolute;
    right: 0;
    top: -18px;
    font-size: 10px;
    color: var(--b3-theme-error);
  }
}
</style>
