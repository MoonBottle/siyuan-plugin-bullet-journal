<template>
  <WorkbenchConfigDialogLayout>
    <div class="todo-widget-config-dialog__body">
      <div class="todo-widget-config-dialog__field">
        <label class="todo-widget-config-dialog__label">
          标签
        </label>
        <TodoTagFilterInput
          v-model:tag-query="tagQuery"
          v-model:selected-tags="selectedTags"
          data-testid="todo-widget-tag-filter"
          :tag-options="tagOptions"
        />
      </div>
      <TodoFilterBar
        :selected-group="selectedGroup"
        search-query=""
        :date-filter-type="dateFilterType"
        :selected-priorities="selectedPriorities"
        :start-date="startDate"
        :end-date="endDate"
        :show-sort-panel="showSortPanel"
        :show-search="false"
        :sort-rules="sortRules"
        :group-options="groupOptions"
        :date-filter-options="dateFilterOptions"
        :priority-options="priorityOptions"
        :sort-direction-options="sortDirectionOptions"
        :available-field-options="availableFieldOptions"
        @update:selected-group="selectedGroup = $event"
        @update:date-filter-type="dateFilterType = $event"
        @changeDateFilterType="handleDateFilterChange"
        @update:start-date="startDate = $event"
        @update:end-date="endDate = $event"
        @togglePriority="togglePriority"
        @toggleSortPanel="showSortPanel = !showSortPanel"
        @updateSortField="updateSortField"
        @updateSortDirection="updateSortDirection"
        @moveSortRule="moveSortRule"
        @removeSortRule="removeSortRule"
        @addSortRule="addSortRule"
        @resetSortRules="resetSortRules"
      />
    </div>

    <template #footer>
      <div class="todo-widget-config-dialog__actions">
        <button
          class="b3-button b3-button--cancel"
          data-testid="todo-widget-config-cancel"
          type="button"
          @click="onCancel"
        >
          {{ t('common').cancel }}
        </button>
        <button
          class="b3-button b3-button--text"
          data-testid="todo-widget-config-confirm"
          type="button"
          @click="handleConfirm"
        >
          {{ t('common').confirm }}
        </button>
      </div>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import type {
  TodoSortDirection,
  TodoSortField,
  TodoSortRule,
} from '@/settings'
import type { PriorityLevel } from '@/types/models'
import type { WorkbenchTodoListWidgetConfig } from '@/types/workbench'
import type { TodoDateFilterType } from '@/utils/todoDateFilter'
import {
  computed,
  ref,
} from 'vue'
import TodoFilterBar from '@/components/todo/TodoFilterBar.vue'
import TodoTagFilterInput from '@/components/todo/TodoTagFilterInput.vue'
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue'
import { useTodoViewState } from '@/composables/useTodoViewState'
import { t } from '@/i18n'
import { PRIORITY_CONFIG } from '@/parser/priorityParser'
import { defaultTodoSortRules } from '@/settings'
import {
  useProjectStore,
  useSettingsStore,
} from '@/stores'
import dayjs from '@/utils/dayjs'

const props = defineProps<{
  initialConfig: WorkbenchTodoListWidgetConfig
  onConfirm: (config: WorkbenchTodoListWidgetConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const projectStore = useProjectStore()
const todoState = useTodoViewState({
  preset: props.initialConfig.preset,
  persistToSettings: false,
})

const selectedGroup = todoState.selectedGroup
const selectedPriorities = todoState.selectedPriorities
const selectedTags = todoState.selectedTags
const dateFilterType = todoState.dateFilterType
const startDate = todoState.startDate
const endDate = todoState.endDate
const tagQuery = ref('')
const showSortPanel = ref(false)
const sortRules = ref<TodoSortRule[]>(
  props.initialConfig.preset?.sortRules?.length
    ? props.initialConfig.preset.sortRules.map((rule) => ({ ...rule }))
    : [...defaultTodoSortRules],
)

const groupOptions = computed(() => [
  {
    value: '',
    label: t('settings').projectGroups.allGroups,
  },
  ...settingsStore.groups.map((group) => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
])

const dateFilterOptions = [
  {
    value: 'today',
    label: t('todo.dateFilter.today'),
  },
  {
    value: 'thisWeek',
    label: t('todo.dateFilter.thisWeek'),
  },
  {
    value: 'thisMonth',
    label: t('todo.dateFilter.thisMonth'),
  },
  {
    value: 'recent7',
    label: t('todo.dateFilter.recent7'),
  },
  {
    value: 'all',
    label: t('todo.dateFilter.all'),
  },
  {
    value: 'custom',
    label: t('todo.dateFilter.custom'),
  },
]

const priorityOptions = [
  {
    value: 'high' as PriorityLevel,
    emoji: PRIORITY_CONFIG.high.emoji,
  },
  {
    value: 'medium' as PriorityLevel,
    emoji: PRIORITY_CONFIG.medium.emoji,
  },
  {
    value: 'low' as PriorityLevel,
    emoji: PRIORITY_CONFIG.low.emoji,
  },
]

const sortFieldOptions = [
  {
    value: 'priority' as TodoSortField,
    label: t('todo.sortFields.priority'),
  },
  {
    value: 'time' as TodoSortField,
    label: t('todo.sortFields.time'),
  },
  {
    value: 'date' as TodoSortField,
    label: t('todo.sortFields.date'),
  },
  {
    value: 'reminderTime' as TodoSortField,
    label: t('todo.sortFields.reminderTime'),
  },
  {
    value: 'project' as TodoSortField,
    label: t('todo.sortFields.project'),
  },
  {
    value: 'task' as TodoSortField,
    label: t('todo.sortFields.task'),
  },
  {
    value: 'content' as TodoSortField,
    label: t('todo.sortFields.content'),
  },
]

const sortDirectionOptions = [
  {
    value: 'asc' as TodoSortDirection,
    label: t('todo.sortDirection.asc'),
  },
  {
    value: 'desc' as TodoSortDirection,
    label: t('todo.sortDirection.desc'),
  },
]

const tagOptions = computed(() => {
  return projectStore.getTodoTagOptions(selectedGroup.value)
})

function togglePriority(priority: PriorityLevel) {
  const index = selectedPriorities.value.indexOf(priority)
  if (index > -1) {
    selectedPriorities.value.splice(index, 1)
    return
  }

  selectedPriorities.value.push(priority)
}

function handleDateFilterChange(type: TodoDateFilterType) {
  if (type !== 'custom') {
    return
  }

  startDate.value = dayjs().format('YYYY-MM-DD')
  endDate.value = dayjs().add(7, 'day').format('YYYY-MM-DD')
}

function availableFieldOptions(index: number) {
  const usedFields = new Set(
    sortRules.value
      .filter((_, ruleIndex) => ruleIndex !== index)
      .map((rule) => rule.field),
  )

  return sortFieldOptions.filter((option) =>
    option.value === sortRules.value[index]?.field || !usedFields.has(option.value),
  )
}

function updateSortField(index: number, value: string) {
  const nextRules = [...sortRules.value]
  nextRules[index] = {
    ...nextRules[index],
    field: value as TodoSortField,
  }
  sortRules.value = nextRules
}

function updateSortDirection(index: number, value: string) {
  const nextRules = [...sortRules.value]
  nextRules[index] = {
    ...nextRules[index],
    direction: value as TodoSortDirection,
  }
  sortRules.value = nextRules
}

function addSortRule() {
  const usedFields = new Set(sortRules.value.map((rule) => rule.field))
  const nextField = sortFieldOptions.find((option) => !usedFields.has(option.value))
  if (!nextField) {
    return
  }

  sortRules.value = [
    ...sortRules.value,
    {
      field: nextField.value,
      direction: 'asc',
    },
  ]
}

function moveSortRule(index: number, delta: number) {
  const targetIndex = index + delta
  if (targetIndex < 0 || targetIndex >= sortRules.value.length) {
    return
  }

  const nextRules = [...sortRules.value];
  [nextRules[index], nextRules[targetIndex]] = [nextRules[targetIndex], nextRules[index]]
  sortRules.value = nextRules
}

function removeSortRule(index: number) {
  if (sortRules.value.length <= 1) {
    return
  }

  sortRules.value = sortRules.value.filter((_, ruleIndex) => ruleIndex !== index)
}

function resetSortRules() {
  sortRules.value = [...defaultTodoSortRules]
}

function handleConfirm() {
  props.onConfirm({
    preset: {
      groupId: selectedGroup.value || undefined,
      dateFilterType: dateFilterType.value,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      priorities: selectedPriorities.value.length > 0
        ? [...selectedPriorities.value]
        : undefined,
      selectedTags: selectedTags.value.length > 0
        ? [...selectedTags.value]
        : undefined,
      sortRules: sortRules.value.length > 0
        ? sortRules.value.map((rule) => ({ ...rule }))
        : undefined,
    },
  })
}
</script>

<style lang="scss" scoped>
.todo-widget-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.todo-widget-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 8px;
}

.todo-widget-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.todo-widget-config-dialog__body :deep(.todo-filter-card) {
  background: transparent;
  border-radius: 0;
}

.todo-widget-config-dialog__body :deep(.tag-search-row) {
  margin-bottom: 0;
}

.todo-widget-config-dialog__body :deep(.tag-search-box) {
  min-height: 32px;
  padding: 3px 10px;
}

.todo-widget-config-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
