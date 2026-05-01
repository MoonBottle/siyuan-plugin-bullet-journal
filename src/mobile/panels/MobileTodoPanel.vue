<template>
  <section class="mobile-todo-panel" data-testid="todo-panel">
    <div class="mobile-filter-bar-shell">
      <MobileFilterBar
        v-model:search="state.searchQuery"
        :has-active-filters="hasActiveFilters"
        @open-filter="state.showFilterDrawer = true"
      />
    </div>

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

    <FilterDrawer
      v-model="state.showFilterDrawer"
      v-model:selected-group="state.selectedGroup"
      v-model:date-filter="state.dateFilter"
      v-model:date-range="state.dateRange"
      v-model:priorities="state.selectedPriorities"
      @apply="applyFilters"
    />

    <ActionDrawer
      v-model="state.showActionDrawer"
      :item="state.selectedItem"
      @open-detail="openItemDetail"
      @open-pomodoro="handleOpenPomodoro"
    />

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

    <TaskItemDetail
      v-model="state.showTaskItemDetail"
      :item="state.selectedTaskItem"
      @open-pomodoro="handleOpenPomodoro"
      @set-reminder="handleSetTaskItemReminder"
      @set-recurring="handleSetTaskItemRecurring"
      @refresh="handleRefresh"
    />

    <ProjectDetail
      v-model="state.showProjectDetail"
      :project="selectedProject"
      @open-task="openTaskDetail"
      @create-task="handleCreateTask"
    />

    <TaskDetail
      v-model="state.showTaskDetail"
      :task="selectedTask"
      :project-id="selectedProject?.id"
      :project-name="selectedProject?.name"
      @open-item="openTaskItemDetail"
      @create-item="handleCreateItem"
      @toggle-item="handleToggleItemStatus"
    />

    <QuickCreateDrawer
      v-model="state.showQuickCreate"
      :preselected-project-id="state.selectedProjectId || undefined"
      :preselected-task-id="state.selectedTaskBlockId || undefined"
      @created="handleCreated"
    />

    <MobileReminderDrawer
      v-model="showReminderDrawer"
      :item="selectedItemForSetting"
      :initial-config="selectedItemForSetting?.reminder"
      @save="handleSettingDrawerClose"
      @cancel="selectedItemForSetting = null"
    />

    <MobileRecurringDrawer
      v-model="showRecurringDrawer"
      :item="selectedItemForSetting"
      :initial-repeat-rule="selectedItemForSetting?.repeatRule"
      :initial-end-condition="selectedItemForSetting?.endCondition"
      @save="handleSettingDrawerClose"
      @cancel="selectedItemForSetting = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import ActionDrawer from '@/mobile/drawers/action/ActionDrawer.vue';
import FilterDrawer from '@/mobile/drawers/filter/FilterDrawer.vue';
import MobileItemDetail from '@/mobile/drawers/item/MobileItemDetail.vue';
import MobileRecurringDrawer from '@/mobile/drawers/pomodoro/MobileRecurringDrawer.vue';
import MobileReminderDrawer from '@/mobile/drawers/pomodoro/MobileReminderDrawer.vue';
import ProjectDetail from '@/mobile/drawers/project/ProjectDetail.vue';
import QuickCreateDrawer from '@/mobile/drawers/quick-create/QuickCreateDrawer.vue';
import TaskItemDetail from '@/mobile/drawers/task/TaskItemDetail.vue';
import TaskDetail from '@/mobile/drawers/task/TaskDetail.vue';
import MobileFilterBar from '@/mobile/components/todo/MobileFilterBar.vue';
import MobileTodoList from '@/mobile/components/todo/MobileTodoList.vue';
import { useItemDetail } from '@/mobile/composables/useItemDetail';
import { t } from '@/i18n';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { Item, ItemStatus, PriorityLevel, Project, Task } from '@/types/models';
import { showMessage } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';
import { DATA_REFRESH_CHANNEL, eventBus, Events } from '@/utils/eventBus';
import { updateBlockContent } from '@/utils/fileUtils';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { buildCompletedTodoDateRange, buildTodoDateRange, type TodoDateFilterType } from '@/utils/todoDateFilter';
import { buildViewDebugContext } from '@/utils/viewDebug';

const emit = defineEmits<{
  'open-pomodoro': [{ blockId?: string }]
}>();

const plugin = usePlugin();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const { openItem, openProject, openTask } = useItemDetail();
const initialCurrentDate = projectStore.currentDate || dayjs().format('YYYY-MM-DD');

function buildDateRangeForFilter(
  dateFilter: TodoDateFilterType,
  currentDateValue: string,
  currentRange: { start: string, end: string } | null,
) {
  return buildTodoDateRange(
    dateFilter,
    currentDateValue,
    currentRange?.start ?? currentDateValue,
    currentRange?.end ?? dayjs(currentDateValue).add(7, 'day').format('YYYY-MM-DD'),
  );
}

const state = reactive({
  searchQuery: '',
  selectedGroup: '',
  dateFilter: 'today' as TodoDateFilterType,
  dateRange: buildDateRangeForFilter('today', initialCurrentDate, null) as { start: string, end: string } | null,
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
});

const currentDate = computed(() => projectStore.currentDate);
const selectedProject = ref<Project | null>(null);
const selectedTask = ref<Task | null>(null);
const showReminderDrawer = ref(false);
const showRecurringDrawer = ref(false);
const selectedItemForSetting = ref<Item | null>(null);

const handleSetReminder = (item: Item) => {
  selectedItemForSetting.value = item;
  showReminderDrawer.value = true;
};

const handleSetRecurring = (item: Item) => {
  selectedItemForSetting.value = item;
  showRecurringDrawer.value = true;
};

const handleSettingDrawerClose = () => {
  selectedItemForSetting.value = null;
  handleRefresh();
};

const hasActiveFilters = computed(() => {
  return (
    state.selectedGroup !== ''
    || state.dateFilter !== 'today'
    || state.selectedPriorities.length > 0
  );
});

settingsStore.loadFromPlugin();
projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

const updateSelectedItems = () => {
  if (state.showItemDetail && state.selectedItem?.blockId) {
    const updatedItem = projectStore.getDisplayItems('').find(item => item.blockId === state.selectedItem?.blockId);
    if (updatedItem) {
      state.selectedItem = updatedItem;
    }
  }

  if (state.showTaskItemDetail && state.selectedTaskItem?.blockId) {
    const updatedItem = projectStore.getDisplayItems('').find(item => item.blockId === state.selectedTaskItem?.blockId);
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

const openQuickCreate = () => {
  state.selectedProjectId = null;
  state.selectedTaskBlockId = null;
  state.showQuickCreate = true;
};

const handleQuickComplete = async (item: Item) => {
  if (!item.blockId)
    return;
  const tag = t('statusTag').completed || '✅';
  await updateBlockContent(item.blockId, tag);
  showMessage(t('todo').complete);
};

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
  const project = projectStore.projects.find(project => project.id === projectId);
  if (!project)
    return;

  selectedProject.value = project;
  openProject(project);
  state.showProjectDetail = true;
};

const openTaskDetail = (taskOrTaskId: Task | string) => {
  let task: Task | undefined;

  if (typeof taskOrTaskId === 'string') {
    for (const project of projectStore.projects) {
      task = project.tasks.find(currentTask => currentTask.blockId === taskOrTaskId);
      if (task) {
        selectedProject.value = project;
        break;
      }
    }
  }
  else {
    task = taskOrTaskId;
    for (const project of projectStore.projects) {
      if (project.tasks.some(currentTask => currentTask.blockId === task.blockId)) {
        selectedProject.value = project;
        break;
      }
    }
  }

  if (!task)
    return;

  selectedTask.value = task;
  openTask(task);
  state.showTaskDetail = true;
};

const handleCreateTask = (projectId: string) => {
  state.selectedProjectId = projectId;
  state.selectedTaskBlockId = null;
  state.showQuickCreate = true;
};

const handleCreateItem = (taskId: string, projectId?: string) => {
  state.selectedTaskBlockId = taskId;
  state.selectedProjectId = projectId || '';
  state.showQuickCreate = true;
};

const applyFilters = (options: { silent?: boolean } = {}) => {
  state.dateRange = buildDateRangeForFilter(state.dateFilter, currentDate.value, state.dateRange);

  if (!options.silent) {
    showMessage(t('mobile.filter.applied') || '筛选已应用');
  }
};

const completedDateRange = computed(() => {
  return buildCompletedTodoDateRange(state.dateFilter, currentDate.value, state.dateRange);
});

watch(
  () => projectStore.currentDate,
  () => {
    if (state.dateFilter === 'today' || state.dateFilter === 'week') {
      applyFilters({ silent: true });
    }
  },
);

const handleOpenPomodoro = (item: Item) => {
  emit('open-pomodoro', {
    blockId: item.blockId,
  });
};

const handleSetTaskItemReminder = (item: Item) => {
  selectedItemForSetting.value = item;
  showReminderDrawer.value = true;
};

const handleSetTaskItemRecurring = (item: Item) => {
  selectedItemForSetting.value = item;
  showRecurringDrawer.value = true;
};

const handleToggleItemStatus = (_item: Item, _newStatus: ItemStatus) => {
  showMessage(t('mobile.status.updated') || '状态已更新');
};

const handleCreated = () => {
  showMessage(t('mobile.create.success') || '创建成功');
  handleRefresh();
};

const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', {
    ...buildViewDebugContext('MobileTodoPanel', plugin),
    hasPayload: Boolean(payload),
    payloadKeys: payload ? Object.keys(payload) : [],
  });

  if (!plugin)
    return;

  const storeKeys = [
    'directories',
    'groups',
    'defaultGroup',
    'lunchBreakStart',
    'lunchBreakEnd',
    'showPomodoroBlocks',
    'showPomodoroTotal',
    'todoDock',
    'scanMode',
  ];

  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(key => key in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach((key) => {
      if (payload[key] !== undefined)
        patch[key] = payload[key];
    });
    if (Object.keys(patch).length > 0) {
      settingsStore.$patch(patch);
    }
  }
  else {
    settingsStore.loadFromPlugin();
  }

  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  updateSelectedItems();
};

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('MobileTodoPanel', plugin));

  settingsStore.loadFromPlugin();
  projectStore.hideCompleted = settingsStore.todoDock.hideCompleted;
  projectStore.hideAbandoned = settingsStore.todoDock.hideAbandoned;

  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
  }

  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: (payload) => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('MobileTodoPanel', plugin),
          data: payload ? { type: 'DATA_REFRESH', ...payload } : { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh(payload);
      },
      viewName: 'MobileTodoPanel',
    });
  }
  catch {
    // Ignore BroadcastChannel failures on unsupported environments.
  }

  applyFilters({ silent: true });
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('MobileTodoPanel', plugin));

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

defineExpose({
  openQuickCreate,
});
</script>

<style lang="scss" scoped>
.mobile-todo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  background: var(--b3-theme-surface);
  overflow: hidden;
  position: relative;
}

.mobile-filter-bar-shell {
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
  box-sizing: border-box;
}
</style>
