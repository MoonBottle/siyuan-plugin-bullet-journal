<template>
  <div class="sy-settings-dialog">
    <div class="sy-settings-dialog__body">
      <!-- 左侧栏 -->
      <div class="sy-settings-dialog__sidebar">
        <div class="sy-settings-sidebar__search">
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
        <nav class="sy-settings-sidebar__menu">
          <div
            v-for="item in visibleMenuItems"
            :key="item.key"
            class="sy-settings-menu-item"
            :class="{ 'sy-settings-menu-item--active': activeSection === item.key }"
            @click="scrollToSection(item.key)"
          >
            <svg v-if="item.icon" class="sy-settings-menu-item__icon">
              <use :xlink:href="`#${item.icon}`"></use>
            </svg>
            <span class="sy-settings-menu-item__title">{{ item.title }}</span>
          </div>
        </nav>
      </div>

      <!-- 右侧内容区 -->
      <div ref="contentRef" class="sy-settings-dialog__content">
        <div id="section-dir" class="sy-settings-section-wrapper">
          <DirectoryConfigSection
            v-show="sectionVisible('dir')"
            v-model:directories="local.directories"
            v-model:default-group="local.defaultGroup"
            :groups="local.groups"
          />
        </div>
        <div id="section-group" class="sy-settings-section-wrapper">
          <GroupConfigSection
            v-show="sectionVisible('group')"
            v-model:groups="local.groups"
            v-model:default-group="local.defaultGroup"
            v-model:directories="local.directories"
          />
        </div>
        <div id="section-pomodoro" class="sy-settings-section-wrapper">
          <PomodoroConfigSection
            v-show="sectionVisible('pomodoro')"
            v-model:pomodoro="local.pomodoro"
          />
        </div>
        <div id="section-calendar" class="sy-settings-section-wrapper">
          <CalendarConfigSection
            v-show="sectionVisible('calendar')"
            v-model:calendar-default-view="local.calendarDefaultView"
            v-model:show-pomodoro-blocks="local.showPomodoroBlocks"
            v-model:show-pomodoro-total="local.showPomodoroTotal"
          />
        </div>
        <div id="section-lunch" class="sy-settings-section-wrapper">
          <LunchBreakConfigSection
            v-show="sectionVisible('lunch')"
            v-model:lunch-break-start="local.lunchBreakStart"
            v-model:lunch-break-end="local.lunchBreakEnd"
          />
        </div>
        <div id="section-slash" class="sy-settings-section-wrapper">
          <SlashCommandConfigSection
            v-show="sectionVisible('slash')"
            v-model="local.customSlashCommands"
          />
        </div>
        <div id="section-ai" class="sy-settings-section-wrapper">
          <AiConfigSection v-show="sectionVisible('ai')" v-model:ai="local.ai" />
        </div>
        <div id="section-mcp" class="sy-settings-section-wrapper">
          <McpConfigSection v-show="sectionVisible('mcp')" />
        </div>
      </div>
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
import { reactive, ref, watch, computed, onMounted, onUnmounted } from 'vue';
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
import SlashCommandConfigSection from './SlashCommandConfigSection.vue';

const props = defineProps<{
  plugin: any;
  closeDialog: () => void;
}>();

const searchQuery = ref('');
const contentRef = ref<HTMLElement | null>(null);
const activeSection = ref('dir');

interface MenuItem {
  key: string;
  title: string;
  icon: string;
  sectionId: string;
}

const menuItems = computed<MenuItem[]>(() => {
  const settings = t('settings') as Record<string, any>;
  return [
    { key: 'dir', title: settings.dirConfig?.title ?? '目录配置', icon: 'iconFolder', sectionId: 'section-dir' },
    { key: 'group', title: settings.groupManage?.title ?? '分组管理', icon: 'iconGroups', sectionId: 'section-group' },
    { key: 'pomodoro', title: settings.pomodoro?.title ?? '番茄钟', icon: 'iconClock', sectionId: 'section-pomodoro' },
    { key: 'calendar', title: settings.calendar?.title ?? '日历', icon: 'iconCalendar', sectionId: 'section-calendar' },
    { key: 'lunch', title: settings.lunchBreak?.title ?? '午休时间', icon: 'iconClock', sectionId: 'section-lunch' },
    { key: 'slash', title: settings.slashCommands?.title ?? '斜杠命令', icon: 'iconCode', sectionId: 'section-slash' },
    { key: 'ai', title: settings.ai?.title ?? 'AI 服务配置', icon: 'iconSparkles', sectionId: 'section-ai' },
    { key: 'mcp', title: settings.mcp?.title ?? 'MCP 配置', icon: 'iconLink', sectionId: 'section-mcp' },
  ];
});

const visibleMenuItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return menuItems.value;
  return menuItems.value.filter(item => {
    const kw = sectionKeywords.value[item.key]?.toLowerCase() ?? '';
    return kw.includes(q);
  });
});

// 用于标记是否正在手动滚动，避免 IntersectionObserver 干扰
let isManualScrolling = false;
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

function scrollToSection(key: string) {
  const item = menuItems.value.find(i => i.key === key);
  if (!item) return;

  // 标记为手动滚动，暂时禁用 observer 的自动更新
  isManualScrolling = true;
  activeSection.value = key;

  const sectionEl = document.getElementById(item.sectionId);
  if (sectionEl && contentRef.value) {
    const containerRect = contentRef.value.getBoundingClientRect();
    const sectionRect = sectionEl.getBoundingClientRect();
    const scrollTop = contentRef.value.scrollTop + sectionRect.top - containerRect.top;
    contentRef.value.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }

  // 滚动动画完成后恢复 observer（smooth 滚动大约 300-500ms）
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(() => {
    isManualScrolling = false;
  }, 600);
}

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
    lunch: collectStrings(s.lunchBreak).join(' '),
    slash: collectStrings(s.slashCommands).join(' ')
  };
});

function sectionVisible(key: string): boolean {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return true;
  const kw = sectionKeywords.value[key]?.toLowerCase() ?? '';
  return kw.includes(q);
}

// 使用 IntersectionObserver 监听当前可见的 section
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (contentRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        // 手动滚动期间忽略 observer 的回调
        if (isManualScrolling) return;

        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            const item = menuItems.value.find(i => i.sectionId === sectionId);
            if (item) {
              activeSection.value = item.key;
            }
          }
        });
      },
      {
        root: contentRef.value,
        threshold: 0.5
      }
    );

    // 观察所有 section
    menuItems.value.forEach(item => {
      const el = document.getElementById(item.sectionId);
      if (el && observer) {
        observer.observe(el);
      }
    });
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
});

function cloneSettings(data: SettingsData): SettingsData {
  const merged = { ...defaultSettings, ...data };
  // 合并 pomodoro 设置，确保新字段有默认值
  if (!merged.pomodoro) {
    merged.pomodoro = { ...defaultSettings.pomodoro! };
  } else {
    merged.pomodoro = { ...defaultSettings.pomodoro!, ...merged.pomodoro };
  }
  if (!merged.ai) merged.ai = { providers: [], activeProviderId: null };
  if (!merged.customSlashCommands) merged.customSlashCommands = [];
  return JSON.parse(JSON.stringify(merged));
}

const local = reactive<SettingsData>(cloneSettings(props.plugin.getSettings()));

// 当 plugin 传入的 settings 变化时同步（如 destroyCallback 重新 load 后再次打开）
watch(() => props.plugin.getSettings(), (newSettings) => {
  Object.assign(local, cloneSettings(newSettings));
}, { deep: true });

function validateSettings(): string | null {
  // 校验番茄钟最小专注时间
  if (local.pomodoro?.minFocusMinutes !== undefined) {
    const minFocus = local.pomodoro.minFocusMinutes;
    console.log('[Settings] 校验最小专注时间:', minFocus);
    if (isNaN(minFocus)) {
      console.log('[Settings] 最小专注时间校验失败: 不是有效数字');
      return '最小专注时间必须是有效数字';
    }
    if (minFocus < 1) {
      console.log('[Settings] 最小专注时间校验失败: 小于 1 分钟');
      return '最小专注时间不能小于 1 分钟';
    }
    if (minFocus > 60) {
      console.log('[Settings] 最小专注时间校验失败: 大于 60 分钟');
      return '最小专注时间不能大于 60 分钟';
    }
  }

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

/* 左侧栏 */
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
  gap: 8px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 8px 10px;
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
  padding: 0 0 0 5px;
  font-size: 13px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
}

.sy-settings-search:focus {
  outline: none;
}

.sy-settings-search::placeholder {
  color: var(--b3-theme-on-surface-light);
}

/* 导航菜单 */
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

/* 右侧内容区 */
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

.sy-settings-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;
  background: var(--b3-theme-background);
}
</style>
