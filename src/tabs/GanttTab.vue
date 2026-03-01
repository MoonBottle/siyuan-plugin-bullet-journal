<template>
  <div class="hk-work-tab gantt-tab">
    <div class="block__icons">
      <span class="fn__flex-1 fn__space"></span>
      <!-- 分组选择 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="projectStore.selectedGroup"
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
      <GanttView :projects="projectStore.filteredProjects" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events } from '@/utils/eventBus';

import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import GanttView from '@/components/gantt/GanttView.vue';
import type { ProjectDirectory } from '@/types/models';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const groupOptions = computed(() => {
  const options = [{ value: '', text: '全部分组' }];
  settingsStore.groups.forEach(g => {
    options.push({ value: g.id, text: g.name || '未命名' });
  });
  return options;
});

// 数据刷新处理函数（支持 payload 直接更新 store）
const handleDataRefresh = async (payload?: { directories?: ProjectDirectory[] }) => {
  if (!plugin) return;
  if (payload?.directories !== undefined) {
    settingsStore.$patch({ directories: payload.directories });
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

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 加载项目数据
  if (settingsStore.enabledDirectories.length > 0 && plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  } else {
    projectStore.clearData();
  }

  // 监听数据刷新事件
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
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

// 监听分组变化
watch(() => projectStore.selectedGroup, (groupId) => {
  projectStore.setSelectedGroup(groupId);
});
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
