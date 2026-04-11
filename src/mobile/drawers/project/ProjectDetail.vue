<template>
  <Teleport to="body">
    <Transition name="slide-up-full">
      <div v-if="modelValue && project" class="project-detail-fullscreen">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="close">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="header-title">{{ t('mobile.detail.project') || '项目详情' }}</span>
          <button class="create-btn" @click="handleCreateTask">
            <svg><use xlink:href="#iconAdd"></use></svg>
          </button>
        </div>

        <!-- Project Info Section -->
        <div class="project-info-section">
          <div class="project-name-row">
            <div class="project-icon">
              <svg><use xlink:href="#iconFolder"></use></svg>
            </div>
            <h2 class="project-name">{{ project.name }}</h2>
          </div>
          <div v-if="project.description" class="project-description">
            {{ project.description }}
          </div>
          <div class="project-stats">
            <div class="stat-item">
              <span class="stat-value">{{ totalTasks }}</span>
              <span class="stat-label">{{ t('mobile.project.tasks') || '任务' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ totalItems }}</span>
              <span class="stat-label">{{ t('mobile.project.items') || '事项' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ completedItems }}</span>
              <span class="stat-label">{{ t('mobile.project.completed') || '已完成' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ completionRate }}%</span>
              <span class="stat-label">{{ t('mobile.project.progress') || '进度' }}</span>
            </div>
          </div>
        </div>

        <!-- Task List Grouped by Priority -->
        <div class="tasks-container">
          <!-- High Priority -->
          <div v-if="highPriorityTasks.length > 0" class="priority-section">
            <div class="priority-header high">
              <div class="priority-icon">
                <svg><use xlink:href="#iconFire"></use></svg>
              </div>
              <span class="priority-name">{{ t('mobile.priority.high') || '高优先级' }}</span>
              <span class="priority-count">{{ highPriorityTasks.length }}</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in highPriorityTasks"
                :key="task.id"
                class="task-item"
                @click="handleTaskClick(task)"
              >
                <div class="task-info">
                  <div class="task-name">{{ task.name }}</div>
                  <div class="task-meta">
                    <span class="task-level">{{ task.level }}</span>
                    <span class="task-items-count">{{ getTaskItemsCount(task) }} 事项</span>
                  </div>
                </div>
                <div class="task-progress">
                  <div class="progress-ring" :style="getProgressStyle(task)">
                    <span class="progress-text">{{ getTaskProgress(task) }}%</span>
                  </div>
                  <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Medium Priority -->
          <div v-if="mediumPriorityTasks.length > 0" class="priority-section">
            <div class="priority-header medium">
              <div class="priority-icon">
                <svg><use xlink:href="#iconLeaf"></use></svg>
              </div>
              <span class="priority-name">{{ t('mobile.priority.medium') || '中优先级' }}</span>
              <span class="priority-count">{{ mediumPriorityTasks.length }}</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in mediumPriorityTasks"
                :key="task.id"
                class="task-item"
                @click="handleTaskClick(task)"
              >
                <div class="task-info">
                  <div class="task-name">{{ task.name }}</div>
                  <div class="task-meta">
                    <span class="task-level">{{ task.level }}</span>
                    <span class="task-items-count">{{ getTaskItemsCount(task) }} 事项</span>
                  </div>
                </div>
                <div class="task-progress">
                  <div class="progress-ring" :style="getProgressStyle(task)">
                    <span class="progress-text">{{ getTaskProgress(task) }}%</span>
                  </div>
                  <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Priority -->
          <div v-if="lowPriorityTasks.length > 0" class="priority-section">
            <div class="priority-header low">
              <div class="priority-icon">
                <svg><use xlink:href="#iconCoffee"></use></svg>
              </div>
              <span class="priority-name">{{ t('mobile.priority.low') || '低优先级' }}</span>
              <span class="priority-count">{{ lowPriorityTasks.length }}</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in lowPriorityTasks"
                :key="task.id"
                class="task-item"
                @click="handleTaskClick(task)"
              >
                <div class="task-info">
                  <div class="task-name">{{ task.name }}</div>
                  <div class="task-meta">
                    <span class="task-level">{{ task.level }}</span>
                    <span class="task-items-count">{{ getTaskItemsCount(task) }} 事项</span>
                  </div>
                </div>
                <div class="task-progress">
                  <div class="progress-ring" :style="getProgressStyle(task)">
                    <span class="progress-text">{{ getTaskProgress(task) }}%</span>
                  </div>
                  <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- No Tasks -->
          <div v-if="allTasks.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg><use xlink:href="#iconList"></use></svg>
            </div>
            <span class="empty-text">{{ t('mobile.project.noTasks') || '暂无任务' }}</span>
            <button class="empty-action" @click="handleCreateTask">
              {{ t('mobile.project.createTask') || '创建任务' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import type { Project, Task, PriorityLevel } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  project: Project | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openTask': [task: Task];
  'createTask': [projectId: string];
}>();

// Computed: All tasks from project
const allTasks = computed(() => props.project?.tasks || []);

// Computed: Tasks grouped by priority
const highPriorityTasks = computed(() => 
  allTasks.value.filter(task => getTaskPriority(task) === 'high')
);

const mediumPriorityTasks = computed(() => 
  allTasks.value.filter(task => getTaskPriority(task) === 'medium')
);

const lowPriorityTasks = computed(() => 
  allTasks.value.filter(task => getTaskPriority(task) === 'low')
);

// Computed: Project stats
const totalTasks = computed(() => allTasks.value.length);

const totalItems = computed(() => 
  allTasks.value.reduce((sum, task) => sum + task.items.length, 0)
);

const completedItems = computed(() => 
  allTasks.value.reduce((sum, task) => 
    sum + task.items.filter(item => item.status === 'completed').length, 0
  )
);

const completionRate = computed(() => {
  const total = totalItems.value;
  if (total === 0) return 0;
  return Math.round((completedItems.value / total) * 100);
});

// Get task priority based on its items
function getTaskPriority(task: Task): PriorityLevel | undefined {
  // Check if any item has a priority
  for (const item of task.items) {
    if (item.priority) return item.priority;
  }
  return undefined;
}

// Get number of items in a task
function getTaskItemsCount(task: Task): number {
  return task.items.length;
}

// Get task completion progress
function getTaskProgress(task: Task): number {
  const total = task.items.length;
  if (total === 0) return 0;
  const completed = task.items.filter(item => item.status === 'completed').length;
  return Math.round((completed / total) * 100);
}

// Get progress ring style
function getProgressStyle(task: Task) {
  const progress = getTaskProgress(task);
  const color = progress === 100 ? '#52c41a' : progress > 50 ? '#1890ff' : '#faad14';
  
  return {
    background: `conic-gradient(${color} ${progress}%, var(--b3-border-color) 0)`
  };
}

// Handle task click
const handleTaskClick = (task: Task) => {
  emit('openTask', task);
};

// Handle create task button click
const handleCreateTask = () => {
  if (props.project?.id) {
    emit('createTask', props.project.id);
  }
};

// Close the drawer
const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.project-detail-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--b3-theme-background);
  z-index: 1001;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.back-btn,
.create-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--b3-theme-surface);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-on-background);
  }
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

// Project Info Section
.project-info-section {
  padding: 20px 16px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lightest) 0%, var(--b3-theme-surface) 100%);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.project-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.project-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  border-radius: 12px;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
    fill: var(--b3-theme-primary);
  }
}

.project-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.project-description {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  margin-bottom: 16px;
  line-height: 1.4;
}

.project-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--b3-theme-background);
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

// Tasks Container
.tasks-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

// Priority Section
.priority-section {
  margin-bottom: 20px;
}

.priority-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;
  font-weight: 500;

  &.high {
    background: rgba(220, 38, 38, 0.08);
    color: #dc2626;

    .priority-icon svg {
      fill: #dc2626;
    }

    .priority-count {
      background: rgba(220, 38, 38, 0.15);
      color: #dc2626;
    }
  }

  &.medium {
    background: rgba(234, 88, 12, 0.08);
    color: #ea580c;

    .priority-icon svg {
      fill: #ea580c;
    }

    .priority-count {
      background: rgba(234, 88, 12, 0.15);
      color: #ea580c;
    }
  }

  &.low {
    background: rgba(75, 85, 99, 0.08);
    color: #4b5563;

    .priority-icon svg {
      fill: #4b5563;
    }

    .priority-count {
      background: rgba(75, 85, 99, 0.15);
      color: #4b5563;
    }
  }
}

.priority-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 18px;
    height: 18px;
  }
}

.priority-name {
  font-size: 14px;
  flex: 1;
}

.priority-count {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

// Task List
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--b3-theme-surface);
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &:active {
    background: var(--b3-theme-surface-lighter);
    transform: scale(0.99);
  }
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-level {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-weight: 500;
}

.task-items-count {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-ring {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    width: 32px;
    height: 32px;
    background: var(--b3-theme-surface);
    border-radius: 50%;
  }
}

.progress-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  position: relative;
  z-index: 1;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
  transform: rotate(90deg);
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  border-radius: 16px;
  margin-bottom: 16px;

  svg {
    width: 32px;
    height: 32px;
    fill: var(--b3-theme-primary);
  }
}

.empty-text {
  font-size: 15px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-bottom: 20px;
}

.empty-action {
  padding: 12px 24px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.98);
  }
}

// Transitions
.slide-up-full-enter-active,
.slide-up-full-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-full-enter-from,
.slide-up-full-leave-to {
  transform: translateY(100%);
}
</style>
