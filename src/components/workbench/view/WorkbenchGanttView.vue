<template>
  <div class="workbench-gantt-view">
    <GanttTab
      embedded
      :view-mode="config.viewMode"
      :show-items="config.showItems"
      :date-preset="config.datePreset"
      :start-date="config.startDate"
      :end-date="config.endDate"
      :group-id="config.groupId"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkbenchGanttViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import GanttTab from '@/tabs/GanttTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchGanttViewConfig)
</script>

<style scoped>
.workbench-gantt-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
  padding: 0 16px 16px 16px;
}
</style>
