<template>
  <div class="calendar-day-header">
    <span
      class="block__icon"
      @mouseenter="showTooltip($event.currentTarget as HTMLElement, t('calendarNav').prev)"
      @mouseleave="hideTooltip"
      @click="handlePrev"
    >
      <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span
      class="block__icon"
      @mouseenter="showTooltip($event.currentTarget as HTMLElement, t('calendarNav').next)"
      @mouseleave="hideTooltip"
      @click="handleNext"
    >
      <svg><use xlink:href="#iconRight"></use></svg>
    </span>
    <span
      class="block__icon"
      @mouseenter="showTooltip($event.currentTarget as HTMLElement, t('calendarNav').today)"
      @mouseleave="hideTooltip"
      @click="handleToday"
    >
      <svg><use xlink:href="#iconCalendar"></use></svg>
    </span>
    <span
      v-if="showBack"
      class="block__icon"
      @mouseenter="showTooltip($event.currentTarget as HTMLElement, t('calendarNav').back)"
      @mouseleave="hideTooltip"
      @click="handleBack"
    >
      <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
    <span class="calendar-day-header__title">{{ title }}</span>
    <span
      v-if="durationLabel"
      class="calendar-day-header__duration"
    >{{ durationLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

withDefaults(defineProps<{
  title: string
  durationLabel?: string
  showBack?: boolean
}>(), {
  durationLabel: '',
  showBack: false,
})

const emit = defineEmits<{
  (event: 'prev'): void
  (event: 'next'): void
  (event: 'today'): void
  (event: 'back'): void
}>()

function handlePrev() {
  hideTooltip()
  emit('prev')
}

function handleNext() {
  hideTooltip()
  emit('next')
}

function handleToday() {
  hideTooltip()
  emit('today')
}

function handleBack() {
  hideTooltip()
  emit('back')
}
</script>

<style lang="scss" scoped>
.calendar-day-header {
  display: flex;
  align-items: center;
  min-width: 0;

  .block__icon {
    opacity: 1;
  }
}

.calendar-day-header__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-left: 12px;
  white-space: nowrap;
}

.calendar-day-header__duration {
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
  margin-left: 10px;
  white-space: nowrap;
}
</style>
