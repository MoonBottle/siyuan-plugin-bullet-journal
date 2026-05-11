<template>
  <TodoSidebarList
    ref="todoSidebarListRef"
    :items="items"
    :selected-tags="selectedTags"
    :has-any-items-raw="hasAnyItemsRaw"
    :has-active-filters="hasActiveFilters"
    :loading="projectStore.loading"
    :display-mode="displayMode"
    :preview-trigger-mode="previewTriggerMode"
    :enable-drag="enableDrag"
    :on-item-drag-start="onItemDragStart"
    :on-item-drag-end="onItemDragEnd"
    :on-item-hover-start="onItemHoverStart"
    :on-item-hover-end="onItemHoverEnd"
    :on-item-preview-click="onItemPreviewClick"
    @add-tag-filter="emit('add-tag-filter', $event)"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TodoSortRule } from '@/settings';
import type { Item, PriorityLevel } from '@/types/models';
import { useProjectStore } from '@/stores';
import TodoSidebarList from '@/components/todo/TodoSidebarList.vue';
import type {
  TodoSidebarDragPayload,
  TodoSidebarHoverPayload,
  TodoSidebarPreviewTriggerMode,
} from './todoSidebarTypes';

export type {
  TodoSidebarDragPayload,
  TodoSidebarHoverPayload,
  TodoSidebarPreviewTriggerMode,
} from './todoSidebarTypes';

const props = withDefaults(defineProps<{
  groupId?: string;
  searchQuery?: string;
  selectedTags?: string[];
  sortRules?: TodoSortRule[];
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  includeNoPriority?: boolean;
  displayMode?: 'default' | 'embedded';
  previewTriggerMode?: TodoSidebarPreviewTriggerMode;
  enableDrag?: boolean;
  onItemDragStart?: (payload: TodoSidebarDragPayload, event: DragEvent) => void;
  onItemDragEnd?: (payload: TodoSidebarDragPayload, event: DragEvent) => void;
  onItemHoverStart?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void;
  onItemHoverEnd?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void;
  onItemPreviewClick?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void;
}>(), {
  groupId: '',
  searchQuery: '',
  selectedTags: () => [],
  sortRules: () => [],
  dateRange: null,
  priorities: () => [],
  includeNoPriority: false,
  displayMode: 'default',
  previewTriggerMode: 'hover',
  enableDrag: false,
  onItemDragStart: undefined,
  onItemDragEnd: undefined,
  onItemHoverStart: undefined,
  onItemHoverEnd: undefined,
  onItemPreviewClick: undefined,
});

const emit = defineEmits<{
  (event: 'add-tag-filter', value: string): void;
}>();

const projectStore = useProjectStore();
const todoSidebarListRef = ref<InstanceType<typeof TodoSidebarList> | null>(null);

const items = computed<Item[]>(() => {
  return projectStore.getFilteredAndSortedItems({
    groupId: props.groupId,
    searchQuery: props.searchQuery,
    selectedTags: props.selectedTags,
    dateRange: props.dateRange,
    priorities: props.priorities.length > 0 ? props.priorities : undefined,
    includeNoPriority: props.includeNoPriority,
    sortRules: props.sortRules.length > 0 ? props.sortRules : undefined,
  });
});

const hasAnyItemsRaw = computed(() => {
  return projectStore.getDisplayItems('').length > 0;
});

const hasActiveFilters = computed(() => {
  return Boolean(
    props.groupId
    || props.searchQuery?.trim()
    || props.selectedTags.length > 0
    || props.dateRange
    || props.priorities.length > 0
    || (props.includeNoPriority && hasAnyItemsRaw.value),
  );
});

const allCollapsed = computed(() => todoSidebarListRef.value?.allCollapsed ?? false);

function collapseAll() {
  todoSidebarListRef.value?.collapseAll();
}

function expandAll() {
  todoSidebarListRef.value?.expandAll();
}

function toggleCollapseAll() {
  todoSidebarListRef.value?.toggleCollapseAll();
}

defineExpose({
  collapseAll,
  expandAll,
  toggleCollapseAll,
  allCollapsed,
});
</script>
