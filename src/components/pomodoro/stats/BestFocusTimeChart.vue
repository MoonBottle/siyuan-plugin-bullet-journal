<template>
  <div class="best-focus-time-chart chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ t('pomodoroStats').bestFocusTime }}</span>
      <div class="chart-controls">
        <button class="nav-btn" @click="prevMonth">‹</button>
        <span class="nav-label">{{ monthLabel }}</span>
        <button class="nav-btn" @click="nextMonth">›</button>
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
import { groupByTimeSlot } from '@/utils/pomodoroUtils';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { getThemePrimary, getChartTextColor, toRgba, darkenColor } from '@/utils/chartThemeUtils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const projectStore = useProjectStore();
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const monthOffset = ref(0);

const monthRange = computed(() => {
  const m = dayjs().add(monthOffset.value, 'month');
  return {
    startDate: m.startOf('month').format('YYYY-MM-DD'),
    endDate: m.endOf('month').format('YYYY-MM-DD')
  };
});

const monthLabel = computed(() => {
  return dayjs().add(monthOffset.value, 'month').format('M月');
});

const chartData = computed(() => {
  const { startDate, endDate } = monthRange.value;
  const all = projectStore.getAllPomodoros('');
  const filtered = all.filter(p => p.date >= startDate && p.date <= endDate);
  const bySlot = groupByTimeSlot(filtered, 1);
  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  return labels.map(l => ({ label: l, minutes: bySlot.get(l) ?? 0 }));
});

function prevMonth() {
  monthOffset.value--;
}

function nextMonth() {
  monthOffset.value++;
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

  // 清除画布
  ctx.clearRect(0, 0, chartCanvas.value.width, chartCanvas.value.height);

  const containerEl = chartCanvas.value?.parentElement ?? null;
  const primaryColor = getThemePrimary(containerEl);
  const textColor = getChartTextColor(containerEl);
  const borderColor = darkenColor(primaryColor, 18);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.value.map(d => d.label),
      datasets: [{
        label: t('pomodoroStats').focusDuration,
        data: chartData.value.map(d => d.minutes),
        backgroundColor: primaryColor,
        borderColor,
        borderWidth: 1,
        borderRadius: 4
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
          enabled: false,
          external: (context) => {
            const { chart, tooltip } = context;
            let tooltipEl = document.getElementById('chartjs-bar-tooltip');

            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.id = 'chartjs-bar-tooltip';
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

            if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
              const dataIndex = tooltip.dataPoints[0].dataIndex;
              const item = chartData.value[dataIndex];
              const duration = formatDuration(item.minutes);
              tooltipEl.innerHTML = `${item.label}<br/>${t('pomodoroStats').focusDuration}: ${duration}`;
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
            drawTicks: false
          },
          ticks: {
            color: textColor,
            callback: function(value: number, index: number) {
              return index % 3 === 0 ? chartData.value[index]?.label : '';
            },
            maxRotation: 0,
            autoSkip: false
          },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            display: false
          },
          border: { display: false }
        }
      }
    }
  });
}

let themeObserver: MutationObserver | null = null;
watch(chartData, updateChart);
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
  const tooltipEl = document.getElementById('chartjs-bar-tooltip');
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
  min-width: 50px;
  text-align: center;
}

.chart-container {
  height: 180px;
}
</style>
