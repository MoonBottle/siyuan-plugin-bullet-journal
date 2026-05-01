<template>
  <div class="hk-work-tab quadrant-tab">
    <div class="block__icons quadrant-toolbar">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconGrid"></use></svg>
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
        v-for="(quadrant, index) in quadrants"
        :key="quadrant.key"
        class="quadrant-panel"
        :class="{ 'quadrant-panel--drop-active': activeDropQuadrant === quadrant.key }"
        data-testid="quadrant-panel"
        @dragover="handleQuadrantDragOver($event, quadrant)"
        @dragleave="handleQuadrantDragLeave($event, quadrant.key)"
        @drop="handleQuadrantDrop($event, quadrant)"
      >
        <header class="quadrant-panel__header">
          <h2 class="quadrant-panel__title">{{ t(quadrant.titleKey) }}</h2>
          <span class="quadrant-panel__count">{{ panelCounts[index] }}</span>
        </header>

        <div class="quadrant-panel__body">
          <TodoSidebar
            :ref="instance => setSidebarRef(index, instance)"
            :group-id="selectedGroup"
            :search-query="searchQuery"
            :priorities="quadrant.priorities"
            :include-no-priority="quadrant.includeNoPriority"
            :enable-drag="true"
            :on-item-drag-start="handleItemDragStart"
            :on-item-drag-end="handleItemDragEnd"
            display-mode="embedded"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { Menu } from 'siyuan';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { PriorityLevel } from '@/types/models';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import { DATA_REFRESH_CHANNEL, eventBus, Events } from '@/utils/eventBus';
import { updateBlockPriority } from '@/utils/fileUtils';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';

type QuadrantConfig = {
  key: string;
  titleKey: string;
  priorities: PriorityLevel[];
  includeNoPriority: boolean;
};

type QuadrantDragPayload = {
  blockId: string;
  itemId: string;
  priority?: PriorityLevel;
};

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref(settingsStore.defaultGroup || '');
const isSelectedGroupDefaultDriven = ref(true);
const searchQuery = ref('');
const sidebarRefs = ref<Array<InstanceType<typeof TodoSidebar> | null>>([]);
const draggedItem = ref<QuadrantDragPayload | null>(null);
const activeDropQuadrant = ref<string | null>(null);

const quadrants: QuadrantConfig[] = [
  {
    key: 'high',
    titleKey: 'quadrant.panels.high',
    priorities: ['high'],
    includeNoPriority: false,
  },
  {
    key: 'medium',
    titleKey: 'quadrant.panels.medium',
    priorities: ['medium'],
    includeNoPriority: false,
  },
  {
    key: 'low',
    titleKey: 'quadrant.panels.low',
    priorities: ['low'],
    includeNoPriority: false,
  },
  {
    key: 'none',
    titleKey: 'quadrant.panels.none',
    priorities: [],
    includeNoPriority: true,
  },
];

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

const panelCounts = computed(() => {
  return quadrants.map((quadrant) => {
    return projectStore.getFilteredAndSortedItems({
      groupId: selectedGroup.value,
      searchQuery: searchQuery.value,
      priorities: quadrant.priorities.length > 0 ? quadrant.priorities : undefined,
      includeNoPriority: quadrant.includeNoPriority,
    }).length;
  });
});

function setSidebarRef(index: number, instance: InstanceType<typeof TodoSidebar> | null) {
  sidebarRefs.value[index] = instance;
}

function getQuadrantPriority(quadrant: QuadrantConfig): PriorityLevel | undefined {
  if (quadrant.includeNoPriority) {
    return undefined;
  }
  return quadrant.priorities[0];
}

function parseDragPayload(raw: string | undefined): QuadrantDragPayload | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as QuadrantDragPayload;
  }
  catch {
    return null;
  }
}

function handleItemDragStart(payload: QuadrantDragPayload) {
  draggedItem.value = payload;
}

function handleItemDragEnd() {
  draggedItem.value = null;
  activeDropQuadrant.value = null;
}

function handleQuadrantDragOver(event: DragEvent, quadrant: QuadrantConfig) {
  event.preventDefault();
  activeDropQuadrant.value = quadrant.key;

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleQuadrantDragLeave(event: DragEvent, quadrantKey: string) {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;

  if (
    currentTarget instanceof HTMLElement
    && relatedTarget instanceof Node
    && currentTarget.contains(relatedTarget)
  ) {
    return;
  }

  if (activeDropQuadrant.value === quadrantKey) {
    activeDropQuadrant.value = null;
  }
}

async function handleQuadrantDrop(event: DragEvent, quadrant: QuadrantConfig) {
  event.preventDefault();

  const payload = draggedItem.value ?? parseDragPayload(event.dataTransfer?.getData('application/json'));
  activeDropQuadrant.value = null;

  if (!payload?.blockId) {
    return;
  }

  const targetPriority = getQuadrantPriority(quadrant);
  if (payload.priority === targetPriority) {
    draggedItem.value = null;
    return;
  }

  const success = await updateBlockPriority(payload.blockId, targetPriority);
  draggedItem.value = null;

  if (!success || !plugin) {
    showMessage(t('common').actionFailed, 'error');
    return;
  }

  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
}

function syncSelectedGroupWithDefault() {
  if (!isSelectedGroupDefaultDriven.value) {
    return;
  }

  selectedGroup.value = settingsStore.defaultGroup || '';
}

async function handleRefresh() {
  if (!plugin) return;
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
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
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
}

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(() => {
  settingsStore.loadFromPlugin();
  syncSelectedGroupWithDefault();
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

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

  &.quadrant-panel--drop-active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.quadrant-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.quadrant-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.quadrant-panel__count {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.quadrant-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
