<template>
  <div class="quadrant-rule-dialog">
    <div class="quadrant-rule-dialog__field">
      <label class="quadrant-rule-dialog__label">{{ t('quadrant').panelTitle }}</label>
      <div class="quadrant-rule-dialog__title">
        {{ panel.title }}
      </div>
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
        @click="handleSave"
      >
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuadrantPanelConfig } from '@/types/quadrant'
import { reactive } from 'vue'
import { t } from '@/i18n'
import { showConfirmDialog } from '@/utils/dialog'

const props = defineProps<{
  panel: QuadrantPanelConfig
}>()

const emit = defineEmits<{
  (event: 'save', panel: QuadrantPanelConfig): void
  (event: 'resetDefaults'): void
  (event: 'close'): void
}>()

const panel = reactive<QuadrantPanelConfig>({
  id: props.panel.id,
  title: props.panel.title,
  rules: {
    priority: Array.isArray(props.panel.rules.priority) ? [...props.panel.rules.priority] : [],
    date: Array.isArray(props.panel.rules.date) ? [...props.panel.rules.date] : [],
  },
})

const priorityOptions = [
  {
    value: 'high',
    label: t('quadrant').priorityHigh,
  },
  {
    value: 'medium',
    label: t('quadrant').priorityMedium,
  },
  {
    value: 'low',
    label: t('quadrant').priorityLow,
  },
  {
    value: 'none',
    label: t('quadrant').priorityNone,
  },
]

const dateOptions = [
  {
    value: 'overdue',
    label: t('quadrant').dateOverdue,
  },
  {
    value: 'today',
    label: t('quadrant').dateToday,
  },
  {
    value: 'tomorrow',
    label: t('quadrant').dateTomorrow,
  },
  {
    value: 'thisWeek',
    label: t('quadrant').dateThisWeek,
  },
  {
    value: 'thisMonth',
    label: t('quadrant').dateThisMonth,
  },
  {
    value: 'recent7',
    label: t('quadrant').dateRecent7,
  },
]

function handleResetDefaults() {
  showConfirmDialog(
    t('quadrant').editPanel,
    t('quadrant').resetConfirm,
    () => emit('resetDefaults'),
  )
}

function handleSave() {
  emit('save', {
    id: panel.id,
    title: panel.title,
    rules: {
      priority: [...panel.rules.priority],
      date: [...panel.rules.date],
    },
  })
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
