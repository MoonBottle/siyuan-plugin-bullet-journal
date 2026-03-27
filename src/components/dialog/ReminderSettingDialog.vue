<template>
  <div class="reminder-setting-dialog">
    <div class="setting-section">
      <label class="setting-label">
        <SySwitch v-model="enabled" />
        <span class="setting-text">{{ t('reminder.enableReminder') }}</span>
      </label>
    </div>

    <template v-if="enabled">
      <!-- 提醒类型选择 -->
      <div class="setting-section">
        <div class="section-title">{{ t('reminder.reminderType') }}</div>
        <div class="type-options">
          <button
            v-for="type in reminderTypes"
            :key="type.value"
            class="b3-button"
            :class="reminderType === type.value ? 'b3-button--primary' : 'b3-button--outline'"
            @click="reminderType = type.value"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <!-- 绝对时间设置 -->
      <div v-if="reminderType === 'absolute'" class="setting-section">
        <div class="section-title">{{ t('reminder.reminderTime') }}</div>
        <input
          type="time"
          v-model="absoluteTime"
          class="b3-text-field time-input"
        />
      </div>

      <!-- 相对时间设置 -->
      <div v-else class="setting-section">
        <div class="section-title">{{ t('reminder.relativeTime') }}</div>
        
        <!-- 相对基准选择 -->
        <div class="relative-base-options">
          <button
            v-for="base in relativeBases"
            :key="base.value"
            class="b3-button"
            :class="relativeBase === base.value ? 'b3-button--primary' : 'b3-button--outline'"
            @click="relativeBase = base.value"
          >
            {{ base.label }}
          </button>
        </div>

        <!-- 提前时间选择 -->
        <div class="offset-options">
          <button
            v-for="offset in offsetPresets"
            :key="offset.value"
            class="b3-button b3-button--small"
            :class="offsetMinutes === offset.value ? 'b3-button--primary' : 'b3-button--outline'"
            @click="offsetMinutes = offset.value"
          >
            {{ offset.label }}
          </button>
        </div>
      </div>
    </template>

    <!-- 底部按钮 -->
    <div class="dialog-footer">
      <button class="b3-button b3-button--outline" @click="handleCancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" @click="handleSave">
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';
import type { ReminderConfig } from '@/types/models';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

interface Props {
  initialConfig?: ReminderConfig;
}

const props = withDefaults(defineProps<Props>(), {
  initialConfig: () => ({
    enabled: false,
    type: 'absolute',
    time: '09:00'
  })
});

const emit = defineEmits<{
  save: [config: ReminderConfig];
  cancel: [];
}>();

// 本地状态
const enabled = ref(props.initialConfig?.enabled ?? false);
const reminderType = ref<'absolute' | 'relative'>(props.initialConfig?.type ?? 'absolute');
const absoluteTime = ref(props.initialConfig?.time ?? '09:00');
const relativeBase = ref<'start' | 'end'>(props.initialConfig?.relativeTo ?? 'start');
const offsetMinutes = ref(props.initialConfig?.offsetMinutes ?? 10);

// 选项定义
const reminderTypes = computed(() => [
  { value: 'absolute', label: t('reminder.absoluteTime') },
  { value: 'relative', label: t('reminder.relativeTime') }
]);

const relativeBases = computed(() => [
  { value: 'start', label: t('reminder.beforeStart') },
  { value: 'end', label: t('reminder.beforeEnd') }
]);

const offsetPresets = computed(() => [
  { value: 5, label: t('reminder.minutes', { n: 5 }) },
  { value: 10, label: t('reminder.minutes', { n: 10 }) },
  { value: 15, label: t('reminder.minutes', { n: 15 }) },
  { value: 30, label: t('reminder.minutes', { n: 30 }) },
  { value: 60, label: t('reminder.hour', { n: 1 }) }
]);

// 保存
function handleSave() {
  if (!enabled.value) {
    emit('save', { enabled: false, type: 'absolute' });
    return;
  }

  if (reminderType.value === 'absolute') {
    emit('save', {
      enabled: true,
      type: 'absolute',
      time: absoluteTime.value,
      alertMode: { type: 'ontime' }
    });
  } else {
    emit('save', {
      enabled: true,
      type: 'relative',
      relativeTo: relativeBase.value,
      offsetMinutes: offsetMinutes.value
    });
  }
}

// 取消
function handleCancel() {
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.reminder-setting-dialog {
  padding: 16px;
  min-width: 280px;
}

.setting-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.type-options,
.relative-base-options,
.offset-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.time-input {
  width: 120px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
