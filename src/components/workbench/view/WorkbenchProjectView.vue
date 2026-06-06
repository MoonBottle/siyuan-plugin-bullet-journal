<template>
  <ProjectTab
    embedded
    :group-id="config.groupId"
    :column-ratios="config.columnRatios"
  />
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
