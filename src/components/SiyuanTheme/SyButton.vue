<template>
  <span
    ref="btnRef"
    class="sy-icon-btn"
    :aria-label="ariaLabel"
    role="button"
    tabindex="0"
    @click="$emit('click', $event)"
    @keydown.enter="$emit('click', $event)"
    @keydown.space.prevent="$emit('click', $event)"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <svg class="sy-icon-btn__svg">
      <use :xlink:href="`#${icon}`"></use>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { showIconTooltip, hideIconTooltip } from '@/utils/dialog';

const props = defineProps<{
  icon: string;
  ariaLabel: string;
}>()
defineEmits<{
  click: [event: MouseEvent | KeyboardEvent];
}>()

const btnRef = ref<HTMLElement | null>(null);

function handleMouseEnter() {
  const el = btnRef.value;
  if (el && props.ariaLabel) showIconTooltip(el, props.ariaLabel);
}

function handleMouseLeave() {
  hideIconTooltip();
}
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
