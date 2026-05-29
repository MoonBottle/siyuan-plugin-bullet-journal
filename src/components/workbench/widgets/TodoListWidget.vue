<template>
  <div
    ref="widgetRootRef"
    class="workbench-widget-todo-list"
    data-testid="workbench-widget-todo-list"
  >
    <TodoFilterBar
      :selected-group="todoState.selectedGroup.value"
      :search-query="searchQuery"
      :tag-query="tagQuery"
      :selected-tags="selectedTags"
      :date-filter-type="todoState.dateFilterType.value"
      :selected-priorities="todoState.selectedPriorities.value"
      :start-date="todoState.startDate.value"
      :end-date="todoState.endDate.value"
      :show-sort-panel="showSortPanel"
      :sort-rules="sortRules"
      :group-options="groupOptions"
      :tag-options="tagOptions"
      :date-filter-options="dateFilterOptions"
      :priority-options="priorityOptions"
      :sort-direction-options="sortDirectionOptions"
      :available-field-options="availableFieldOptions"
      @update:selected-group="todoState.selectedGroup.value = $event"
      @update:search-query="searchQuery = $event"
      @update:tag-query="tagQuery = $event"
      @update:selected-tags="selectedTags = $event"
      @update:date-filter-type="onDateFilterChange"
      @change:date-filter-type="onDateFilterChange"
      @update:start-date="todoState.startDate.value = $event"
      @update:end-date="todoState.endDate.value = $event"
      @toggle-priority="togglePriority"
      @toggle-sort-panel="showSortPanel = !showSortPanel"
      @update-sort-field="updateSortField"
      @update-sort-direction="updateSortDirection"
      @move-sort-rule="moveSortRule"
      @remove-sort-rule="removeSortRule"
      @add-sort-rule="addSortRule"
      @reset-sort-rules="resetSortRules"
    />
    <div
      class="workbench-widget-todo-list__content"
      data-testid="workbench-todo-widget-content"
    >
      <TodoContentPane
        ref="todoContentPaneRef"
        :group-id="todoState.selectedGroup.value"
        :search-query="searchQuery"
        :selected-tags="selectedTags"
        :sort-rules="effectiveSortRules"
        :date-range="todoState.dateRange.value"
        :completed-date-range="todoState.completedDateRange.value"
        :priorities="todoState.selectedPriorities.value"
        display-mode="embedded"
        preview-trigger-mode="click"
        :on-item-preview-click="handleItemPreviewClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TodoSidebarHoverPayload } from '@/components/todo/TodoSidebar.vue'
import type {
  TodoSortDirection,
  TodoSortField,
  TodoSortRule,
} from '@/settings'
import type { PriorityLevel } from '@/types/models'
import type {
  WorkbenchTodoListWidgetConfig,
  WorkbenchWidgetInstance,
} from '@/types/workbench'
import type { TodoDateFilterType } from '@/utils/todoDateFilter'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import TodoContentPane from '@/components/todo/TodoContentPane.vue'
import TodoFilterBar from '@/components/todo/TodoFilterBar.vue'
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview'
import { useTodoViewState } from '@/composables/useTodoViewState'
import { t } from '@/i18n'
import {
  useApp,
  usePlugin,
} from '@/main'
import { PRIORITY_CONFIG } from '@/parser/priorityParser'
import { defaultTodoSortRules } from '@/settings'
import { useSettingsStore } from '@/stores'
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'
import { useSafeProjectStore } from './useSafeProjectStore'

const props = defineProps<{
  widget?: WorkbenchWidgetInstance
  onTitleMetaChange?: (value: string) => void
}>()

const app = useApp()
const plugin = usePlugin() as any
const projectStore = useSafeProjectStore()
const settingsStore = useSettingsStore()
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
})
const nativePreview = createNativeBlockPreviewController()
const widgetRootRef = ref<HTMLElement | null>(null)
let widgetScrollbarObserver: ResizeObserver | null = null
let unsubscribeDateRange: (() => void) | undefined
const todoConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchTodoListWidgetConfig
})
const todoState = useTodoViewState({
  preset: todoConfig.value.preset,
  persistToSettings: false,
})
const selectedTags = todoState.selectedTags
const searchQuery = ref('')
const tagQuery = ref('')
const showSortPanel = ref(false)

const sortRules = computed(() => {
  return settingsStore.todoDock.sortRules
})

const effectiveSortRules = computed<TodoSortRule[] | undefined>(() => {
  const presetRules = todoConfig.value.preset?.sortRules
  return Array.isArray(presetRules) && presetRules.length > 0 ? presetRules : undefined
})

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
  if (!projectStore) {
    return []
  }

  return projectStore.getTodoTagOptions(todoState.selectedGroup.value)
})
const groupOptions = computed(() => {
  const options = [{
    value: '',
    label: t('settings').projectGroups.allGroups,
  }]
  settingsStore.groups.forEach((g: any) => {
    options.push({
      value: g.id,
      label: g.name || t('settings').projectGroups.unnamed,
    })
  })
  return options
})

function onDateFilterChange(type: TodoDateFilterType) {
  todoState.dateFilterType.value = type
}

function togglePriority(priority: PriorityLevel) {
  const index = todoState.selectedPriorities.value.indexOf(priority)
  if (index > -1) {
    todoState.selectedPriorities.value.splice(index, 1)
  } else {
    todoState.selectedPriorities.value.push(priority)
  }
}

function persistSortRules(nextRules: TodoSortRule[]) {
  settingsStore.todoDock.sortRules = nextRules.length > 0
    ? nextRules
    : [...defaultTodoSortRules]
  settingsStore.saveToPlugin()
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
  persistSortRules(nextRules)
}

function updateSortDirection(index: number, value: string) {
  const nextRules = [...sortRules.value]
  nextRules[index] = {
    ...nextRules[index],
    direction: value as TodoSortDirection,
  }
  persistSortRules(nextRules)
}

function addSortRule() {
  const usedFields = new Set(sortRules.value.map((rule) => rule.field))
  const nextField = sortFieldOptions.find((option) => !usedFields.has(option.value))
  if (!nextField) return

  persistSortRules([
    ...sortRules.value,
    {
      field: nextField.value,
      direction: 'asc',
    },
  ])
}

function moveSortRule(index: number, delta: number) {
  const targetIndex = index + delta
  if (targetIndex < 0 || targetIndex >= sortRules.value.length) return

  const nextRules = [...sortRules.value];
  [nextRules[index], nextRules[targetIndex]] = [nextRules[targetIndex], nextRules[index]]
  persistSortRules(nextRules)
}

function removeSortRule(index: number) {
  if (sortRules.value.length <= 1) return
  const nextRules = sortRules.value.filter((_, ruleIndex) => ruleIndex !== index)
  persistSortRules(nextRules)
}

function resetSortRules() {
  persistSortRules([...defaultTodoSortRules])
}

watch(
  () => todoConfig.value.preset,
  (preset) => {
    todoState.selectedGroup.value = preset?.groupId ?? ''
    todoState.selectedPriorities.value = [...(preset?.priorities ?? [])]
    selectedTags.value = [...(preset?.selectedTags ?? [])]
    todoState.dateFilterType.value = preset?.dateFilterType ?? 'today'
    todoState.startDate.value = preset?.startDate ?? todoState.startDate.value
    todoState.endDate.value = preset?.endDate ?? todoState.endDate.value
  },
  {
    deep: true,
  },
)

const openItemsCount = computed(() => {
  if (!projectStore) {
    return 0
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: todoState.selectedGroup.value,
    searchQuery: searchQuery.value,
    selectedTags: selectedTags.value,
    sortRules: effectiveSortRules.value,
    dateRange: todoState.dateRange.value,
    priorities: todoState.selectedPriorities.value.length > 0
      ? todoState.selectedPriorities.value
      : undefined,
  }).filter((item) => item.status !== 'completed' && item.status !== 'abandoned').length
})

watch(
  openItemsCount,
  (count) => {
    props.onTitleMetaChange?.(`${count} 项`)
  },
  {
    immediate: true,
  },
)

function handleItemPreviewClick(payload: TodoSidebarHoverPayload) {
  preview.showNow(payload)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!preview.isOpen.value) {
    return
  }

  if (nativePreview.containsTarget(event.target)) {
    return
  }

  preview.forceClose()
}

function handleNativePreviewDestroyed({
  initiatedByController,
  blockId,
  anchorEl,
}: {
  initiatedByController: boolean
  blockId: string
  anchorEl: HTMLElement
}) {
  const activeBlockId = preview.activeBlockId.value
  const activeItemId = preview.activeItemId.value
  const activeAnchorEl = preview.anchorEl.value

  if (activeBlockId !== blockId || activeAnchorEl !== anchorEl) {
    return
  }

  preview.forceClose()

  if (
    initiatedByController
    || !activeBlockId
    || !activeItemId
    || !activeAnchorEl
    || !anchorEl.matches(':hover')
  ) {
    return
  }

  preview.showNow({
    blockId: activeBlockId,
    itemId: activeItemId,
    anchorEl: activeAnchorEl,
  })
}

const todoContentPaneRef = ref<InstanceType<typeof TodoContentPane> | null>(null)

function syncWidgetScrollbarGutter() {
  const hostEl = widgetRootRef.value
  const scrollEl = todoContentPaneRef.value?.getScrollElement?.() as HTMLElement | null | undefined
  if (!hostEl || !scrollEl) {
    return
  }

  const gutterWidth = Math.max(0, scrollEl.offsetWidth - scrollEl.clientWidth)
  hostEl.style.setProperty('--todo-scrollbar-gutter-width', `${gutterWidth}px`)
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
    if (!isOpen || !blockId || !anchorEl || !app) {
      nativePreview.close()
      return
    }

    nativePreview.open({
      app,
      plugin,
      blockId,
      anchorEl,
      onHoverChange: preview.markPopoverHovered,
      onPanelDestroyed: handleNativePreviewDestroyed,
    })
  },
  {
    flush: 'post',
  },
)

onMounted(() => {
  unsubscribeDateRange = eventBus.on(
    Events.WIDGET_DATE_RANGE_CHANGED,
    (payload: { sourceWidgetId: string, targetWidgetId: string, dateRange: { start: string, end: string } }) => {
      if (!props.widget || payload.targetWidgetId !== props.widget.id) return
      todoState.dateFilterType.value = 'custom'
      todoState.startDate.value = payload.dateRange.start
      todoState.endDate.value = payload.dateRange.end
    },
  )
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  nextTick(() => {
    syncWidgetScrollbarGutter()
    const scrollEl = todoContentPaneRef.value?.getScrollElement?.() as HTMLElement | null | undefined
    const contentEl = scrollEl?.firstElementChild as HTMLElement | null
    widgetScrollbarObserver = new ResizeObserver(() => {
      syncWidgetScrollbarGutter()
    })
    if (scrollEl) {
      widgetScrollbarObserver.observe(scrollEl)
    }
    if (contentEl) {
      widgetScrollbarObserver.observe(contentEl)
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  widgetScrollbarObserver?.disconnect()
  widgetScrollbarObserver = null
  nativePreview.close()
  unsubscribeDateRange?.()
  preview.dispose()
})
</script>

<style lang="scss" scoped>
.workbench-widget-todo-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
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
