<template>
  <div class="workbench-habit-view" data-testid="workbench-habit-view">
    <aside class="workbench-habit-view__sidebar">
      <div class="workbench-habit-view__sidebar-header">
        <template v-if="listMode === 'archived'">
          <button
            class="block__icon"
            data-testid="workbench-habit-back-active"
            :aria-label="t('habit').backToList"
            @click="showActiveHabits"
          >
            <svg
              @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('habit').backToList)"
              @mouseleave="hideIconTooltip"
            ><use xlink:href="#iconLeft"></use></svg>
          </button>
          <div class="workbench-habit-view__sidebar-title" data-testid="workbench-habit-archived-header">
            {{ t('habit').archivedList }}
          </div>
          <span class="fn__flex-1 fn__space"></span>
          <button
            class="block__icon"
            data-testid="workbench-habit-sidebar-refresh-button"
            :aria-label="t('common').refresh"
            @click="refreshHabits"
          >
            <svg
              @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('common').refresh)"
              @mouseleave="hideIconTooltip"
            ><use xlink:href="#iconRefresh"></use></svg>
          </button>
        </template>
        <template v-else>
          <div class="workbench-habit-view__sidebar-title" data-testid="workbench-habit-active-header">
            {{ t('habit').title }}
          </div>
          <span class="fn__flex-1 fn__space"></span>
          <button
            class="block__icon"
            data-testid="workbench-habit-sidebar-refresh-button"
            :aria-label="t('common').refresh"
            @click="refreshHabits"
          >
            <svg
              @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('common').refresh)"
              @mouseleave="hideIconTooltip"
            ><use xlink:href="#iconRefresh"></use></svg>
          </button>
          <button
            class="block__icon"
            data-testid="workbench-habit-open-archived"
            :aria-label="t('habit').viewArchived"
            @click="showArchivedHabits"
          >
            <svg
              @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('habit').viewArchived)"
              @mouseleave="hideIconTooltip"
            ><use xlink:href="#iconInbox"></use></svg>
          </button>
        </template>
      </div>

      <HabitWorkspaceListPane
        :selected-date="selectedDate"
        :current-date="currentDate"
        :habits="habits"
        :habit-stats-map="habitStatsMap"
        :habit-day-state-map="habitDayStateMap"
        :habit-period-state-map="habitPeriodStateMap"
        :active-habit-id="selectedHabit?.blockId"
        :archived-list="listMode === 'archived'"
        :empty-title="listMode === 'archived' ? t('habit').archivedEmptyTitle : ''"
        :empty-desc="listMode === 'archived' ? t('habit').archivedEmptyDesc : ''"
        item-open-behavior="detail"
        item-test-id-prefix="workbench-habit-item-"
        @update:selected-date="selectedDate = $event"
        @check-in="checkInHabit"
        @increment="incrementHabit"
        @select-habit="selectHabit"
      />
    </aside>

    <section class="workbench-habit-view__detail">
      <HabitWorkspaceDetailPane
        class="workbench-habit-view__detail-pane"
        :selected-habit="selectedHabit"
        :stats="displaySelectedStats"
        :current-date="currentDate"
        :view-month="selectedViewMonth"
        :empty-title="t('workbench').habitDetailEmptyTitle"
        :empty-desc="t('workbench').habitDetailEmptyDesc"
        header-test-id="workbench-habit-detail-header"
        content-test-id="workbench-habit-detail-content"
        empty-test-id="workbench-habit-empty-detail"
        refresh-button-test-id="workbench-habit-refresh-button"
        show-archive-action
        archive-button-test-id="workbench-habit-detail-archive"
        unarchive-button-test-id="workbench-habit-detail-unarchive"
        open-doc-button-test-id="workbench-habit-open-doc"
        record-preview-trigger-mode="preview"
        :on-record-preview-click="handleRecordPreviewClick"
        @refresh="refreshHabits"
        @archive="archiveSelectedHabit"
        @unarchive="unarchiveSelectedHabit"
        @open-doc="openSelectedHabitDoc"
        @update:view-month="selectedViewMonth = $event"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue';
import { useHabitWorkspace } from '@/composables/useHabitWorkspace';
import { t } from '@/i18n';
import { useApp, usePlugin } from '@/main';
import type { HabitRecordLogPreviewPayload } from '@/components/habit/HabitRecordLog.vue';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { showIconTooltip, hideIconTooltip } from '@/utils/dialog';

const plugin = usePlugin();
const app = useApp();
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
});
const nativePreview = createNativeBlockPreviewController();
const {
  listMode,
  selectedDate,
  selectedViewMonth,
  selectedHabit,
  currentDate,
  habits,
  habitStatsMap,
  habitDayStateMap,
  habitPeriodStateMap,
  displaySelectedStats,
  refreshHabits,
  showActiveHabits,
  showArchivedHabits,
  selectHabit,
  checkInHabit,
  incrementHabit,
  openSelectedHabitDoc,
  archiveSelectedHabit,
  unarchiveSelectedHabit,
} = useHabitWorkspace();

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
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin: () => plugin,
      onRefresh: () => handleDataRefresh(),
      viewName: 'WorkbenchHabitView',
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
.workbench-habit-view {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
}

.workbench-habit-view__sidebar,
.workbench-habit-view__detail {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  overflow: hidden;
}

.workbench-habit-view__sidebar {
  padding: 12px;
  gap: 8px;
}

.workbench-habit-view__sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workbench-habit-view__sidebar-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.workbench-habit-view__sidebar .block__icon {
  opacity: 1;
}

.workbench-habit-view__detail-pane {
  min-height: 0;
}
</style>
