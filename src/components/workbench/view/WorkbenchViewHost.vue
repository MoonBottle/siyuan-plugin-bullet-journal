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
      <DesktopTodoDock
        :enable-workbench-preview="true"
        :view-config="entry.config"
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
      <ProjectTab
        :embedded="true"
        :view-config="entry.config"
        :on-update-config="handleProjectViewConfigUpdate"
      />
    </div>
    <div
      v-else-if="viewType === 'aiChat'"
      class="workbench-view-host__surface"
      data-testid="workbench-view-ai-chat"
    >
      <AiChatView :view-config="entry.config" />
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
import AiChatView from '@/components/workbench/view/AiChatView.vue'
import WorkbenchHabitView from '@/components/workbench/view/WorkbenchHabitView.vue'
import { t } from '@/i18n'
import { useWorkbenchStore } from '@/stores'
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue'
import FocusWorkbenchTab from '@/tabs/FocusWorkbenchTab.vue'
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue'
import ProjectTab from '@/tabs/ProjectTab.vue'
import QuadrantTab from '@/tabs/QuadrantTab.vue'

const props = defineProps<{
  entry: WorkbenchEntry
}>()

const workbenchStore = useWorkbenchStore()

async function handleProjectViewConfigUpdate(config: Record<string, unknown>) {
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
