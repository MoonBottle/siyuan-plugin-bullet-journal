<template>
  <div class="recurring-setting-dialog">
    <div class="setting-section">
      <label class="setting-label">
        <SySwitch v-model="enabled" />
        <span class="setting-text">{{ t('recurring.enableRecurring') }}</span>
      </label>
    </div>

    <template v-if="enabled">
      <!-- 重复规则选择 -->
      <div class="setting-section">
        <div class="section-title">{{ t('recurring.repeatRule') }}</div>
        <div class="rule-options">
          <button
            v-for="rule in repeatRules"
            :key="rule.value"
            class="b3-button"
            :class="selectedRule === rule.value ? 'b3-button--primary' : 'b3-button--outline'"
            @click="selectedRule = rule.value"
          >
            {{ rule.label }}
          </button>
        </div>
      </div>

      <!-- 每月指定日期 -->
      <div v-if="selectedRule === 'monthly'" class="setting-section">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="hasSpecificDay"
          />
          <span>{{ t('recurring.specificDay') }}</span>
        </label>
        <input
          v-if="hasSpecificDay"
          type="number"
          v-model.number="specificDay"
          min="1"
          max="31"
          class="b3-text-field"
          :placeholder="t('recurring.dayOfMonth')"
        />
      </div>

      <!-- 结束条件 -->
      <div class="setting-section">
        <div class="section-title">{{ t('recurring.endCondition') }}</div>
        
        <!-- 永不结束 -->
        <label class="radio-label">
          <input
            type="radio"
            v-model="endConditionType"
            value="never"
          />
          <span>{{ t('recurring.never') }}</span>
        </label>

        <!-- 按日期结束 -->
        <label class="radio-label">
          <input
            type="radio"
            v-model="endConditionType"
            value="date"
          />
          <span>{{ t('recurring.endByDate') }}</span>
        </label>
        <input
          v-if="endConditionType === 'date'"
          type="date"
          v-model="endDate"
          class="b3-text-field"
        />

        <!-- 按次数结束 -->
        <label class="radio-label">
          <input
            type="radio"
            v-model="endConditionType"
            value="count"
          />
          <span>{{ t('recurring.endByCount') }}</span>
        </label>
        <input
          v-if="endConditionType === 'count'"
          type="number"
          v-model.number="maxCount"
          min="1"
          max="999"
          class="b3-text-field"
          :placeholder="t('recurring.times')"
        />
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
import type { RepeatRule, EndCondition } from '@/types/models';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

interface Props {
  initialRepeatRule?: RepeatRule;
  initialEndCondition?: EndCondition;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  save: [repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined];
  cancel: [];
}>();

// 本地状态
const enabled = ref(!!props.initialRepeatRule);
const selectedRule = ref(props.initialRepeatRule?.type ?? 'daily');
const hasSpecificDay = ref(!!props.initialRepeatRule?.dayOfMonth);
const specificDay = ref(props.initialRepeatRule?.dayOfMonth ?? 1);

const endConditionType = ref(props.initialEndCondition?.type ?? 'never');
const endDate = ref(props.initialEndCondition?.endDate ?? '');
const maxCount = ref(props.initialEndCondition?.maxCount ?? 10);

// 重复规则选项
const repeatRules = computed(() => [
  { value: 'daily', label: t('recurring.daily') },
  { value: 'weekly', label: t('recurring.weekly') },
  { value: 'monthly', label: t('recurring.monthly') },
  { value: 'yearly', label: t('recurring.yearly') },
  { value: 'workday', label: t('recurring.workday') }
]);

// 保存
function handleSave() {
  if (!enabled.value) {
    emit('save', undefined, undefined);
    return;
  }

  // 构建重复规则
  const repeatRule: RepeatRule = {
    type: selectedRule.value
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

// 取消
function handleCancel() {
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.recurring-setting-dialog {
  padding: 16px;
  min-width: 280px;
}

.setting-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-label,
.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--b3-theme-on-background);
  margin-bottom: 8px;
}

.radio-label {
  margin-bottom: 4px;
}

.setting-text {
  margin-left: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.rule-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.b3-text-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  margin-top: 4px;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
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
