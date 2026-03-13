<template>
  <div class="sy-settings-dialog">
    <div class="sy-settings-dialog__content">
      <DirectoryConfigSection v-model:directories="local.directories" v-model:default-group="local.defaultGroup" :groups="local.groups" />
      <GroupConfigSection v-model:groups="local.groups" v-model:default-group="local.defaultGroup" v-model:directories="local.directories" />
      <PomodoroConfigSection v-model:pomodoro="local.pomodoro" />
      <CalendarConfigSection v-model:calendar-default-view="local.calendarDefaultView" />
      <AiConfigSection v-model:ai="local.ai" />
      <McpConfigSection />
      <LunchBreakConfigSection v-model:lunch-break-start="local.lunchBreakStart" v-model:lunch-break-end="local.lunchBreakEnd" />
    </div>
    <div class="sy-settings-dialog__footer">
      <button type="button" class="b3-button b3-button--cancel" @click="handleCancel">
        {{ t('common').cancel }}
      </button>
      <button type="button" class="b3-button b3-button--text" @click="handleSave">
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import { t } from '@/i18n';
import type { SettingsData } from '@/settings/types';
import { defaultSettings } from '@/settings/types';
import DirectoryConfigSection from './DirectoryConfigSection.vue';
import GroupConfigSection from './GroupConfigSection.vue';
import PomodoroConfigSection from './PomodoroConfigSection.vue';
import CalendarConfigSection from './CalendarConfigSection.vue';
import AiConfigSection from './AiConfigSection.vue';
import McpConfigSection from './McpConfigSection.vue';
import LunchBreakConfigSection from './LunchBreakConfigSection.vue';

const props = defineProps<{
  plugin: any;
  closeDialog: () => void;
}>();

function cloneSettings(data: SettingsData): SettingsData {
  const merged = { ...defaultSettings, ...data };
  if (!merged.pomodoro) merged.pomodoro = { ...defaultSettings.pomodoro! };
  if (!merged.ai) merged.ai = { providers: [], activeProviderId: null };
  return JSON.parse(JSON.stringify(merged));
}

const local = reactive<SettingsData>(cloneSettings(props.plugin.getSettings()));

// 当 plugin 传入的 settings 变化时同步（如 destroyCallback 重新 load 后再次打开）
watch(() => props.plugin.getSettings(), (newSettings) => {
  Object.assign(local, cloneSettings(newSettings));
}, { deep: true });

async function handleSave() {
  props.plugin.updateSettings(local);
  await props.plugin.saveSettings();
  const settings = props.plugin.getSettings();
  eventBus.emit(Events.DATA_REFRESH, settings);
  broadcastDataRefresh(settings as object);
  props.closeDialog();
}

function handleCancel() {
  props.closeDialog();
}
</script>

<style scoped>
.sy-settings-dialog {
  display: flex;
  flex-direction: column;
  min-height: 400px;
  max-height: 70vh;
}

.sy-settings-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.sy-settings-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;
}
</style>
