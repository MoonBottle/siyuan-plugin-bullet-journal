<template>
  <div class="sy-settings-dialog">
    <div class="sy-settings-dialog__body">
      <div class="sy-settings-dialog__sidebar">
        <div class="sy-settings-sidebar__search">
          <div class="sy-settings-search-wrap">
            <svg class="sy-settings-search__icon">
              <use xlink:href="#iconSearch"></use>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              class="sy-settings-search"
              :placeholder="t('settings').searchPlaceholder"
            />
            <button
              v-if="searchQuery"
              class="sy-settings-search__clear"
              @click="searchQuery = ''"
            >
              <svg><use xlink:href="#iconClose"></use></svg>
            </button>
          </div>
        </div>
        <nav class="sy-settings-sidebar__menu">
          <div
            v-for="item in visibleMenuItems"
            :key="item.key"
            class="sy-settings-menu-item"
            :class="{ 'sy-settings-menu-item--active': activeSection === item.key }"
            @click="activeSection = item.key"
          >
            <svg
              v-if="item.icon"
              class="sy-settings-menu-item__icon"
            >
              <use :xlink:href="`#${item.icon}`"></use>
            </svg>
            <span class="sy-settings-menu-item__title">{{ item.title }}</span>
          </div>
        </nav>
      </div>

      <div class="sy-settings-dialog__content">
        <KeepAlive>
          <component
            :is="currentSectionComponent"
            v-bind="currentSectionProps"
            v-on="currentSectionEvents"
          />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type {
  CustomSlashCommand,
  PomodoroSettings,
  SettingsData,
  WebhookConfig,
} from '@/settings/types'
import type { AIProviderConfig } from '@/types/ai'
import { showMessage } from 'siyuan'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import AiConfigSection from './AiConfigSection.vue'
import AiSkillConfigSection from './AiSkillConfigSection.vue'
import CalendarConfigSection from './CalendarConfigSection.vue'
import DirectoryConfigSection from './DirectoryConfigSection.vue'
import GroupConfigSection from './GroupConfigSection.vue'
import HabitConfigSection from './HabitConfigSection.vue'
import LunchBreakConfigSection from './LunchBreakConfigSection.vue'
import McpConfigSection from './McpConfigSection.vue'
import PomodoroConfigSection from './PomodoroConfigSection.vue'
import SlashCommandConfigSection from './SlashCommandConfigSection.vue'
import WebhookConfigSection from './WebhookConfigSection.vue'

const props = defineProps<{
  plugin: any
  closeDialog: () => void
  initialSection?: string
}>()

const settingsStore = useSettingsStore()
const searchQuery = ref('')
const activeSection = ref(props.initialSection || 'dir')

interface MenuItem {
  key: string
  title: string
  icon: string
}

const menuItems = computed<MenuItem[]>(() => {
  const settings = t('settings') as Record<string, any>
  return [
    {
      key: 'dir',
      title: settings.dirConfig?.title ?? '目录配置',
      icon: 'iconTaProject',
    },
    {
      key: 'group',
      title: settings.groupManage?.title ?? '分组管理',
      icon: 'iconGroups',
    },
    {
      key: 'pomodoro',
      title: settings.pomodoro?.title ?? '番茄钟',
      icon: 'iconTaPomodoro',
    },
    {
      key: 'calendar',
      title: settings.calendar?.title ?? '日历',
      icon: 'iconTaCalendar',
    },
    {
      key: 'habit',
      title: settings.habitSettings?.title ?? '习惯',
      icon: 'iconTaHabit',
    },
    {
      key: 'lunch',
      title: settings.lunchBreak?.title ?? '午休时间',
      icon: 'iconTaPomodoro',
    },
    {
      key: 'slash',
      title: settings.slashCommands?.title ?? '斜杠命令',
      icon: 'iconCode',
    },
    {
      key: 'ai',
      title: settings.ai?.title ?? 'AI 服务配置',
      icon: 'iconTaAiAssistant',
    },
    {
      key: 'skill',
      title: settings.aiSkills?.title ?? 'AI 技能配置',
      icon: 'iconPlugin',
    },
    {
      key: 'mcp',
      title: settings.mcp?.title ?? 'MCP 配置',
      icon: 'iconLink',
    },
    {
      key: 'webhook',
      title: settings.webhook?.title ?? 'Webhook 通知',
      icon: 'iconLink',
    },
  ]
})

const sectionKeywords = computed<Record<string, string>>(() => {
  const s = t('settings') as Record<string, unknown>
  return {
    dir: collectStrings({
      dirConfig: s.dirConfig,
      projectDirectories: s.projectDirectories,
    }).join(' '),
    group: collectStrings({
      groupManage: s.groupManage,
      projectGroups: s.projectGroups,
    }).join(' '),
    pomodoro: collectStrings(s.pomodoro).join(' '),
    calendar: collectStrings(s.calendar).join(' '),
    habit: collectStrings(s.habitSettings).join(' '),
    ai: collectStrings(s.ai).join(' '),
    mcp: collectStrings(s.mcp).join(' '),
    webhook: collectStrings(s.webhook).join(' '),
    lunch: collectStrings(s.lunchBreak).join(' '),
    slash: collectStrings(s.slashCommands).join(' '),
    skill: collectStrings(s.aiSkills).join(' '),
  }
})

const visibleMenuItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return menuItems.value
  return menuItems.value.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(q)
    const kwMatch = (sectionKeywords.value[item.key] ?? '').toLowerCase().includes(q)
    return titleMatch || kwMatch
  })
})

watch(visibleMenuItems, (items) => {
  if (items.length > 0 && !items.some((i) => i.key === activeSection.value)) {
    activeSection.value = items[0].key
  }
})

function collectStrings(obj: unknown): string[] {
  if (obj == null) return []
  if (typeof obj === 'string') return [obj]
  if (Array.isArray(obj)) return obj.flatMap(collectStrings)
  if (typeof obj === 'object') return Object.values(obj).flatMap(collectStrings)
  return []
}

const sectionComponentMap: Record<string, Component> = {
  dir: DirectoryConfigSection,
  group: GroupConfigSection,
  pomodoro: PomodoroConfigSection,
  calendar: CalendarConfigSection,
  habit: HabitConfigSection,
  lunch: LunchBreakConfigSection,
  slash: SlashCommandConfigSection,
  ai: AiConfigSection,
  skill: AiSkillConfigSection,
  mcp: McpConfigSection,
  webhook: WebhookConfigSection,
}

const currentSectionComponent = computed(() => sectionComponentMap[activeSection.value] ?? DirectoryConfigSection)

const currentSectionProps = computed(() => {
  switch (activeSection.value) {
    case 'dir':
      return {
        directories: settingsStore.directories,
        defaultGroup: settingsStore.defaultGroup,
        scanMode: settingsStore.scanMode,
        groups: settingsStore.groups,
      }
    case 'group':
      return {
        groups: settingsStore.groups,
        defaultGroup: settingsStore.defaultGroup,
        directories: settingsStore.directories,
      }
    case 'pomodoro':
      return { pomodoro: settingsStore.pomodoro }
    case 'calendar':
      return {
        calendarDefaultView: settingsStore.calendarDefaultView,
        showPomodoroBlocks: settingsStore.showPomodoroBlocks,
        showPomodoroTotal: settingsStore.showPomodoroTotal,
        calendarDateClickBehavior: settingsStore.calendarDateClickBehavior,
      }
    case 'habit':
      return { habitCheckInTimePrecision: settingsStore.habitCheckInTimePrecision }
    case 'lunch':
      return {
        lunchBreakStart: settingsStore.lunchBreakStart,
        lunchBreakEnd: settingsStore.lunchBreakEnd,
      }
    case 'slash':
      return { modelValue: settingsStore.customSlashCommands }
    case 'ai':
      return { ai: settingsStore.ai }
    case 'skill':
      return {}
    case 'mcp':
      return {}
    case 'webhook':
      return { webhook: settingsStore.webhook }
    default:
      return {}
  }
})

const currentSectionEvents = computed(() => {
  switch (activeSection.value) {
    case 'dir':
      return {
        'update:directories': (val: any) => settingsStore.applySettings({ directories: val }),
        'update:defaultGroup': (val: string) => settingsStore.applySettings({ defaultGroup: val }),
        'update:scanMode': (val: any) => settingsStore.applySettings({ scanMode: val }),
      }
    case 'group':
      return {
        'update:groups': (val: any) => settingsStore.applySettings({ groups: val }),
        'update:defaultGroup': (val: string) => settingsStore.applySettings({ defaultGroup: val }),
        'update:directories': (val: any) => settingsStore.applySettings({ directories: val }),
      }
    case 'pomodoro':
      return {
        'update:pomodoro': handlePomodoroUpdate,
      }
    case 'calendar':
      return {
        'update:calendarDefaultView': (val: string) => settingsStore.applySettings({ calendarDefaultView: val }),
        'update:showPomodoroBlocks': (val: boolean) => settingsStore.applySettings({ showPomodoroBlocks: val }),
        'update:showPomodoroTotal': (val: boolean) => settingsStore.applySettings({ showPomodoroTotal: val }),
        'update:calendarDateClickBehavior': (val: any) => settingsStore.applySettings({ calendarDateClickBehavior: val }),
      }
    case 'habit':
      return {
        'update:habitCheckInTimePrecision': (val: any) => settingsStore.applySettings({ habitCheckInTimePrecision: val }),
      }
    case 'lunch':
      return {
        'update:lunchBreakStart': (val: string) => settingsStore.applySettings({ lunchBreakStart: val }),
        'update:lunchBreakEnd': (val: string) => settingsStore.applySettings({ lunchBreakEnd: val }),
      }
    case 'slash':
      return {
        'update:modelValue': (val: CustomSlashCommand[]) => settingsStore.applySettings({ customSlashCommands: val }),
      }
    case 'ai':
      return {
        'update:ai': handleAiUpdate,
      }
    case 'webhook':
      return {
        'update:webhook': (val: WebhookConfig) => settingsStore.applySettings({ webhook: val }),
      }
    default:
      return {}
  }
})

function handlePomodoroUpdate(newPomodoro: PomodoroSettings) {
  if (newPomodoro.minFocusMinutes !== undefined) {
    const v = newPomodoro.minFocusMinutes
    if (Number.isNaN(v) || v < 1 || v > 60) {
      showMessage('最小专注时间必须在 1-60 分钟之间', 3000, 'error')
      return
    }
  }
  settingsStore.applySettings({ pomodoro: newPomodoro })
}

function handleAiUpdate(newAi: {
  providers: AIProviderConfig[]
  activeProviderId: string | null
}) {
  if (newAi.providers) {
    for (const provider of newAi.providers) {
      if (!provider.name?.trim()) {
        showMessage((t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称', 3000, 'error')
        return
      }
      if (!provider.apiUrl?.trim()) {
        showMessage((t('settings') as any).ai?.messageEnterApiUrl ?? '请输入 API 地址', 3000, 'error')
        return
      }
      if (!provider.apiKey?.trim()) {
        showMessage(t('settings').ai?.messageEnterApiKey ?? '请输入 API Key', 3000, 'error')
        return
      }
      if (!provider.models || provider.models.length === 0) {
        showMessage(t('settings').ai?.messageAddOneModel ?? '请至少添加一个模型', 3000, 'error')
        return
      }
    }
  }
  settingsStore.applySettings({ ai: newAi })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let storeReady = false

onMounted(() => {
  settingsStore.loadFromPlugin()
  storeReady = true
})

watch(
  () => settingsStore.$state,
  () => {
    if (!storeReady) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const plugin = props.plugin
      if (!plugin?.updateSettings) return
      plugin.updateSettings(settingsStore.$state as SettingsData)
      plugin.saveSettings()
    }, 500)
  },
  { deep: true },
)

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
.sy-settings-dialog {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 960px;
  max-width: 95vw;
  border-radius: 8px;
  overflow: hidden;
}

.sy-settings-dialog__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sy-settings-dialog__sidebar {
  border-radius: 8px;
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-surface);
  border-right: 1px solid var(--b3-border-color);
  padding: 16px 12px;
  gap: 12px;
}

.sy-settings-sidebar__search {
  flex-shrink: 0;
}

.sy-settings-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 5px 10px;
}

.sy-settings-search-wrap:focus-within {
  border-color: var(--b3-theme-primary);
}

.sy-settings-search__icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  pointer-events: none;
}

.sy-settings-search {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-background);
}

.sy-settings-search:focus {
  outline: none;
}

.sy-settings-search::placeholder {
  color: var(--b3-theme-on-surface-light);
}

.sy-settings-search__clear {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.4;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
}

.sy-settings-search__clear svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.sy-settings-search__clear:hover {
  opacity: 0.8;
}

.sy-settings-sidebar__menu {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sy-settings-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--b3-theme-on-surface);
}

.sy-settings-menu-item:hover {
  background: var(--b3-theme-background);
}

.sy-settings-menu-item--active {
  background: var(--b3-theme-background);
  color: var(--b3-theme-primary);
  position: relative;
}

.sy-settings-menu-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: var(--b3-theme-primary);
  border-radius: 0 2px 2px 0;
}

.sy-settings-menu-item__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: currentColor;
  opacity: 0.85;
}

.sy-settings-menu-item__title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sy-settings-dialog__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px 0 20px;
  background: var(--b3-theme-background);
}

.sy-settings-section-wrapper {
  margin-bottom: 16px;
}

.sy-settings-section-wrapper:last-child {
  margin-bottom: 0;
}
</style>
