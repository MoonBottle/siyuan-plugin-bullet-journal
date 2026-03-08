<template>
  <div class="pomodoro-stats">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">今日番茄</div>
        <div class="stat-value">{{ todayCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日专注时长</div>
        <div class="stat-value">{{ formatDuration(todayMinutes) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总番茄</div>
        <div class="stat-value">{{ totalCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总专注时长</div>
        <div class="stat-value">{{ formatDuration(totalMinutes) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';

const projectStore = useProjectStore();

const todayCount = computed(() => projectStore.getTodayPomodoros('').length);
const todayMinutes = computed(() => projectStore.getTodayFocusMinutes(''));
const totalCount = computed(() => projectStore.getTotalPomodoros(''));
const totalMinutes = computed(() => projectStore.getTotalFocusMinutes(''));

/**
 * 格式化时长为可读字符串
 * 如：25m, 1h 30m, 10h 5m
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
</script>

<style lang="scss" scoped>
.pomodoro-stats {
  padding: 16px;
  background: var(--b3-theme-surface);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  padding: 12px 16px;
  text-align: left;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--b3-theme-surface-lighter);
}

.stat-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
  opacity: 0.8;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}
</style>
