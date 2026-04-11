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
      :priorities="state.selectedPriorities"
      :has-active-filters="hasActiveFilters"
      @item-click="openItemDetail"
      @item-long-press="handleQuickComplete"
      @refresh="handleRefresh"
    />
    
    <MobileBottomNav
      @refresh="handleRefresh"
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
    />

    <!-- Task Item Detail Drawer (higher z-index, no nested navigation) -->
    <TaskItemDetail
      v-model="state.showTaskItemDetail"
      :item="state.selectedTaskItem"
      @open-pomodoro="handleOpenPomodoro"
      @set-reminder="handleSetTaskItemReminder"
      @set-recurring="handleSetTaskItemRecurring"
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import MobileFilterBar from './components/MobileFilterBar.vue';
import MobileTodoList from './components/MobileTodoList.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';
import FilterDrawer from './drawers/FilterDrawer.vue';
import ActionDrawer from './drawers/ActionDrawer.vue';
import MobileItemDetail from './drawers/MobileItemDetail.vue';
import TaskItemDetail from './drawers/TaskItemDetail.vue';
import ProjectDetail from './drawers/ProjectDetail.vue';
import TaskDetail from './drawers/TaskDetail.vue';
import QuickCreateDrawer from './drawers/QuickCreateDrawer.vue';
import { useItemDetail } from './composables/useItemDetail';
import { useProjectStore, useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { showMessage, showPomodoroTimerDialog } from '@/utils/dialog';
import { updateBlockContent } from '@/utils/fileUtils';
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
});

// Selected project and task refs for detail drawers
const selectedProject = ref<Project | null>(null);
const selectedTask = ref<Task | null>(null);

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

const handleRefresh = async () => {
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
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
    const today = dayjs().format('YYYY-MM-DD');
    state.dateRange = { start: today, end: today };
  } else if (state.dateFilter === 'week') {
    state.dateRange = {
      start: dayjs().format('YYYY-MM-DD'),
      end: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    };
  } else if (state.dateFilter === 'all') {
    state.dateRange = null;
  }
  // Custom date range is already set by the drawer
  
  showMessage(t('mobile.filter.applied') || '筛选已应用');
};

const handleOpenPomodoro = (item: Item) => {
  // Open pomodoro timer dialog with preselected item
  showPomodoroTimerDialog(item.blockId);
};

const handleSetReminder = (item: Item) => {
  // TODO: Open reminder dialog
  showMessage(t('mobile.reminder.set') || '设置提醒');
};

const handleSetRecurring = (item: Item) => {
  // TODO: Open recurring dialog
  showMessage(t('mobile.recurring.set') || '设置重复');
};

const handleSetTaskItemReminder = (item: Item) => {
  // TODO: Open reminder dialog
  showMessage(t('mobile.reminder.set') || '设置提醒');
};

const handleSetTaskItemRecurring = (item: Item) => {
  // TODO: Open recurring dialog
  showMessage(t('mobile.recurring.set') || '设置重复');
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
</script>

<style lang="scss" scoped>
.mobile-todo-dock {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--b3-theme-surface);
}
</style>
