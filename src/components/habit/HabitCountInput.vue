<template>
  <div class="habit-count-input">
    <button
      class="habit-count-input__btn habit-count-input__btn--minus"
      :disabled="currentValue <= 0"
      @click="emit('change', Math.max(0, currentValue - 1))"
    >−</button>
    <input
      :value="draftValue"
      type="number"
      min="0"
      class="habit-count-input__field"
      data-testid="habit-count-direct-input"
      @input="handleInput"
      @keydown.enter.prevent="commitDraft"
      @blur="commitDraft"
    />
    <button
      class="habit-count-input__btn habit-count-input__btn--plus"
      @click="emit('change', currentValue + 1)"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  currentValue: number;
  target?: number;
}>();

const emit = defineEmits<{
  'change': [value: number];
}>();

const draftValue = ref(String(props.currentValue));

watch(() => props.currentValue, (value) => {
  draftValue.value = String(value);
});

function handleInput(event: Event) {
  draftValue.value = (event.target as HTMLInputElement).value;
}

function commitDraft() {
  const nextValue = Number(draftValue.value);
  if (!Number.isFinite(nextValue) || nextValue < 0 || !Number.isInteger(nextValue)) {
    draftValue.value = String(props.currentValue);
    return;
  }

  if (nextValue !== props.currentValue) {
    emit('change', nextValue);
  }
}
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

.habit-count-input__field {
  width: 52px;
  min-width: 52px;
  height: 28px;
  padding: 4px 6px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  box-sizing: border-box;
}

.habit-count-input__field:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
}
</style>
