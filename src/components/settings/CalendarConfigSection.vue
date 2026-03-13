<template>
  <SySettingsSection icon="iconCalendar" :title="t('settings').calendar.defaultViewTitle" :description="t('settings').calendar.defaultViewDesc">
    <SySelect
      :model-value="calendarDefaultView"
      :options="viewOptions"
      @update:model-value="$emit('update:calendarDefaultView', $event)"
    />
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
