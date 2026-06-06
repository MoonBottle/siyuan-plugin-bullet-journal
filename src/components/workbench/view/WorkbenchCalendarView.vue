<template>
  <CalendarTab
    embedded
    :default-view="config.defaultView"
    :group-id="config.groupId"
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
</script>
