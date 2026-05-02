<template>
  <div class="workbench-widget-habit-week" data-testid="workbench-widget-habit-week">
    <HabitWeekBar :habits="habits" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import { useSafeProjectStore } from './useSafeProjectStore';

const projectStore = useSafeProjectStore();

const habits = computed(() => {
  return projectStore?.getHabits('') ?? [];
});
</script>

<style lang="scss" scoped>
.workbench-widget-habit-week {
  min-height: 0;
}
</style>
