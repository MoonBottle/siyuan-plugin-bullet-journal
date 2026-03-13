<template>
  <SySettingsSection
    :title="t('settings').lunchBreak.start.title"
    :description="t('settings').lunchBreak.description"
  >
    <input
      :value="lunchBreakStart"
      type="time"
      class="b3-text-field fn__flex-center sy-time-input"
      @input="$emit('update:lunchBreakStart', ($event.target as HTMLInputElement).value)"
    />
  </SySettingsSection>
  <SySettingsSection
    :title="t('settings').lunchBreak.end.title"
    :description="t('settings').lunchBreak.description"
  >
    <input
      :value="lunchBreakEnd"
      type="time"
      class="b3-text-field fn__flex-center sy-time-input"
      @input="$emit('update:lunchBreakEnd', ($event.target as HTMLInputElement).value)"
    />
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
.sy-time-input {
  max-width: 120px;
}
</style>
