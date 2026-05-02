<template>
  <div class="todo-widget-config-dialog">
    <div class="todo-widget-config-dialog__body">
      <TodoFilterBar
        :selected-group="selectedGroup"
        :search-query="searchQuery"
        :date-filter-type="dateFilterType"
        :selected-priorities="selectedPriorities"
        :start-date="startDate"
        :end-date="endDate"
        :show-sort-panel="false"
        :show-sort-trigger="false"
        :sort-rules="[]"
        :group-options="groupOptions"
        :date-filter-options="dateFilterOptions"
        :priority-options="priorityOptions"
        :sort-direction-options="[]"
        :available-field-options="getEmptyFieldOptions"
        @update:selected-group="selectedGroup = $event"
        @update:search-query="searchQuery = $event"
        @update:date-filter-type="dateFilterType = $event"
        @change:date-filter-type="handleDateFilterChange"
        @update:start-date="startDate = $event"
        @update:end-date="endDate = $event"
        @toggle-priority="togglePriority"
      />
    </div>

    <div class="todo-widget-config-dialog__footer">
      <div class="todo-widget-config-dialog__actions">
        <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
          {{ t('common').cancel }}
        </button>
        <button class="b3-button b3-button--text" type="button" @click="handleConfirm">
          {{ t('common').confirm }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TodoFilterBar from '@/components/todo/TodoFilterBar.vue';
import { useTodoViewState } from '@/composables/useTodoViewState';
import { t } from '@/i18n';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { useSettingsStore } from '@/stores';
import type { PriorityLevel } from '@/types/models';
import type { WorkbenchTodoListWidgetConfig } from '@/types/workbench';
import type { TodoDateFilterType } from '@/utils/todoDateFilter';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  initialConfig: WorkbenchTodoListWidgetConfig;
  onConfirm: (config: WorkbenchTodoListWidgetConfig) => void;
  onCancel: () => void;
}>();

const settingsStore = useSettingsStore();
const todoState = useTodoViewState({
  preset: props.initialConfig.preset,
  persistToSettings: false,
});

const selectedGroup = todoState.selectedGroup;
const searchQuery = todoState.searchQuery;
const selectedPriorities = todoState.selectedPriorities;
const dateFilterType = todoState.dateFilterType;
const startDate = todoState.startDate;
const endDate = todoState.endDate;

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
]);

const dateFilterOptions = [
  { value: 'today', label: t('todo.dateFilter.today') },
  { value: 'week', label: t('todo.dateFilter.thisWeek') },
  { value: 'all', label: t('todo.dateFilter.all') },
  { value: 'custom', label: t('todo.dateFilter.custom') },
];

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji },
];

function togglePriority(priority: PriorityLevel) {
  const index = selectedPriorities.value.indexOf(priority);
  if (index > -1) {
    selectedPriorities.value.splice(index, 1);
    return;
  }

  selectedPriorities.value.push(priority);
}

function handleDateFilterChange(type: TodoDateFilterType) {
  if (type !== 'custom') {
    return;
  }

  startDate.value = dayjs().format('YYYY-MM-DD');
  endDate.value = dayjs().add(7, 'day').format('YYYY-MM-DD');
}

function getEmptyFieldOptions() {
  return [];
}

function handleConfirm() {
  props.onConfirm({
    preset: {
      groupId: selectedGroup.value || undefined,
      searchQuery: searchQuery.value.trim() || undefined,
      dateFilterType: dateFilterType.value,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      priorities: selectedPriorities.value.length > 0
        ? [...selectedPriorities.value]
        : undefined,
    },
  });
}
</script>

<style lang="scss" scoped>
.todo-widget-config-dialog {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px 20px;
}

.todo-widget-config-dialog__body {
  padding: 0;
}

.todo-widget-config-dialog__body :deep(.todo-filter-bar) {
  padding: 0;
  background: transparent;
  border-radius: 0;
}

.todo-widget-config-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-border-color);
}

.todo-widget-config-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
