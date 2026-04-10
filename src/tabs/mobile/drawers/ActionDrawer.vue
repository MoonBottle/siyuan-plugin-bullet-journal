<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="action-drawer" @click.stop>
            <!-- Handle Bar -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Item Info Header -->
            <div v-if="item" class="item-info">
              <div class="item-content">{{ item.content }}</div>
              <div v-if="item.project || item.task" class="item-breadcrumb">
                <svg class="breadcrumb-icon"><use xlink:href="#iconFolder"></use></svg>
                <span v-if="item.project" class="breadcrumb-project">{{ item.project.name }}</span>
                <span v-if="item.project && item.task" class="breadcrumb-separator">›</span>
                <span v-if="item.task">{{ item.task.name }}</span>
              </div>
            </div>
            
            <!-- Action Grid -->
            <div class="action-grid">
              <button class="action-btn action-complete" @click="handleComplete">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconCheck"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.complete') || '完成' }}</span>
              </button>
              
              <button class="action-btn action-focus" @click="handlePomodoro">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconClock"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.pomodoro') || '专注' }}</span>
              </button>
              
              <button class="action-btn action-migrate" @click="handleMigrate">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconForward"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.migrate') || '迁移' }}</span>
              </button>
              
              <button class="action-btn action-abandon" @click="handleAbandon">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconCloseRound"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.abandon') || '放弃' }}</span>
              </button>
              
              <button class="action-btn action-detail" @click="handleDetail">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconInfo"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.detail') || '详情' }}</span>
              </button>
              
              <button class="action-btn action-calendar" @click="handleCalendar">
                <div class="action-icon-wrapper">
                  <svg><use xlink:href="#iconCalendar"></use></svg>
                </div>
                <span class="action-label">{{ t('mobile.action.calendar') || '日历' }}</span>
              </button>
            </div>
            
            <!-- Cancel Button -->
            <div class="drawer-footer">
              <button class="cancel-btn" @click="close">
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
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.action-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 8px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.item-info {
  padding: 12px 8px 20px;
  text-align: center;
}

.item-content {
  font-size: 17px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  margin-bottom: 8px;
}

.item-breadcrumb {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  
  .breadcrumb-icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
  
  .breadcrumb-project {
    font-weight: 500;
  }
  
  .breadcrumb-separator {
    opacity: 0.5;
  }
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 4px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 8px;
  border: none;
  background: var(--b3-theme-surface);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  
  &:active {
    transform: scale(0.96);
  }
  
  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.action-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
}

// Action-specific colors
.action-complete {
  .action-icon-wrapper {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(34, 197, 94, 0.2);
  }
}

.action-focus {
  .action-icon-wrapper {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(239, 68, 68, 0.2);
  }
}

.action-migrate {
  .action-icon-wrapper {
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(59, 130, 246, 0.2);
  }
}

.action-abandon {
  .action-icon-wrapper {
    background: rgba(107, 114, 128, 0.12);
    color: #4b5563;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(107, 114, 128, 0.2);
  }
}

.action-detail {
  .action-icon-wrapper {
    background: rgba(168, 85, 247, 0.12);
    color: #9333ea;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(168, 85, 247, 0.2);
  }
}

.action-calendar {
  .action-icon-wrapper {
    background: rgba(249, 115, 22, 0.12);
    color: #ea580c;
  }
  
  &:hover .action-icon-wrapper {
    background: rgba(249, 115, 22, 0.2);
  }
}

.action-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.drawer-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
}

.cancel-btn {
  width: 100%;
  padding: 14px;
  border: none;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 15px;
  font-weight: 500;
  border-radius: 12px;
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
