<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="action-drawer" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Item Info -->
            <div v-if="item" class="item-info">
              <div class="item-content">{{ item.content }}</div>
              <div v-if="item.project || item.task" class="item-breadcrumb">
                <span v-if="item.project">{{ item.project.name }}</span>
                <span v-if="item.task">> {{ item.task.name }}</span>
              </div>
            </div>
            
            <!-- Action Grid -->
            <div class="action-grid">
              <button class="action-btn" @click="handleComplete">
                <span class="action-icon">✅</span>
                <span class="action-label">{{ t('mobile.action.complete') || '完成' }}</span>
              </button>
              <button class="action-btn" @click="handlePomodoro">
                <span class="action-icon">🍅</span>
                <span class="action-label">{{ t('mobile.action.pomodoro') || '专注' }}</span>
              </button>
              <button class="action-btn" @click="handleMigrate">
                <span class="action-icon">📅</span>
                <span class="action-label">{{ t('mobile.action.migrate') || '迁移' }}</span>
              </button>
              <button class="action-btn" @click="handleAbandon">
                <span class="action-icon">❌</span>
                <span class="action-label">{{ t('mobile.action.abandon') || '放弃' }}</span>
              </button>
              <button class="action-btn" @click="handleDetail">
                <span class="action-icon">ℹ️</span>
                <span class="action-label">{{ t('mobile.action.detail') || '详情' }}</span>
              </button>
              <button class="action-btn" @click="handleCalendar">
                <span class="action-icon">📆</span>
                <span class="action-label">{{ t('mobile.action.calendar') || '日历' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import type { Item } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  item: Item | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openDetail': [item: Item];
  'openPomodoro': [item: Item];
}>();

const handleComplete = async () => {
  if (!props.item?.blockId) return;
  const tag = t('statusTag').completed || '✅';
  await updateBlockContent(props.item.blockId, tag);
  close();
};

const handlePomodoro = () => {
  if (!props.item) return;
  emit('openPomodoro', props.item);
  close();
};

const handleMigrate = async () => {
  if (!props.item?.blockId) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  await updateBlockDateTime(
    props.item.blockId,
    dateStr,
    props.item.startDateTime?.split(' ')[1],
    props.item.endDateTime?.split(' ')[1]
  );
  close();
};

const handleAbandon = async () => {
  if (!props.item?.blockId) return;
  const tag = t('statusTag').abandoned || '❌';
  await updateBlockContent(props.item.blockId, tag);
  close();
};

const handleDetail = () => {
  if (!props.item) return;
  emit('openDetail', props.item);
  close();
};

const handleCalendar = () => {
  close();
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.action-drawer {
  width: 100%;
  background: var(--b3-theme-background);
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.3;
  border-radius: 2px;
}

.item-info {
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.item-content {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-breadcrumb {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  padding: 1px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border: none;
  background: var(--b3-theme-background);
  cursor: pointer;
}

.action-icon {
  font-size: 24px;
}

.action-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
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
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
