<template>
  <div
    ref="rootEl"
    class="fn__flex-1 todo-dock-content"
    :class="{ 'todo-dock-content--embedded': displayMode === 'embedded' }"
  >
    <TodoSidebar
      ref="todoSidebar"
      :group-id="groupId"
      :search-query="searchQuery"
      :sort-rules="sortRules"
      :date-range="dateRange"
      :completed-date-range="completedDateRange"
      :priorities="priorities"
      :display-mode="displayMode"
      :preview-trigger-mode="previewTriggerMode"
      :on-item-preview-click="onItemPreviewClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import type { TodoSortRule } from '@/settings';
import type { PriorityLevel } from '@/types/models';
import type { TodoDateRange } from '@/utils/todoDateFilter';
import type { TodoSidebarHoverPayload } from '@/components/todo/TodoSidebar.vue';

const props = withDefaults(defineProps<{
  groupId: string;
  searchQuery: string;
  sortRules?: TodoSortRule[];
  dateRange?: TodoDateRange | null;
  completedDateRange?: TodoDateRange | null;
  priorities: PriorityLevel[];
  displayMode?: 'default' | 'embedded';
  previewTriggerMode?: 'hover' | 'click';
  onItemPreviewClick?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void;
}>(), {
  dateRange: null,
  completedDateRange: null,
  displayMode: 'default',
  previewTriggerMode: 'hover',
});

const todoSidebar = ref<InstanceType<typeof TodoSidebar> | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const allCollapsed = computed(() => todoSidebar.value?.allCollapsed ?? false);

function toggleCollapseAll() {
  todoSidebar.value?.toggleCollapseAll();
}

function getScrollElement() {
  if (props.displayMode === 'embedded') {
    return rootEl.value?.querySelector('.todo-content') as HTMLElement | null;
  }

  return rootEl.value;
}

defineExpose({
  rootEl,
  getScrollElement,
  todoSidebar,
  allCollapsed,
  toggleCollapseAll,
});
</script>

<style lang="scss" scoped>
.todo-dock-content {
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  flex: 1;
  min-height: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.todo-dock-content--embedded {
  overflow: hidden;
  scrollbar-gutter: auto;
}
</style>
