<template>
  <div class="sy-settings-dialog">
    <div class="sy-settings-dialog__content">
      <div class="sy-settings-dialog__search">
        <div class="sy-settings-search-wrap">
          <svg class="sy-settings-search__icon">
            <use xlink:href="#iconSearch"></use>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="b3-text-field sy-settings-search"
            :placeholder="t('settings').searchPlaceholder"
          />
        </div>
      </div>
      <DirectoryConfigSection v-show="sectionVisible('dir')" v-model:directories="local.directories" v-model:default-group="local.defaultGroup" :groups="local.groups" />
      <GroupConfigSection v-show="sectionVisible('group')" v-model:groups="local.groups" v-model:default-group="local.defaultGroup" v-model:directories="local.directories" />
      <PomodoroConfigSection v-show="sectionVisible('pomodoro')" v-model:pomodoro="local.pomodoro" />
      <CalendarConfigSection v-show="sectionVisible('calendar')" v-model:calendar-default-view="local.calendarDefaultView" />
      <AiConfigSection v-show="sectionVisible('ai')" v-model:ai="local.ai" />
      <McpConfigSection v-show="sectionVisible('mcp')" />
      <LunchBreakConfigSection v-show="sectionVisible('lunch')" v-model:lunch-break-start="local.lunchBreakStart" v-model:lunch-break-end="local.lunchBreakEnd" />
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
import { reactive, ref, watch, computed } from 'vue';
import { showMessage } from 'siyuan';
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

const searchQuery = ref('');

/** 递归收集对象中所有字符串值，用于搜索匹配 */
function collectStrings(obj: unknown): string[] {
  if (obj == null) return [];
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(collectStrings);
  if (typeof obj === 'object') {
    return Object.values(obj).flatMap(collectStrings);
  }
  return [];
}

const sectionKeywords: Record<string, string> = computed(() => {
  const s = t('settings') as Record<string, unknown>;
  return {
    dir: collectStrings({ dirConfig: s.dirConfig, projectDirectories: s.projectDirectories }).join(' '),
    group: collectStrings({ groupManage: s.groupManage, projectGroups: s.projectGroups }).join(' '),
    pomodoro: collectStrings(s.pomodoro).join(' '),
    calendar: collectStrings(s.calendar).join(' '),
    ai: collectStrings(s.ai).join(' '),
    mcp: collectStrings(s.mcp).join(' '),
    lunch: collectStrings(s.lunchBreak).join(' ')
  };
});

function sectionVisible(key: string): boolean {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return true;
  const kw = sectionKeywords.value[key]?.toLowerCase() ?? '';
  return kw.includes(q);
}

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

function validateSettings(): string | null {
  // 校验 AI Provider 配置
  if (local.ai?.providers) {
    for (const provider of local.ai.providers) {
      if (!provider.name?.trim()) {
        return (t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称';
      }
      if (!provider.apiUrl?.trim()) {
        return (t('settings') as any).ai?.messageEnterApiUrl ?? '请输入 API 地址';
      }
      if (!provider.apiKey?.trim()) {
        return (t('settings') as any).ai?.messageEnterApiKey ?? '请输入 API Key';
      }
      if (!provider.models || provider.models.length === 0) {
        return (t('settings') as any).ai?.messageAddOneModel ?? '请至少添加一个模型';
      }
    }
  }
  return null;
}

async function handleSave() {
  const errorMsg = validateSettings();
  if (errorMsg) {
    showMessage(errorMsg, 3000, 'error');
    return;
  }

  try {
    props.plugin.updateSettings(local);
    await props.plugin.saveSettings();
    const settings = props.plugin.getSettings();
    eventBus.emit(Events.DATA_REFRESH, settings);
    broadcastDataRefresh(settings as object);
    // 触发设置变更事件，通知插件主类更新 UI（如番茄钟显示/隐藏）
    eventBus.emit(Events.SETTINGS_CHANGED, settings);
    showMessage(t('common').saveSuccess, 3000, 'info');
    props.closeDialog();
  } catch (e) {
    showMessage((e as Error)?.message ?? t('common').actionFailed, 3000, 'error');
  }
}

function handleCancel() {
  props.closeDialog();
}
</script>

<style scoped>
.sy-settings-dialog {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.sy-settings-dialog__search {
  flex-shrink: 0;
  padding-bottom: 16px;
}

.sy-settings-search-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 12px 16px;
}

.sy-settings-search__icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface-light);
  pointer-events: none;
}

.sy-settings-search {
  flex: 1;
  min-width: 0;
  padding: 6px 0 6px 8px;
  font-size: 13px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
}

.sy-settings-search:focus {
  outline: none;
}

.sy-settings-search::placeholder {
  color: var(--b3-theme-on-surface-light);
}

.sy-settings-dialog__content {
  flex: 1;
  min-height: 200px;
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
