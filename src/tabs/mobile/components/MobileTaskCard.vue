<template>
  <div
    class="mobile-task-card"
    :class="{ 
      'is-pressing': isPressing,
      'is-completed': item.status === 'completed',
      'is-abandoned': item.status === 'abandoned',
      'is-expired': isExpired
    }"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <div class="card-header">
      <div class="header-left">
        <div class="time-badge">
          <svg class="time-icon" :class="{ 'is-all-day': !item.startDateTime }">
            <use :xlink:href="item.startDateTime ? '#iconClock' : '#iconCalendar'"></use>
          </svg>
          <span class="time-text">{{ formatTime }}</span>
        </div>
        <div v-if="item.priority" class="priority-badge" :class="`priority-${item.priority}`">
          {{ getPriorityLabel(item.priority) }}
        </div>
      </div>
      <span v-if="item.project" class="project-tag">
        <svg class="project-icon"><use xlink:href="#iconFolder"></use></svg>
        {{ item.project.name }}
      </span>
    </div>
    
    <div v-if="item.task" class="task-name">
      <svg class="task-icon"><use xlink:href="#iconList"></use></svg>
      {{ item.task.name }}
    </div>
    
    <div class="item-content">
      <div class="status-icon" :class="statusClass">
        <svg v-if="item.status === 'completed'"><use xlink:href="#iconCheck"></use></svg>
        <svg v-else-if="item.status === 'abandoned'"><use xlink:href="#iconCloseRound"></use></svg>
        <svg v-else-if="isExpired"><use xlink:href="#iconWarning"></use></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
      </div>
      <span class="content-text">{{ item.content }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import type { Item, PriorityLevel } from '@/types/models';
import { formatTimeRange } from '@/utils/dateUtils';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import dayjs from '@/utils/dayjs';
import { getEffectiveDate } from '@/utils/dateRangeUtils';

const props = defineProps<{
  item: Item;
}>();

const emit = defineEmits<{
  click: [item: Item];
  'long-press': [item: Item];
}>();

const isPressing = ref(false);
let pressTimer: ReturnType<typeof setTimeout> | null = null;
const PRESS_DURATION = 500; // ms

const formatTime = computed(() => {
  return formatTimeRange(props.item.startDateTime, props.item.endDateTime) || '全天';
});

const isExpired = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD');
  return getEffectiveDate(props.item) < todayStr && props.item.status !== 'completed' && props.item.status !== 'abandoned';
});

const statusClass = computed(() => {
  if (props.item.status === 'completed') return 'status-completed';
  if (props.item.status === 'abandoned') return 'status-abandoned';
  if (isExpired.value) return 'status-expired';
  return 'status-pending';
});

const getPriorityLabel = (priority: PriorityLevel) => {
  return PRIORITY_CONFIG[priority]?.label || priority;
};

const handleClick = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  emit('click', props.item);
};

const handleTouchStart = () => {
  isPressing.value = true;
  pressTimer = setTimeout(() => {
    emit('long-press', props.item);
    isPressing.value = false;
  }, PRESS_DURATION);
};

const handleTouchEnd = () => {
  isPressing.value = false;
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
};

const handleTouchMove = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  isPressing.value = false;
};

onUnmounted(() => {
  if (pressTimer) {
    clearTimeout(pressTimer);
  }
});
</script>

<style lang="scss" scoped>
.mobile-task-card {
  padding: 14px 16px;
  background: var(--b3-theme-background);
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  
  &:hover {
    border-color: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  
  &.is-pressing {
    transform: scale(0.98);
    background: var(--b3-theme-surface);
  }
  
  &.is-completed {
    opacity: 0.7;
    background: rgba(34, 197, 94, 0.03);
    
    .content-text {
      text-decoration: line-through;
      opacity: 0.6;
    }
  }
  
  &.is-abandoned {
    opacity: 0.6;
    background: rgba(107, 114, 128, 0.03);
    
    .content-text {
      text-decoration: line-through;
      opacity: 0.5;
    }
  }
  
  &.is-expired {
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.02);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.time-icon {
  width: 12px;
  height: 12px;
  fill: currentColor;
  
  &.is-all-day {
    opacity: 0.6;
  }
}

.priority-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &.priority-p0 {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  &.priority-p1 {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
  }
  
  &.priority-p2 {
    background: rgba(234, 179, 8, 0.1);
    color: #ca8a04;
  }
  
  &.priority-p3 {
    background: rgba(107, 114, 128, 0.1);
    color: #4b5563;
  }
}

.project-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  padding: 3px 8px;
  border-radius: 6px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-icon {
  width: 12px;
  height: 12px;
  fill: currentColor;
  flex-shrink: 0;
}

.task-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
  opacity: 0.85;
}

.task-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
  opacity: 0.6;
}

.item-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.status-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 1px;
  
  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
  
  &.status-completed {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  
  &.status-abandoned {
    background: rgba(107, 114, 128, 0.12);
    color: #4b5563;
  }
  
  &.status-expired {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
  
  &.status-pending {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
    color: var(--b3-theme-primary);
  }
}

.content-text {
  flex: 1;
  font-size: 15px;
  color: var(--b3-theme-on-background);
  line-height: 1.5;
  word-break: break-word;
}
</style>
