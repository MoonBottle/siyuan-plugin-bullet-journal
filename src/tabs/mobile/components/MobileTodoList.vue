<template>
  <div class="mobile-todo-list">
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
          <svg class="empty-icon"><use xlink:href="#iconTask"></use></svg>
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
          <div class="section-header" :class="{ collapsed: collapsedSections.expired }" @click="toggleSection('expired')">
            <div class="section-title-wrapper">
              <div class="section-icon warning">
                <svg><use xlink:href="#iconWarning"></use></svg>
              </div>
              <span class="section-title">{{ t('todo').expired }}</span>
              <span class="section-count">{{ expiredItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.expired }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.expired" class="section-items">
            <MobileTaskCard
              v-for="item in expiredItems"
              :key="item.id"
              :item="item"
              @click="emit('itemClick', item)"
              @long-press="emit('itemLongPress', item)"
            />
          </div>
        </div>
        
        <!-- Today's items -->
        <div v-if="todayItems.length > 0" class="todo-section">
          <div class="section-header" :class="{ collapsed: collapsedSections.today }" @click="toggleSection('today')">
            <div class="section-title-wrapper">
              <div class="section-icon primary">
                <svg><use xlink:href="#iconCalendar"></use></svg>
              </div>
              <span class="section-title">{{ t('todo').today }}</span>
              <span class="section-count">{{ todayItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.today }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.today" class="section-items">
            <MobileTaskCard
              v-for="item in todayItems"
              :key="item.id"
              :item="item"
              @click="emit('itemClick', item)"
              @long-press="emit('itemLongPress', item)"
            />
          </div>
        </div>
        
        <!-- Tomorrow's items -->
        <div v-if="tomorrowItems.length > 0" class="todo-section">
          <div class="section-header" :class="{ collapsed: collapsedSections.tomorrow }" @click="toggleSection('tomorrow')">
            <div class="section-title-wrapper">
              <div class="section-icon secondary">
                <svg><use xlink:href="#iconCheck"></use></svg>
              </div>
              <span class="section-title">{{ t('todo').tomorrow }}</span>
              <span class="section-count">{{ tomorrowItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.tomorrow }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.tomorrow" class="section-items">
            <MobileTaskCard
              v-for="item in tomorrowItems"
              :key="item.id"
              :item="item"
              @click="emit('itemClick', item)"
              @long-press="emit('itemLongPress', item)"
            />
          </div>
        </div>
        
        <!-- Future items -->
        <div v-if="futureItems.length > 0" class="todo-section">
          <div class="section-header" :class="{ collapsed: collapsedSections.future }" @click="toggleSection('future')">
            <div class="section-title-wrapper">
              <div class="section-icon tertiary">
                <svg><use xlink:href="#iconCalendar"></use></svg>
              </div>
              <span class="section-title">{{ t('todo').future }}</span>
              <span class="section-count">{{ futureItems.length }}</span>
            </div>
            <div class="collapse-icon" :class="{ collapsed: collapsedSections.future }">
              <svg><use xlink:href="#iconDown"></use></svg>
            </div>
          </div>
          <div v-show="!collapsedSections.future" class="section-items">
            <div v-for="date in futureDates" :key="date" class="date-group">
              <div class="date-label">{{ formatDateLabel(date) }}</div>
              <MobileTaskCard
                v-for="item in groupedFutureItems.get(date)"
                :key="item.id"
                :item="item"
                @click="emit('itemClick', item)"
                @long-press="emit('itemLongPress', item)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SyLoading from '@/components/SiyuanTheme/SyLoading.vue';
import MobileTaskCard from './MobileTaskCard.vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import type { Item, PriorityLevel } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { formatDateLabel as formatDateLabelUtil } from '@/utils/dateUtils';
import { getEffectiveDate } from '@/utils/dateRangeUtils';
import { createExampleDocument } from '@/utils/exampleDocUtils';

const props = defineProps<{
  groupId?: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  hasActiveFilters?: boolean;
}>();

const emit = defineEmits<{
  itemClick: [item: Item];
  itemLongPress: [item: Item];
  refresh: [];
}>();

const projectStore = useProjectStore();
const loading = computed(() => projectStore.loading);
const hasAnyItems = computed(() => projectStore.getDisplayItems('').length > 0);

// Collapsible sections
const collapsedSections = ref({
  expired: false,
  today: false,
  tomorrow: false,
  future: false,
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

const expiredItems = computed(() => {
  return filteredItems.value.filter(item => getEffectiveDate(item) < todayStr);
});

const todayItems = computed(() => {
  return filteredItems.value.filter(item => item.date === todayStr);
});

const tomorrowItems = computed(() => {
  return filteredItems.value.filter(item => item.date === tomorrowStr);
});

const futureItems = computed(() => {
  return filteredItems.value.filter(item => {
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

const formatDateLabel = (date: string) => {
  return formatDateLabelUtil(date, t('todo').today, t('todo').tomorrow);
};

const handleCreateExample = async () => {
  await createExampleDocument();
};
</script>

<style lang="scss" scoped>
.mobile-todo-list {
  flex: 1;
  overflow-y: auto;
  position: relative;
  background: var(--b3-theme-surface);
}

.todo-content {
  padding: 12px 16px 24px;
  min-height: 100%;
}

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

.todo-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.todo-section {
  background: var(--b3-theme-background);
  border-radius: 16px;
  border: 1px solid var(--b3-border-color);
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-bottom: 1px solid transparent;
  
  &:hover {
    background: var(--b3-theme-surface);
  }
  
  &.collapsed {
    border-bottom-color: transparent;
  }
}

.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  
  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  
  &.warning {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  &.primary {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
    color: var(--b3-theme-primary);
  }
  
  &.secondary {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
  }
  
  &.tertiary {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.section-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  background: var(--b3-theme-surface-lighter);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
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

.section-items {
  padding: 12px;
  background: var(--b3-theme-surface);
}

.date-group {
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.date-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  padding: 8px 4px 12px;
  border-bottom: 1px dashed var(--b3-border-color);
  margin-bottom: 12px;
  opacity: 0.8;
}
</style>
