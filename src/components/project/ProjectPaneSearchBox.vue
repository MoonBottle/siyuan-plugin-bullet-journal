<template>
  <div class="project-pane-search-box">
    <svg class="project-pane-search-box__icon"><use xlink:href="#iconSearch"></use></svg>
    <input
      :value="modelValue"
      :data-testid="testId"
      type="text"
      class="project-pane-search-box__input"
      :placeholder="placeholder"
      @input="handleInput"
    />
    <button
      v-if="modelValue"
      type="button"
      class="project-pane-search-box__clear"
      :aria-label="clearLabel"
      @click="$emit('update:modelValue', '')"
    >
      <svg><use xlink:href="#iconClose"></use></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  placeholder: string
  clearLabel?: string
  testId?: string
}>(), {
  clearLabel: 'Clear',
  testId: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<style lang="scss" scoped>
.project-pane-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  padding: 5px 10px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);

  &:focus-within {
    border-color: var(--b3-theme-primary);
  }
}

.project-pane-search-box__icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  flex-shrink: 0;
}

.project-pane-search-box__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--b3-theme-on-background);
  font-size: 13px;
}

.project-pane-search-box__clear {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  opacity: 0.45;

  &:hover {
    opacity: 0.85;
  }

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
}
</style>
