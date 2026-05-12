<template>
  <div class="hk-work-tab quadrant-tab">
    <div class="block__icons quadrant-toolbar">
      <div v-if="showHeaderTitle" class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconLayout"></use></svg>
        {{ t('quadrant').title }}
      </div>

      <SySelect
        v-if="groupOptions.length > 1"
        v-model="selectedGroupModel"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />

      <div class="quadrant-search">
        <svg class="quadrant-search__icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('todo').searchPlaceholder"
          class="quadrant-search__input"
        />
      </div>

      <span class="fn__flex-1 fn__space"></span>

      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        data-testid="quadrant-refresh-button"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        data-testid="quadrant-more-button"
        :aria-label="t('common').more"
        @click="handleMoreClick"
      >
        <svg><use xlink:href="#iconMore"></use></svg>
      </span>
    </div>

    <div class="quadrant-grid">
      <section
        v-for="(panel, index) in panels"
        :key="panel.id"
        class="quadrant-panel"
        :class="{ 'quadrant-panel--drag-over': dragEnabled && dragOverPanelId === panel.id }"
        data-testid="quadrant-panel"
        @dragover="handleQuadrantDragOver(panel.id, $event)"
        @dragleave="handleQuadrantDragLeave(panel.id, $event)"
        @drop="handleQuadrantDrop(panel.id, $event)"
      >
        <header class="quadrant-panel__header">
          <div class="quadrant-panel__header-main">
            <h2 class="quadrant-panel__title">{{ panel.title }}</h2>
            <span class="quadrant-panel__count">{{ panelCounts[index] }}</span>
          </div>
          <span
            class="block__icon b3-tooltips b3-tooltips__sw quadrant-panel__more"
            :data-testid="`quadrant-edit-button-${panel.id}`"
            :aria-label="t('common').more"
            @click="openQuadrantEditor(panel)"
          >
            <svg><use xlink:href="#iconMore"></use></svg>
          </span>
        </header>

        <div class="quadrant-panel__body">
          <TodoSidebarList
            :ref="instance => setSidebarRef(index, instance)"
            :items="quadrantAssignments[panel.id]"
            :has-any-items-raw="allFilteredItems.length > 0"
            :has-active-filters="Boolean(searchQuery.trim())"
            empty-state-mode="panel"
            :empty-state-title="t('quadrant').noTodos"
            preview-trigger-mode="click"
            :enable-drag="dragEnabled"
            :on-item-drag-start="handleItemDragStart"
            :on-item-drag-end="handleItemDragEnd"
            :on-item-preview-click="handleItemPreviewClick"
            display-mode="embedded"
          />
        </div>
      </section>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Menu } from 'siyuan';
import { getCurrentPlugin, useApp, usePlugin } from '@/main';
import { useProjectStore, useSettingsStore } from '@/stores';
import TodoSidebarList from '@/components/todo/TodoSidebarList.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import { DATA_REFRESH_CHANNEL, eventBus, Events } from '@/utils/eventBus';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { useQuadrantConfigStore } from '@/stores/quadrantConfigStore';
import { assignItemsToQuadrants } from '@/utils/quadrantEvaluator';
import { openQuadrantRuleDialog } from '@/components/quadrant/openQuadrantRuleDialog';
import { isDefaultPriorityQuadrantConfig } from '@/utils/quadrant';
import { updateBlockPriority } from '@/utils/fileUtils';
import type { QuadrantPanelConfig } from '@/types/quadrant';
import type { PriorityLevel } from '@/types/models';
import type { TodoSidebarDragPayload } from '@/components/todo/todoSidebarTypes';

const props = withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false,
});

const plugin = usePlugin() as any;
const app = useApp();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const quadrantConfigStore = useQuadrantConfigStore();

const selectedGroup = ref(settingsStore.defaultGroup || '');
const isSelectedGroupDefaultDriven = ref(true);
const searchQuery = ref('');
const sidebarRefs = ref<Array<InstanceType<typeof TodoSidebarList> | null>>([]);
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
});
const nativePreview = createNativeBlockPreviewController();
const showHeaderTitle = computed(() => !props.embedded);

const panels = computed(() => quadrantConfigStore.panels);
const dragEnabled = computed(() => isDefaultPriorityQuadrantConfig(panels.value));
const dragOverPanelId = ref<string | null>(null);
const draggedItem = ref<TodoSidebarDragPayload | null>(null);

const allFilteredItems = computed(() => {
  return projectStore.getFilteredAndSortedItems({
    groupId: selectedGroup.value,
    searchQuery: searchQuery.value,
  });
});

const quadrantAssignments = computed(() => {
  return assignItemsToQuadrants(allFilteredItems.value, panels.value);
});

const panelCounts = computed(() => {
  return panels.value.map(panel => quadrantAssignments.value[panel.id].length);
});

const groupOptions = computed(() => {
  const options = [{ value: '', label: t('settings').projectGroups.allGroups }];
  (settingsStore.groups || []).forEach((group) => {
    options.push({
      value: group.id,
      label: group.name || t('settings').projectGroups.unnamed,
    });
  });
  return options;
});

const selectedGroupModel = computed({
  get: () => selectedGroup.value,
  set: (value: string) => {
    selectedGroup.value = value;
    isSelectedGroupDefaultDriven.value = false;
  },
});

function openQuadrantEditor(panel: QuadrantPanelConfig) {
  openQuadrantRuleDialog({
    panel: JSON.parse(JSON.stringify(panel)),
    onSave: async (nextPanel) => {
      await quadrantConfigStore.savePanel(nextPanel.id, nextPanel);
    },
    onResetDefaults: async () => {
      await quadrantConfigStore.resetAll();
    },
  });
}

function setSidebarRef(index: number, instance: InstanceType<typeof TodoSidebarList> | null) {
  sidebarRefs.value[index] = instance;
}

function handleItemPreviewClick(payload: {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
}) {
  preview.showNow(payload);
}

function handleItemDragStart(_payload: TodoSidebarDragPayload, _event: DragEvent) {
  if (!dragEnabled.value) return;
  draggedItem.value = _payload;
  preview.setDragActive(true);
}

function handleItemDragEnd() {
  draggedItem.value = null;
  dragOverPanelId.value = null;
  preview.setDragActive(false);
}

function getPanelTargetPriority(panelId: string): PriorityLevel | undefined {
  switch (panelId) {
    case 'q1': return 'high';
    case 'q2': return 'medium';
    case 'q3': return 'low';
    case 'q4': return undefined;
    default: return undefined;
  }
}

function parseDragPayload(event: DragEvent): TodoSidebarDragPayload | null {
  const rawPayload = event.dataTransfer?.getData('application/json');
  if (!rawPayload) return null;

  try {
    const payload = JSON.parse(rawPayload) as TodoSidebarDragPayload;
    if (!payload?.blockId) return null;
    return payload;
  }
  catch {
    return null;
  }
}

function handleQuadrantDragOver(panelId: string, event: DragEvent) {
  if (!dragEnabled.value) return;
  const payload = draggedItem.value ?? parseDragPayload(event);
  if (!payload) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverPanelId.value = panelId;
}

function handleQuadrantDragLeave(panelId: string, event: DragEvent) {
  if (dragOverPanelId.value !== panelId) return;

  const currentTarget = event.currentTarget as HTMLElement | null;
  const relatedTarget = event.relatedTarget;
  if (currentTarget && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  dragOverPanelId.value = null;
}

async function handleQuadrantDrop(panelId: string, event: DragEvent) {
  if (!dragEnabled.value) return;

  event.preventDefault();

  const payload = draggedItem.value ?? parseDragPayload(event);
  dragOverPanelId.value = null;
  draggedItem.value = null;
  preview.setDragActive(false);
  if (!payload) return;

  const targetPriority = getPanelTargetPriority(panelId);
  if (payload.priority === targetPriority) return;

  const success = await updateBlockPriority(payload.blockId, targetPriority);
  if (!success || !plugin) {
    showMessage(t('common').actionFailed, 'error');
    return;
  }

  await plugin.requestDataRefresh?.({
    type: 'full',
    reason: 'quadrant-drop-update-priority',
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

function syncSelectedGroupWithDefault() {
  if (!isSelectedGroupDefaultDriven.value) {
    return;
  }

  selectedGroup.value = settingsStore.defaultGroup || '';
}

async function handleRefresh() {
  if (!plugin) return;
  await plugin.requestDataRefresh?.({
    type: 'full',
    reason: 'quadrant-tab:manual-refresh',
  });
  showMessage(t('common').dataRefreshed);
}

function handleMoreClick(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const menu = new Menu('bullet-journal-more-menu');

  const hideCompleted = projectStore.hideCompleted;
  menu.addItem({
    icon: hideCompleted ? 'iconEyeoff' : 'iconEye',
    label: hideCompleted ? t('todo').showCompleted : t('todo').hideCompleted,
    click: () => {
      projectStore.toggleHideCompleted();
    },
  });

  const hideAbandoned = projectStore.hideAbandoned;
  menu.addItem({
    icon: hideAbandoned ? 'iconEyeoff' : 'iconEye',
    label: hideAbandoned ? t('todo').showAbandoned : t('todo').hideAbandoned,
    click: () => {
      projectStore.toggleHideAbandoned();
    },
  });

  const showLinks = settingsStore.todoDock.showLinks;
  menu.addItem({
    icon: showLinks ? 'iconEyeoff' : 'iconEye',
    label: showLinks ? t('todo').hideLinks : t('todo').showLinks,
    click: () => {
      settingsStore.todoDock.showLinks = !settingsStore.todoDock.showLinks;
      settingsStore.saveToPlugin();
    },
  });

  const showReminderAndRecurring = settingsStore.todoDock.showReminderAndRecurring;
  menu.addItem({
    icon: showReminderAndRecurring ? 'iconEyeoff' : 'iconEye',
    label: showReminderAndRecurring
      ? t('todo').hideReminderRecurring
      : t('todo').showReminderRecurring,
    click: () => {
      settingsStore.todoDock.showReminderAndRecurring = !settingsStore.todoDock.showReminderAndRecurring;
      settingsStore.saveToPlugin();
    },
  });

  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  });
}

async function handleDataRefresh(payload?: Record<string, unknown>) {
  if (!plugin) return;

  const storeKeys = ['scanMode', 'directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(key => key in payload);

  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach((key) => {
      if (payload[key] !== undefined) {
        patch[key] = payload[key];
      }
    });
    if (Object.keys(patch).length > 0) {
      settingsStore.$patch(patch);
    }
  }
  else {
    settingsStore.loadFromPlugin();
  }

  syncSelectedGroupWithDefault();
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

  await nextTick();
}

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

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

onMounted(async () => {
  settingsStore.loadFromPlugin();
  syncSelectedGroupWithDefault();
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

  await quadrantConfigStore.loadConfig();

  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: payload => handleDataRefresh(payload),
      viewName: 'QuadrantTab',
    });
  }
  catch {
    // Ignore unsupported contexts.
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});

onUnmounted(() => {
  preview.dispose();
  nativePreview.close();
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);

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
});
</script>

<style lang="scss" scoped>
.quadrant-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.quadrant-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;

  .block__icon {
    opacity: 1;
  }
}

.quadrant-search {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 220px;
  padding: 6px 10px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
}

.quadrant-search__icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.quadrant-search__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--b3-theme-on-background);
}

.quadrant-grid {
  flex: 1;
  min-height: 0;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quadrant-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  overflow: hidden;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.quadrant-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.quadrant-panel__header-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.quadrant-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  min-width: 0;
}

.quadrant-panel__count {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  flex-shrink: 0;
}

.quadrant-panel__more {
  opacity: 1;

  svg {
    width: 14px;
    height: 14px;
  }
}

.quadrant-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.quadrant-panel--drag-over {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
}
</style>
