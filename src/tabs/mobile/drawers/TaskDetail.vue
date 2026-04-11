<template>
  <Teleport to="body">
    <Transition name="slide-up-full">
      <div v-if="modelValue && task" class="task-detail-fullscreen">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="close">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="header-title">{{ t('mobile.detail.task') || '任务详情' }}</span>
          <button class="create-btn" @click="handleCreateItem">
            <svg><use xlink:href="#iconAdd"></use></svg>
          </button>
        </div>

        <!-- Task Info Section -->
        <div class="task-info-section">
          <div class="task-name-row">
            <div class="task-icon">
              <svg><use xlink:href="#iconTask"></use></svg>
            </div>
            <h2 class="task-name">{{ task.name }}</h2>
          </div>
          <div class="task-meta-row">
            <span class="task-level-badge">{{ task.level }}</span>
            <span v-if="projectName" class="project-name">{{ projectName }}</span>
          </div>
          <div class="task-stats">
            <div class="stat-item">
              <span class="stat-value">{{ totalItems }}</span>
              <span class="stat-label">{{ t('mobile.task.items') || '事项' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ completedItems }}</span>
              <span class="stat-label">{{ t('mobile.task.completed') || '已完成' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ pendingItems }}</span>
              <span class="stat-label">{{ t('mobile.task.pending') || '待完成' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ completionRate }}%</span>
              <span class="stat-label">{{ t('mobile.task.progress') || '进度' }}</span>
            </div>
          </div>
        </div>

        <!-- Items List Grouped by Status -->
        <div class="items-container">
          <!-- Pending Items -->
          <div v-if="pendingItemsList.length > 0" class="status-section">
            <div class="status-header pending">
              <div class="status-icon">
                <svg><use xlink:href="#iconClock"></use></svg>
              </div>
              <span class="status-name">{{ t('mobile.status.pending') || '待完成' }}</span>
              <span class="status-count">{{ pendingItemsList.length }}</span>
            </div>
            <div class="item-list">
              <div
                v-for="item in pendingItemsList"
                :key="item.id"
                class="item-row"
                @click="handleItemClick(item)"
              >
                <div class="item-checkbox" @click.stop="toggleItemStatus(item)">
                  <div class="checkbox-circle"></div>
                </div>
                <div class="item-content">
                  <div class="item-text">{{ item.content }}</div>
                  <div v-if="item.date" class="item-date">
                    {{ formatDate(item.date) }}
                  </div>
                </div>
                <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
              </div>
            </div>
          </div>

          <!-- Completed Items -->
          <div v-if="completedItemsList.length > 0" class="status-section">
            <div class="status-header completed">
              <div class="status-icon">
                <svg><use xlink:href="#iconCheck"></use></svg>
              </div>
              <span class="status-name">{{ t('mobile.status.completed') || '已完成' }}</span>
              <span class="status-count">{{ completedItemsList.length }}</span>
            </div>
            <div class="item-list">
              <div
                v-for="item in completedItemsList"
                :key="item.id"
                class="item-row completed"
                @click="handleItemClick(item)"
              >
                <div class="item-checkbox" @click.stop="toggleItemStatus(item)">
                  <div class="checkbox-circle checked">
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </div>
                </div>
                <div class="item-content">
                  <div class="item-text">{{ item.content }}</div>
                  <div v-if="item.date" class="item-date">
                    {{ formatDate(item.date) }}
                  </div>
                </div>
                <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
              </div>
            </div>
          </div>

          <!-- Abandoned Items -->
          <div v-if="abandonedItemsList.length > 0" class="status-section">
            <div class="status-header abandoned">
              <div class="status-icon">
                <svg><use xlink:href="#iconBan"></use></svg>
              </div>
              <span class="status-name">{{ t('mobile.status.abandoned') || '已放弃' }}</span>
              <span class="status-count">{{ abandonedItemsList.length }}</span>
            </div>
            <div class="item-list">
              <div
                v-for="item in abandonedItemsList"
                :key="item.id"
                class="item-row abandoned"
                @click="handleItemClick(item)"
              >
                <div class="item-checkbox">
                  <div class="checkbox-circle abandoned">
                    <svg><use xlink:href="#iconClose"></use></svg>
                  </div>
                </div>
                <div class="item-content">
                  <div class="item-text">{{ item.content }}</div>
                  <div v-if="item.date" class="item-date">
                    {{ formatDate(item.date) }}
                  </div>
                </div>
                <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
              </div>
            </div>
          </div>

          <!-- No Items -->
          <div v-if="allItems.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg><use xlink:href="#iconEdit"></use></svg>
            </div>
            <span class="empty-text">{{ t('mobile.task.noItems') || '暂无事项' }}</span>
            <button class="empty-action" @click="handleCreateItem">
              {{ t('mobile.task.createItem') || '创建事项' }}
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
import type { Task, Item, ItemStatus } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  task: Task | null;
  projectName?: string;
  projectId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openItem': [item: Item];
  'createItem': [taskId: string, projectId?: string];
  'toggleItem': [item: Item, newStatus: ItemStatus];
}>();

// Computed: All items from task
const allItems = computed(() => props.task?.items || []);

// Computed: Items grouped by status
const pendingItemsList = computed(() =>
  allItems.value.filter(item => item.status === 'pending')
);

const completedItemsList = computed(() =>
  allItems.value.filter(item => item.status === 'completed')
);

const abandonedItemsList = computed(() =>
  allItems.value.filter(item => item.status === 'abandoned')
);

// Computed: Task stats
const totalItems = computed(() => allItems.value.length);

const completedItems = computed(() =>
  allItems.value.filter(item => item.status === 'completed').length
);

const pendingItems = computed(() =>
  allItems.value.filter(item => item.status === 'pending').length
);

const completionRate = computed(() => {
  const total = totalItems.value;
  if (total === 0) return 0;
  return Math.round((completedItems.value / total) * 100);
});

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return t('mobile.date.today') || '今天';
  }
  if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return t('mobile.date.tomorrow') || '明天';
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Handle item click
const handleItemClick = (item: Item) => {
  emit('openItem', item);
};

// Toggle item status
const toggleItemStatus = (item: Item) => {
  const newStatus: ItemStatus = item.status === 'completed' ? 'pending' : 'completed';
  emit('toggleItem', item, newStatus);
};

// Handle create item button click
const handleCreateItem = () => {
  if (props.task?.id) {
    emit('createItem', props.task.id, props.projectId);
  }
};

// Close the drawer
const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.task-detail-fullscreen {
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

// Task Info Section
.task-info-section {
  padding: 20px 16px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lightest) 0%, var(--b3-theme-surface) 100%);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.task-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.task-icon {
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

.task-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.task-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.task-level-badge {
  font-size: 12px;
  padding: 4px 10px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-weight: 500;
}

.project-name {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.task-stats {
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

// Items Container
.items-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

// Status Section
.status-section {
  margin-bottom: 20px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;
  font-weight: 500;

  &.pending {
    background: rgba(234, 88, 12, 0.08);
    color: #ea580c;

    .status-icon svg {
      fill: #ea580c;
    }

    .status-count {
      background: rgba(234, 88, 12, 0.15);
      color: #ea580c;
    }
  }

  &.completed {
    background: rgba(34, 197, 94, 0.08);
    color: #16a34a;

    .status-icon svg {
      fill: #16a34a;
    }

    .status-count {
      background: rgba(34, 197, 94, 0.15);
      color: #16a34a;
    }
  }

  &.abandoned {
    background: rgba(107, 114, 128, 0.08);
    color: #6b7280;

    .status-icon svg {
      fill: #6b7280;
    }

    .status-count {
      background: rgba(107, 114, 128, 0.15);
      color: #6b7280;
    }
  }
}

.status-icon {
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

.status-name {
  font-size: 14px;
  flex: 1;
}

.status-count {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

// Item List
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
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

  &.completed {
    .item-text {
      text-decoration: line-through;
      opacity: 0.6;
    }
  }

  &.abandoned {
    .item-text {
      text-decoration: line-through;
      opacity: 0.5;
    }
  }
}

.item-checkbox {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-circle {
  width: 20px;
  height: 20px;
  border: 2px solid var(--b3-border-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &.checked {
    background: #22c55e;
    border-color: #22c55e;

    svg {
      width: 12px;
      height: 12px;
      fill: white;
    }
  }

  &.abandoned {
    background: #6b7280;
    border-color: #6b7280;

    svg {
      width: 10px;
      height: 10px;
      fill: white;
    }
  }
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-text {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-date {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
  flex-shrink: 0;
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
