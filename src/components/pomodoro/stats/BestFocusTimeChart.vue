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

function getThemeColor(): string {
  const root = document.documentElement;
  const style = window.getComputedStyle(root);
  const color = style.getPropertyValue('--b3-theme-primary').trim();
  return color || '#4285f4';
}

function updateChart() {
  if (!chartCanvas.value) return;
  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const primaryColor = getThemeColor();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.value.map(d => d.label),
      datasets: [{
        label: t('pomodoroStats').focusDuration,
        data: chartData.value.map(d => d.minutes),
        backgroundColor: primaryColor,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 8,
          cornerRadius: 4,
          titleFont: { size: 13 },
          bodyFont: { size: 13 },
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${item.dataset.label}: ${item.parsed.y}m`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.03)',
            drawBorder: false
          },
          ticks: {
            callback: function(value: number, index: number) {
              // 每3小时显示一个标签
              return index % 3 === 0 ? chartData.value[index]?.label : '';
            },
            maxRotation: 0,
            autoSkip: false,
            color: 'rgba(0, 0, 0, 0.4)'
          },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { display: false, drawBorder: false },
          ticks: {
            callback: (v: number) => v + 'm',
            color: 'rgba(0, 0, 0, 0.4)'
          },
          border: { display: false }
        }
      }
    }
  });
}

watch(chartData, updateChart);
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
