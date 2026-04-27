<template>
  <div 
    class="mobile-todo-list" 
    ref="scrollContainer"
    @touchstart="handleContainerTouchStart"
    @touchmove="handleContainerTouchMove"
    @touchend="handleContainerTouchEnd"
  >
    <!-- 下拉刷新指示器 -->
    <div 
      class="pull-refresh-indicator"
      :style="{ transform: `translateY(${pullDistance}px)` }"
    >
      <div v-if="isRefreshing" class="refresh-spinner">
        <SyLoading :text="t('common').refreshing || '刷新中...'" />
      </div>
      <div v-else class="pull-text">
        {{ pullDistance >= REFRESH_THRESHOLD ? (t('mobile.releaseToRefresh') || '释放刷新') : (t('mobile.pullToRefresh') || '下拉刷新') }}
      </div>
    </div>
    <div class="todo-content">
      <SyLoading v-if="loading" :text="t('common').loading" />
      
      <!-- Empty states -->
      <div v-else-if="hasActiveFilters && filteredItems.length === 0" class="empty-guide">
        <div class="empty-icon-wrapper">
          <svg class="empty-icon"><use xlink:href="#iconSearch"></use></svg>
        </div>
        <div class="empty-title">{{ t('todo').noFilterResults || '没有找到符合条件的事项' }}</div>
        <div class="empty-desc">{{ t('todo').adjustFilters || '请尝试调整筛选条件' }}</div>
      </div>
      
      <div v-else-if="!hasAnyItems" class="empty-guide">
        <div class="empty-icon-wrapper large">
          <svg class="empty-icon"><use xlink:href="#iconList"></use></svg>
        </div>
        <div class="empty-title">{{ t('todo').emptyGuideTitle }}</div>
        <div class="empty-desc">{{ t('todo').emptyGuideDesc }}</div>
        <button class="create-example-btn" @click="handleCreateExample">
          <svg><use xlink:href="#iconAdd"></use></svg>
          {{ t('todo').createExampleDoc }}
        </button>
      </div>
      
      <!-- Grouped list -->
      <div v-else class="todo-sections">
        <!-- Expired items -->
        <div v-if="expiredItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('expired')">
            <div class="section-title-wrapper">
              <div class="section-status-bar expired"></div>
              <span class="section-title">{{ t('todo').expired }}</span>
              <span class="section-count">{{ expiredItems.length }}</span>
            </div>
            <div class="section-actions">
              <button class="action-link" @click.stop="handlePostponeAll(expiredItems)">
                {{ t('mobile.postpone') || '顺延' }}
              </button>
              <div class="collapse-icon" :class="{ collapsed: collapsedSections.expired }">
                <svg><use xlink:href="#iconDown"></use></svg>
              </div>
            </div>
          </div>
          <div v-show="!collapsedSections.expired" class="section-content">
            <div
              v-for="(item, index) in expiredItems"
              :key="item.id"
              class="todo-item"
              :class="{ 'is-last': index === expiredItems.length - 1 }"
              @click="emit('itemClick', item)"
              @touchstart="handleTouchStart(item)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <div class="item-status-bar expired"></div>
              <div class="item-content">
                <div class="item-title">{{ item.content }}</div>
                <div class="item-meta">
                  <span class="meta-date expired">{{ formatExpiredDate(item) }}</span>
                  <span v-if="item.priority" class="priority-tag" :class="item.priority">{{ getPriorityLabel(item.priority) }}</span>
                  <svg v-if="item.repeatRule" class="meta-icon"><use xlink:href="#iconRefresh"></use></svg>
                  <svg v-if="item.reminder?.enabled" class="meta-icon"><use xlink:href="#iconClock"></use></svg>
                </div>
              </div>
              <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
            </div>
          </div>
        </div>
        
        <!-- Today's items -->
        <div v-if="todayItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('today')">
            <div class="section-title-wrapper">
              <div class="section-status-bar today"></div>
              <span class="section-title">{{ t('todo').today }}</span>
              <span class="section-count">{{ todayItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.today }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.today" class="section-content">
            <div
              v-for="(item, index) in todayItems"
              :key="item.id"
              class="todo-item"
              :class="{ 'is-last': index === todayItems.length - 1 }"
              @click="emit('itemClick', item)"
              @touchstart="handleTouchStart(item)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <div class="item-status-bar today"></div>
              <div class="item-content">
                <div class="item-title">{{ item.content }}</div>
                <div class="item-meta">
                  <span v-if="item.startDateTime" class="meta-time">{{ formatTime(item) }}</span>
                  <span v-else class="meta-time all-day">{{ t('todo.allDay') || '全天' }}</span>
                  <span v-if="item.priority" class="priority-tag" :class="item.priority">{{ getPriorityLabel(item.priority) }}</span>
                  <svg v-if="item.repeatRule" class="meta-icon"><use xlink:href="#iconRefresh"></use></svg>
                  <svg v-if="item.reminder?.enabled" class="meta-icon"><use xlink:href="#iconClock"></use></svg>
                </div>
              </div>
              <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
            </div>
          </div>
        </div>
        
        <!-- Tomorrow's items -->
        <div v-if="tomorrowItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('tomorrow')">
            <div class="section-title-wrapper">
              <div class="section-status-bar tomorrow"></div>
              <span class="section-title">{{ t('todo').tomorrow }}</span>
              <span class="section-count">{{ tomorrowItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.tomorrow }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.tomorrow" class="section-content">
            <div
              v-for="(item, index) in tomorrowItems"
              :key="item.id"
              class="todo-item"
              :class="{ 'is-last': index === tomorrowItems.length - 1 }"
              @click="emit('itemClick', item)"
              @touchstart="handleTouchStart(item)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <div class="item-status-bar tomorrow"></div>
              <div class="item-content">
                <div class="item-title">{{ item.content }}</div>
                <div class="item-meta">
                  <span v-if="item.startDateTime" class="meta-time">{{ formatTime(item) }}</span>
                  <span v-else class="meta-time all-day">{{ t('todo.allDay') || '全天' }}</span>
                  <span v-if="item.priority" class="priority-tag" :class="item.priority">{{ getPriorityLabel(item.priority) }}</span>
                </div>
              </div>
              <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
            </div>
          </div>
        </div>
        
        <!-- Future items -->
        <div v-if="futureItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('future')">
            <div class="section-title-wrapper">
              <div class="section-status-bar future"></div>
              <span class="section-title">{{ t('todo').future }}</span>
              <span class="section-count">{{ futureItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.future }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.future" class="section-content">
            <div v-for="date in futureDates" :key="date" class="date-group">
              <div class="date-divider">{{ formatDateLabel(date) }}</div>
              <div
                v-for="(item, index) in groupedFutureItems.get(date)"
                :key="item.id"
                class="todo-item"
                :class="{ 'is-last': index === groupedFutureItems.get(date)!.length - 1 }"
                @click="emit('itemClick', item)"
                @touchstart="handleTouchStart(item)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
              >
                <div class="item-status-bar future"></div>
                <div class="item-content">
                  <div class="item-title">{{ item.content }}</div>
                  <div class="item-meta">
                    <span v-if="item.startDateTime" class="meta-time">{{ formatTime(item) }}</span>
                    <span v-else class="meta-time all-day">{{ t('todo.allDay') || '全天' }}</span>
                    <span v-if="item.priority" class="priority-tag" :class="item.priority">{{ getPriorityLabel(item.priority) }}</span>
                  </div>
                </div>
                <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Completed items -->
        <div v-if="!hideCompleted && completedItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('completed')">
            <div class="section-title-wrapper">
              <div class="section-status-bar completed"></div>
              <span class="section-title">{{ t('todo').completed }}</span>
              <span class="section-count">{{ completedItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.completed }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.completed" class="section-content">
            <div
              v-for="(item, index) in completedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item completed-item"
              :class="{ 'is-last': index === completedItems.slice(0, 10).length - 1 }"
              @click="emit('itemClick', item)"
              @touchstart="handleTouchStart(item)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <div class="item-status-bar completed"></div>
              <div class="item-content">
                <div class="item-title">{{ item.content }}</div>
                <div class="item-meta">
                  <span class="meta-date">{{ formatExpiredDate(item) }}</span>
                </div>
              </div>
              <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
            </div>
          </div>
        </div>
        
        <!-- Abandoned items -->
        <div v-if="!hideAbandoned && abandonedItems.length > 0" class="todo-section">
          <div class="section-header" @click="toggleSection('abandoned')">
            <div class="section-title-wrapper">
              <div class="section-status-bar abandoned"></div>
              <span class="section-title">{{ t('todo').abandoned }}</span>
              <span class="section-count">{{ abandonedItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.abandoned }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.abandoned" class="section-content">
            <div
              v-for="(item, index) in abandonedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item abandoned-item"
              :class="{ 'is-last': index === abandonedItems.slice(0, 10).length - 1 }"
              @click="emit('itemClick', item)"
              @touchstart="handleTouchStart(item)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <div class="item-status-bar abandoned"></div>
              <div class="item-content">
                <div class="item-title">{{ item.content }}</div>
                <div class="item-meta">
                  <span class="meta-date">{{ formatExpiredDate(item) }}</span>
                </div>
              </div>
              <div v-if="item.project" class="item-project">{{ item.project.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import SyLoading from '@/components/SiyuanTheme/SyLoading.vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import type { Item, PriorityLevel } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { formatDateLabel as formatDateLabelUtil } from '@/utils/dateUtils';
import { getEffectiveDate } from '@/utils/dateRangeUtils';
import { createExampleDocument } from '@/utils/exampleDocUtils';
import { updateBlockDateTime } from '@/utils/fileUtils';
import { showMessage } from '@/utils/dialog';

const props = defineProps<{
  groupId?: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  completedDateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  hasActiveFilters?: boolean;
}>();

const emit = defineEmits<{
  itemClick: [item: Item];
  itemLongPress: [item: Item];
  refresh: [];
}>();

// Pull-to-refresh state
const isRefreshing = ref(false);
const pullDistance = ref(0);
const isPulling = ref(false);
const startY = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);

const REFRESH_THRESHOLD = 80;

// Pull-to-refresh touch handlers
const handleContainerTouchStart = (e: TouchEvent) => {
  if (scrollContainer.value?.scrollTop === 0) {
    startY.value = e.touches[0].clientY;
    isPulling.value = true;
  }
};

const handleContainerTouchMove = (e: TouchEvent) => {
  if (!isPulling.value) return;
  const currentY = e.touches[0].clientY;
  const diff = currentY - startY.value;
  if (diff > 0) {
    pullDistance.value = Math.min(diff * 0.5, REFRESH_THRESHOLD + 20);
    // Only prevent default when necessary (handled via .passive modifier)
    if (pullDistance.value > 0) {
      e.preventDefault();
    }
  }
};

const handleContainerTouchEnd = async () => {
  if (!isPulling.value) return;
  isPulling.value = false;
  
  if (pullDistance.value >= REFRESH_THRESHOLD) {
    isRefreshing.value = true;
    emit('refresh');
    isRefreshing.value = false;
  }
  pullDistance.value = 0;
};

const projectStore = useProjectStore();
const loading = computed(() => projectStore.loading);
const hasAnyItems = computed(() => projectStore.getDisplayItems('').length > 0);

// Long press handling
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let currentItem: Item | null = null;
const PRESS_DURATION = 500;

// Collapsible sections
const collapsedSections = ref({
  expired: false,
  today: false,
  tomorrow: false,
  future: false,
  completed: false,
  abandoned: false,
});

const toggleSection = (section: keyof typeof collapsedSections.value) => {
  collapsedSections.value[section] = !collapsedSections.value[section];
};

// Filtered items
const filteredItems = computed(() => {
  return projectStore.getFilteredAndSortedItems({
    groupId: props.groupId || '',
    searchQuery: props.searchQuery || '',
    dateRange: props.dateRange,
    priorities: props.priorities?.length ? props.priorities : undefined,
  });
});

// Group items by date
const todayStr = dayjs().format('YYYY-MM-DD');
const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

// 隐藏设置
const hideCompleted = computed(() => projectStore.hideCompleted);
const hideAbandoned = computed(() => projectStore.hideAbandoned);

// 只包含待办状态的事项（已完成和已放弃单独分组）
const pendingItems = computed(() => {
  return filteredItems.value.filter(item => item.status === 'pending');
});

// 已完成事项
const completedItems = computed(() => {
  return projectStore.getFilteredCompletedItems({
    groupId: props.groupId || '',
    searchQuery: props.searchQuery || '',
    dateRange: props.completedDateRange ?? props.dateRange,
    priorities: props.priorities?.length ? props.priorities : undefined,
  });
});

// 已放弃事项
const abandonedItems = computed(() => {
  return projectStore.getFilteredAbandonedItems({
    groupId: props.groupId || '',
    searchQuery: props.searchQuery || '',
    dateRange: props.completedDateRange ?? props.dateRange,
    priorities: props.priorities?.length ? props.priorities : undefined,
  });
});

const expiredItems = computed(() => {
  return pendingItems.value.filter(item => getEffectiveDate(item) < todayStr);
});

const todayItems = computed(() => {
  return pendingItems.value.filter(item => item.date === todayStr);
});

const tomorrowItems = computed(() => {
  return pendingItems.value.filter(item => item.date === tomorrowStr);
});

const futureItems = computed(() => {
  return pendingItems.value.filter(item => {
    const date = item.date;
    return date > tomorrowStr && getEffectiveDate(item) >= todayStr;
  });
});

const groupedFutureItems = computed(() => {
  const grouped = new Map<string, Item[]>();
  futureItems.value.forEach(item => {
    const list = grouped.get(item.date);
    if (list) {
      list.push(item);
    } else {
      grouped.set(item.date, [item]);
    }
  });
  return grouped;
});

const futureDates = computed(() => {
  return Array.from(groupedFutureItems.value.keys()).sort();
});

// Format helpers
const formatDateLabel = (date: string) => {
  return formatDateLabelUtil(date, t('todo').today, t('todo').tomorrow);
};

const formatExpiredDate = (item: Item) => {
  const date = getEffectiveDate(item);
  const day = dayjs(date);
  const today = dayjs();
  const diffDays = today.diff(day, 'day');
  
  if (diffDays === 1) return t('todo.yesterday') || '昨天';
  return day.format('M月D日');
};

const formatTime = (item: Item) => {
  if (!item.startDateTime) return '';
  return item.startDateTime.split(' ')[1]?.slice(0, 5) || '';
};

const getPriorityLabel = (priority: PriorityLevel) => {
  const labels: Record<string, string> = {
    high: t('todo.priority.high') || '高',
    medium: t('todo.priority.medium') || '中',
    low: t('todo.priority.low') || '低',
  };
  return labels[priority] || priority;
};

// Touch handlers for long press
const handleTouchStart = (item: Item) => {
  currentItem = item;
  pressTimer = setTimeout(() => {
    if (currentItem) {
      emit('itemLongPress', currentItem);
    }
    pressTimer = null;
  }, PRESS_DURATION);
};

const handleTouchEnd = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  currentItem = null;
};

const handleTouchMove = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  currentItem = null;
};

// Postpone all expired items
const handlePostponeAll = async (items: Item[]) => {
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  let successCount = 0;
  
  for (const item of items) {
    if (item.blockId) {
      try {
        await updateBlockDateTime(
          item.blockId,
          tomorrow,
          item.startDateTime?.split(' ')[1],
          item.endDateTime?.split(' ')[1]
        );
        successCount++;
      } catch (e) {
        console.error('Failed to postpone item:', e);
      }
    }
  }
  
  if (successCount > 0) {
    showMessage(t('mobile.postponeSuccess', { count: successCount }) || `已顺延 ${successCount} 个事项到明天`);
    emit('refresh');
  }
};

const handleCreateExample = async () => {
  await createExampleDocument();
};

onUnmounted(() => {
  if (pressTimer) {
    clearTimeout(pressTimer);
  }
});
</script>

<style lang="scss" scoped>
.mobile-todo-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background: var(--b3-theme-surface);
  width: 100%;
}

.pull-refresh-indicator {
  position: absolute;
  top: -60px;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.pull-text {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.refresh-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.todo-content {
  padding: 12px 16px 24px;
  min-height: 100%;
  box-sizing: border-box;
}

// Empty states
.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface-lighter);
  border-radius: 50%;
  margin-bottom: 20px;
  
  &.large {
    width: 80px;
    height: 80px;
  }
  
  .empty-icon {
    width: 32px;
    height: 32px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.4;
    
    .large & {
      width: 40px;
      height: 40px;
    }
  }
}

.empty-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--b3-theme-on-background);
}

.empty-desc {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-bottom: 24px;
  max-width: 280px;
  line-height: 1.5;
}

.create-example-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

// Todo sections
.todo-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-section {
  background: var(--b3-theme-background);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  box-sizing: border-box;
}

.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.section-status-bar {
  width: 4px;
  height: 20px;
  border-radius: 2px;
  
  &.expired {
    background: #ef4444;
  }
  
  &.today {
    background: var(--b3-theme-primary);
  }
  
  &.tomorrow {
    background: #10b981;
  }
  
  &.future {
    background: #8b5cf6;
  }
  
  &.completed {
    background: #22c55e;
  }
  
  &.abandoned {
    background: #9ca3af;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
}

.section-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  background: var(--b3-theme-surface-lighter);
  padding: 2px 10px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.action-link {
  font-size: 13px;
  font-weight: 500;
  color: #10b981;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(16, 185, 129, 0.1);
  }
}

.collapse-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  
  svg {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
  
  &.collapsed {
    transform: rotate(-90deg);
  }
}

.section-content {
  padding: 4px 0;
}

// Todo items
.todo-item {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--b3-border-color);
  
  &:hover {
    background: var(--b3-theme-surface);
  }
  
  &:active {
    background: var(--b3-theme-surface-lighter);
  }
  
  &.is-last {
    border-bottom: none;
  }
}

.item-status-bar {
  width: 3px;
  height: 40px;
  border-radius: 2px;
  margin-right: 12px;
  flex-shrink: 0;
  
  &.expired {
    background: #ef4444;
  }
  
  &.today {
    background: var(--b3-theme-primary);
  }
  
  &.tomorrow {
    background: #10b981;
  }
  
  &.future {
    background: #8b5cf6;
  }
  
  &.completed {
    background: #22c55e;
  }
  
  &.abandoned {
    background: #9ca3af;
  }
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-item .item-title,
.abandoned-item .item-title {
  text-decoration: line-through;
  opacity: 0.6;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-date {
  font-size: 12px;
  font-weight: 500;
  
  &.expired {
    color: #ef4444;
  }
}

.meta-time {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
  
  &.all-day {
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }
}

.meta-icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.priority-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  
  &.high {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  &.medium {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
  }
  
  &.low {
    background: rgba(107, 114, 128, 0.1);
    color: #4b5563;
  }
}

.item-project {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  margin-left: 8px;
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Date group for future items
.date-group {
  &:not(:first-child) {
    margin-top: 8px;
  }
}

.date-divider {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  background: var(--b3-theme-surface);
  margin: 0 -16px;
  padding-left: 32px;
}
</style>
