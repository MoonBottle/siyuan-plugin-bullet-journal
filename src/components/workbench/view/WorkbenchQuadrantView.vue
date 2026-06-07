<template>
  <div class="workbench-quadrant-view">
    <QuadrantTab
      :embedded="true"
      :view-config="viewConfig"
    />
  </div>
</template>

<script setup lang="ts">
import QuadrantTab from '@/tabs/QuadrantTab.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
}>()
</script>

<style scoped>
.workbench-quadrant-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
  padding: 8px;
}
</style>
