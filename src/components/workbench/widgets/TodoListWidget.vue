<template>
  <div class="workbench-widget-todo-list" data-testid="workbench-widget-todo-list">
    <div class="workbench-widget-todo-list__meta">
      <span>{{ openItems.length }}</span>
      <span>{{ t('todo').title }}</span>
    </div>
    <ul v-if="previewItems.length" class="workbench-widget-todo-list__list">
      <li v-for="item in previewItems" :key="item.blockId || item.id" class="workbench-widget-todo-list__item">
        {{ item.content }}
      </li>
    </ul>
    <div v-else class="workbench-widget-todo-list__empty">
      {{ t('workbench').dashboardPlaceholder }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { useSafeProjectStore } from './useSafeProjectStore';

const projectStore = useSafeProjectStore();

const openItems = computed(() => {
  if (!projectStore) {
    return [];
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: '',
  }).filter(item => item.status !== 'completed' && item.status !== 'abandoned');
});

const previewItems = computed(() => {
  return openItems.value.slice(0, 5);
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

.workbench-widget-todo-list__list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--b3-theme-on-background);
}

.workbench-widget-todo-list__item {
  line-height: 1.5;
}

.workbench-widget-todo-list__empty {
  color: var(--b3-theme-on-surface);
}
</style>
