<template>
  <SySettingsSection icon="iconCalendar" :title="t('settings').calendar.title">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').calendar.defaultView"
        :description="t('settings').calendar.defaultViewDesc"
      >
        <SySelect
          :model-value="calendarDefaultView"
          :options="viewOptions"
          @update:model-value="$emit('update:calendarDefaultView', $event)"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').calendar.showPomodoroBlocks"
        :description="t('settings').calendar.showPomodoroBlocksDesc"
      >
        <SySwitch
          :model-value="showPomodoroBlocks ?? true"
          @update:model-value="$emit('update:showPomodoroBlocks', $event)"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').calendar.showPomodoroTotal"
        :description="t('settings').calendar.showPomodoroTotalDesc"
      >
        <SySwitch
          :model-value="showPomodoroTotal ?? true"
          @update:model-value="$emit('update:showPomodoroTotal', $event)"
        />
      </SySettingItem>
    </SySettingItemList>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

defineProps<{
  calendarDefaultView: string;
  showPomodoroBlocks?: boolean;
  showPomodoroTotal?: boolean;
}>();

defineEmits<{
  'update:calendarDefaultView': [value: string];
  'update:showPomodoroBlocks': [value: boolean];
  'update:showPomodoroTotal': [value: boolean];
}>();

const viewOptions = [
  { value: 'dayGridMonth', label: t('calendar').month },
  { value: 'timeGridWeek', label: t('calendar').week },
  { value: 'timeGridDay', label: t('calendar').day },
  { value: 'listWeek', label: t('calendar').list }
];
</script>

