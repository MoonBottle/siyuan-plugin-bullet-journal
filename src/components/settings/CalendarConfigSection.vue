<template>
  <SySettingsSection icon="iconCalendar" :title="t('settings').calendar.title">
    <div class="sy-calendar-rows">
      <div class="sy-settings-row fn__flex">
        <div class="sy-settings-row__left">
          <span class="sy-settings-row__label">{{ t('settings').calendar.defaultView }}</span>
          <span class="sy-settings-row__desc">{{ t('settings').calendar.defaultViewDesc }}</span>
        </div>
        <SySelect
          :model-value="calendarDefaultView"
          :options="viewOptions"
          @update:model-value="$emit('update:calendarDefaultView', $event)"
        />
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

defineProps<{
  calendarDefaultView: string;
}>();

defineEmits<{
  'update:calendarDefaultView': [value: string];
}>();

const viewOptions = [
  { value: 'dayGridMonth', label: t('calendar').month },
  { value: 'timeGridWeek', label: t('calendar').week },
  { value: 'timeGridDay', label: t('calendar').day },
  { value: 'listWeek', label: t('calendar').list }
];
</script>

<style scoped>
.sy-calendar-rows {
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
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sy-settings-row__label {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.sy-settings-row__desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}
</style>
