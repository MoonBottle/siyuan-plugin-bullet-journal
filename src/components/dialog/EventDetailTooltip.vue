<template>
  <Teleport to="body">
    <div
      ref="tooltipEl"
      class="event-detail-tooltip"
      :class="{ 'event-detail-tooltip--visible': visible }"
      :style="positionStyle"
      @mouseenter="onTooltipMouseEnter"
      @mouseleave="onTooltipMouseLeave"
    >
      <ItemDetailContent
        v-if="currentItem"
        :item="currentItem"
        :readonly="true"
        :embedded="true"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  CalendarEvent,
  Item,
} from '@/types/models'
import {
  nextTick,
  ref,
} from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import { buildItemFromEventProps } from '@/utils/dialog'
import { computeTooltipPosition } from '@/utils/tooltipPosition'

const tooltipEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const positionStyle = ref<{
  left?: string
  top?: string
}>({})
const currentItem = ref<Item | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let isHoveringTooltip = false

const show = (event: CalendarEvent, anchorEl: HTMLElement, delay = 300) => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  timer = setTimeout(() => {
    timer = null
    currentItem.value = buildItemFromEventProps(event)
    nextTick(() => {
      if (tooltipEl.value) {
        const rect = anchorEl.getBoundingClientRect()
        positionStyle.value = computeTooltipPosition(rect, tooltipEl.value, 4)
        visible.value = true
      }
    })
  }, delay)
}

const hide = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!isHoveringTooltip) {
    visible.value = false
  }
}

const onTooltipMouseEnter = () => {
  isHoveringTooltip = true
}

const onTooltipMouseLeave = () => {
  isHoveringTooltip = false
  visible.value = false
}

defineExpose({
  show,
  hide,
})
</script>

<style lang="scss">
.event-detail-tooltip {
  position: fixed;
  z-index: 10000;
  min-width: 350px;
  max-width: 440px;
  overflow: visible;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.15s ease;

  &.event-detail-tooltip--visible {
    opacity: 1;
  }

  .sy-dialog-content {
    padding: 0 !important;
  }

  .sy-dialog-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sy-dialog-card {
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
  }
}
</style>
