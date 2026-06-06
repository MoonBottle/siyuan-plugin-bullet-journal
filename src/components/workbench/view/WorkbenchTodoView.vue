<template>
  <DesktopTodoDock
    embedded
    :enable-workbench-preview="true"
    :view-config="viewConfig"
  />
</template>

<script setup lang="ts">
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()
</script>
