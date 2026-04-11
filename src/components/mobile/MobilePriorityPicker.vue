<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="priority-picker-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="priority-picker-sheet" @click.stop>
            <div class="sheet-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ title }}</h4>
            </div>
            
            <div class="sheet-content">
              <button
                v-for="option in priorityOptions"
                :key="option.value"
                class="priority-option"
                :class="{ active: tempPriority === option.value }"
                @click="selectPriority(option.value)"
              >
                <span class="priority-emoji">{{ option.emoji }}</span>
                <span class="priority-label">{{ option.label }}</span>
                <svg v-if="tempPriority === option.value" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
              
              <button
                class="priority-option"
                :class="{ active: !tempPriority }"
                @click="selectPriority(undefined)"
              >
                <span class="priority-emoji">⚪</span>
                <span class="priority-label">{{ clearLabel }}</span>
                <svg v-if="!tempPriority" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
            </div>
            
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="close">
                {{ cancelText }}
              </button>
              <button class="sheet-confirm-btn" @click="confirm">
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { t } from '@/i18n';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  priority?: PriorityLevel;
  title?: string;
  cancelText?: string;
  confirmText?: string;
  clearLabel?: string;
}>(), {
  title: () => t('todo.priority.setPriority') || '设置优先级',
  cancelText: () => t('common.cancel') || '取消',
  confirmText: () => t('common.confirm') || '确认',
  clearLabel: () => t('todo.priority.clear') || '清除',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [priority: PriorityLevel | undefined];
  cancel: [];
}>();

const tempPriority = ref<PriorityLevel | undefined>(props.priority);

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji, label: PRIORITY_CONFIG.high.label },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji, label: PRIORITY_CONFIG.medium.label },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji, label: PRIORITY_CONFIG.low.label },
];

// Sync with props when opened
watch(() => props.modelValue, (val) => {
  if (val) {
    tempPriority.value = props.priority;
  }
});

const selectPriority = (priority: PriorityLevel | undefined) => {
  tempPriority.value = priority;
};

const close = () => {
  emit('update:modelValue', false);
  emit('cancel');
};

const confirm = () => {
  emit('confirm', tempPriority.value);
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.priority-picker-overlay {
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

.priority-picker-sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 60vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.priority-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:active {
    transform: scale(0.99);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  }
}

.priority-emoji {
  font-size: 20px;
  width: 32px;
  text-align: center;
}

.priority-label {
  flex: 1;
  font-size: 15px;
  color: var(--b3-theme-on-background);
  text-align: left;
}

.check-icon {
  width: 20px;
  height: 20px;
  fill: var(--b3-theme-primary);
}

.sheet-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
}

.sheet-cancel-btn,
.sheet-confirm-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.sheet-cancel-btn {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}

.sheet-confirm-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
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
