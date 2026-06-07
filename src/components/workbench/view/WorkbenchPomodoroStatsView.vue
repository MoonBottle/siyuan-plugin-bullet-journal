<template>
  <div class="workbench-pomodoro-stats-view">
    <PomodoroStatsTab
      :embedded="true"
      :view-config="viewConfig"
    />
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
}
</style>
