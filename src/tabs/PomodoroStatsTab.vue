<template>
  <div class="pomodoro-stats-tab">
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
    </div>

    <div class="stats-summary">
      <div class="summary-item">
        <span class="summary-label">总专注</span>
        <span class="summary-value">{{ formatDuration(totalMinutes) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">番茄数</span>
        <span class="summary-value">{{ totalCount }}</span>
      </div>
    </div>

    <div class="chart-container">
      <div v-if="chartData.length === 0" class="chart-empty">暂无数据</div>
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
        <span class="target-label">目标 {{ dailyTarget }}m</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import { defaultPomodoroSettings } from '@/settings';

const projectStore = useProjectStore();
const plugin = usePlugin() as any;

type RangeType = 'today' | 'week' | 'month';

const range = ref<RangeType>('week');

const rangeOptions = [
  { value: 'today' as RangeType, label: '今日' },
  { value: 'week' as RangeType, label: '本周' },
  { value: 'month' as RangeType, label: '本月' }
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

.stats-tab-header {
  margin-bottom: 16px;
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

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }
}

.stats-summary {
  display: flex;
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
