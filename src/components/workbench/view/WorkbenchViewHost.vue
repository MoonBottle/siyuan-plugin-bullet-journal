<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div v-if="viewType === 'todo'" class="workbench-view-host__surface" data-testid="workbench-view-todo">
      <DesktopTodoDock />
    </div>
    <div v-else-if="viewType === 'habit'" class="workbench-view-host__surface" data-testid="workbench-view-habit">
      <DesktopHabitDock />
    </div>
    <div v-else-if="viewType === 'quadrant'" class="workbench-view-host__surface" data-testid="workbench-view-quadrant">
      <QuadrantTab />
    </div>
    <div v-else-if="viewType === 'pomodoroStats'" class="workbench-view-host__surface" data-testid="workbench-view-pomodoro-stats">
      <PomodoroStatsTab />
    </div>
    <div
      v-else
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-unsupported"
    >
      {{ t('workbench').unsupportedView }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue';
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue';
import QuadrantTab from '@/tabs/QuadrantTab.vue';
import { t } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

const viewType = computed(() => props.entry.viewType);
</script>

<style lang="scss" scoped>
.workbench-view-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workbench-view-host__surface {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workbench-view-host__placeholder {
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}
</style>
