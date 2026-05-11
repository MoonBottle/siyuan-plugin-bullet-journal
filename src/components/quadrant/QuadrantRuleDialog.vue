<template>
  <div class="quadrant-rule-dialog">
    <div class="quadrant-rule-dialog__field">
      <label class="quadrant-rule-dialog__label">{{ t('quadrant').panelTitle }}</label>
      <div class="quadrant-rule-dialog__title">{{ panel.title }}</div>
    </div>

    <div class="quadrant-rule-dialog__field">
      <label class="quadrant-rule-dialog__label">{{ t('quadrant').priorityRule }}</label>
      <div class="quadrant-rule-dialog__checkbox-group">
        <label
          v-for="option in priorityOptions"
          :key="option.value"
          class="quadrant-rule-dialog__checkbox-label"
        >
          <input
            v-model="panel.rules.priority"
            type="checkbox"
            :value="option.value"
          />
          {{ option.label }}
        </label>
      </div>
    </div>

    <div class="quadrant-rule-dialog__field">
      <label class="quadrant-rule-dialog__label">{{ t('quadrant').dateRule }}</label>
      <div class="quadrant-rule-dialog__checkbox-group">
        <label
          v-for="option in dateOptions"
          :key="option.value"
          class="quadrant-rule-dialog__checkbox-label"
        >
          <input
            v-model="panel.rules.date"
            type="checkbox"
            :value="option.value"
          />
          {{ option.label }}
        </label>
      </div>
    </div>

    <div class="quadrant-rule-dialog__footer">
      <button
        data-testid="quadrant-rule-reset-defaults"
        class="b3-button b3-button--cancel"
        @click="handleResetDefaults"
      >
        {{ t('quadrant').resetDefaults }}
      </button>
      <span class="fn__flex-1"></span>
      <button
        class="b3-button b3-button--cancel"
        @click="$emit('close')"
      >
        {{ t('common').cancel }}
      </button>
      <button
        data-testid="quadrant-rule-save"
        class="b3-button b3-button--text"
        @click="$emit('save', panel)"
      >
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { showConfirmDialog } from '@/utils/dialog';
import type { QuadrantPanelConfig } from '@/types/quadrant';

const { panel } = defineProps<{
  panel: QuadrantPanelConfig;
}>();

const emit = defineEmits<{
  (event: 'save', panel: QuadrantPanelConfig): void;
  (event: 'reset-defaults'): void;
  (event: 'close'): void;
}>();

const priorityOptions = [
  { value: 'high', label: t('quadrant').priorityHigh },
  { value: 'medium', label: t('quadrant').priorityMedium },
  { value: 'low', label: t('quadrant').priorityLow },
  { value: 'none', label: t('quadrant').priorityNone },
];

const dateOptions = [
  { value: 'overdue', label: t('quadrant').dateOverdue },
  { value: 'today', label: t('quadrant').dateToday },
  { value: 'tomorrow', label: t('quadrant').dateTomorrow },
  { value: 'undated', label: t('quadrant').dateUndated },
];

function handleResetDefaults() {
  showConfirmDialog(
    t('quadrant').editPanel,
    t('quadrant').resetConfirm,
    () => emit('reset-defaults'),
  );
}
</script>

<style lang="scss" scoped>
.quadrant-rule-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  gap: 16px;
  min-width: 0;
  padding: 16px 20px 20px;
}

.quadrant-rule-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.quadrant-rule-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.quadrant-rule-dialog__title {
  min-height: 34px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  box-sizing: border-box;
  width: 100%;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.quadrant-rule-dialog__checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.quadrant-rule-dialog__checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  white-space: nowrap;
}

.quadrant-rule-dialog__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
