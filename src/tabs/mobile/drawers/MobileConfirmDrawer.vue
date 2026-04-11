<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="confirm-overlay" @click="handleCancel">
        <Transition name="zoom">
          <div v-if="modelValue" class="confirm-dialog" @click.stop>
            <div class="confirm-icon" v-if="icon">
              <svg class="icon-svg">
                <use :xlink:href="`#${icon}`"></use>
              </svg>
            </div>

            <div class="confirm-content">
              <h3 class="confirm-title">{{ title }}</h3>
              <p class="confirm-message">{{ message }}</p>
            </div>

            <div class="confirm-footer">
              <button class="cancel-btn" @click="handleCancel">
                {{ cancelText }}
              </button>
              <button 
                class="confirm-btn" 
                :class="{ 'danger': type === 'danger' }"
                @click="handleConfirm"
              >
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
const props = defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger';
  icon?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const confirmText = props.confirmText || '确认';
const cancelText = props.cancelText || '取消';

const handleConfirm = () => {
  emit('confirm');
  emit('update:modelValue', false);
};

const handleCancel = () => {
  emit('cancel');
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1003;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.confirm-dialog {
  width: 100%;
  max-width: 320px;
  background: var(--b3-theme-background);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.confirm-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--b3-theme-error, #ef4444);
  display: flex;
  align-items: center;
  justify-content: center;

  .icon-svg {
    width: 28px;
    height: 28px;
    fill: white;
  }
}

.confirm-content {
  margin-bottom: 24px;
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 8px;
  line-height: 1.4;
}

.confirm-message {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  line-height: 1.6;
  margin: 0;
}

.confirm-footer {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.cancel-btn {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.confirm-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &:hover {
    opacity: 0.9;
  }

  &.danger {
    background: var(--b3-theme-error, #ef4444);
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.zoom-enter-from,
.zoom-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
</style>
