<template>
  <div class="hk-work-tab project-tab">
    <div class="tab-header">
      <div class="tab-toolbar">
        <SySelect
          v-if="settingsStore.groups.length > 0"
          v-model="projectStore.selectedGroup"
          :options="groupOptions"
          placeholder="全部分组"
        />
        <SyButton @click="handleRefresh" :disabled="projectStore.loading">
          {{ projectStore.loading ? '加载中...' : '刷新' }}
        </SyButton>
      </div>
    </div>
    <div class="tab-content">
      <ProjectView
        :projects="projectStore.filteredProjects"
        @project-click="handleProjectClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { eventBus, Events } from '@/utils/eventBus';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import ProjectView from '@/components/project/ProjectView.vue';

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

// 数据刷新处理函数
const handleDataRefresh = async () => {
  if (plugin) {
    settingsStore.loadFromPlugin();
    if (settingsStore.enabledDirectories.length > 0) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
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
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

const handleProjectClick = async (project: any) => {
  if (project.id) {
    await openDocumentAtLine(project.id);
  }
};

// 监听分组变化
watch(() => projectStore.selectedGroup, (groupId) => {
  projectStore.setSelectedGroup(groupId);
});
</script>

<style lang="scss" scoped>
.project-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.tab-header {
  flex-shrink: 0;
  padding: 8px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.tab-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
