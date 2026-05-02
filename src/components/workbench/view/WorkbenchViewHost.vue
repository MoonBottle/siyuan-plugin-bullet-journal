<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div
      v-if="viewType === 'todo'"
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-todo"
    >
      Todo view host
    </div>
    <div
      v-else-if="viewType === 'habit'"
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-habit"
    >
      Habit view host
    </div>
    <div
      v-else-if="viewType === 'quadrant'"
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-quadrant"
    >
      Quadrant view host
    </div>
    <div
      v-else-if="viewType === 'pomodoroStats'"
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-pomodoro-stats"
    >
      Pomodoro Stats view host
    </div>
    <div
      v-else
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-unsupported"
    >
      Unsupported workbench view
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorkbenchEntry } from '@/types/workbench';

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

const viewType = computed(() => props.entry.viewType);
</script>

<style lang="scss" scoped>
.workbench-view-host {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workbench-view-host__placeholder {
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}
</style>
