<template>
  <GanttTab
    embedded
    :view-mode="config.viewMode"
    :show-items="config.showItems"
    :start-date="config.startDate"
    :end-date="config.endDate"
    :group-id="config.groupId"
    @update:view-mode="handleChange('viewMode', $event)"
    @update:show-items="handleChange('showItems', $event)"
    @update:start-date="handleChange('startDate', $event)"
    @update:end-date="handleChange('endDate', $event)"
    @update:group-id="handleChange('groupId', $event)"
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
