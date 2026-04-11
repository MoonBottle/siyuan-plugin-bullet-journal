<template>
  <MobileItemDetail
    :model-value="modelValue"
    :item="item"
    :disable-navigation="true"
    overlay-class="task-item-detail-overlay"
    @update:model-value="$emit('update:modelValue', $event)"
    @open-pomodoro="$emit('openPomodoro', $event)"
    @set-reminder="$emit('setReminder', $event)"
    @set-recurring="$emit('setRecurring', $event)"
    @refresh="$emit('refresh')"
  />
</template>

<script setup lang="ts">
import MobileItemDetail from '../item/MobileItemDetail.vue';
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
  'refresh': [];
}>();
</script>

<style lang="scss">
// Global style (no scoped) to override z-index
// Higher than TaskDetail (z-index: 1001)
.drawer-overlay.task-item-detail-overlay {
  z-index: 1002;
}
</style>
