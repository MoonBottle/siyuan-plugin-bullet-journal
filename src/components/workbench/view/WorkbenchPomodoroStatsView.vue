<template>
  <div class="workbench-pomodoro-stats-view">
    <div class="workbench-pomodoro-stats-view__scroll">
      <PomodoroStatsTab
        :embedded="true"
        :view-config="viewConfig"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
}>()
</script>

<style scoped>
.workbench-pomodoro-stats-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;

  :deep(.pomodoro-stats-tab) {
    padding: 16px;
  }
}

.workbench-pomodoro-stats-view__scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
</style>
