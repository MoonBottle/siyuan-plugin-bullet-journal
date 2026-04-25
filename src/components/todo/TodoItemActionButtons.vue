<template>
  <div v-if="showActions" class="todo-item-actions">
    <button
      v-if="showReminder"
      class="action-btn b3-tooltips b3-tooltips__n"
      :class="{ active: hasReminder, readonly: isReadonly }"
      :disabled="isReadonly"
      :aria-label="reminderTooltip || reminderText"
      @click.stop="$emit('set-reminder')"
    >
      <span class="action-icon">⏰</span>
      <span class="action-text">{{ reminderText }}</span>
    </button>

    <button
      v-if="showRecurring"
      class="action-btn b3-tooltips b3-tooltips__n"
      :class="{ active: hasRecurring, readonly: isReadonly }"
      :disabled="isReadonly"
      :aria-label="recurringTooltip || recurringText"
      @click.stop="$emit('set-recurring')"
    >
      <span class="action-icon">🔁</span>
      <span class="action-text">{{ recurringText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  hasReminder: boolean;
  hasRecurring: boolean;
  isReadonly: boolean;
  showReminder: boolean;
  showRecurring: boolean;
  reminderText: string;
  recurringText: string;
  reminderTooltip?: string;
  recurringTooltip?: string;
}>();

defineEmits<{
  'set-reminder': [];
  'set-recurring': [];
}>();

const showActions = computed(() => props.showReminder || props.showRecurring);
</script>

<style lang="scss" scoped>
.todo-item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-light);
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.readonly {
    cursor: default;
    opacity: 0.8;

    &:hover {
      background: var(--b3-theme-surface);
      border-color: var(--b3-theme-primary);
    }
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.action-icon {
  font-size: 12px;
}
</style>
