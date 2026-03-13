<template>
  <SySettingsSection icon="iconClock" :title="t('settings').pomodoro.title" :description="(t('settings').pomodoro as any).sectionDescription ?? ''">
    <div class="sy-pomodoro-rows">
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').pomodoro.enableStatusBar }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').pomodoro.enableStatusBarDesc }}</span>
        </div>
        <SySwitch v-model="pomodoro.enableStatusBar" />
      </div>
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').pomodoro.enableStatusBarTimer }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').pomodoro.enableStatusBarTimerDesc }}</span>
        </div>
        <SySwitch v-model="pomodoro.enableStatusBarTimer" />
      </div>
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').pomodoro.enableFloatingButton }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').pomodoro.enableFloatingButtonDesc }}</span>
        </div>
        <SySwitch v-model="pomodoro.enableFloatingButton" />
      </div>
      <div class="sy-pomodoro-row fn__flex">
        <div class="sy-pomodoro-row__left">
          <span class="sy-pomodoro-row__label">{{ t('settings').pomodoro.recordMode }}</span>
          <span class="sy-pomodoro-row__desc">{{ t('settings').pomodoro.recordModeDesc }}</span>
        </div>
        <SySelect
          :model-value="pomodoro.recordMode || 'block'"
          :options="recordModeOptions"
          @update:model-value="pomodoro.recordMode = $event as 'block' | 'attr'"
        />
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import type { PomodoroSettings } from '@/settings/types';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
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
</style>
