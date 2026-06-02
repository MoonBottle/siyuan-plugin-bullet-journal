<template>
  <button
    type="button"
    class="sy-settings-action-btn b3-button b3-button--outline fn__flex-center"
    @click="$emit('click', $event)"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <svg
      v-if="icon"
      class="sy-settings-action-btn__icon"
    >
      <use :xlink:href="`#${icon}`"></use>
    </svg>
    <span>{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
import { hideIconTooltip, showIconTooltip } from '@/utils/dialog'

const props = defineProps<{
  icon?: string
  text: string
  title?: string
}>()
defineEmits<{
  click: [event: MouseEvent]
}>()

function onMouseEnter(e: MouseEvent) {
  if (props.title) {
    showIconTooltip(e.currentTarget as HTMLElement, props.title)
  }
}

function onMouseLeave(e: MouseEvent) {
  hideIconTooltip(e.currentTarget as HTMLElement)
}
</script>

<style scoped>
.sy-settings-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 8px;
}

.sy-settings-action-btn__icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
</style>
