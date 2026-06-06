<template>
  <ProjectTab
    embedded
    :group-id="config.groupId"
    :column-ratios="config.columnRatios"
    @update:group-id="handleChange('groupId', $event)"
    @update:column-ratios="handleChange('columnRatios', $event)"
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

let timer: ReturnType<typeof setTimeout> | null = null

function handleChange(key: string, value: unknown) {
  if (!props.onUpdateConfig) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    props.onUpdateConfig({
      ...props.viewConfig,
      [key]: value,
    })
    timer = null
  }, 300)
}
</script>
