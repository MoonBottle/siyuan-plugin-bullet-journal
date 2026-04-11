<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="modelValue" class="time-setting-overlay" @click="onCancel">
        <div class="time-setting-drawer" @click.stop>
          <!-- 标题栏 -->
          <div class="drawer-header">
            <div class="header-title">{{ t('mobile.time.timeSetting') }}</div>
            <button class="close-btn" @click="onCancel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="drawer-content">
            <TimeRangeSelector
              v-model:is-all-day="tempIsAllDay"
              v-model:start-time="tempStartTime"
              v-model:end-time="tempEndTime"
            />
          </div>

          <!-- 底部按钮 -->
          <div class="drawer-footer">
            <button class="footer-btn cancel" @click="onCancel">
              {{ t('common.cancel') }}
            </button>
            <button 
              class="footer-btn save" 
              :disabled="!canSave"
              @click="onSave"
            >
              {{ t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { t } from '@/i18n';
import TimeRangeSelector from './TimeRangeSelector.vue';

interface Props {
  modelValue: boolean;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: { isAllDay: boolean; startTime?: string; endTime?: string }];
  cancel: [];
}>();

// t 函数直接导入自 @/i18n

// 临时状态
const tempIsAllDay = ref(true);
const tempStartTime = ref('');
const tempEndTime = ref('');

// 是否可以保存
const canSave = computed(() => {
  if (tempIsAllDay.value) {
    return true;
  }
  // 自定义时间需要填写完整
  return !!tempStartTime.value && !!tempEndTime.value;
});

// 打开时复制 props 到临时状态
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    tempIsAllDay.value = props.isAllDay;
    tempStartTime.value = props.startTime || '';
    tempEndTime.value = props.endTime || '';
  }
});

// 保存
function onSave() {
  emit('save', {
    isAllDay: tempIsAllDay.value,
    startTime: tempIsAllDay.value ? undefined : tempStartTime.value,
    endTime: tempIsAllDay.value ? undefined : tempEndTime.value
  });
  emit('update:modelValue', false);
}

// 取消
function onCancel() {
  emit('cancel');
  emit('update:modelValue', false);
}
</script>

<style scoped>
.time-setting-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 10001;
}

.time-setting-drawer {
  background: var(--b3-theme-background, #fff);
  border-radius: 20px 20px 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--b3-border-color, #eee);
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #000);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s ease;
}

.close-btn:hover {
  background: var(--b3-theme-surface, #f5f5f5);
}

.close-btn svg {
  width: 20px;
  height: 20px;
  color: var(--text-secondary, #666);
}

/* 内容区域 */
.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 底部按钮 */
.drawer-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 0.5px solid var(--b3-border-color, #eee);
}

.footer-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.footer-btn.cancel {
  background: var(--b3-theme-surface, #f5f5f5);
  color: var(--text-primary, #333);
}

.footer-btn.cancel:hover {
  background: var(--b3-theme-surface-lighter, #eee);
}

.footer-btn.save {
  background: var(--b3-theme-primary, #3b82f6);
  color: white;
}

.footer-btn.save:hover:not(:disabled) {
  opacity: 0.9;
}

.footer-btn.save:disabled {
  background: var(--b3-theme-surface, #e5e5e5);
  color: var(--text-tertiary, #bbb);
  cursor: not-allowed;
}

/* 过渡动画 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-active .time-setting-drawer,
.drawer-fade-leave-active .time-setting-drawer {
  transition: transform 0.3s ease;
}

.drawer-fade-enter-from .time-setting-drawer,
.drawer-fade-leave-to .time-setting-drawer {
  transform: translateY(100%);
}
</style>
