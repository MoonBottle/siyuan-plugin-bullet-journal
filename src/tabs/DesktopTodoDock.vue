<template>
  <div class="fn__flex-1 fn__flex-column todo-dock-container">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconList"></use></svg>
        {{ t('todo').title }}
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="todoContentPane?.allCollapsed ? t('todo').expandAll : t('todo').collapseAll"
        @click="todoContentPane?.toggleCollapseAll()"
      >
        <svg><use :xlink:href="todoContentPane?.allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        data-testid="todo-dock-refresh-button"
        :aria-label="t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        data-testid="todo-dock-more-button"
        :aria-label="t('common').more"
        @click="handleMoreClick"
      >
        <svg><use xlink:href="#iconMore"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column todo-dock-body">
      <TodoFilterBar
        :selected-group="selectedGroup"
        :search-query="searchQuery"
        :date-filter-type="dateFilterType"
        :selected-priorities="selectedPriorities"
        :start-date="startDate"
        :end-date="endDate"
        :show-sort-panel="showSortPanel"
        :sort-rules="sortRules"
        :group-options="groupOptions"
        :date-filter-options="dateFilterOptions"
        :priority-options="priorityOptions"
        :sort-direction-options="sortDirectionOptions"
        :available-field-options="availableFieldOptions"
        @update:selected-group="selectedGroup = $event"
        @update:search-query="searchQuery = $event"
        @update:date-filter-type="dateFilterType = $event"
        @change:date-filter-type="onDateFilterChange"
        @update:start-date="startDate = $event"
        @update:end-date="endDate = $event"
        @toggle-priority="togglePriority"
        @toggle-sort-panel="toggleSortPanel"
        @update-sort-field="updateSortField"
        @update-sort-direction="updateSortDirection"
        @move-sort-rule="moveSortRule"
        @remove-sort-rule="removeSortRule"
        @add-sort-rule="addSortRule"
        @reset-sort-rules="resetSortRules"
      />
      <TodoContentPane
        ref="todoContentPane"
        :group-id="selectedGroup"
        :search-query="searchQuery"
        :date-range="dateRange"
        :completed-date-range="completedDateRange"
        :priorities="selectedPriorities"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import dayjs from 'dayjs';
import { Menu } from 'siyuan';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import TodoContentPane from '@/components/todo/TodoContentPane.vue';
import TodoFilterBar from '@/components/todo/TodoFilterBar.vue';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import { buildViewDebugContext } from '@/utils/viewDebug';
import { buildCompletedTodoDateRange, buildTodoDateRange, type TodoDateFilterType } from '@/utils/todoDateFilter';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { defaultTodoSortRules } from '@/settings';
import type { TodoSortDirection, TodoSortField, TodoSortRule } from '@/settings';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const todoContentPane = ref<InstanceType<typeof TodoContentPane> | null>(null);

const selectedGroup = ref(settingsStore.todoDock.selectedGroup);

watch(selectedGroup, (val) => {
  settingsStore.todoDock.selectedGroup = val;
  settingsStore.saveToPlugin();
});

// 搜索和筛选状态
const searchQuery = ref('');
const selectedPriorities = ref<PriorityLevel[]>([]);
const showSortPanel = ref(false);

const dateFilterType = ref<TodoDateFilterType>('today');
const startDate = ref(dayjs().format('YYYY-MM-DD'));
const endDate = ref(dayjs().add(7, 'day').format('YYYY-MM-DD'));
const currentDate = computed(() => projectStore.currentDate);

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji },
];

const dateFilterOptions = [
  { value: 'today', label: t('todo.dateFilter.today') },
  { value: 'week', label: t('todo.dateFilter.thisWeek') },
  { value: 'all', label: t('todo.dateFilter.all') },
  { value: 'custom', label: t('todo.dateFilter.custom') },
];

const sortFieldOptions = [
  { value: 'priority' as TodoSortField, label: t('todo.sortFields.priority') },
  { value: 'time' as TodoSortField, label: t('todo.sortFields.time') },
  { value: 'date' as TodoSortField, label: t('todo.sortFields.date') },
  { value: 'reminderTime' as TodoSortField, label: t('todo.sortFields.reminderTime') },
  { value: 'project' as TodoSortField, label: t('todo.sortFields.project') },
  { value: 'task' as TodoSortField, label: t('todo.sortFields.task') },
  { value: 'content' as TodoSortField, label: t('todo.sortFields.content') },
];

const sortDirectionOptions = [
  { value: 'asc' as TodoSortDirection, label: t('todo.sortDirection.asc') },
  { value: 'desc' as TodoSortDirection, label: t('todo.sortDirection.desc') },
];

const dateRange = computed(() => {
  return buildTodoDateRange(
    dateFilterType.value,
    currentDate.value,
    startDate.value,
    endDate.value,
  );
});

const completedDateRange = computed(() => {
  return buildCompletedTodoDateRange(dateFilterType.value, currentDate.value, dateRange.value);
});

const sortRules = computed(() => {
  return settingsStore.todoDock.sortRules;
});

function togglePriority(priority: PriorityLevel) {
  const index = selectedPriorities.value.indexOf(priority);
  if (index > -1) {
    selectedPriorities.value.splice(index, 1);
  } else {
    selectedPriorities.value.push(priority);
  }
}

function onDateFilterChange(type: TodoDateFilterType) {
  dateFilterType.value = type;
  if (type === 'custom') {
    // 默认设置为今天到一周后
    startDate.value = dayjs().format('YYYY-MM-DD');
    endDate.value = dayjs().add(7, 'day').format('YYYY-MM-DD');
  }
}

function persistSortRules(nextRules: TodoSortRule[]) {
  settingsStore.todoDock.sortRules = nextRules.length > 0
    ? nextRules
    : [...defaultTodoSortRules];
  settingsStore.saveToPlugin();
}

function toggleSortPanel() {
  showSortPanel.value = !showSortPanel.value;
}

function availableFieldOptions(index: number) {
  const usedFields = new Set(
    sortRules.value
      .filter((_, ruleIndex) => ruleIndex !== index)
      .map(rule => rule.field),
  );

  return sortFieldOptions.filter(option =>
    option.value === sortRules.value[index]?.field || !usedFields.has(option.value),
  );
}

function updateSortField(index: number, value: string) {
  const nextRules = [...sortRules.value];
  nextRules[index] = {
    ...nextRules[index],
    field: value as TodoSortField,
  };
  persistSortRules(nextRules);
}

function updateSortDirection(index: number, value: string) {
  const nextRules = [...sortRules.value];
  nextRules[index] = {
    ...nextRules[index],
    direction: value as TodoSortDirection,
  };
  persistSortRules(nextRules);
}

function addSortRule() {
  const usedFields = new Set(sortRules.value.map(rule => rule.field));
  const nextField = sortFieldOptions.find(option => !usedFields.has(option.value));
  if (!nextField) return;

  persistSortRules([
    ...sortRules.value,
    { field: nextField.value, direction: 'asc' },
  ]);
}

function moveSortRule(index: number, delta: number) {
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= sortRules.value.length) return;

  const nextRules = [...sortRules.value];
  [nextRules[index], nextRules[targetIndex]] = [nextRules[targetIndex], nextRules[index]];
  persistSortRules(nextRules);
}

function removeSortRule(index: number) {
  if (sortRules.value.length <= 1) return;
  const nextRules = sortRules.value.filter((_, ruleIndex) => ruleIndex !== index);
  persistSortRules(nextRules);
}

function resetSortRules() {
  persistSortRules([...defaultTodoSortRules]);
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
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', {
    ...buildViewDebugContext('DesktopTodoDock', plugin),
    hasPayload: Boolean(payload),
    payloadKeys: payload ? Object.keys(payload) : [],
  });
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock', 'scanMode'];
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
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

// 初始化数据
onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('DesktopTodoDock', plugin));
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
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: (payload) => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('DesktopTodoDock', plugin),
          data: payload ? { type: 'DATA_REFRESH', ...payload } : { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh(payload);
      },
      viewName: 'DesktopTodoDock',
    });
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('DesktopTodoDock', plugin));
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
</style>
