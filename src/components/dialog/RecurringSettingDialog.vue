<template>
  <div class="recurring-setting-dialog" :class="{ 'drawer-mode': layout === 'drawer' }">
    <!-- 事项信息卡片 -->
    <div v-if="item" class="selected-item-section">
      <SelectedItemCard :item="item" :show-header="true" />
    </div>

    <template v-if="item">
      <!-- 重复规则 -->
      <div class="panel-title">{{ t('recurring.repeatRule') }}</div>
      <div class="quick-buttons">
        <button
          v-for="rule in repeatRules"
          :key="rule.value"
          class="mode-btn"
          :class="{ active: selectedRule === rule.value }"
          @click="selectRule(rule.value)"
        >
          {{ rule.label }}
        </button>
      </div>

      <!-- 每周指定周几 -->
      <div v-if="selectedRule === 'weekly'" class="custom-section">
        <div class="weekday-label">{{ t('recurring.selectWeekDays') }}</div>
        <div class="weekday-buttons">
          <button
            v-for="day in weekDays"
            :key="day.value"
            class="weekday-btn"
            :class="{ active: selectedWeekDays.includes(day.value) }"
            @click="toggleWeekDay(day.value)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>

      <!-- 每月指定日期 -->
      <div v-if="selectedRule === 'monthly'" class="custom-section">
        <label class="checkbox-row">
          <input type="checkbox" v-model="hasSpecificDay" />
          <span class="checkbox-label">{{ t('recurring.specificDay') }}</span>
        </label>
        <div v-if="hasSpecificDay" class="day-input-row">
          <span class="day-label">{{ t('recurring.dayOfMonth') }}</span>
          <input
            v-model.number="specificDay"
            type="number"
            min="1"
            max="31"
            class="day-input"
          />
        </div>
      </div>

      <!-- 结束条件 -->
      <div class="panel-title">{{ t('recurring.endCondition') }}</div>
      <div class="quick-buttons end-condition">
        <button
          v-for="condition in endConditions"
          :key="condition.value"
          class="mode-btn"
          :class="{ active: endConditionType === condition.value }"
          @click="endConditionType = condition.value"
        >
          {{ condition.label }}
        </button>
      </div>

      <!-- 按日期结束 -->
      <div v-if="endConditionType === 'date'" class="custom-section">
        <input
          v-model="endDate"
          type="date"
          class="date-input"
        />
      </div>

      <!-- 按次数结束 -->
      <div v-if="endConditionType === 'count'" class="custom-section">
        <div class="count-input-row">
          <input
            v-model.number="maxCount"
            type="number"
            min="1"
            max="999"
            class="count-input"
          />
          <span class="count-label">{{ t('recurring.times') }}</span>
        </div>
      </div>
    </template>

    <!-- 底部按钮 -->
    <div class="action-section">
      <button class="start-btn" :disabled="!item" @click="handleSave">
        {{ t('recurring.save') }}
      </button>
      <button class="cancel-btn" @click="handleCancel">
        {{ t('recurring.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores';
import { getSharedPinia } from '@/utils/sharedPinia';
import { t } from '@/i18n';
import type { RepeatRule, EndCondition } from '@/types/models';
import SelectedItemCard from '@/components/pomodoro/SelectedItemCard.vue';

interface Props {
  blockId: string;
  initialRepeatRule?: RepeatRule;
  initialEndCondition?: EndCondition;
  layout?: 'dialog' | 'drawer';
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'dialog'
});



const emit = defineEmits<{
  save: [repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined];
  cancel: [];
}>();

// 获取事项信息
const pinia = getSharedPinia();
const projectStore = pinia ? useProjectStore(pinia) : null;

const item = computed(() => {
  if (!props.blockId || !projectStore) return null;
  return projectStore.getItemByBlockId(props.blockId) || null;
});

// 重复规则
const repeatRules = computed(() => [
  { value: 'daily', label: t('recurring.daily') },
  { value: 'weekly', label: t('recurring.weekly') },
  { value: 'monthly', label: t('recurring.monthly') },
  { value: 'yearly', label: t('recurring.yearly') },
  { value: 'workday', label: t('recurring.workday') }
]);

const selectedRule = ref(props.initialRepeatRule?.type ?? 'daily');
const hasSpecificDay = ref(!!props.initialRepeatRule?.dayOfMonth);
const specificDay = ref(props.initialRepeatRule?.dayOfMonth ?? 1);

// 周几选择（0=周日, 1=周一, ..., 6=周六）
const weekDays = computed(() => [
  { value: 1, label: t('recurring.monday') },
  { value: 2, label: t('recurring.tuesday') },
  { value: 3, label: t('recurring.wednesday') },
  { value: 4, label: t('recurring.thursday') },
  { value: 5, label: t('recurring.friday') },
  { value: 6, label: t('recurring.saturday') },
  { value: 0, label: t('recurring.sunday') }
]);
// 根据事项日期获取默认周几（如果没有指定）
function getDefaultWeekDays(): number[] {
  if (props.initialRepeatRule?.daysOfWeek) {
    return props.initialRepeatRule.daysOfWeek;
  }
  // 根据事项日期获取周几，如果没有则默认周一
  const itemDate = item.value?.date;
  if (itemDate) {
    const date = new Date(itemDate);
    const dayOfWeek = date.getDay(); // 0=周日, 1=周一...
    return [dayOfWeek];
  }
  return [1]; // 默认周一
}

const selectedWeekDays = ref<number[]>(getDefaultWeekDays());

function toggleWeekDay(day: number) {
  const index = selectedWeekDays.value.indexOf(day);
  if (index > -1) {
    selectedWeekDays.value.splice(index, 1);
  } else {
    selectedWeekDays.value.push(day);
  }
  // 保持排序
  selectedWeekDays.value.sort((a, b) => a - b);
}

// 结束条件
const endConditions = computed(() => [
  { value: 'never', label: t('recurring.never') },
  { value: 'date', label: t('recurring.endByDate') },
  { value: 'count', label: t('recurring.endByCount') }
]);

const endConditionType = ref(props.initialEndCondition?.type ?? 'never');
const endDate = ref(props.initialEndCondition?.endDate ?? '');
const maxCount = ref(props.initialEndCondition?.maxCount ?? 10);

function selectRule(rule: string) {
  selectedRule.value = rule;
}

function handleSave() {
  // 构建重复规则
  const repeatRule: RepeatRule = {
    type: selectedRule.value as RepeatRule['type']
  };

  if (selectedRule.value === 'weekly' && selectedWeekDays.value.length > 0) {
    repeatRule.daysOfWeek = [...selectedWeekDays.value];
  }

  if (selectedRule.value === 'monthly' && hasSpecificDay.value) {
    repeatRule.dayOfMonth = Math.max(1, Math.min(31, specificDay.value));
  }

  // 构建结束条件
  let endCondition: EndCondition | undefined;

  switch (endConditionType.value) {
    case 'date':
      if (endDate.value) {
        endCondition = { type: 'date', endDate: endDate.value };
      }
      break;
    case 'count':
      if (maxCount.value > 0) {
        endCondition = { type: 'count', maxCount: maxCount.value };
      }
      break;
    default:
      endCondition = { type: 'never' };
  }

  emit('save', repeatRule, endCondition);
}

function handleCancel() {
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.recurring-setting-dialog {
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
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;

  &.end-condition {
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
}

.custom-section {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--b3-theme-surface-lightest);
  border-radius: var(--b3-border-radius);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 13px;
  color: var(--b3-theme-on-background);
}

.day-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.day-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.day-input {
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

.date-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.count-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-input {
  width: 80px;
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

.count-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.weekday-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.weekday-buttons {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.weekday-btn {
  padding: 8px 4px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
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
.recurring-setting-dialog.drawer-mode {
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

  .weekday-buttons {
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }

  .weekday-btn {
    padding: 10px 4px;
    font-size: 12px;
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
