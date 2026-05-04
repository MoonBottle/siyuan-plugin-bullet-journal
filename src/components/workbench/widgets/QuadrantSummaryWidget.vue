<template>
  <div class="workbench-widget-quadrant" data-testid="workbench-widget-quadrant">
    <div class="workbench-widget-quadrant__meta">
      <span>{{ openItemsCount }}</span>
      <span>{{ t(quadrant.titleKey) }}</span>
    </div>
    <div class="workbench-widget-quadrant__content" data-testid="workbench-widget-quadrant-content">
      <TodoSidebar
        :group-id="quadrantConfig.groupId ?? ''"
        :priorities="quadrant.priorities"
        :include-no-priority="quadrant.includeNoPriority"
        display-mode="embedded"
        preview-trigger-mode="click"
        :on-item-preview-click="handleItemPreviewClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { t } from '@/i18n';
import { useApp, usePlugin } from '@/main';
import type { WorkbenchQuadrantWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { getQuadrantDefinition } from '@/utils/quadrant';
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

const quadrantConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchQuadrantWidgetConfig;
});
const quadrant = computed(() => getQuadrantDefinition(quadrantConfig.value.quadrant));

const openItemsCount = computed(() => {
  if (!projectStore) {
    return 0;
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: quadrantConfig.value.groupId ?? '',
    priorities: quadrant.value.priorities.length > 0 ? quadrant.value.priorities : undefined,
    includeNoPriority: quadrant.value.includeNoPriority,
  }).filter(item => item.status !== 'completed' && item.status !== 'abandoned').length;
});

function handleItemPreviewClick(payload: {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
}) {
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
.workbench-widget-quadrant {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__meta {
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

.workbench-widget-quadrant__content {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__content :deep(.todo-sidebar) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-content) {
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-list) {
  min-height: 0;
}
</style>
