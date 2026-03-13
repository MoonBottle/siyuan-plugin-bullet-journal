<template>
  <SySettingsSection icon="iconClock" :title="t('settings').lunchBreak.title">
    <div class="sy-pomodoro-rows">
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').lunchBreak.start }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').lunchBreak.startDesc }}</span>
        </div>
        <input
          :value="lunchBreakStart"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakStart', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').lunchBreak.end }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').lunchBreak.endDesc }}</span>
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
.sy-pomodoro-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sy-pomodoro-row {
  align-items: center;
  gap: 12px;
}

.sy-pomodoro-row__left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sy-pomodoro-row__label {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.sy-pomodoro-row__desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.sy-time-input {
  max-width: 120px;
}
</style>
