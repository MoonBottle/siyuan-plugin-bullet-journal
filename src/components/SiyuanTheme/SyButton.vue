<template>
  <span
    class="b3-tooltips b3-tooltips__nw sy-icon-btn"
    :aria-label="ariaLabel"
    role="button"
    tabindex="0"
    @click="$emit('click', $event)"
    @keydown.enter="$emit('click', $event)"
    @keydown.space.prevent="$emit('click', $event)"
  >
    <svg class="sy-icon-btn__svg">
      <use :xlink:href="`#${icon}`"></use>
    </svg>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  ariaLabel: string;
}>()
defineEmits<{
  click: [event: MouseEvent | KeyboardEvent];
}>()
</script>

<style scoped>
.sy-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
  transition: background-color 0.2s;
}

.sy-icon-btn:hover {
  background-color: var(--b3-theme-surface);
}

.sy-icon-btn:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

.sy-icon-btn__svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
  display: block;
}
</style>
