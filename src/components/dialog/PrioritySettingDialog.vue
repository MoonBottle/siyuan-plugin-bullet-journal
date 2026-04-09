<template>
  <div class="priority-setting-dialog">
    <div class="priority-options">
      <button
        v-for="option in priorityOptions"
        :key="option.value"
        :class="['priority-option', { active: selectedPriority === option.value }]"
        @click="selectPriority(option.value)"
      >
        <span class="priority-emoji">{{ option.emoji }}</span>
        <span class="priority-label">{{ option.label }}</span>
      </button>
      <button
        :class="['priority-option', { active: !selectedPriority }]"
        @click="selectPriority(undefined)"
      >
        <span class="priority-emoji">⚪</span>
        <span class="priority-label">{{ t('todo').priority.clear }}</span>
      </button>
    </div>
    <div class="dialog-actions">
      <button class="b3-button b3-button--cancel" @click="cancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" @click="confirm">
        {{ t('common').confirm }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { t } from '@/i18n';

const props = defineProps<{
  initialPriority?: PriorityLevel;
}>();

const emit = defineEmits<{
  confirm: [priority: PriorityLevel | undefined];
  cancel: [];
}>();

const selectedPriority = ref<PriorityLevel | undefined>(props.initialPriority);

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji, label: PRIORITY_CONFIG.high.label },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji, label: PRIORITY_CONFIG.medium.label },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji, label: PRIORITY_CONFIG.low.label },
];

function selectPriority(priority: PriorityLevel | undefined) {
  selectedPriority.value = priority;
}

function confirm() {
  emit('confirm', selectedPriority.value);
}

function cancel() {
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.priority-setting-dialog {
  padding: 16px;
  min-width: 200px;
}

.priority-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.priority-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.priority-emoji {
  font-size: 18px;
}

.priority-label {
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
