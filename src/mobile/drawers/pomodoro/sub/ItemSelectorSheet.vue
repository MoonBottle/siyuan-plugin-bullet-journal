<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="sheet-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="selector-sheet" @click.stop>
            <!-- Drag Handle -->
            <div class="sheet-handle" @click="close">
              <div class="handle-bar"></div>
            </div>

            <!-- Header -->
            <div class="sheet-header">
              <h4 class="sheet-title">{{ t('pomodoroDialog.selectItem') || '选择事项' }}</h4>
            </div>

            <!-- Content -->
            <div class="sheet-content">
              <!-- Expired Items Section -->
              <div v-if="expiredItems.length > 0" class="item-section">
                <div class="section-label section-label--expired">
                  <span class="label-badge label-badge--expired">{{ t('pomodoroDialog.expiredItems') || '过期事项' }}</span>
                </div>
                <button
                  v-for="item in expiredItems"
                  :key="item.id"
                  class="sheet-option"
                  @click="selectItem(item)"
                >
                  <div class="option-icon">
                    <svg><use xlink:href="#iconCircle"></use></svg>
                  </div>
                  <div class="option-info">
                    <span class="option-text">{{ item.content }}</span>
                    <span v-if="item.project" class="option-meta">{{ item.project.name }}</span>
                  </div>
                  <span class="option-date">{{ formatDate(item.date) }}</span>
                </button>
              </div>

              <!-- Today Items Section -->
              <div v-if="todayItems.length > 0" class="item-section">
                <div class="section-label section-label--today">
                  <span class="label-badge label-badge--today">{{ t('pomodoroDialog.todayItems') || '今日事项' }}</span>
                </div>
                <button
                  v-for="item in todayItems"
                  :key="item.id"
                  class="sheet-option"
                  @click="selectItem(item)"
                >
                  <div class="option-icon">
                    <svg><use xlink:href="#iconCircle"></use></svg>
                  </div>
                  <div class="option-info">
                    <span class="option-text">{{ item.content }}</span>
                    <span v-if="item.project" class="option-meta">{{ item.project.name }}</span>
                  </div>
                </button>
              </div>

              <!-- Empty State -->
              <div v-if="expiredItems.length === 0 && todayItems.length === 0" class="sheet-empty">
                <svg class="empty-icon"><use xlink:href="#iconInbox"></use></svg>
                <span>{{ t('pomodoroDialog.noItems') || '暂无待办事项' }}</span>
              </div>
            </div>

            <!-- Footer -->
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="close">
                {{ t('common.cancel') || '取消' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  select: [item: Item];
}>();

const projectStore = useProjectStore();
const currentDate = dayjs().format('YYYY-MM-DD');

const expiredItems = computed(() => {
  return projectStore.getExpiredItems('').filter(item => item.status === 'pending');
});

const todayItems = computed(() => {
  return projectStore.getFutureItems('')
    .filter(item => item.date === currentDate && item.status === 'pending');
});

const selectItem = (item: Item) => {
  emit('select', item);
  close();
};

const close = () => {
  emit('update:modelValue', false);
};

const formatDate = (dateStr: string): string => {
  const date = dayjs(dateStr);
  const today = dayjs();
  const diff = today.diff(date, 'day');

  if (diff === 1) return t('pomodoroDialog.yesterday') || '昨天';
  if (diff === 2) return t('pomodoroDialog.dayBeforeYesterday') || '前天';
  return date.format('MM-DD');
};
</script>

<style lang="scss" scoped>
.sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1003;
  display: flex;
  align-items: flex-end;
}

.selector-sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.sheet-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.item-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 4px;
}

.label-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &--expired {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &--today {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
    color: var(--b3-theme-primary);
  }
}

.sheet-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;

  &:first-of-type {
    border-radius: 12px 12px 0 0;
  }

  &:last-of-type {
    border-bottom: none;
    border-radius: 0 0 12px 12px;
  }

  &:only-child {
    border-radius: 12px;
  }

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:active {
    transform: scale(0.995);
  }
}

.option-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
}

.option-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-text {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-meta {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-date {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  flex-shrink: 0;
}

.sheet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  background: var(--b3-theme-surface);
  border-radius: 12px;

  .empty-icon {
    width: 48px;
    height: 48px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.3;
    margin-bottom: 16px;
  }

  span {
    font-size: 15px;
  }
}

.sheet-footer {
  padding: 12px 16px 24px;
  border-top: 1px solid var(--b3-border-color);
}

.sheet-cancel-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:active {
    transform: scale(0.98);
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
