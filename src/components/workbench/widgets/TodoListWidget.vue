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
        preview-trigger-mode="click"
        :on-item-preview-click="handleItemPreviewClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import TodoContentPane from '@/components/todo/TodoContentPane.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { useTodoViewState } from '@/composables/useTodoViewState';
import { t } from '@/i18n';
import { useApp, usePlugin } from '@/main';
import type { WorkbenchTodoListWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import type { TodoSidebarHoverPayload } from '@/components/todo/TodoSidebar.vue';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { useSafeProjectStore } from './useSafeProjectStore';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const app = useApp();
const plugin = usePlugin() as any;
const projectStore = useSafeProjectStore();
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
});
const nativePreview = createNativeBlockPreviewController();
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

function handleItemPreviewClick(payload: TodoSidebarHoverPayload) {
  preview.showNow(payload);
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!preview.isOpen.value) {
    return;
  }

  if (nativePreview.containsTarget(event.target)) {
    return;
  }

  preview.forceClose();
}

function handleNativePreviewDestroyed({
  initiatedByController,
  blockId,
  anchorEl,
}: {
  initiatedByController: boolean;
  blockId: string;
  anchorEl: HTMLElement;
}) {
  const activeBlockId = preview.activeBlockId.value;
  const activeItemId = preview.activeItemId.value;
  const activeAnchorEl = preview.anchorEl.value;

  if (activeBlockId !== blockId || activeAnchorEl !== anchorEl) {
    return;
  }

  preview.forceClose();

  if (
    initiatedByController
    || !activeBlockId
    || !activeItemId
    || !activeAnchorEl
    || !anchorEl.matches(':hover')
  ) {
    return;
  }

  preview.showNow({
    blockId: activeBlockId,
    itemId: activeItemId,
    anchorEl: activeAnchorEl,
  });
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
    if (!isOpen || !blockId || !anchorEl || !app) {
      nativePreview.close();
      return;
    }

    nativePreview.open({
      app,
      plugin,
      blockId,
      anchorEl,
      onHoverChange: preview.markPopoverHovered,
      onPanelDestroyed: handleNativePreviewDestroyed,
    });
  },
  {
    flush: 'post',
  },
);

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  nativePreview.close();
  preview.dispose();
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
