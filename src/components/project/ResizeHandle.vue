<template>
  <div
    class="resize-handle"
    :class="{ 'resize-handle--active': isActive }"
    @mousedown="handleMouseDown"
  ></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isActive?: boolean
}>(), {
  isActive: false,
});

const emit = defineEmits<{
  (e: 'drag-start', event: MouseEvent): void;
}>();

function handleMouseDown(event: MouseEvent) {
  emit('drag-start', event);
}
</script>

<style scoped lang="scss">
.resize-handle {
  position: relative;
  width: 16px;
  cursor: col-resize;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -4px;
    right: -4px;
    bottom: 0;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 100%;
    background-color: var(--b3-border-color);
    opacity: 0.5;
    transition: opacity 0.15s, background-color 0.15s;
  }

  &:hover::after {
    opacity: 0.8;
    background-color: var(--b3-text-on-surface);
  }

  &--active::after {
    opacity: 1;
    background-color: var(--b3-theme-primary);
  }
}
</style>
