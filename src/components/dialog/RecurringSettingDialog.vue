<template>
  <div class="recurring-setting-dialog">
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
}

const props = defineProps<Props>();

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

.action-section {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
