<template>
  <div class="habit-count-input">
    <button
      class="habit-count-input__btn habit-count-input__btn--minus"
      :disabled="currentValue <= 0"
      @click="emit('change', Math.max(0, currentValue - 1))"
    >−</button>
    <span class="habit-count-input__value">{{ currentValue }}</span>
    <button
      class="habit-count-input__btn habit-count-input__btn--plus"
      @click="emit('change', currentValue + 1)"
    >+</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentValue: number;
  target?: number;
}>();

const emit = defineEmits<{
  'change': [value: number];
}>();
</script>

<style scoped>
.habit-count-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.habit-count-input__btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.habit-count-input__btn:hover:not(:disabled) {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.habit-count-input__btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.habit-count-input__value {
  font-size: 16px;
  font-weight: 600;
  min-width: 28px;
  text-align: center;
}
</style>
