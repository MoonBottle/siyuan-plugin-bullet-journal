<template>
  <SySettingsSection icon="iconClock" :title="t('settings').pomodoro.title" :description="(t('settings').pomodoro as any).sectionDescription ?? ''">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBar"
        :description="t('settings').pomodoro.enableStatusBarDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBar" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBarTimer"
        :description="t('settings').pomodoro.enableStatusBarTimerDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBarTimer" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableFloatingButton"
        :description="t('settings').pomodoro.enableFloatingButtonDesc"
      >
        <SySwitch v-model="pomodoro.enableFloatingButton" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.recordMode"
        :description="t('settings').pomodoro.recordModeDesc"
      >
        <SySelect
          :model-value="pomodoro.recordMode || 'block'"
          :options="recordModeOptions"
          @update:model-value="pomodoro.recordMode = $event as 'block' | 'attr'"
        />
      </SySettingItem>
    </SySettingItemList>
  </SySettingsSection>
</template>

<script setup lang="ts">
import type { PomodoroSettings } from '@/settings/types';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

defineProps<{
  pomodoro: PomodoroSettings;
}>();

const recordModeOptions = [
  { value: 'block', label: t('settings').pomodoro.recordModeBlock },
  { value: 'attr', label: t('settings').pomodoro.recordModeAttr }
];
</script>

