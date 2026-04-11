<template>
  <div class="task-item-detail-wrapper">
    <MobileItemDetail
      :model-value="modelValue"
      :item="item"
      :disable-navigation="true"
      @update:model-value="$emit('update:modelValue', $event)"
      @open-pomodoro="$emit('openPomodoro', $event)"
      @set-reminder="$emit('setReminder', $event)"
      @set-recurring="$emit('setRecurring', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import MobileItemDetail from './MobileItemDetail.vue';
import type { Item } from '@/types/models';

defineProps<{
  modelValue: boolean;
  item: Item | null;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
  'openPomodoro': [item: Item];
  'setReminder': [item: Item];
  'setRecurring': [item: Item];
}>();
</script>

<style lang="scss" scoped>
// Higher z-index wrapper to show above TaskDetail (z-index: 1001)
.task-item-detail-wrapper {
  :deep(.drawer-overlay) {
    z-index: 1002;
  }
}
</style>
