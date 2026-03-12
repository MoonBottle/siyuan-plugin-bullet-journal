<template>
  <div class="stats-overview">
    <div class="overview-card">
      <span class="card-label">{{ t('pomodoroStats').todayPomodoros }}</span>
      <span class="card-value">{{ todayCount }}</span>
      <span v-if="todayCountDiff !== null" class="card-diff positive">
        ↑ {{ t('pomodoroStats').moreThanYesterday }}{{ todayCountDiff > 0 ? todayCountDiff + '个' : '' }}
      </span>
    </div>
    <div class="overview-card">
      <span class="card-label">{{ t('pomodoroStats').totalPomodoros }}</span>
      <span class="card-value">{{ totalCount }}</span>
    </div>
    <div class="overview-card">
      <span class="card-label">{{ t('pomodoroStats').todayFocusDuration }}</span>
      <span class="card-value">{{ formatDuration(todayMinutes) }}</span>
      <span v-if="todayMinutesDiff !== null" class="card-diff positive">
        ↑ {{ t('pomodoroStats').moreThanYesterday }}{{ formatDuration(Math.abs(todayMinutesDiff)) }}
      </span>
    </div>
    <div class="overview-card">
      <span class="card-label">{{ t('pomodoroStats').totalFocusDuration }}</span>
      <span class="card-value">{{ formatDuration(totalMinutes) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

const projectStore = useProjectStore();

const today = dayjs().format('YYYY-MM-DD');
const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

const todayCount = computed(() => {
  const all = projectStore.getAllPomodoros('');
  return all.filter(p => p.date === today).length;
});

const totalCount = computed(() => {
  return projectStore.getTotalPomodoros('');
});

const todayMinutes = computed(() => {
  const byDay = projectStore.getFocusMinutesByDateRange(today, today, '');
  return byDay.get(today) ?? 0;
});

const totalMinutes = computed(() => {
  return projectStore.getTotalFocusMinutes('');
});

const yesterdayCount = computed(() => {
  const all = projectStore.getAllPomodoros('');
  return all.filter(p => p.date === yesterday).length;
});

const yesterdayMinutes = computed(() => {
  const byDay = projectStore.getFocusMinutesByDateRange(yesterday, yesterday, '');
  return byDay.get(yesterday) ?? 0;
});

const todayCountDiff = computed(() => {
  const diff = todayCount.value - yesterdayCount.value;
  return diff !== 0 ? diff : null;
});

const todayMinutesDiff = computed(() => {
  const diff = todayMinutes.value - yesterdayMinutes.value;
  return diff !== 0 ? diff : null;
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}
</script>

<style lang="scss" scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .stats-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.overview-card {
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  padding: 12px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--b3-theme-surface-lighter);

  .card-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-primary);
  }

  .card-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 6px;
    opacity: 0.8;
  }

  .card-diff {
    font-size: 11px;
    margin-top: 4px;

    &.positive {
      color: var(--b3-theme-success, #4caf50);
    }
  }
}
</style>
