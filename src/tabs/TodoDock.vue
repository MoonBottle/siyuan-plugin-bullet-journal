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
        <TodoSidebar />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Menu } from 'siyuan';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events } from '@/utils/eventBus';
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

// 数据刷新处理函数
const handleDataRefresh = async () => {
  console.log('[Bullet Journal] TodoDock received DATA_REFRESH event');
  if (plugin) {
    settingsStore.loadFromPlugin();
    if (settingsStore.enabledDirectories.length > 0) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
      console.log('[Bullet Journal] TodoDock refreshed, items:', projectStore.futureItems.length);
    }
  }
};

// 手动刷新
const handleRefresh = async () => {
  if (plugin && settingsStore.enabledDirectories.length > 0) {
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

// 监听分组变化
watch(selectedGroup, (groupId) => {
  projectStore.setSelectedGroup(groupId);
});

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;

// 初始化数据
onMounted(async () => {
  console.log('[Bullet Journal] TodoDock mounted');

  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 同步 todoDock 设置到 projectStore
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

  // 加载项目数据
  if (settingsStore.enabledDirectories.length > 0 && plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
    console.log('[Bullet Journal] Todo items loaded:', projectStore.futureItems.length);
  }

  // 监听数据刷新事件
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
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
