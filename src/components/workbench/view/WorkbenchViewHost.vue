<template>
  <div
    class="workbench-view-host"
    data-testid="workbench-view-host"
  >
    <div
      v-if="viewType === 'todo'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-todo"
    >
      <WorkbenchTodoView
        :view-config="entry.config"
        :on-update-config="handleViewConfigUpdate"
      />
    </div>
    <div
      v-else-if="viewType === 'habit'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-habit"
    >
      <WorkbenchHabitView :view-config="entry.config" />
    </div>
    <div
      v-else-if="viewType === 'quadrant'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-quadrant"
    >
      <QuadrantTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div
      v-else-if="viewType === 'pomodoroStats'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-pomodoro-stats"
    >
      <PomodoroStatsTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div
      v-else-if="viewType === 'focusWorkbench'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-focus-workbench"
    >
      <FocusWorkbenchTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div
      v-else-if="viewType === 'project'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-project"
    >
      <WorkbenchProjectView
        :view-config="entry.config"
        :on-update-config="handleViewConfigUpdate"
      />
    </div>
    <div
      v-else-if="viewType === 'calendar'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-calendar"
    >
      <WorkbenchCalendarView
        :view-config="entry.config"
        :on-update-config="handleViewConfigUpdate"
      />
    </div>
    <div
      v-else-if="viewType === 'gantt'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-gantt"
    >
      <WorkbenchGanttView
        :view-config="entry.config"
        :on-update-config="handleViewConfigUpdate"
      />
    </div>
    <div
      v-else-if="viewType === 'aiChat'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-ai-chat"
    >
      <WorkbenchAiChatView :view-config="entry.config" />
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
import type { WorkbenchEntry } from '@/types/workbench'
import { computed } from 'vue'
import WorkbenchAiChatView from '@/components/workbench/view/WorkbenchAiChatView.vue'
import WorkbenchCalendarView from '@/components/workbench/view/WorkbenchCalendarView.vue'
import WorkbenchGanttView from '@/components/workbench/view/WorkbenchGanttView.vue'
import WorkbenchHabitView from '@/components/workbench/view/WorkbenchHabitView.vue'
import WorkbenchProjectView from '@/components/workbench/view/WorkbenchProjectView.vue'
import WorkbenchTodoView from '@/components/workbench/view/WorkbenchTodoView.vue'
import { t } from '@/i18n'
import { useWorkbenchStore } from '@/stores'
import FocusWorkbenchTab from '@/tabs/FocusWorkbenchTab.vue'
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue'
import QuadrantTab from '@/tabs/QuadrantTab.vue'

const props = defineProps<{
  entry: WorkbenchEntry
}>()

const workbenchStore = useWorkbenchStore()

async function handleViewConfigUpdate(config: Record<string, unknown>) {
  await workbenchStore.updateViewConfig(props.entry.id, config)
}

const viewType = computed(() => props.entry.viewType)
</script>

<style lang="scss" scoped>
.workbench-view-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workbench-view-host__surface {
  flex: 1;
  min-width: 0;
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
