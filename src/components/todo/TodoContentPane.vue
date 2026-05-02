<template>
  <div class="fn__flex-1 todo-dock-content">
    <TodoSidebar
      ref="todoSidebar"
      :group-id="groupId"
      :search-query="searchQuery"
      :date-range="dateRange"
      :completed-date-range="completedDateRange"
      :priorities="priorities"
      :display-mode="displayMode"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import type { PriorityLevel } from '@/types/models';
import type { TodoDateRange } from '@/utils/todoDateFilter';

const props = withDefaults(defineProps<{
  groupId: string;
  searchQuery: string;
  dateRange?: TodoDateRange | null;
  completedDateRange?: TodoDateRange | null;
  priorities: PriorityLevel[];
  displayMode?: 'default' | 'embedded';
}>(), {
  dateRange: null,
  completedDateRange: null,
  displayMode: 'default',
});

const todoSidebar = ref<InstanceType<typeof TodoSidebar> | null>(null);
const allCollapsed = computed(() => todoSidebar.value?.allCollapsed ?? false);

function toggleCollapseAll() {
  todoSidebar.value?.toggleCollapseAll();
}

defineExpose({
  todoSidebar,
  allCollapsed,
  toggleCollapseAll,
});
</script>

<style lang="scss" scoped>
.todo-dock-content {
  overflow: auto;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
