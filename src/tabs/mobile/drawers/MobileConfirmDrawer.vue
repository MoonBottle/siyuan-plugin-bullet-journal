<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="confirm-overlay" @click="handleCancel">
        <Transition name="slide-up">
          <div v-if="modelValue" class="confirm-drawer" @click.stop>
            <div class="drawer-handle" @click="handleCancel">
              <div class="handle-bar"></div>
            </div>

            <div class="confirm-content">
              <h3 class="confirm-title">{{ title }}</h3>
              <p class="confirm-message">{{ message }}</p>
            </div>

            <div class="confirm-footer">
              <button class="cancel-btn" @click="handleCancel">
                {{ cancelText }}
              </button>
              <button class="confirm-btn" @click="handleConfirm">
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
  backdrop-filter: blur(2px);
  z-index: 1003;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.confirm-drawer {
  width: 100%;
  max-width: 480px;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
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

.confirm-content {
  padding: 8px 20px 20px;
  text-align: center;
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 12px;
}

.confirm-message {
  font-size: 15px;
  color: var(--b3-theme-on-surface);
  line-height: 1.5;
  margin: 0;
}

.confirm-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px 24px;
  border-radius: 12px;
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
