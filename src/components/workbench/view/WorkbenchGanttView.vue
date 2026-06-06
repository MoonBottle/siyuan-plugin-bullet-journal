<template>
  <GanttTab
    embedded
    :view-mode="config.viewMode"
    :show-items="config.showItems"
    :start-date="config.startDate"
    :end-date="config.endDate"
    :group-id="config.groupId"
  />
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
