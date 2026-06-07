<template>
  <div class="workbench-focus-workbench-view">
    <FocusWorkbenchTab
      :embedded="true"
      :view-config="viewConfig"
    />
  </div>
</template>

<script setup lang="ts">
import FocusWorkbenchTab from '@/tabs/FocusWorkbenchTab.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
}>()
</script>

<style scoped>
.workbench-focus-workbench-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
  padding: 16px;
}
</style>
