<template>
  <div class="workbench-widget-quadrant" data-testid="workbench-widget-quadrant">
    <div class="workbench-widget-quadrant__meta">
      <span>{{ openItemsCount }}</span>
      <span>{{ t(quadrant.titleKey) }}</span>
    </div>
    <div class="workbench-widget-quadrant__content" data-testid="workbench-widget-quadrant-content">
      <TodoSidebar
        :group-id="quadrantConfig.groupId ?? ''"
        :priorities="quadrant.priorities"
        :include-no-priority="quadrant.includeNoPriority"
        display-mode="embedded"
        preview-trigger-mode="click"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import { t } from '@/i18n';
import type { WorkbenchQuadrantWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { getQuadrantDefinition } from '@/utils/quadrant';
import { useSafeProjectStore } from './useSafeProjectStore';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const projectStore = useSafeProjectStore();
const quadrantConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchQuadrantWidgetConfig;
});
const quadrant = computed(() => getQuadrantDefinition(quadrantConfig.value.quadrant));

const openItemsCount = computed(() => {
  if (!projectStore) {
    return 0;
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: quadrantConfig.value.groupId ?? '',
    priorities: quadrant.value.priorities.length > 0 ? quadrant.value.priorities : undefined,
    includeNoPriority: quadrant.value.includeNoPriority,
  }).filter(item => item.status !== 'completed' && item.status !== 'abandoned').length;
});
</script>

<style lang="scss" scoped>
.workbench-widget-quadrant {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;

  span:first-child {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.workbench-widget-quadrant__content {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__content :deep(.todo-sidebar) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-content) {
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-list) {
  min-height: 0;
}
</style>
