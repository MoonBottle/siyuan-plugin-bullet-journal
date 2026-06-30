<template>
  <div class="workbench-project-view">
    <ProjectTab
      embedded
      :group-id="config.groupId"
      :column-ratios="config.columnRatios"
      :item-status-filter="config.itemStatusFilter"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkbenchProjectViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import ProjectTab from '@/tabs/ProjectTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchProjectViewConfig)
</script>

<style scoped>
.workbench-project-view {
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
  padding-top: 8px;

  :deep(.project-workbench) {
    background: var(--b3-theme-surface);
  }
}
</style>
