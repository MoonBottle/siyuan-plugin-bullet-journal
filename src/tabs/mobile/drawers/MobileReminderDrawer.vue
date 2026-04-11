<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="mobile-reminder-drawer" @click.stop>
            <!-- Handle Bar -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>

            <!-- Header -->
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('reminder.settingTitle') || '设置提醒' }}</h3>
            </div>

            <!-- Content -->
            <div class="drawer-content">
              <ReminderSettingDialog
                ref="reminderDialogRef"
                :block-id="blockId || ''"
                :initial-config="initialConfig"
                layout="drawer"
                hide-footer
              />
            </div>

            <!-- Footer -->
            <div class="drawer-footer">
              <button class="footer-btn cancel" @click="close">
                {{ t('common.cancel') || '取消' }}
              </button>
              <button class="footer-btn save" @click="handleSaveClick">
                {{ t('reminder.save') || '保存' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ReminderSettingDialog from '@/components/dialog/ReminderSettingDialog.vue';
import { t } from '@/i18n';
import { updateItemWithReminder } from '@/utils/itemSettingUtils';
import type { ReminderConfig, Item } from '@/types/models';

const reminderDialogRef = ref<InstanceType<typeof ReminderSettingDialog> | null>(null);

interface Props {
  modelValue: boolean;
  blockId?: string;
  initialConfig?: ReminderConfig;
  item?: Item;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'save': [config: ReminderConfig];
  'cancel': [];
}>();

const hasItem = computed(() => !!props.item);

async function handleSave(config: ReminderConfig) {
  if (props.item) {
    try {
      await updateItemWithReminder(props.item, config);
      emit('save', config);
      close();
    } catch (error) {
      console.error('[MobileReminderDrawer] Failed to save reminder:', error);
    }
  } else {
    emit('save', config);
    close();
  }
}

function handleSaveClick() {
  // 调用 Dialog 内部的 getConfig 方法
  reminderDialogRef.value?.getConfig();
}

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
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
  z-index: 1003;
  display: flex;
  align-items: flex-end;
}

.mobile-reminder-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
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

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 16px 16px;
  min-height: 0;
}

.drawer-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
  flex-shrink: 0;
}

.footer-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &.cancel {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    
    &:hover {
      background: var(--b3-theme-surface-lighter);
    }
  }
  
  &.save {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    
    &:hover {
      opacity: 0.9;
    }
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
