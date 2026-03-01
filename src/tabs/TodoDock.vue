<template>
  <div class="fn__flex-1 fn__flex-column">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconList"></use></svg>
        待办事项
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="更多" @click="handleMoreClick">
        <svg><use xlink:href="#iconMore"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column todo-dock-body">
      <div v-if="settingsStore.groups.length > 0" class="todo-filter-card">
        <SySelect
          v-model="selectedGroup"
          :options="groupOptions"
          placeholder="全部分组"
        />
      </div>
      <div class="fn__flex-1 todo-dock-content">
        <TodoSidebar :group-id="selectedGroup" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Menu } from 'siyuan';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref('');

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
  await projectStore.refresh(plugin, settingsStore.enabledDirectories);
};

// 手动刷新
const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 更多按钮点击事件
const handleMoreClick = (event: MouseEvent) => {
  event.stopPropagation();
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();

  const menu = new Menu('bullet-journal-more-menu');

  // 刷新选项
  menu.addItem({
    icon: 'iconRefresh',
    label: '刷新',
    click: () => {
      handleRefresh();
    },
  });

  // 分隔线
  menu.addSeparator();

  // 隐藏/显示已完成选项
  const hideCompleted = projectStore.hideCompleted;
  menu.addItem({
    icon: hideCompleted ? 'iconEyeoff' : 'iconEye',
    label: hideCompleted ? '显示已完成' : '隐藏已完成',
    click: () => {
      projectStore.toggleHideCompleted();
    },
  });

  // 隐藏/显示已放弃选项
  const hideAbandoned = projectStore.hideAbandoned;
  menu.addItem({
    icon: hideAbandoned ? 'iconEyeoff' : 'iconEye',
    label: hideAbandoned ? '显示已放弃' : '隐藏已放弃',
    click: () => {
      projectStore.toggleHideAbandoned();
    },
  });

  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  });
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 初始默认分组（仅首次为空时应用）
  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup;
  }

  // 同步 todoDock 设置到 projectStore
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

  // 加载项目数据
  if (plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  }

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：Dock 可能在 iframe 中，收不到主窗口的 eventBus，用 BroadcastChannel 接收
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
</script>

<style lang="scss" scoped>
.block__icons {
  .block__icon {
    opacity: 1;
  }
}

.todo-dock-body {
  padding: 8px;
  gap: 8px;
  min-height: 0;
}

.todo-filter-card {
  padding: 8px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);

  :deep(.b3-select) {
    width: auto !important;
    min-width: 60px;
    padding: 4px 24px 4px 8px;
  }
}

.todo-dock-content {
  overflow: auto;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 160px);
}
</style>
