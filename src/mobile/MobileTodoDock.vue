<template>
  <div class="mobile-todo-dock">
    <MobileFilterBar
      v-model:search="state.searchQuery"
      :has-active-filters="hasActiveFilters"
      @open-filter="state.showFilterDrawer = true"
    />
    
    <MobileTodoList
      :group-id="state.selectedGroup"
      :search-query="state.searchQuery"
      :date-range="state.dateRange"
      :completed-date-range="completedDateRange"
      :priorities="state.selectedPriorities"
      :has-active-filters="hasActiveFilters"
      @item-click="openItemDetail"
      @item-long-press="handleQuickComplete"
      @refresh="handleRefresh"
    />
    
    <MobileBottomNav
      @open-pomodoro="() => { console.log('[MobileTodoDock] 点击番茄钟'); state.showPomodoroDrawer = true; }"
      @create="openQuickCreate"
    />

    <!-- Filter Drawer -->
    <FilterDrawer
      v-model="state.showFilterDrawer"
      v-model:selected-group="state.selectedGroup"
      v-model:date-filter="state.dateFilter"
      v-model:date-range="state.dateRange"
      v-model:priorities="state.selectedPriorities"
      @apply="applyFilters"
    />

    <!-- Action Drawer -->
    <ActionDrawer
      v-model="state.showActionDrawer"
      :item="state.selectedItem"
      @open-detail="openItemDetail"
      @open-pomodoro="handleOpenPomodoro"
    />

    <!-- Item Detail Drawer -->
    <MobileItemDetail
      v-model="state.showItemDetail"
      :item="state.selectedItem"
      @open-project="openProjectDetail"
      @open-task="openTaskDetail"
      @open-pomodoro="handleOpenPomodoro"
      @set-reminder="handleSetReminder"
      @set-recurring="handleSetRecurring"
      @refresh="handleRefresh"
    />

    <!-- Task Item Detail Drawer (higher z-index, no nested navigation) -->
    <TaskItemDetail
      v-model="state.showTaskItemDetail"
      :item="state.selectedTaskItem"
      @open-pomodoro="handleOpenPomodoro"
      @set-reminder="handleSetTaskItemReminder"
      @set-recurring="handleSetTaskItemRecurring"
      @refresh="handleRefresh"
    />

    <!-- Project Detail Drawer -->
    <ProjectDetail
      v-model="state.showProjectDetail"
      :project="selectedProject"
      @open-task="openTaskDetail"
      @create-task="handleCreateTask"
    />

    <!-- Task Detail Drawer -->
    <TaskDetail
      v-model="state.showTaskDetail"
      :task="selectedTask"
      :project-id="selectedProject?.id"
      :project-name="selectedProject?.name"
      @open-item="openTaskItemDetail"
      @create-item="handleCreateItem"
      @toggle-item="handleToggleItemStatus"
    />

    <!-- Quick Create Drawer -->
    <QuickCreateDrawer
      v-model="state.showQuickCreate"
      :preselected-project-id="state.selectedProjectId || undefined"
      :preselected-task-id="state.selectedTaskBlockId || undefined"
      @created="handleCreated"
    />

    <!-- Pomodoro Drawer -->
    <MobilePomodoroDrawer
      v-model="state.showPomodoroDrawer"
      :preselected-block-id="preselectedPomodoroBlockId"
      @update:model-value="handlePomodoroDrawerClose"
    />

    <!-- Reminder Drawer -->
    <MobileReminderDrawer
      v-model="showReminderDrawer"
      :item="selectedItemForSetting"
      :initial-config="selectedItemForSetting?.reminder"
      @save="handleSettingDrawerClose"
      @cancel="selectedItemForSetting = null"
    />

    <!-- Recurring Drawer -->
    <MobileRecurringDrawer
      v-model="showRecurringDrawer"
      :item="selectedItemForSetting"
      :initial-repeat-rule="selectedItemForSetting?.repeatRule"
      :initial-end-condition="selectedItemForSetting?.endCondition"
      @save="handleSettingDrawerClose"
      @cancel="selectedItemForSetting = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import MobileFilterBar from './components/todo/MobileFilterBar.vue';
import MobileTodoList from './components/todo/MobileTodoList.vue';
import MobileBottomNav from './components/todo/MobileBottomNav.vue';
import FilterDrawer from './drawers/filter/FilterDrawer.vue';
import ActionDrawer from './drawers/action/ActionDrawer.vue';
import MobileItemDetail from './drawers/item/MobileItemDetail.vue';
import TaskItemDetail from './drawers/task/TaskItemDetail.vue';
import ProjectDetail from './drawers/project/ProjectDetail.vue';
import TaskDetail from './drawers/task/TaskDetail.vue';
import QuickCreateDrawer from './drawers/quick-create/QuickCreateDrawer.vue';
import MobilePomodoroDrawer from './drawers/pomodoro/MobilePomodoroDrawer.vue';
import MobileReminderDrawer from './drawers/pomodoro/MobileReminderDrawer.vue';
import MobileRecurringDrawer from './drawers/pomodoro/MobileRecurringDrawer.vue';
import { useItemDetail } from './composables/useItemDetail';
import { useProjectStore, useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { showMessage, showPomodoroTimerDialog } from '@/utils/dialog';
import { updateBlockContent } from '@/utils/fileUtils';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { t } from '@/i18n';
import type { Item, Project, Task, ItemStatus, PriorityLevel } from '@/types/models';
import dayjs from '@/utils/dayjs';

const plugin = usePlugin();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const { state: detailState, openItem, openProject, openTask } = useItemDetail();

// Main state
const state = reactive({
  searchQuery: '',
  selectedGroup: '',
  dateFilter: 'today' as 'today' | 'week' | 'all' | 'custom',
  dateRange: null as { start: string; end: string } | null,
  selectedPriorities: [] as PriorityLevel[],
  showFilterDrawer: false,
  showActionDrawer: false,
  showItemDetail: false,
  showProjectDetail: false,
  showTaskDetail: false,
  showQuickCreate: false,
  showTaskItemDetail: false,
  selectedItem: null as Item | null,
  selectedTaskItem: null as Item | null,
  selectedProjectId: null as string | null,
  selectedTaskBlockId: null as string | null,
  showPomodoroDrawer: false,
});

const todayDate = ref(dayjs().format('YYYY-MM-DD'));
let dateCheckTimer: ReturnType<typeof setInterval> | null = null;

const startDateCheck = () => {
  dateCheckTimer = setInterval(() => {
    const newDate = dayjs().format('YYYY-MM-DD');
    if (newDate !== todayDate.value) {
      todayDate.value = newDate;
      applyFilters();
    }
  }, 60_000);
};

// Selected project and task refs for detail drawers
const selectedProject = ref<Project | null>(null);
const selectedTask = ref<Task | null>(null);

// Pomodoro preselected block ID
const preselectedPomodoroBlockId = ref<string | undefined>(undefined);

// Reminder & Recurring drawer state
const showReminderDrawer = ref(false);
const showRecurringDrawer = ref(false);
const selectedItemForSetting = ref<Item | null>(null);

// Handle set reminder
const handleSetReminder = (item: Item) => {
  selectedItemForSetting.value = item;
  showReminderDrawer.value = true;
};

// Handle set recurring
const handleSetRecurring = (item: Item) => {
  selectedItemForSetting.value = item;
  showRecurringDrawer.value = true;
};

// Handle setting drawer close with refresh
const handleSettingDrawerClose = () => {
  selectedItemForSetting.value = null;
  handleRefresh();
};

// Computed
const hasActiveFilters = computed(() => {
  return (
    state.selectedGroup !== '' ||
    state.dateFilter !== 'today' ||
    state.selectedPriorities.length > 0
  );
});

// Initialize settings
settingsStore.loadFromPlugin();
projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

// 更新选中的 item 到最新数据
const updateSelectedItems = () => {
  // 如果 Item Detail 是打开的，更新 selectedItem
  if (state.showItemDetail && state.selectedItem?.blockId) {
    const allItems = projectStore.getDisplayItems('');
    const updatedItem = allItems.find(i => i.blockId === state.selectedItem!.blockId);
    if (updatedItem) {
      state.selectedItem = updatedItem;
    }
  }
  // 如果 Task Item Detail 是打开的，更新 selectedTaskItem
  if (state.showTaskItemDetail && state.selectedTaskItem?.blockId) {
    const allItems = projectStore.getDisplayItems('');
    const updatedItem = allItems.find(i => i.blockId === state.selectedTaskItem!.blockId);
    if (updatedItem) {
      state.selectedTaskItem = updatedItem;
    }
  }
};

const handleRefresh = async () => {
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  updateSelectedItems();
  showMessage(t('common').dataRefreshed);
};

const openActionDrawer = (item: Item) => {
  state.selectedItem = item;
  state.showActionDrawer = true;
};

const openQuickCreate = () => {
  state.selectedProjectId = null;
  state.selectedTaskBlockId = null;
  state.showQuickCreate = true;
};

const handleQuickComplete = async (item: Item) => {
  if (!item.blockId) return;
  const tag = t('statusTag').completed || '✅';
  await updateBlockContent(item.blockId, tag);
  showMessage(t('todo').complete);
};

// Handler functions for drawers
const openItemDetail = (item: Item) => {
  state.selectedItem = item;
  openItem(item);
  state.showItemDetail = true;
};

const openTaskItemDetail = (item: Item) => {
  state.selectedTaskItem = item;
  state.showTaskItemDetail = true;
};

const openProjectDetail = (projectId: string) => {
  const project = projectStore.projects.find(p => p.id === projectId);
  if (project) {
    selectedProject.value = project;
    openProject(project);
    state.showProjectDetail = true;
  }
};

const openTaskDetail = (taskOrTaskId: Task | string) => {
  let task: Task | undefined;
  
  if (typeof taskOrTaskId === 'string') {
    // Find task by blockId across all projects
    for (const project of projectStore.projects) {
      task = project.tasks.find(t => t.blockId === taskOrTaskId);
      if (task) {
        selectedProject.value = project;
        break;
      }
    }
  } else {
    task = taskOrTaskId;
    // Find parent project
    for (const project of projectStore.projects) {
      if (project.tasks.some(t => t.blockId === task.blockId)) {
        selectedProject.value = project;
        break;
      }
    }
  }
  
  if (task) {
    selectedTask.value = task;
    openTask(task);
    state.showTaskDetail = true;
  }
};

const handleCreateTask = (projectId: string) => {
  state.selectedProjectId = projectId;
  state.selectedTaskBlockId = null;
  state.showQuickCreate = true;
  // Note: QuickCreateDrawer handles the actual task creation
};

const handleCreateItem = (taskId: string, projectId?: string) => {
  state.selectedTaskBlockId = taskId;
  state.selectedProjectId = projectId || '';
  state.showQuickCreate = true;
};

const applyFilters = () => {
  // Apply date filter
  if (state.dateFilter === 'today') {
    state.dateRange = { start: '1970-01-01', end: todayDate.value };
  } else if (state.dateFilter === 'week') {
    const nextWeek = dayjs(todayDate.value).add(6, 'day').format('YYYY-MM-DD');
    state.dateRange = { start: '1970-01-01', end: nextWeek };
  } else if (state.dateFilter === 'all') {
    state.dateRange = null;
  }
  // Custom date range is already set by the drawer
  
  showMessage(t('mobile.filter.applied') || '筛选已应用');
};

const completedDateRange = computed(() => {
  if (state.dateFilter === 'all') return null;
  if (state.dateFilter === 'today') {
    return { start: todayDate.value, end: todayDate.value };
  }
  if (state.dateFilter === 'week') {
    const nextWeek = dayjs(todayDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: todayDate.value, end: nextWeek };
  }
  return state.dateRange;
});

const handleOpenPomodoro = (item: Item) => {
  // Open pomodoro drawer with preselected item
  preselectedPomodoroBlockId.value = item.blockId;
  state.showPomodoroDrawer = true;
};

const handlePomodoroDrawerClose = (value: boolean) => {
  if (!value) {
    preselectedPomodoroBlockId.value = undefined;
  }
};

const handleSetTaskItemReminder = (item: Item) => {
  selectedItemForSetting.value = item;
  showReminderDrawer.value = true;
};

const handleSetTaskItemRecurring = (item: Item) => {
  selectedItemForSetting.value = item;
  showRecurringDrawer.value = true;
};

const handleToggleItemStatus = (item: Item, newStatus: ItemStatus) => {
  // TODO: Toggle item status
  showMessage(t('mobile.status.updated') || '状态已更新');
};

const handleCreated = () => {
  showMessage(t('mobile.create.success') || '创建成功');
  // Refresh data after creation
  handleRefresh();
};

// 数据刷新处理函数
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
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
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  updateSelectedItems();
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据监听
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();
  
  // 同步 todoDock 设置到 projectStore
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;
  
  // 初始数据加载
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  }
  
  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：用 BroadcastChannel 接收
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

  applyFilters();
  startDateCheck();
});

onUnmounted(() => {
  if (dateCheckTimer) {
    clearInterval(dateCheckTimer);
    dateCheckTimer = null;
  }
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
.mobile-todo-dock {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  background: var(--b3-theme-surface);
  overflow: hidden;
  position: relative;
}
</style>
