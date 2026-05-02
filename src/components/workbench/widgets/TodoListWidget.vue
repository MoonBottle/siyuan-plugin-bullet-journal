<template>
  <div class="workbench-widget-todo-list" data-testid="workbench-widget-todo-list">
    <div class="workbench-widget-todo-list__meta">
      <span>{{ openItemsCount }}</span>
      <span>{{ t('todo').title }}</span>
    </div>
    <TodoContentPane
      :group-id="todoState.selectedGroup.value"
      :search-query="todoState.searchQuery.value"
      :date-range="todoState.dateRange.value"
      :completed-date-range="todoState.completedDateRange.value"
      :priorities="todoState.selectedPriorities.value"
      :max-items="previewCount"
      display-mode="embedded"
    />
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
const previewCount = computed(() => {
  const value = Number(todoConfig.value.previewCount ?? 5);
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.min(Math.max(Math.round(value), 1), 20);
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
  min-height: 0;
}

.workbench-widget-todo-list__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--b3-theme-on-surface);

  span:first-child {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}
</style>
