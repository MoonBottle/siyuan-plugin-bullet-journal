<template>
  <div class="calendar-day-header">
    <span
      class="block__icon b3-tooltips b3-tooltips__se"
      :aria-label="t('calendarNav').prev"
      @click="emit('prev')"
    >
      <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span
      class="block__icon b3-tooltips b3-tooltips__se"
      :aria-label="t('calendarNav').next"
      @click="emit('next')"
    >
      <svg><use xlink:href="#iconRight"></use></svg>
    </span>
    <span
      class="block__icon b3-tooltips b3-tooltips__se"
      :aria-label="t('calendarNav').today"
      @click="emit('today')"
    >
      <svg><use xlink:href="#iconCalendar"></use></svg>
    </span>
    <span
      v-if="showBack"
      class="block__icon b3-tooltips b3-tooltips__se"
      :aria-label="t('calendarNav').back"
      @click="emit('back')"
    >
      <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
    <span class="calendar-day-header__title">{{ title }}</span>
    <span v-if="durationLabel" class="calendar-day-header__duration">{{ durationLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';

withDefaults(defineProps<{
  title: string;
  durationLabel?: string;
  showBack?: boolean;
}>(), {
  durationLabel: '',
  showBack: false,
});

const emit = defineEmits<{
  (event: 'prev'): void;
  (event: 'next'): void;
  (event: 'today'): void;
  (event: 'back'): void;
}>();
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
