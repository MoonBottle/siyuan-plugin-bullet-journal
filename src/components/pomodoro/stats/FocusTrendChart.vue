<template>
  <div class="focus-trend-chart chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').focusTrend }}</span>
      <span class="chart-subtitle">{{ t('pomodoroStats').dailyAverage }}: {{ formatDuration(dailyAvg) }}</span>
    </div>
    <div class="chart-controls">
      <select v-model="dimension" class="dimension-select">
        <option value="year">{{ t('pomodoroStats').year }}</option>
        <option value="month">{{ t('pomodoroStats').month }}</option>
        <option value="day">{{ t('pomodoroStats').day }}</option>
      </select>
      <div class="nav-btns">
        <button class="nav-btn" @click="prev">‹</button>
        <span class="nav-label">{{ navLabel }}</span>
        <button class="nav-btn" @click="next">›</button>
      </div>
    </div>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const projectStore = useProjectStore();
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const dimension = ref<'year' | 'month' | 'day'>('year');
const offset = ref(0);

const rangeDates = computed(() => {
  const base = dayjs();
  switch (dimension.value) {
    case 'year': {
      const y = base.add(offset.value, 'year');
      return {
        startDate: y.startOf('year').format('YYYY-MM-DD'),
        endDate: y.endOf('year').format('YYYY-MM-DD')
      };
    }
    case 'month': {
      const m = base.add(offset.value, 'month');
      return {
        startDate: m.startOf('month').format('YYYY-MM-DD'),
        endDate: m.endOf('month').format('YYYY-MM-DD')
      };
    }
    case 'day': {
      const d = base.add(offset.value, 'day');
      const s = d.format('YYYY-MM-DD');
      return { startDate: s, endDate: s };
    }
    default:
      return { startDate: base.format('YYYY-MM-DD'), endDate: base.format('YYYY-MM-DD') };
  }
});

const navLabel = computed(() => {
  switch (dimension.value) {
    case 'year':
      return dayjs().add(offset.value, 'year').format('YYYY');
    case 'month':
      return dayjs().add(offset.value, 'month').format('YYYY-M月');
    case 'day':
      return dayjs().add(offset.value, 'day').format('YYYY-MM-DD');
    default:
      return '';
  }
});

const chartData = computed(() => {
  const { startDate, endDate } = rangeDates.value;
  const byDay = projectStore.getFocusMinutesByDateRange(startDate, endDate, '');
  const result: { label: string; minutes: number }[] = [];

  if (dimension.value === 'year') {
    for (let m = 1; m <= 12; m++) {
      const monthStart = dayjs(startDate).month(m - 1).startOf('month');
      const monthEnd = monthStart.endOf('month');
      let total = 0;
      let current = monthStart;
      while (current.isBefore(monthEnd) || current.isSame(monthEnd, 'day')) {
        const d = current.format('YYYY-MM-DD');
        total += byDay.get(d) ?? 0;
        current = current.add(1, 'day');
      }
      result.push({ label: `${m}月`, minutes: total });
    }
  } else if (dimension.value === 'month') {
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const d = current.format('YYYY-MM-DD');
      result.push({
        label: current.format('D'),
        minutes: byDay.get(d) ?? 0
      });
      current = current.add(1, 'day');
    }
  } else {
    const all = projectStore.getAllPomodoros('');
    const dayPomodoros = all.filter(p => p.date === startDate);
    const byHour = new Map<number, number>();
    for (let h = 0; h < 24; h++) byHour.set(h, 0);
    for (const p of dayPomodoros) {
      const hour = parseInt(p.startTime.split(':')[0], 10);
      const mins = p.actualDurationMinutes ?? p.durationMinutes;
      byHour.set(hour, (byHour.get(hour) ?? 0) + mins);
    }
    for (let h = 0; h < 24; h++) {
      result.push({
        label: `${h.toString().padStart(2, '0')}:00`,
        minutes: byHour.get(h) ?? 0
      });
    }
  }
  return result;
});

const dailyAvg = computed(() => {
  const data = chartData.value;
  if (data.length === 0) return 0;
  const total = data.reduce((s, d) => s + d.minutes, 0);
  if (dimension.value === 'year') return Math.round(total / 365) || 0;
  if (dimension.value === 'month') return data.length > 0 ? Math.round(total / data.length) : 0;
  if (dimension.value === 'day') return total;
  return 0;
});

function prev() {
  offset.value--;
}

function next() {
  offset.value++;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function updateChart() {
  if (!chartCanvas.value) return;
  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.value.map(d => d.label),
      datasets: [{
        label: t('pomodoroStats').focusDuration,
        data: chartData.value.map(d => d.minutes),
        borderColor: 'var(--b3-theme-primary)',
        backgroundColor: 'rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v: number) => v + 'm'
          }
        }
      }
    }
  });
}

watch([chartData, dimension], updateChart);
onMounted(updateChart);
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>

<style lang="scss" scoped>
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

  .chart-subtitle {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    margin-left: 8px;
    opacity: 0.8;
  }
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.dimension-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.nav-btns {
  display: flex;
  align-items: center;
  gap: 4px;
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
  min-width: 60px;
  text-align: center;
}

.chart-container {
  height: 180px;
}
</style>
