<template>
  <SySettingsSection icon="iconClock" :title="t('settings').lunchBreak.title">
    <div class="sy-lunch-break-rows">
      <div class="sy-settings-row fn__flex">
        <div class="sy-settings-row__left">
          <span class="sy-settings-row__label">{{ t('settings').lunchBreak.start }}</span>
        </div>
        <input
          :value="lunchBreakStart"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakStart', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="sy-settings-row fn__flex">
        <div class="sy-settings-row__left">
          <span class="sy-settings-row__label">{{ t('settings').lunchBreak.end }}</span>
        </div>
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
.sy-lunch-break-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sy-settings-row {
  align-items: center;
  gap: 12px;
}

.sy-settings-row__left {
  flex: 1;
  min-width: 0;
}

.sy-settings-row__label {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.sy-time-input {
  max-width: 120px;
}
</style>
