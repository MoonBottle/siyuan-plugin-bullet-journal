<template>
  <div class="hk-work-tab gantt-tab">
    <div class="block__icons">
      <!-- 左侧：甘特图控件 -->
      <label class="show-items">
        <input type="checkbox" v-model="showItems" />
        {{ t('gantt').showItems }}
      </label>
      <div class="date-filter">
        <span>{{ t('gantt').dateFilter }}</span>
        <input type="date" v-model="startDate" />
        <span>{{ t('gantt').to }}</span>
        <input type="date" v-model="endDate" />
      </div>
      <div class="view-modes">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          :class="['view-mode-btn', { active: viewMode === mode.value }]"
          @click="viewMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <!-- 右侧：分组、刷新 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <span
        class="block__icon refresh-btn b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <GanttView
        :projects="filteredProjects"
        :show-items="showItems"
        :start-date="startDate"
        :end-date="endDate"
        :view-mode="viewMode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { showMessage } from '@/utils/dialog';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';

import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import GanttView from '@/components/gantt/GanttView.vue';
import { t } from '@/i18n';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref('');
const showItems = ref(false);
const startDate = ref('');
const endDate = ref('');
const viewMode = ref<'day' | 'week' | 'month'>('day');

const viewModes: Array<{ value: 'day' | 'week' | 'month'; label: string }> = [
  { value: 'day', label: t('gantt').day },
  { value: 'week', label: t('gantt').week },
  { value: 'month', label: t('gantt').month }
];

const filteredProjects = computed(() => projectStore.getFilteredProjects(selectedGroup.value));

const groupOptions = computed(() => {
  const options = [{ value: '', label: t('settings').projectGroups.allGroups }];
  settingsStore.groups.forEach(g => {
    options.push({ value: g.id, label: g.name || t('settings').projectGroups.unnamed });
  });
  return options;
});

// 数据刷新处理函数（同上下文无 payload 则 loadFromPlugin 同步 groups/defaultGroup；跨上下文 BC 带完整设置则 patch）
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'todoDock'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(k => k in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k]; });
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch);
  } else {
    settingsStore.loadFromPlugin();
  }
  await nextTick();
  await projectStore.refresh(plugin, settingsStore.enabledDirectories);
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup;
  }

  // 加载项目数据
  if (plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  }

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：Tab 可能与主窗口分离，用 BroadcastChannel 接收刷新
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = (e: MessageEvent) => {
      const data = e?.data;
      if (data?.type === 'DATA_REFRESH') {
        const { type: _t, ...rest } = data;
        handleDataRefresh(Object.keys(rest).length > 0 ? rest : undefined);
      }
    };
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});

const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    showMessage(t('common').dataRefreshed);
  }
};
</script>

<style lang="scss" scoped>
.gantt-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.block__icons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);

  .block__icon {
    opacity: 1;
  }

  .show-items {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 12px;
    min-height: 28px;
  }

  .date-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;

    input[type='date'] {
      padding: 5px 10px;
      border: 1px solid var(--b3-border-color);
      border-radius: var(--b3-border-radius);
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
    }
  }

  .view-modes {
    display: flex;
    gap: 4px;
  }

  .view-mode-btn {
    padding: 5px 12px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    border-radius: var(--b3-border-radius);
    font-size: 12px;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-surface-light);
    }

    &.active {
      background: var(--b3-theme-primary);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }

  select.b3-select {
    width: auto !important;
    min-width: 60px;
    margin-left: 8px;
    padding: 4px 24px 4px 8px;
  }

  .refresh-btn {
    margin-left: 0;
  }
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
