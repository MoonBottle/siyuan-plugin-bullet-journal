<template>
  <CalendarTab
    embedded
    :default-view="config.defaultView"
    :group-id="config.groupId"
    @update:default-view="handleChange('defaultView', $event)"
    @update:group-id="handleChange('groupId', $event)"
  />
</template>

<script setup lang="ts">
import type { WorkbenchCalendarViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import CalendarTab from '@/tabs/CalendarTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchCalendarViewConfig)

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
