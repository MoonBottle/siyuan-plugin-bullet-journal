<template>
  <div class="hk-work-tab gantt-tab">
    <div class="block__icons">
      <span class="fn__flex-1 fn__space"></span>
      <!-- 分组选择 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        placeholder="全部分组"
      />
      <!-- 刷新按钮 -->
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? '加载中...' : '刷新'"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <GanttView :projects="filteredProjects" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';

import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import GanttView from '@/components/gantt/GanttView.vue';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref('');
const filteredProjects = computed(() => projectStore.getFilteredProjects(selectedGroup.value));

const groupOptions = computed(() => {
  const options = [{ value: '', text: '全部分组' }];
  settingsStore.groups.forEach(g => {
    options.push({ value: g.id, text: g.name || '未命名' });
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
  if (settingsStore.enabledDirectories.length > 0) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  } else {
    projectStore.clearData();
  }
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
  if (settingsStore.enabledDirectories.length > 0 && plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  } else {
    projectStore.clearData();
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
    if (settingsStore.enabledDirectories.length > 0) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    } else {
      projectStore.clearData();
    }
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
  overflow: hidden;
}
</style>
