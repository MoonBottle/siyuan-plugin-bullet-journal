<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="modelValue" class="time-picker-overlay" @click="onCancel">
        <div class="time-picker-sheet" @click.stop>
          <!-- 标题栏（仅标题，无按钮） -->
          <div class="sheet-header">
            <div class="header-title">{{ title || t('mobile.time.selectTime') }}</div>
          </div>
          
          <!-- 当前选中时间大字体显示 -->
          <div class="current-time-display">
            <span class="time-text">{{ currentHour }}:{{ currentMinute }}</span>
          </div>
          
          <!-- 滚轮区域 -->
          <div class="wheels-container">
            <TimeWheel
              ref="hourWheelRef"
              v-model="currentHour"
              :options="hourOptions"
              :label="t('mobile.time.hour')"
            />
            <div class="time-colon">:</div>
            <TimeWheel
              ref="minuteWheelRef"
              v-model="currentMinute"
              :options="minuteOptions"
              :label="t('mobile.time.minute')"
            />
          </div>
          
          <!-- 快捷时间按钮 -->
          <div class="quick-times-section">
            <div class="quick-times-label">{{ t('mobile.time.quickTime') }}</div>
            <div class="quick-times-grid">
              <button
                v-for="time in quickTimes"
                :key="time"
                class="quick-time-btn"
                :class="{ active: currentHour === time.split(':')[0] && currentMinute === time.split(':')[1] }"
                @click="selectQuickTime(time)"
              >
                {{ time }}
              </button>
            </div>
          </div>

          <!-- 底部按钮（取消/确认） -->
          <div class="sheet-footer">
            <button class="footer-btn cancel" @click="onCancel">
              {{ t('common.cancel') }}
            </button>
            <button class="footer-btn confirm" @click="onConfirm">
              {{ t('common.confirm') }}
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
import TimeWheel from './TimeWheel.vue';

interface Props {
  modelValue: boolean;
  title?: string;
  time?: string; // "HH:mm"
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  time: '09:00'
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [time: string];
  cancel: [];
}>();

// t 函数直接导入自 @/i18n

const hourWheelRef = ref<InstanceType<typeof TimeWheel>>();
const minuteWheelRef = ref<InstanceType<typeof TimeWheel>>();

// 当前选中时间
const currentHour = ref('09');
const currentMinute = ref('00');

// 选项数据
const hourOptions = computed(() => 
  Array.from({ length: 24 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0')
  }))
);

const minuteOptions = computed(() => 
  Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0')
  }))
);

// 快捷时间列表
const quickTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// 解析传入的时间
function parseTime(timeStr: string) {
  const [hour, minute] = timeStr.split(':');
  return {
    hour: hour?.padStart(2, '0') || '09',
    minute: minute?.padStart(2, '0') || '00'
  };
}

// 打开时初始化时间
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.time) {
    const { hour, minute } = parseTime(props.time);
    currentHour.value = hour;
    currentMinute.value = minute;
    // 滚动到对应位置
    setTimeout(() => {
      hourWheelRef.value?.scrollToValue(hour, false);
      minuteWheelRef.value?.scrollToValue(minute, false);
    }, 50);
  }
});

// 选择快捷时间
function selectQuickTime(time: string) {
  const { hour, minute } = parseTime(time);
  currentHour.value = hour;
  currentMinute.value = minute;
  hourWheelRef.value?.scrollToValue(hour, true);
  minuteWheelRef.value?.scrollToValue(minute, true);
}

// 确认
function onConfirm() {
  const timeStr = `${currentHour.value}:${currentMinute.value}`;
  emit('confirm', timeStr);
  emit('update:modelValue', false);
}

// 取消
function onCancel() {
  emit('cancel');
  emit('update:modelValue', false);
}

// 当前时间字符串
const currentTimeStr = computed(() => `${currentHour.value}:${currentMinute.value}`);
</script>

<style scoped>
.time-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 10000;
}

.time-picker-sheet {
  background: var(--b3-theme-background, #fff);
  border-radius: 20px 20px 0 0;
  padding: 16px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

/* 头部 - 仅标题居中 */
.sheet-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0 16px;
  border-bottom: 0.5px solid var(--b3-border-color, #eee);
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #000);
}

/* 当前时间显示 */
.current-time-display {
  text-align: center;
  padding: 20px 0 12px;
}

.time-text {
  font-size: 48px;
  font-weight: 600;
  color: var(--b3-theme-primary, #3b82f6);
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}

/* 滚轮区域 */
.wheels-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0 16px;
  position: relative;
  height: 180px;
}

.time-colon {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary, #000);
  user-select: none;
  line-height: 1;
  align-self: center;
  margin-top: 16px;
}

/* 快捷时间 */
.quick-times-section {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 0.5px solid var(--b3-border-color, #eee);
}

.quick-times-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  margin-bottom: 12px;
  font-weight: 500;
}

.quick-times-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.quick-time-btn {
  padding: 10px 0;
  border: 1px solid var(--b3-border-color, #e5e5e5);
  border-radius: 8px;
  background: var(--b3-theme-background, #fff);
  font-size: 14px;
  color: var(--text-primary, #333);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-time-btn.active {
  background: var(--b3-theme-primary, #3b82f6);
  color: white;
  border-color: var(--b3-theme-primary, #3b82f6);
}

.quick-time-btn:not(.active):hover {
  background: var(--b3-theme-surface, #f5f5f5);
}

/* 底部按钮区域 */
.sheet-footer {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 0.5px solid var(--b3-border-color, #eee);
  margin-top: 16px;
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

.footer-btn.confirm {
  background: var(--b3-theme-primary, #3b82f6);
  color: white;
}

.footer-btn.confirm:hover {
  opacity: 0.9;
}

/* 过渡动画 */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.3s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-fade-enter-active .time-picker-sheet,
.sheet-fade-leave-active .time-picker-sheet {
  transition: transform 0.3s ease;
}

.sheet-fade-enter-from .time-picker-sheet,
.sheet-fade-leave-to .time-picker-sheet {
  transform: translateY(100%);
}
</style>
