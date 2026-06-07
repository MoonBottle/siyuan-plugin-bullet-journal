<template>
  <div class="workbench-todo-view">
    <DesktopTodoDock
      embedded
      :enable-workbench-preview="true"
      :view-config="viewConfig"
    />
  </div>
</template>

<script setup lang="ts">
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()
</script>

<style scoped>
.workbench-todo-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);

  :deep(.todo-content) {
    padding: 0 8px 8px 8px;
  }
}
</style>
