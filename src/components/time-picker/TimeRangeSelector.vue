<template>
  <div class="time-range-selector">
    <!-- 全天/自定义选择 -->
    <div class="time-type-radio">
      <label 
        class="radio-option" 
        :class="{ active: isAllDay }"
        @click="onAllDayChange(true)"
      >
        <span class="radio-circle">
          <span v-if="isAllDay" class="radio-dot"></span>
        </span>
        <span class="radio-label">{{ t('mobile.time.allDay') }}</span>
      </label>
      <label 
        class="radio-option" 
        :class="{ active: !isAllDay }"
        @click="onAllDayChange(false)"
      >
        <span class="radio-circle">
          <span v-if="!isAllDay" class="radio-dot"></span>
        </span>
        <span class="radio-label">{{ t('mobile.time.customTime') }}</span>
      </label>
    </div>

    <!-- 自定义时间选择区域 -->
    <Transition name="time-fields">
      <div v-if="!isAllDay" class="time-fields">
        <!-- 开始时间 -->
        <div class="time-field" @click="openTimePicker('start')">
          <span class="field-label">{{ t('mobile.time.startTime') }}</span>
          <div class="field-value" :class="{ empty: !startTime, filled: startTime }">
            <span class="time-display">{{ startTime || t('mobile.time.selectTime') }}</span>
            <span class="chevron">›</span>
          </div>
        </div>
        
        <!-- 结束时间 -->
        <div class="time-field" @click="openTimePicker('end')">
          <span class="field-label">{{ t('mobile.time.endTime') }}</span>
          <div class="field-value" :class="{ empty: !endTime, filled: endTime }">
            <span class="time-display">{{ endTime || t('mobile.time.selectTime') }}</span>
            <span class="chevron">›</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 时间选择弹窗 -->
    <TimePickerSheet
      v-model="showTimePicker"
      :title="pickerTitle"
      :time="currentPickerTime"
      @confirm="onTimeConfirmed"
      @cancel="showTimePicker = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';
import TimePickerSheet from './TimePickerSheet.vue';

interface Props {
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:isAllDay': [value: boolean];
  'update:startTime': [value: string];
  'update:endTime': [value: string];
}>();

// t 函数直接导入自 @/i18n

// 弹窗状态
const showTimePicker = ref(false);
const pickerType = ref<'start' | 'end'>('start');

// 弹窗标题
const pickerTitle = computed(() => 
  pickerType.value === 'start' 
    ? t('mobile.time.selectStartTime') 
    : t('mobile.time.selectEndTime')
);

// 当前弹窗的默认时间
const currentPickerTime = computed(() => {
  if (pickerType.value === 'start') {
    return props.startTime || '09:00';
  }
  return props.endTime || '10:00';
});

// 全天状态切换
function onAllDayChange(value: boolean) {
  emit('update:isAllDay', value);
}

// 打开时间选择器
function openTimePicker(type: 'start' | 'end') {
  pickerType.value = type;
  showTimePicker.value = true;
}

// 时间选择确认
function onTimeConfirmed(time: string) {
  if (pickerType.value === 'start') {
    emit('update:startTime', time);
    // 如果结束时间早于开始时间，自动调整
    if (props.endTime && time > props.endTime) {
      // 可以在这里添加逻辑，暂时不处理
    }
  } else {
    emit('update:endTime', time);
  }
}
</script>

<style scoped>
.time-range-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 单选按钮组 */
.time-type-radio {
  display: flex;
  gap: 24px;
  padding: 4px 0;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border: 2px solid var(--b3-border-color, #ccc);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.radio-option.active .radio-circle {
  border-color: var(--b3-theme-primary, #3b82f6);
}

.radio-dot {
  width: 10px;
  height: 10px;
  background: var(--b3-theme-primary, #3b82f6);
  border-radius: 50%;
}

.radio-label {
  font-size: 15px;
  color: var(--text-primary, #333);
}

.radio-option.active .radio-label {
  font-weight: 500;
}

/* 时间字段区域 */
.time-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.time-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--b3-theme-surface, #f8f9fa);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-field:active {
  background: var(--b3-theme-surface-lighter, #eee);
}

.field-label {
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.field-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-display {
  font-size: 15px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.field-value.empty .time-display {
  color: var(--text-placeholder, #999);
}

.field-value.filled .time-display {
  color: var(--b3-theme-primary, #3b82f6);
}

.chevron {
  font-size: 16px;
  color: var(--text-tertiary, #bbb);
}

/* 过渡动画 */
.time-fields-enter-active,
.time-fields-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.time-fields-enter-from,
.time-fields-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.time-fields-enter-to,
.time-fields-leave-from {
  opacity: 1;
  max-height: 120px;
  margin-top: 4px;
}
</style>
