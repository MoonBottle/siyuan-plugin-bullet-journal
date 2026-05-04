<template>
  <div
    ref="widgetRootRef"
    class="workbench-widget-todo-list"
    data-testid="workbench-widget-todo-list"
  >
    <div class="workbench-widget-todo-list__meta">
      <span>{{ openItemsCount }}</span>
      <span>{{ t('todo').title }}</span>
    </div>
    <div class="workbench-widget-todo-list__search">
      <svg class="workbench-widget-todo-list__search-icon"><use xlink:href="#iconSearch"></use></svg>
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('todo').searchPlaceholder"
        class="workbench-widget-todo-list__search-input"
        data-testid="workbench-todo-widget-search"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="workbench-widget-todo-list__search-clear"
        data-testid="workbench-todo-widget-search-clear"
        @click="searchQuery = ''"
      >
        <svg><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>
    <div class="workbench-widget-todo-list__content" data-testid="workbench-todo-widget-content">
      <TodoContentPane
        ref="todoContentPaneRef"
        :group-id="todoState.selectedGroup.value"
        :search-query="searchQuery"
        :sort-rules="presetSortRules"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import TodoContentPane from '@/components/todo/TodoContentPane.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { useTodoViewState } from '@/composables/useTodoViewState';
import { t } from '@/i18n';
import { useApp, usePlugin } from '@/main';
import type { TodoSortRule } from '@/settings';
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
const widgetRootRef = ref<HTMLElement | null>(null);
let widgetScrollbarObserver: ResizeObserver | null = null;
const todoConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchTodoListWidgetConfig;
});
const todoState = useTodoViewState({
  preset: todoConfig.value.preset,
  persistToSettings: false,
});
const searchQuery = ref('');
const presetSortRules = computed<TodoSortRule[] | undefined>(() => {
  const sortRules = todoConfig.value.preset?.sortRules;
  return Array.isArray(sortRules) && sortRules.length > 0 ? sortRules : undefined;
});

const openItemsCount = computed(() => {
  if (!projectStore) {
    return 0;
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: todoState.selectedGroup.value,
    searchQuery: searchQuery.value,
    sortRules: presetSortRules.value,
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

function syncWidgetScrollbarGutter() {
  const hostEl = widgetRootRef.value;
  const scrollEl = todoContentPaneRef.value?.getScrollElement?.() as HTMLElement | null | undefined;
  if (!hostEl || !scrollEl) {
    return;
  }

  const gutterWidth = Math.max(0, scrollEl.offsetWidth - scrollEl.clientWidth);
  hostEl.style.setProperty('--todo-scrollbar-gutter-width', `${gutterWidth}px`);
}

const todoContentPaneRef = ref<InstanceType<typeof TodoContentPane> | null>(null);

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
  nextTick(() => {
    syncWidgetScrollbarGutter();
    const scrollEl = todoContentPaneRef.value?.getScrollElement?.() as HTMLElement | null | undefined;
    const contentEl = scrollEl?.firstElementChild as HTMLElement | null;
    widgetScrollbarObserver = new ResizeObserver(() => {
      syncWidgetScrollbarGutter();
    });
    if (scrollEl) {
      widgetScrollbarObserver.observe(scrollEl);
    }
    if (contentEl) {
      widgetScrollbarObserver.observe(contentEl);
    }
  });
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  widgetScrollbarObserver?.disconnect();
  widgetScrollbarObserver = null;
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

.workbench-widget-todo-list__search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: calc(100% - 16px - var(--todo-scrollbar-gutter-width, 0px));
  margin-left: 8px;
  box-sizing: border-box;
  padding: 6px 10px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  flex-shrink: 0;
}

.workbench-widget-todo-list__search-icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.workbench-widget-todo-list__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 13px;
  outline: none;
  color: var(--b3-theme-on-background);
}

.workbench-widget-todo-list__search-clear {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
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
