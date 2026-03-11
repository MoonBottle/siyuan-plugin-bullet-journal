<template>
  <div class="focus-trend-chart chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').focusTrend }}</span>
      <div class="chart-controls">
        <DropdownSelect
          v-model="dimension"
          :options="dimensionOptions"
          class="dimension-dropdown"
        />
        <div class="nav-btns">
          <button class="nav-btn" @click="prev">‹</button>
          <span class="nav-label">{{ navLabel }}</span>
          <button class="nav-btn" @click="next">›</button>
        </div>
      </div>
    </div>
    <div class="chart-subtitle-row">
      {{ t('pomodoroStats').dailyAverage }}: {{ formatDuration(dailyAvg) }}
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
import { getThemePrimary, getChartTextColor, toRgba } from '@/utils/chartThemeUtils';
import { Chart, registerables } from 'chart.js';
import DropdownSelect from '@/components/common/DropdownSelect.vue';

Chart.register(...registerables);

const projectStore = useProjectStore();
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const dimension = ref<'year' | 'month' | 'week' | 'day'>('week');
const offset = ref(0);

const dimensionOptions = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '日', value: 'day' }
];

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
    case 'week': {
      const w = base.add(offset.value, 'week');
      return {
        startDate: w.startOf('week').add(1, 'day').format('YYYY-MM-DD'),
        endDate: w.endOf('week').add(1, 'day').format('YYYY-MM-DD')
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
    case 'week': {
      if (offset.value === 0) return t('pomodoroStats').week;
      if (offset.value === -1) return t('pomodoroStats').lastWeek;
      const w = dayjs().add(offset.value, 'week');
      const start = w.startOf('week').add(1, 'day');
      const end = w.endOf('week').add(1, 'day');
      return `${start.format('M月D日')} - ${end.format('M月D日')}`;
    }
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
  } else if (dimension.value === 'week') {
    const dows = ['一', '二', '三', '四', '五', '六', '日'];
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    let i = 0;
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const d = current.format('YYYY-MM-DD');
      result.push({
        label: dows[i],
        minutes: byDay.get(d) ?? 0
      });
      current = current.add(1, 'day');
      i++;
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
  if (dimension.value === 'month' || dimension.value === 'week') return data.length > 0 ? Math.round(total / data.length) : 0;
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
    chartInstance = null;
  }

  // 强制清除画布，防止残留线条叠加
  ctx.clearRect(0, 0, chartCanvas.value.width, chartCanvas.value.height);

  const containerEl = chartCanvas.value?.parentElement ?? null;
  const primaryColor = getThemePrimary(containerEl);
  const textColor = getChartTextColor(containerEl);
  const gridColor = toRgba(textColor, 0.3); // 适中透明度
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.value.map(d => d.label),
      datasets: [{
        label: t('pomodoroStats').focusDuration,
        data: chartData.value.map(d => d.minutes),
        borderColor: primaryColor,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: primaryColor,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: primaryColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, toRgba(primaryColor, 0.2));
          gradient.addColorStop(1, 'transparent');
          return gradient;
        },
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false, // 禁用默认 tooltip
          external: (context) => {
            const { chart, tooltip } = context;
            let tooltipEl = document.getElementById('chartjs-tooltip');

            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.id = 'chartjs-tooltip';
              tooltipEl.style.cssText = `
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
              document.body.appendChild(tooltipEl);
            }

            if (tooltip.opacity === 0) {
              tooltipEl.style.opacity = '0';
              return;
            }

            if (tooltip.body) {
              const dataIndex = tooltip.dataPoints[0].dataIndex;
              const item = chartData.value[dataIndex];
              let title = '';
              if (dimension.value === 'week' || dimension.value === 'month') {
                const { startDate } = rangeDates.value;
                const date = dayjs(startDate).add(dataIndex, 'day');
                title = date.format('M月D日');
              } else {
                title = item.label;
              }
              const duration = formatDuration(item.minutes);
              tooltipEl.innerHTML = `${title}<br/>${t('pomodoroStats').focusDuration}: ${duration}`;
            }

            const position = chart.canvas.getBoundingClientRect();
            tooltipEl.style.opacity = '1';
            tooltipEl.style.left = position.left + tooltip.caretX - tooltipEl.offsetWidth / 2 + 'px';
            tooltipEl.style.top = position.top + tooltip.caretY - tooltipEl.offsetHeight - 10 + 'px';
          }
        }
      },
      scales: {
        x: {
          grid: { 
            display: false,
          },
          ticks: {
            color: textColor,
            font: {
              size: 11,
              weight: 300
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { 
            display: false, // 彻底去掉横线
          },
          border: {
            display: false,
          },
          ticks: {
            display: false,
          }
        }
      }
    }
  });
}

let themeObserver: MutationObserver | null = null;
watch([chartData, dimension], updateChart);
onMounted(() => {
  updateChart();
  themeObserver = new MutationObserver(updateChart);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-color-scheme', 'style'] });
});
onUnmounted(() => {
  themeObserver?.disconnect();
  themeObserver = null;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const tooltipEl = document.getElementById('chartjs-tooltip');
  if (tooltipEl) {
    tooltipEl.remove();
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

.chart-subtitle-row {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  margin-bottom: 12px;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimension-dropdown {
  width: 60px;
}

.nav-btns {
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
  cursor: pointer;
  font-size: 14px;
  box-sizing: border-box;
}

.nav-btn:hover {
  background: var(--b3-theme-surface);
}

.nav-label {
  font-size: 13px;
  min-width: 80px;
  text-align: center;
  color: var(--b3-theme-on-surface);
}

.chart-container {
  height: 180px;
}
</style>
