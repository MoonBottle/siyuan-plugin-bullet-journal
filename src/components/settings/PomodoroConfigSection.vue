<template>
  <SySettingsSection icon="iconClock" :title="t('settings').pomodoro.title" :description="(t('settings').pomodoro as any).sectionDescription ?? ''">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').pomodoro.enableFloatingButton"
        :description="t('settings').pomodoro.enableFloatingButtonDesc"
      >
        <SySwitch v-model="pomodoro.enableFloatingButton" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBarTimer"
        :description="t('settings').pomodoro.enableStatusBarTimerDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBarTimer" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBar"
        :description="t('settings').pomodoro.enableStatusBarDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBar" />
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
      <SySettingItem
        :label="t('settings').pomodoro.autoCompleteOnItemDone"
        :description="t('settings').pomodoro.autoCompleteOnItemDoneDesc"
      >
        <SySwitch v-model="pomodoro.autoCompleteOnItemDone" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.minFocusMinutes"
        :description="t('settings').pomodoro.minFocusMinutesDesc"
      >
        <input
          type="number"
          class="b3-text-field fn__flex-center fn__size200"
          :value="pomodoro.minFocusMinutes ?? 5"
          @input="pomodoro.minFocusMinutes = parseInt(($event.target as HTMLInputElement).value)"
          min="1"
          max="60"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.autoExtendEnabled"
        :description="t('settings').pomodoro.autoExtendEnabledDesc"
      >
        <SySwitch v-model="pomodoro.autoExtendEnabled" />
      </SySettingItem>
      <template v-if="pomodoro.autoExtendEnabled">
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendWaitSeconds"
          :description="t('settings').pomodoro.autoExtendWaitSecondsDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendWaitSeconds ?? 30"
            @input="pomodoro.autoExtendWaitSeconds = parseInt(($event.target as HTMLInputElement).value)"
            min="10"
            max="300"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendMinutes"
          :description="t('settings').pomodoro.autoExtendMinutesDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendMinutes ?? 5"
            @input="pomodoro.autoExtendMinutes = parseInt(($event.target as HTMLInputElement).value)"
            min="1"
            max="60"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendMaxCount"
          :description="t('settings').pomodoro.autoExtendMaxCountDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendMaxCount ?? 3"
            @input="pomodoro.autoExtendMaxCount = parseInt(($event.target as HTMLInputElement).value)"
            min="1"
            max="10"
          />
        </SySettingItem>
      </template>
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

