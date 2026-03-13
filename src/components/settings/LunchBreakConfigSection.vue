<template>
  <SySettingsSection
    icon="iconClock"
    :title="t('settings').lunchBreak.title"
    :description="t('settings').lunchBreak.description"
  >
    <div class="sy-lunch-break-fields fn__flex">
      <div class="sy-lunch-break-field">
        <label class="sy-lunch-break-field__label">{{ t('settings').lunchBreak.start.title }}</label>
        <input
          :value="lunchBreakStart"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakStart', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="sy-lunch-break-field">
        <label class="sy-lunch-break-field__label">{{ t('settings').lunchBreak.end.title }}</label>
        <input
          :value="lunchBreakEnd"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakEnd', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';

defineProps<{
  lunchBreakStart: string;
  lunchBreakEnd: string;
}>();

defineEmits<{
  'update:lunchBreakStart': [value: string];
  'update:lunchBreakEnd': [value: string];
}>();
</script>

<style scoped>
.sy-lunch-break-fields {
  gap: 24px;
  flex-wrap: wrap;
}

.sy-lunch-break-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sy-lunch-break-field__label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.sy-time-input {
  max-width: 120px;
}
</style>
