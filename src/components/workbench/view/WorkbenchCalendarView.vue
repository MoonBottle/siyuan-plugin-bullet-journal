<template>
  <div class="workbench-calendar-view">
    <CalendarTab
      embedded
      :default-view="config.defaultView"
      :group-id="config.groupId"
    />
  </div>
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

<style scoped>
.workbench-calendar-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
}
</style>
