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
        :aria-label="todoSidebar?.allCollapsed ? t('todo').expandAll : t('todo').collapseAll"
        @click="todoSidebar?.toggleCollapseAll()"
      >
        <svg><use :xlink:href="todoSidebar?.allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
      </span>
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

          <button
            class="sort-trigger b3-tooltips b3-tooltips__n"
            :aria-label="t('todo.sortSettings')"
            @click="toggleSortPanel"
          >
            <svg><use xlink:href="#iconSort"></use></svg>
          </button>

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

        <div v-if="showSortPanel" class="sort-panel">
          <div
            v-for="(rule, index) in sortRules"
            :key="`${rule.field}-${index}`"
            class="sort-rule-row"
          >
            <SySelect
              :model-value="rule.field"
              :options="availableFieldOptions(index)"
              class="sort-field-select"
              @change="value => updateSortField(index, value)"
            />
            <SySelect
              :model-value="rule.direction"
              :options="sortDirectionOptions"
              class="sort-direction-select"
              @change="value => updateSortDirection(index, value)"
            />
            <button
              class="sort-rule-btn b3-tooltips b3-tooltips__n"
              :aria-label="t('todo.sortMoveUp')"
              :disabled="index === 0"
              @click="moveSortRule(index, -1)"
            >
              <svg><use xlink:href="#iconUp"></use></svg>
            </button>
            <button
              class="sort-rule-btn b3-tooltips b3-tooltips__n"
              :aria-label="t('todo.sortMoveDown')"
              :disabled="index === sortRules.length - 1"
              @click="moveSortRule(index, 1)"
            >
              <svg><use xlink:href="#iconDown"></use></svg>
            </button>
            <button
              class="sort-rule-btn b3-tooltips b3-tooltips__n"
              :aria-label="t('todo.sortRemoveRule')"
              :disabled="sortRules.length <= 1"
              @click="removeSortRule(index)"
            >
              <svg><use xlink:href="#iconClose"></use></svg>
            </button>
          </div>

          <div class="sort-panel-actions">
            <button class="b3-button b3-button--outline" @click="addSortRule">
              {{ t('todo.sortAddRule') }}
            </button>
            <button class="b3-button b3-button--text" @click="resetSortRules">
              {{ t('todo.sortReset') }}
            </button>
          </div>
        </div>
      </div>
      <div class="fn__flex-1 todo-dock-content">
        <TodoSidebar 
          ref="todoSidebar"
          :group-id="selectedGroup"
          :search-query="searchQuery"
          :date-range="dateRange"
          :completed-date-range="completedDateRange"
          :priorities="selectedPriorities"
        />
      </div>
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
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import { buildViewDebugContext } from '@/utils/viewDebug';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { defaultTodoSortRules } from '@/settings';
import type { TodoSortDirection, TodoSortField, TodoSortRule } from '@/settings';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const todoSidebar = ref<InstanceType<typeof TodoSidebar> | null>(null);

const selectedGroup = ref(settingsStore.todoDock.selectedGroup);

watch(selectedGroup, (val) => {
  settingsStore.todoDock.selectedGroup = val;
  settingsStore.saveToPlugin();
});

// 搜索和筛选状态
const searchQuery = ref('');
const selectedPriorities = ref<PriorityLevel[]>([]);
const showSortPanel = ref(false);

// 日期筛选类型：today | week | all | custom
type DateFilterType = 'today' | 'week' | 'all' | 'custom';
const dateFilterType = ref<DateFilterType>('today');
const startDate = ref(dayjs().format('YYYY-MM-DD'));
const endDate = ref(dayjs().add(7, 'day').format('YYYY-MM-DD'));

const todayDate = ref(dayjs().format('YYYY-MM-DD'));
let dateCheckTimer: ReturnType<typeof setInterval> | null = null;

const startDateCheck = () => {
  dateCheckTimer = setInterval(() => {
    const newDate = dayjs().format('YYYY-MM-DD');
    if (newDate !== todayDate.value) {
      todayDate.value = newDate;
    }
  }, 60_000);
};

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
  if (dateFilterType.value === 'all') return null;
  if (dateFilterType.value === 'today') {
    return { start: '1970-01-01', end: todayDate.value };
  }
  if (dateFilterType.value === 'week') {
    const nextWeek = dayjs(todayDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: '1970-01-01', end: nextWeek };
  }
  // custom
  return { start: startDate.value, end: endDate.value };
});

const completedDateRange = computed(() => {
  if (dateFilterType.value === 'all') return null;
  if (dateFilterType.value === 'today') {
    return { start: todayDate.value, end: todayDate.value };
  }
  if (dateFilterType.value === 'week') {
    const nextWeek = dayjs(todayDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: todayDate.value, end: nextWeek };
  }
  return { start: startDate.value, end: endDate.value };
});

const dateFilterLabel = computed(() => {
  return dateFilterOptions.find(o => o.value === dateFilterType.value)?.label || t('todo.dateFilter.today');
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

function onDateFilterChange(type: DateFilterType) {
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

  startDateCheck();
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('DesktopTodoDock', plugin));
  if (dateCheckTimer) {
    clearInterval(dateCheckTimer);
    dateCheckTimer = null;
  }
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
        transition: all 0.2s;
        padding: 0;

        &:hover, &.active {
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

    .sort-trigger {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-surface);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      &:hover {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
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

  .sort-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid var(--b3-border-color);
  }

  .sort-rule-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 92px auto auto auto;
    gap: 6px;
    align-items: center;
  }

  .sort-field-select,
  .sort-direction-select {
    width: 100%;

    :deep(.sy-select__trigger) {
      min-height: 28px;
    }
  }

  .sort-rule-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    &:hover:not(:disabled) {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .sort-panel-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}
</style>
