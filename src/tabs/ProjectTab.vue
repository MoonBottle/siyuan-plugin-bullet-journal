<template>
  <div class="hk-work-tab project-tab">
    <div class="block__icons">
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <span class="fn__flex-1 fn__space"></span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <ProjectView
        :projects="filteredProjects"
        @project-click="handleProjectClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { showMessage } from '@/utils/dialog';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { buildViewDebugContext } from '@/utils/viewDebug';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import ProjectView from '@/components/project/ProjectView.vue';
import { t } from '@/i18n';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref('');
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
  console.warn('[Task Assistant][ViewLifecycle] handleDataRefresh:', {
    ...buildViewDebugContext('ProjectTab', plugin),
    hasPayload: Boolean(payload),
    payloadKeys: payload ? Object.keys(payload) : [],
  });
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(k => k in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k]; });
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch);
  } else {
    settingsStore.loadFromPlugin();
  }
  await nextTick();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

// 初始化数据
onMounted(async () => {
  console.warn('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('ProjectTab', plugin));
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup;
  }

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：Tab 可能与主窗口分离，用 BroadcastChannel 接收刷新
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: (payload) => {
        console.warn('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('ProjectTab', plugin),
          data: payload ? { type: 'DATA_REFRESH', ...payload } : { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh(payload);
      },
      viewName: 'ProjectTab',
    });
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  console.warn('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('ProjectTab', plugin));
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

const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
  }
};

const handleProjectClick = async (project: any) => {
  if (project.id) {
    await openDocumentAtLine(project.id);
  }
};
</script>

<style lang="scss" scoped>
.project-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.block__icons {
  .block__icon {
    opacity: 1;
  }

  select.b3-select {
    width: auto !important;
    min-width: 60px;
    margin-left: 8px;
    padding: 4px 24px 4px 8px;
  }
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
