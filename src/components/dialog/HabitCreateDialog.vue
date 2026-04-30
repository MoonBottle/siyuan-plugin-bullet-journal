<template>
  <div class="habit-create-dialog">
    <!-- 习惯名 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').nameLabel || '习惯名' }}</label>
      <input
        v-model="form.name"
        type="text"
        class="form-input"
        data-testid="habit-name-input"
        :placeholder="t('habit').namePlaceholder || '输入习惯名'"
        @keyup.enter="handleSave"
      />
    </div>

    <!-- 开始日期 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').startDateLabel || '开始日期' }}</label>
      <input
        v-model="form.startDate"
        type="date"
        class="form-input"
        data-testid="habit-start-date-input"
      />
    </div>

    <!-- 坚持天数 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').durationLabel || '坚持天数（可选）' }}</label>
      <input
        v-model.number="form.durationDays"
        type="number"
        min="0"
        class="form-input"
        data-testid="habit-duration-input"
        :placeholder="t('habit').durationPlaceholder || '留空表示不限制'"
      />
    </div>

    <!-- 类型切换 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').typeLabel || '类型' }}</label>
      <div class="type-toggle">
        <button
          :class="['type-btn', { active: form.type === 'binary' }]"
          data-testid="habit-type-binary-button"
          @click="form.type = 'binary'"
        >
          {{ t('habit').typeBinary || '二元型' }}
        </button>
        <button
          :class="['type-btn', { active: form.type === 'count' }]"
          data-testid="habit-type-count-button"
          @click="form.type = 'count'"
        >
          {{ t('habit').typeCount || '计数型' }}
        </button>
      </div>
    </div>

    <!-- 计数型：目标值+单位 -->
    <div v-if="form.type === 'count'" class="form-group">
      <label class="form-label">{{ t('habit').targetLabel || '目标值+单位' }}</label>
      <div class="target-row">
        <input
          v-model.number="form.target"
          type="number"
          min="1"
          class="form-input target-input"
          data-testid="habit-target-input"
          :placeholder="'8'"
        />
        <input
          v-model="form.unit"
          type="text"
          class="form-input unit-input"
          data-testid="habit-unit-input"
          :placeholder="t('habit').unitPlaceholder || '杯'"
        />
      </div>
    </div>

    <!-- 提醒时间 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').reminderLabel || '提醒时间（可选）' }}</label>
      <input
        v-model="form.reminderTime"
        type="time"
        class="form-input"
        data-testid="habit-reminder-time-input"
      />
    </div>

    <!-- 频率 -->
    <div class="form-group">
      <label class="form-label">{{ t('habit').frequencyLabel || '频率' }}</label>
      <div class="frequency-options">
        <button
          v-for="opt in frequencyOptions"
          :key="opt.value"
          :class="['freq-btn', { active: form.frequencyType === opt.value }]"
          :data-testid="`habit-frequency-${opt.value}-button`"
          @click="selectFrequency(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <!-- 每N天 -->
      <div v-if="form.frequencyType === 'every_n_days'" class="freq-detail">
        <input
          v-model.number="form.interval"
          type="number"
          min="2"
          class="form-input small-input"
          data-testid="habit-interval-input"
        />
        <span class="freq-detail-label">{{ t('habit').daysInterval || '天间隔' }}</span>
      </div>
      <!-- 每周N天 -->
      <div v-if="form.frequencyType === 'n_per_week'" class="freq-detail">
        <input
          v-model.number="form.daysPerWeek"
          type="number"
          min="1"
          max="7"
          class="form-input small-input"
          data-testid="habit-days-per-week-input"
        />
        <span class="freq-detail-label">{{ t('habit').daysPerWeekLabel || '天/周' }}</span>
      </div>
      <!-- 指定周几 -->
      <div v-if="form.frequencyType === 'weekly_days'" class="freq-detail">
        <button
          v-for="(label, idx) in weekDayLabels"
          :key="idx"
          :class="['day-btn', { active: form.daysOfWeek.includes(idx) }]"
          @click="toggleDayOfWeek(idx)"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <button class="btn btn-cancel" @click="emit('cancel')">{{ t('common').cancel }}</button>
      <button class="btn btn-save" @click="handleSave">{{ t('common').confirm }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import type { HabitFrequency, ReminderConfig } from '@/types/models';

const props = defineProps<{
  initialData?: Partial<{
    name: string;
    startDate: string;
    durationDays?: number;
    type: 'binary' | 'count';
    target?: number;
    unit?: string;
    reminder?: Pick<ReminderConfig, 'type' | 'time'>;
    frequency?: HabitFrequency;
  }>;
}>();

const emit = defineEmits<{
  'save': [markdown: string];
  'cancel': [];
}>();

const form = reactive({
  name: props.initialData?.name || '',
  startDate: props.initialData?.startDate || dayjs().format('YYYY-MM-DD'),
  durationDays: props.initialData?.durationDays ?? undefined as number | undefined,
  type: props.initialData?.type || 'binary' as 'binary' | 'count',
  target: props.initialData?.target ?? 1,
  unit: props.initialData?.unit || '',
  reminderTime: props.initialData?.reminder?.time || '',
  frequencyType: (props.initialData?.frequency?.type || 'daily') as HabitFrequency['type'],
  interval: props.initialData?.frequency?.interval ?? 2,
  daysPerWeek: props.initialData?.frequency?.daysPerWeek ?? 3,
  daysOfWeek: (props.initialData?.frequency?.daysOfWeek || []) as number[],
});

const weekDayLabels = computed(() => t('calendar').weekDays);

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('habit').freqDaily || '每天' },
  { value: 'every_n_days', label: t('habit').freqEveryNDays || '每N天' },
  { value: 'weekly', label: t('habit').freqWeekly || '每周' },
  { value: 'n_per_week', label: t('habit').freqNPerWeek || '每周N天' },
  { value: 'weekly_days', label: t('habit').freqWeeklyDays || '指定周几' },
]);

function selectFrequency(type: HabitFrequency['type']) {
  form.frequencyType = type;
  form.daysOfWeek = [];
}

function toggleDayOfWeek(day: number) {
  const idx = form.daysOfWeek.indexOf(day);
  if (idx >= 0) {
    form.daysOfWeek.splice(idx, 1);
  } else {
    form.daysOfWeek.push(day);
  }
}

function buildMarkdown(): string {
  let line = form.name;
  line += ` 🎯${form.startDate}`;

  if (form.durationDays) {
    line += ` 坚持${form.durationDays}天`;
  }

  if (form.type === 'count' && form.target) {
    line += ` ${form.target}${form.unit || ''}`;
  }

  if (form.reminderTime) {
    line += ` ⏰${form.reminderTime}`;
  }

  // 频率
  switch (form.frequencyType) {
    case 'daily':
      line += ' 🔄每天';
      break;
    case 'every_n_days':
      line += ` 🔄每${form.interval}天`;
      break;
    case 'weekly':
      line += ' 🔄每周';
      break;
    case 'n_per_week':
      line += ` 🔄每周${form.daysPerWeek}天`;
      break;
    case 'weekly_days': {
      const dayNames = form.daysOfWeek
        .sort()
        .map(d => weekDayLabels.value[d] || '')
        .join('');
      line += ` 🔄每周${dayNames}`;
      break;
    }
  }

  return line;
}

function handleSave() {
  if (!form.name.trim())
    return;
  if (form.type === 'count' && (!Number.isFinite(form.target) || form.target <= 0))
    return;
  if (form.frequencyType === 'weekly_days' && form.daysOfWeek.length === 0)
    return;

  const markdown = buildMarkdown();
  emit('save', markdown);
}
</script>

<style scoped>
.habit-create-dialog {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--b3-theme-primary);
}

.type-toggle {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.type-btn.active {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.target-row {
  display: flex;
  gap: 8px;
}

.target-input {
  flex: 1;
}

.unit-input {
  width: 80px;
}

.frequency-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.freq-btn {
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 14px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.freq-btn.active {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.freq-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.small-input {
  width: 80px;
}

.freq-detail-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.day-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 50%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-btn.active {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

.btn-save {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.btn-save:hover {
  opacity: 0.9;
}
</style>
