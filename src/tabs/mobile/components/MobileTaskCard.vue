<template>
  <div
    class="mobile-task-card"
    :class="{ 'is-pressing': isPressing }"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <div class="card-header">
      <div class="header-left">
        <span class="time-text">{{ formatTime }}</span>
        <span v-if="item.priority" class="priority-badge">
          {{ getPriorityEmoji(item.priority) }}
        </span>
      </div>
      <span v-if="item.project" class="project-name">{{ item.project.name }}</span>
    </div>
    
    <div v-if="item.task" class="task-name">{{ item.task.name }}</div>
    
    <div class="item-content">
      <span class="status-emoji">{{ getStatusEmoji(item) }}</span>
      {{ item.content }}
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

const getPriorityEmoji = (priority: PriorityLevel) => {
  return PRIORITY_CONFIG[priority]?.emoji || '';
};

const getStatusEmoji = (item: Item): string => {
  if (item.status === 'completed') return '✅';
  if (item.status === 'abandoned') return '❌';
  const todayStr = dayjs().format('YYYY-MM-DD');
  const effectiveDate = getEffectiveDate(item);
  if (effectiveDate < todayStr) return '⚠️';
  return '⏳';
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
  padding: 12px 16px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
  
  &.is-pressing {
    transform: scale(0.98);
    background: var(--b3-theme-surface);
  }
  
  &:active {
    background: var(--b3-theme-surface);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.priority-badge {
  font-size: 12px;
}

.project-name {
  font-size: 11px;
  color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
  padding: 2px 8px;
  border-radius: 4px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-bottom: 4px;
  opacity: 0.9;
}

.item-content {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  word-break: break-word;
}

.status-emoji {
  margin-right: 4px;
}
</style>
