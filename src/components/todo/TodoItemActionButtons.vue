<template>
  <div
    v-if="showActions"
    class="todo-item-actions"
  >
    <button
      v-if="showReminder && (!isReadonly || hasReminder)"
      class="action-btn"
      :class="{
        active: hasReminder, readonly: isReadonly,
      }"
      :disabled="isReadonly"
      :aria-label="reminderTooltip || reminderText"
      @mouseenter="handleShowTooltip($event, reminderTooltip || reminderText)"
      @mouseleave="handleHideTooltip"
      @click.stop="$emit('setReminder')"
    >
      <span class="action-icon">⏰</span>
      <span class="action-text">{{ reminderText }}</span>
    </button>

    <button
      v-if="showRecurring && (!isReadonly || hasRecurring)"
      class="action-btn"
      :class="{
        active: hasRecurring, readonly: isReadonly,
      }"
      :disabled="isReadonly"
      :aria-label="recurringTooltip || recurringText"
      @mouseenter="handleShowTooltip($event, recurringTooltip || recurringText)"
      @mouseleave="handleHideTooltip"
      @click.stop="$emit('setRecurring')"
    >
      <span class="action-icon">🔁</span>
      <span class="action-text">{{ recurringText }}</span>
    </button>

  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
} from 'vue'
import {
  hideIconTooltip,
  showIconTooltip,
} from '@/utils/dialog'

const props = defineProps<{
  hasReminder: boolean
  hasRecurring: boolean
  isReadonly: boolean
  showReminder: boolean
  showRecurring: boolean
  reminderText: string
  recurringText: string
  reminderTooltip?: string
  recurringTooltip?: string
}>()

defineEmits<{
  setReminder: []
  setRecurring: []
}>()

const showActions = computed(() => {
  const showReminderBtn = props.showReminder && (!props.isReadonly || props.hasReminder)
  const showRecurringBtn = props.showRecurring && (!props.isReadonly || props.hasRecurring)
  return showReminderBtn || showRecurringBtn
})

function handleShowTooltip(event: MouseEvent | FocusEvent, text?: string) {
  if (!text)
    return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement))
    return
  showIconTooltip(target, text)
}

function handleHideTooltip() {
  hideIconTooltip()
}

onBeforeUnmount(() => {
  hideIconTooltip()
})
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
    // border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.readonly {
    cursor: default;

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
