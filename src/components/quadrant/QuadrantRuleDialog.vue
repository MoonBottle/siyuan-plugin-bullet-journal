<template>
  <div class="quadrant-rule-dialog">
    <div class="quadrant-rule-dialog__field">
      <label class="quadrant-rule-dialog__label">{{ t('quadrant').panelTitle }}</label>
      <input
        v-model="draft.title"
        data-testid="quadrant-rule-title-input"
        class="b3-text-field fn__block"
      />
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
            v-model="draft.rules.priority"
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
            v-model="draft.rules.date"
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
        @click="$emit('save', draft)"
      >
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { t } from '@/i18n';
import { showConfirmDialog } from '@/utils/dialog';
import type { QuadrantPanelConfig } from '@/types/quadrant';

const props = defineProps<{
  panel: QuadrantPanelConfig;
}>();

const emit = defineEmits<{
  (event: 'save', panel: QuadrantPanelConfig): void;
  (event: 'reset-defaults'): void;
  (event: 'close'): void;
}>();

const draft = reactive<QuadrantPanelConfig>({
  id: props.panel.id,
  title: props.panel.title,
  rules: {
    priority: [...(props.panel.rules.priority ?? [])],
    date: [...(props.panel.rules.date ?? [])],
  },
});

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
  gap: 16px;
  padding: 8px 0;
}

.quadrant-rule-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quadrant-rule-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.quadrant-rule-dialog__checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.quadrant-rule-dialog__checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.quadrant-rule-dialog__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
