<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div
      v-if="supportedView"
      class="workbench-view-host__placeholder"
      :data-testid="`workbench-view-${supportedView.testId}`"
    >
      {{ supportedView.title }}
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
import { t } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

type SupportedViewMeta = {
  title: string;
  testId: string;
};

const props = defineProps<{
  entry: WorkbenchEntry;
}>();

const viewType = computed(() => props.entry.viewType);

const supportedViewMap: Record<string, SupportedViewMeta> = {
  todo: {
    title: t('todo').title,
    testId: 'todo',
  },
  habit: {
    title: t('habit').title,
    testId: 'habit',
  },
  quadrant: {
    title: t('quadrant').title,
    testId: 'quadrant',
  },
  pomodoroStats: {
    title: t('pomodoroStats').statsTitle,
    testId: 'pomodoro-stats',
  },
};

const supportedView = computed<SupportedViewMeta | null>(() => {
  return viewType.value ? supportedViewMap[viewType.value] ?? null : null;
});
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
