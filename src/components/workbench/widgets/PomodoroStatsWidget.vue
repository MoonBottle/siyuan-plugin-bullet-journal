<template>
  <div class="workbench-widget-pomodoro-stats" data-testid="workbench-widget-pomodoro-stats">
    <div class="workbench-widget-pomodoro-stats__meta">
      <span>{{ pomodoroCount }}</span>
      <span>{{ t('pomodoroStats').statsTitle }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { useSafeProjectStore } from './useSafeProjectStore';

const projectStore = useSafeProjectStore();

const pomodoroCount = computed(() => {
  return projectStore?.getTotalPomodoros('') ?? 0;
});
</script>

<style lang="scss" scoped>
.workbench-widget-pomodoro-stats__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--b3-theme-on-surface);

  span:first-child {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}
</style>
