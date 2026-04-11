<template>
  <div class="reminder-setting-dialog" :class="{ 'drawer-mode': layout === 'drawer' }">
    <!-- 事项信息卡片 -->
    <div v-if="item" class="selected-item-section">
      <SelectedItemCard :item="item" :show-header="true" />
    </div>

    <!-- 提醒方式 -->
      <div class="panel-title">{{ t('reminder.reminderMethod') }}</div>
      <div class="quick-buttons">
        <button
          v-for="method in reminderMethods"
          :key="method.value"
          class="mode-btn"
          :class="{ active: selectedMethod === method.value }"
          @click="selectMethod(method.value)"
        >
          {{ method.label }}
        </button>
      </div>

      <!-- 自定义提醒方式展开区域 -->
      <div v-if="selectedMethod === 'custom'" class="custom-section">
        <div class="custom-row">
          <span class="custom-label">{{ t('reminder.relativeBase') }}</span>
          <div class="base-options">
            <button
              class="mode-btn small"
              :class="{ active: relativeBase === 'start' }"
              @click="relativeBase = 'start'"
            >
              {{ t('reminder.beforeStart') }}
            </button>
            <button
              class="mode-btn small"
              :class="{ active: relativeBase === 'end' }"
              @click="relativeBase = 'end'"
            >
              {{ t('reminder.beforeEnd') }}
            </button>
          </div>
        </div>
        <div class="custom-row">
          <span class="custom-label">{{ t('reminder.offsetTime') }}</span>
          <div class="offset-inputs">
            <input
              v-model.number="customOffset"
              type="number"
              min="1"
              max="999"
              class="offset-input"
            />
            <select v-model="offsetUnit" class="unit-select">
              <option value="minutes">{{ t('reminder.unitMinutes') }}</option>
              <option value="hours">{{ t('reminder.unitHours') }}</option>
              <option value="days">{{ t('reminder.unitDays') }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 提醒时间（仅准时模式显示） -->
      <template v-if="selectedMethod === 'ontime'">
        <div class="panel-title">{{ t('reminder.reminderTime') }}</div>
        <div class="quick-buttons time-presets">
          <button
            v-for="time in timePresets"
            :key="time"
            class="mode-btn"
            :class="{ active: !isCustomTime && reminderTime === time }"
            @click="selectTime(time)"
          >
            {{ time }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: isCustomTime }"
            @click="setCustomTime"
          >
            {{ t('reminder.custom') }}
          </button>
        </div>

        <!-- 自定义时间展开区域 -->
        <div v-if="isCustomTime" class="custom-section">
          <div class="custom-row">
            <span class="custom-label">{{ t('reminder.customTimeLabel') }}</span>
            <input
              v-model="reminderTime"
              type="time"
              class="time-input"
            />
          </div>
        </div>
      </template>

    <!-- 底部按钮 -->
    <div v-if="!hideFooter" class="action-section">
      <button class="start-btn" @click="handleSave">
        {{ t('reminder.save') }}
      </button>
      <button class="cancel-btn" @click="handleCancel">
        {{ t('reminder.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useProjectStore } from '@/stores';
import { getSharedPinia } from '@/utils/sharedPinia';
import { t } from '@/i18n';
import type { ReminderConfig } from '@/types/models';
import SelectedItemCard from '@/components/pomodoro/SelectedItemCard.vue';

interface Props {
  blockId: string;
  initialConfig?: ReminderConfig;
  layout?: 'dialog' | 'drawer';
  hideFooter?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'dialog'
});



const emit = defineEmits<{
  save: [config: ReminderConfig];
  cancel: [];
}>();

// 获取事项信息
const pinia = getSharedPinia();
const projectStore = pinia ? useProjectStore(pinia) : null;

const item = computed(() => {
  if (!props.blockId || !projectStore) return null;
  return projectStore.getItemByBlockId(props.blockId) || null;
});

// 提醒时间（更多预设）
const timePresets = ['07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '15:00', '18:00', '20:00'];
const reminderTime = ref(props.initialConfig?.time ?? '09:00');
const isCustomTime = ref(!timePresets.includes(reminderTime.value));

// 提醒方法
const reminderMethods = computed(() => [
  { value: 'ontime', label: t('reminder.ontime') },
  { value: 'before5m', label: t('reminder.before5m') },
  { value: 'before15m', label: t('reminder.before15m') },
  { value: 'before30m', label: t('reminder.before30m') },
  { value: 'before1h', label: t('reminder.before1h') },
  { value: 'before1d', label: t('reminder.before1d') },
  { value: 'custom', label: t('reminder.custom') }
]);

const selectedMethod = ref('ontime');
const relativeBase = ref<'start' | 'end'>('start');
const customOffset = ref(30);
const offsetUnit = ref<'minutes' | 'hours' | 'days'>('minutes');

// 初始化方法选择
onMounted(() => {
  const config = props.initialConfig;
  if (config?.type === 'relative' && config.offsetMinutes) {
    const minutes = config.offsetMinutes;
    if (minutes === 5) selectedMethod.value = 'before5m';
    else if (minutes === 15) selectedMethod.value = 'before15m';
    else if (minutes === 30) selectedMethod.value = 'before30m';
    else if (minutes === 60) selectedMethod.value = 'before1h';
    else if (minutes === 1440) selectedMethod.value = 'before1d';
    else {
      selectedMethod.value = 'custom';
      relativeBase.value = config.relativeTo ?? 'start';
      if (minutes % 1440 === 0) {
        customOffset.value = minutes / 1440;
        offsetUnit.value = 'days';
      } else if (minutes % 60 === 0) {
        customOffset.value = minutes / 60;
        offsetUnit.value = 'hours';
      } else {
        customOffset.value = minutes;
        offsetUnit.value = 'minutes';
      }
    }
  } else {
    selectedMethod.value = 'ontime';
  }
});

function selectTime(time: string) {
  reminderTime.value = time;
  isCustomTime.value = false;
}

function setCustomTime() {
  isCustomTime.value = true;
}

function selectMethod(method: string) {
  selectedMethod.value = method;
}

function handleSave() {
  let config: ReminderConfig;
  
  if (selectedMethod.value === 'ontime') {
    config = {
      enabled: true,
      type: 'absolute',
      time: reminderTime.value,
      alertMode: { type: 'ontime' }
    };
  } else {
    let offsetMinutes: number;
    switch (selectedMethod.value) {
      case 'before5m': offsetMinutes = 5; break;
      case 'before15m': offsetMinutes = 15; break;
      case 'before30m': offsetMinutes = 30; break;
      case 'before1h': offsetMinutes = 60; break;
      case 'before1d': offsetMinutes = 1440; break;
      case 'custom':
        if (offsetUnit.value === 'days') offsetMinutes = customOffset.value * 1440;
        else if (offsetUnit.value === 'hours') offsetMinutes = customOffset.value * 60;
        else offsetMinutes = customOffset.value;
        break;
      default: offsetMinutes = 10;
    }
    
    config = {
      enabled: true,
      type: 'relative',
      relativeTo: relativeBase.value,
      offsetMinutes
    };
  }
  
  emit('save', config);
}

function handleCancel() {
  emit('cancel');
}

// 暴露方法供父组件调用
defineExpose({
  getConfig: handleSave
});
</script>

<style lang="scss" scoped>
.reminder-setting-dialog {
  padding: 16px;
  min-width: 320px;
  max-width: 360px;
}

.selected-item-section {
  margin-bottom: 20px;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 12px;
  margin-top: 16px;

  &:first-of-type {
    margin-top: 0;
  }
}

.quick-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  &.time-presets {
    grid-template-columns: repeat(3, 1fr);
  }
}

.mode-btn {
  padding: 8px 4px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-color: var(--b3-theme-primary);
  }

  &.small {
    padding: 6px 12px;
    font-size: 12px;
  }
}

.time-input {
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  width: 120px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  &.full-width {
    width: 100%;
    box-sizing: border-box;
  }
}

.custom-section {
  margin-top: 16px;
  padding: 16px;
  background: var(--b3-theme-surface-lightest);
  border-radius: var(--b3-border-radius);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.custom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.custom-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
}

.base-options {
  display: flex;
  gap: 8px;
}

.offset-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.offset-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.unit-select {
  padding: 6px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.action-section {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// Drawer 模式适配
.reminder-setting-dialog.drawer-mode {
  padding: 0;
  min-width: auto;
  max-width: 100%;

  .quick-buttons {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .mode-btn {
    min-height: 48px;
    padding: 12px 8px;
    font-size: 14px;
  }

  .time-presets {
    grid-template-columns: repeat(3, 1fr);
  }

  .action-section {
    margin-top: 20px;
  }
}

.start-btn {
  padding: 10px 16px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border: none;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.cancel-btn {
  padding: 8px 16px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}
</style>
