<template>
  <div class="fn__flex-1 fn__flex-column todo-dock-container">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconList"></use></svg>
        {{ t('todo').title }}
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('common').more" @click="handleMoreClick">
        <svg><use xlink:href="#iconMore"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column todo-dock-body">
      <div class="todo-filter-card">
        <!-- 第一行：搜索框 -->
        <div class="search-row">
          <div class="search-box">
            <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              :placeholder="t('todo').searchPlaceholder"
              class="search-input"
            />
            <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
              <svg><use xlink:href="#iconClose"></use></svg>
            </button>
          </div>
        </div>

        <!-- 第二行：分组 + 日期 + 优先级 -->
        <div class="filter-row">
          <SySelect
            v-model="selectedGroup"
            :options="groupOptions"
            :placeholder="t('settings').projectGroups.allGroups"
            class="group-select"
          />
          
          <SySelect
            v-model="dateFilterType"
            :options="dateFilterOptions"
            class="date-filter-select"
            @change="onDateFilterChange"
          />

          <div class="priority-filter">
            <button 
              v-for="p in priorityOptions" 
              :key="p.value"
              :class="['priority-btn', 'b3-tooltips', 'b3-tooltips__n', { active: selectedPriorities.includes(p.value) }]"
              :aria-label="PRIORITY_CONFIG[p.value].label"
              @click="togglePriority(p.value)"
            >
              {{ p.emoji }}
            </button>
          </div>
        </div>

        <!-- 自定义日期范围选择器 -->
        <div v-if="dateFilterType === 'custom'" class="date-range-row">
          <input v-model="startDate" type="date" class="date-input" />
          <span>至</span>
          <input v-model="endDate" type="date" class="date-input" />
        </div>
      </div>
      <div class="fn__flex-1 todo-dock-content">
        <TodoSidebar 
          :group-id="selectedGroup"
          :search-query="searchQuery"
          :date-range="dateRange"
          :priorities="selectedPriorities"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import dayjs from 'dayjs';
import { Menu } from 'siyuan';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const selectedGroup = ref('');

// 搜索和筛选状态
const searchQuery = ref('');
const selectedPriorities = ref<PriorityLevel[]>([]);

// 日期筛选类型：today | week | all | custom
type DateFilterType = 'today' | 'week' | 'all' | 'custom';
const dateFilterType = ref<DateFilterType>('today');
const startDate = ref(dayjs().format('YYYY-MM-DD'));
const endDate = ref(dayjs().add(7, 'day').format('YYYY-MM-DD'));

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji },
];

const dateFilterOptions = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '近7天' },
  { value: 'all', label: '全部' },
  { value: 'custom', label: '自定义' },
];

const dateRange = computed(() => {
  if (dateFilterType.value === 'all') return null;
  if (dateFilterType.value === 'today') {
    const today = dayjs().format('YYYY-MM-DD');
    return { start: today, end: today };
  }
  if (dateFilterType.value === 'week') {
    const today = dayjs().format('YYYY-MM-DD');
    const nextWeek = dayjs().add(6, 'day').format('YYYY-MM-DD');
    return { start: today, end: nextWeek };
  }
  // custom
  return { start: startDate.value, end: endDate.value };
});

const dateFilterLabel = computed(() => {
  return dateFilterOptions.find(o => o.value === dateFilterType.value)?.label || '今天';
});

function togglePriority(priority: PriorityLevel) {
  const index = selectedPriorities.value.indexOf(priority);
  if (index > -1) {
    selectedPriorities.value.splice(index, 1);
  } else {
    selectedPriorities.value.push(priority);
  }
}

function onDateFilterChange(type: DateFilterType) {
  dateFilterType.value = type;
  if (type === 'custom') {
    // 默认设置为今天到一周后
    startDate.value = dayjs().format('YYYY-MM-DD');
    endDate.value = dayjs().add(7, 'day').format('YYYY-MM-DD');
  }
}

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

// 手动刷新
const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
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
    label: t('common').refresh,
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
    label: hideCompleted ? t('todo').showCompleted : t('todo').hideCompleted,
    click: () => {
      projectStore.toggleHideCompleted();
    },
  });

  // 隐藏/显示已放弃选项
  const hideAbandoned = projectStore.hideAbandoned;
  menu.addItem({
    icon: hideAbandoned ? 'iconEyeoff' : 'iconEye',
    label: hideAbandoned ? t('todo').showAbandoned : t('todo').hideAbandoned,
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
.todo-dock-container {
  overflow: hidden;
}

.block__icons {
  .block__icon {
    opacity: 1;
  }
}

.todo-dock-body {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
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
  position: relative;
}

.todo-filter-card {
  .search-row {
    margin-bottom: 8px;

    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--b3-theme-background);
      border-radius: var(--b3-border-radius);
      border: 1px solid var(--b3-border-color);

      &:focus-within {
        border-color: var(--b3-theme-primary);
      }

      .search-icon {
        width: 14px;
        height: 14px;
        fill: var(--b3-theme-on-surface);
        opacity: 0.5;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 13px;
        outline: none;
        color: var(--b3-theme-on-background);
      }

      .clear-btn {
        width: 16px;
        height: 16px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 0.4;
        color: var(--b3-theme-on-surface);

        &:hover { opacity: 0.8; }
      }
    }
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .priority-filter {
      display: flex;
      gap: 2px;

      .priority-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        opacity: 0.35;
        transition: all 0.2s;
        padding: 0;

        &:hover, &.active {
          opacity: 1;
          background: var(--b3-theme-primary-lightest);
        }
      }
    }

    .date-filter-select {
      width: auto !important;
      min-width: 80px;

      :deep(.b3-select) {
        height: 28px;
        font-size: 12px;
        padding: 0 24px 0 8px;
      }
    }
  }

  .date-range-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid var(--b3-border-color);

    .date-input {
      padding: 4px;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      font-size: 12px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
    }


  }
}
</style>
