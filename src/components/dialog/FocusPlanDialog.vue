<template>
  <div class="focus-plan-dialog">
    <div class="mode-options">
      <button
        class="mode-option"
        :class="[{ active: selectedType === 'pomodoro' }]"
        @click="selectedType = 'pomodoro'"
      >
        <span class="mode-icon">🍅</span>
        <span>{{ t('focusPlan').pomodoroMode }}</span>
      </button>
      <button
        class="mode-option"
        :class="[{ active: selectedType === 'duration' }]"
        @click="selectedType = 'duration'"
      >
        <span class="mode-icon">⏳</span>
        <span>{{ t('focusPlan').durationMode }}</span>
      </button>
    </div>

    <div class="field-group">
      <label class="field-label">
        {{ selectedType === 'pomodoro' ? t('focusPlan').pomodoroCount : t('focusPlan').durationMinutes }}
      </label>
      <input
        v-model.number="rawValue"
        data-initial-focus
        class="b3-text-field fn__block"
        type="number"
        min="1"
        step="1"
      >
    </div>

    <div class="preview">
      {{ t('focusPlan').preview }}: {{ previewText }}
    </div>

    <div class="dialog-actions">
      <button
        class="b3-button b3-button--cancel"
        @click="emit('cancel')"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button"
        @click="emit('save', undefined)"
      >
        {{ t('focusPlan').clear }}
      </button>
      <button
        class="b3-button b3-button--text"
        @click="handleSave"
      >
        {{ t('common').confirm }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FocusPlan } from '@/types/models'
import {
  computed,
  ref,
} from 'vue'
import { t } from '@/i18n'
import { formatFocusPlanMarker } from '@/parser/focusPlanParser'

const props = defineProps<{
  initialPlan?: FocusPlan
}>()

const emit = defineEmits<{
  save: [plan: Pick<FocusPlan, 'type' | 'rawValue'> | undefined]
  cancel: []
}>()

const selectedType = ref<FocusPlan['type']>(props.initialPlan?.type ?? 'pomodoro')
const rawValue = ref<number>(props.initialPlan?.rawValue ?? (props.initialPlan?.type === 'duration' ? 25 : 1))

const previewText = computed(() => {
  const safeValue = Math.max(1, Math.floor(Number(rawValue.value) || 0))
  return formatFocusPlanMarker({
    type: selectedType.value,
    rawValue: safeValue,
  })
})

function handleSave() {
  const normalizedValue = Math.max(1, Math.floor(Number(rawValue.value) || 0))
  emit('save', {
    type: selectedType.value,
    rawValue: normalizedValue,
  })
}
</script>

<style lang="scss" scoped>
.focus-plan-dialog {
  padding: 16px;
  min-width: 280px;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.mode-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
  cursor: pointer;

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.mode-icon {
  font-size: 16px;
}

.field-group {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.preview {
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
