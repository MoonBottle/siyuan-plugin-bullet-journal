<template>
  <div class="workbench-widget-todo-list" data-testid="workbench-widget-todo-list">
    <div class="workbench-widget-todo-list__meta">
      <span>{{ openItemsCount }}</span>
      <span>{{ t('todo').title }}</span>
    </div>
    <div class="workbench-widget-todo-list__content" data-testid="workbench-todo-widget-content">
      <TodoContentPane
        :group-id="todoState.selectedGroup.value"
        :search-query="todoState.searchQuery.value"
        :date-range="todoState.dateRange.value"
        :completed-date-range="todoState.completedDateRange.value"
        :priorities="todoState.selectedPriorities.value"
        display-mode="embedded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TodoContentPane from '@/components/todo/TodoContentPane.vue';
import { useTodoViewState } from '@/composables/useTodoViewState';
import { t } from '@/i18n';
import type { WorkbenchTodoListWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { useSafeProjectStore } from './useSafeProjectStore';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const projectStore = useSafeProjectStore();
const todoConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchTodoListWidgetConfig;
});
const todoState = useTodoViewState({
  preset: todoConfig.value.preset,
  persistToSettings: false,
});

const openItemsCount = computed(() => {
  if (!projectStore) {
    return 0;
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: todoState.selectedGroup.value,
    searchQuery: todoState.searchQuery.value,
    dateRange: todoState.dateRange.value,
    priorities: todoState.selectedPriorities.value.length > 0
      ? todoState.selectedPriorities.value
      : undefined,
  }).filter(item => item.status !== 'completed' && item.status !== 'abandoned').length;
});
</script>

<style lang="scss" scoped>
.workbench-widget-todo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-todo-list__meta {
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

.workbench-widget-todo-list__content {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-todo-list__content :deep(.todo-dock-content) {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
