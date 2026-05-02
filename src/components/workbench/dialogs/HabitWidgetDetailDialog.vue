<template>
  <div class="habit-widget-detail-dialog">
    <HabitWorkspaceDetailPane
      :selected-habit="selectedHabit"
      :stats="displaySelectedStats"
      :current-date="currentDate"
      :view-month="selectedViewMonth"
      :empty-title="t('workbench').habitDetailEmptyTitle"
      :empty-desc="t('workbench').habitDetailEmptyDesc"
      header-test-id="habit-widget-detail-header"
      content-test-id="habit-widget-detail-content"
      empty-test-id="habit-widget-empty-detail"
      refresh-button-test-id="habit-widget-refresh-button"
      open-doc-button-test-id="habit-widget-open-doc"
      record-preview-trigger-mode="preview"
      :on-record-preview-click="handleRecordPreviewClick"
      @refresh="refreshHabits"
      @open-doc="openSelectedHabitDoc"
      @update:view-month="selectedViewMonth = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import { t } from '@/i18n';
import { getCurrentPlugin, useApp, usePlugin } from '@/main';
import type { HabitRecordLogPreviewPayload } from '@/components/habit/HabitRecordLog.vue';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';

const props = defineProps<{
  habitId: string;
  groupId?: string;
}>();

const app = useApp();
const plugin = usePlugin();
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
});
const nativePreview = createNativeBlockPreviewController();

const {
  selectedHabit,
  selectedViewMonth,
  currentDate,
  displaySelectedStats,
  refreshHabits,
  selectHabitById,
  openSelectedHabitDoc,
} = useHabitWorkspace({
  groupId: () => props.groupId,
});

function handleRecordPreviewClick(payload: HabitRecordLogPreviewPayload) {
  preview.showNow({
    blockId: payload.blockId,
    itemId: payload.blockId,
    anchorEl: payload.anchorEl,
  });
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

const handleDataRefresh = async () => {
  await refreshHabits();
};

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(() => {
  selectHabitById(props.habitId);
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: () => handleDataRefresh(),
      viewName: 'HabitWidgetDetailDialog',
    });
  }
  catch {
    // ignore
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannelGuard) {
    refreshChannelGuard.dispose();
    refreshChannelGuard = null;
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  nativePreview.close();
  preview.dispose();
});

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
</script>

<style scoped>
.habit-widget-detail-dialog {
  width: 100%;
  height: min(72vh, 760px);
  min-height: 420px;
}
</style>
