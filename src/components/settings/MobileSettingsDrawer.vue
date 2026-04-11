<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="modelValue" class="ios-settings-overlay" @click="closeOnOverlay">
        <div class="ios-settings-drawer" @click.stop>
          <!-- Header -->
          <div class="ios-settings-header">
            <div class="drag-handle"></div>
            <div class="header-nav">
              <button class="nav-btn close" @click="close">
                <svg><use xlink:href="#iconClose"></use></svg>
              </button>
              <span class="nav-title">{{ t('settings').title }}</span>
              <button class="nav-btn save" @click="handleSave">
                {{ t('common').save }}
              </button>
            </div>
          </div>
          
          <!-- Search -->
          <div class="ios-search-section">
            <div class="ios-search-box">
              <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('settings').searchPlaceholder"
              />
            </div>
          </div>
          
          <!-- Content -->
          <div class="ios-settings-content">
            <!-- View Settings Group -->
            <div class="ios-settings-group">
              <div class="group-label">{{ t('mobile.settings.view') || '视图' }}</div>
              <div class="ios-card">
                <div class="ios-cell" @click="toggleHideCompleted">
                  <div class="cell-icon blue">👁️</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('mobile.settings.hideCompleted') || '隐藏已完成' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <div class="ios-switch" :class="{ on: local.hideCompleted }">
                      <div class="switch-thumb"></div>
                    </div>
                  </div>
                </div>
                <div class="ios-cell" @click="toggleHideAbandoned">
                  <div class="cell-icon gray">🚫</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('mobile.settings.hideAbandoned') || '隐藏已放弃' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <div class="ios-switch" :class="{ on: local.hideAbandoned }">
                      <div class="switch-thumb"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Config Groups -->
            <div class="ios-settings-group">
              <div class="group-label">{{ t('mobile.settings.configuration') || '配置' }}</div>
              <div class="ios-card">
                <div class="ios-cell" @click="openSection('dir')">
                  <div class="cell-icon yellow">📁</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').directory?.title || '目录配置' }}</span>
                    <span class="cell-detail">{{ directoryCount }} {{ t('mobile.settings.directories') || '个目录' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('group')">
                  <div class="cell-icon teal">📊</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').group?.title || '分组管理' }}</span>
                    <span class="cell-detail">{{ groupCount }} {{ t('mobile.settings.groups') || '个分组' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('pomodoro')">
                  <div class="cell-icon red">🍅</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').pomodoro?.title || '番茄钟' }}</span>
                    <span class="cell-detail">{{ pomodoroDuration }} {{ t('mobile.settings.minutes') || '分钟' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('calendar')">
                  <div class="cell-icon green">📅</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').calendar?.title || '日历' }}</span>
                    <span class="cell-detail">{{ calendarViewLabel }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('lunch')">
                  <div class="cell-icon orange">🍽️</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').lunchBreak?.title || '午休时间' }}</span>
                    <span class="cell-detail">{{ local.lunchBreakStart }} - {{ local.lunchBreakEnd }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Advanced Group -->
            <div class="ios-settings-group">
              <div class="group-label">{{ t('mobile.settings.advanced') || '高级' }}</div>
              <div class="ios-card">
                <div class="ios-cell" @click="openSection('slash')">
                  <div class="cell-icon purple">⌨️</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').slashCommand?.title || '斜杠命令' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('ai')">
                  <div class="cell-icon indigo">🤖</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').ai?.title || 'AI 服务配置' }}</span>
                    <span class="cell-detail">{{ aiStatus }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
                <div class="ios-cell" @click="openSection('mcp')">
                  <div class="cell-icon pink">🔗</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('settings').mcp?.title || 'MCP 配置' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="arrow">›</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- About Group -->
            <div class="ios-settings-group">
              <div class="group-label">{{ t('mobile.settings.about') || '关于' }}</div>
              <div class="ios-card">
                <div class="ios-cell">
                  <div class="cell-icon gray">📦</div>
                  <div class="cell-content">
                    <span class="cell-title">{{ t('mobile.settings.version') || '版本' }}</span>
                  </div>
                  <div class="cell-accessory">
                    <span class="cell-value">v{{ version }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Safe Area -->
            <div class="safe-area-bottom"></div>
          </div>
        </div>
        
        <!-- Sub-page Modal -->
        <Transition name="slide-left">
          <div v-if="activeSubPage" class="ios-subpage" @click.stop>
            <div class="ios-subpage-header">
              <button class="back-btn" @click="closeSubPage">
                <span class="back-arrow">‹</span>
                <span>{{ t('common').back || '返回' }}</span>
              </button>
              <span class="subpage-title">{{ subPageTitle }}</span>
              <div class="header-spacer"></div>
            </div>
            <div class="ios-subpage-content">
              <component 
                :is="subPageComponent" 
                v-bind="subPageProps"
                is-mobile
                @update="handleSubPageUpdate"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import MobileDirectoryConfig from '@/mobile/drawers/settings/MobileDirectoryConfig.vue';
import MobileGroupConfig from '@/mobile/drawers/settings/MobileGroupConfig.vue';
import MobilePomodoroConfig from '@/mobile/drawers/settings/MobilePomodoroConfig.vue';
import MobileCalendarConfig from '@/mobile/drawers/settings/MobileCalendarConfig.vue';
import MobileLunchBreakConfig from '@/mobile/drawers/settings/MobileLunchBreakConfig.vue';
import MobileSlashCommandConfig from '@/mobile/drawers/settings/MobileSlashCommandConfig.vue';
import MobileAiConfig from '@/mobile/drawers/settings/MobileAiConfig.vue';
import MobileMcpConfig from '@/mobile/drawers/settings/MobileMcpConfig.vue';

interface Props {
  modelValue: boolean;
  initialSettings?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  initialSettings: () => ({}),
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [settings: Record<string, any>];
}>();

const plugin = usePlugin();
const searchQuery = ref('');
const activeSubPage = ref<string | null>(null);

const local = reactive({
  directories: props.initialSettings.directories || [],
  groups: props.initialSettings.groups || [],
  defaultGroup: props.initialSettings.defaultGroup || '',
  scanMode: props.initialSettings.scanMode || 'full',
  pomodoro: props.initialSettings.pomodoro || { duration: 25, shortBreak: 5, longBreak: 15 },
  calendarDefaultView: props.initialSettings.calendarDefaultView || 'month',
  showPomodoroBlocks: props.initialSettings.showPomodoroBlocks ?? true,
  showPomodoroTotal: props.initialSettings.showPomodoroTotal ?? true,
  lunchBreakStart: props.initialSettings.lunchBreakStart || '12:00',
  lunchBreakEnd: props.initialSettings.lunchBreakEnd || '13:00',
  customSlashCommands: props.initialSettings.customSlashCommands || [],
  ai: props.initialSettings.ai || {},
  hideCompleted: props.initialSettings.hideCompleted ?? false,
  hideAbandoned: props.initialSettings.hideAbandoned ?? false,
});

const version = computed(() => plugin?.manifest?.version || '0.12.2');

const directoryCount = computed(() => local.directories.length);
const groupCount = computed(() => local.groups.length);
const pomodoroDuration = computed(() => local.pomodoro?.duration || 25);

const calendarViewLabel = computed(() => {
  const views: Record<string, string> = {
    month: t('calendar').views?.month || '月视图',
    week: t('calendar').views?.week || '周视图',
    day: t('calendar').views?.day || '日视图',
  };
  return views[local.calendarDefaultView] || views.month;
});

const aiStatus = computed(() => {
  if (local.ai?.enabled) {
    return local.ai.provider || t('mobile.settings.enabled') || '已启用';
  }
  return t('mobile.settings.disabled') || '未启用';
});

const subPageTitle = computed(() => {
  const titles: Record<string, string> = {
    dir: t('settings').directory?.title || '目录配置',
    group: t('settings').group?.title || '分组管理',
    pomodoro: t('settings').pomodoro?.title || '番茄钟',
    calendar: t('settings').calendar?.title || '日历',
    lunch: t('settings').lunchBreak?.title || '午休时间',
    slash: t('settings').slashCommand?.title || '斜杠命令',
    ai: t('settings').ai?.title || 'AI 服务配置',
    mcp: t('settings').mcp?.title || 'MCP 配置',
  };
  return titles[activeSubPage.value || ''] || '';
});

const subPageComponent = computed(() => {
  const components: Record<string, any> = {
    dir: MobileDirectoryConfig,
    group: MobileGroupConfig,
    pomodoro: MobilePomodoroConfig,
    calendar: MobileCalendarConfig,
    lunch: MobileLunchBreakConfig,
    slash: MobileSlashCommandConfig,
    ai: MobileAiConfig,
    mcp: MobileMcpConfig,
  };
  return components[activeSubPage.value || ''];
});

const subPageProps = computed(() => {
  const propsMap: Record<string, any> = {
    dir: {
      directories: local.directories,
      'onUpdate:directories': (v: any[]) => local.directories = v,
      defaultGroup: local.defaultGroup,
      groups: local.groups,
      scanMode: local.scanMode,
      'onUpdate:scanMode': (v: string) => local.scanMode = v,
    },
    group: {
      groups: local.groups,
      'onUpdate:groups': (v: any[]) => local.groups = v,
      defaultGroup: local.defaultGroup,
      'onUpdate:defaultGroup': (v: string) => local.defaultGroup = v,
      directories: local.directories,
    },
    pomodoro: {
      pomodoro: local.pomodoro,
      'onUpdate:pomodoro': (v: any) => local.pomodoro = v,
    },
    calendar: {
      calendarDefaultView: local.calendarDefaultView,
      'onUpdate:calendarDefaultView': (v: string) => local.calendarDefaultView = v,
      showPomodoroBlocks: local.showPomodoroBlocks,
      'onUpdate:showPomodoroBlocks': (v: boolean) => local.showPomodoroBlocks = v,
      showPomodoroTotal: local.showPomodoroTotal,
      'onUpdate:showPomodoroTotal': (v: boolean) => local.showPomodoroTotal = v,
    },
    lunch: {
      lunchBreakStart: local.lunchBreakStart,
      'onUpdate:lunchBreakStart': (v: string) => local.lunchBreakStart = v,
      lunchBreakEnd: local.lunchBreakEnd,
      'onUpdate:lunchBreakEnd': (v: string) => local.lunchBreakEnd = v,
    },
    slash: {
      modelValue: local.customSlashCommands,
      'onUpdate:modelValue': (v: any[]) => local.customSlashCommands = v,
    },
    ai: {
      ai: local.ai,
      'onUpdate:ai': (v: any) => local.ai = v,
    },
    mcp: {},
  };
  return propsMap[activeSubPage.value || ''] || {};
});

const toggleHideCompleted = () => {
  local.hideCompleted = !local.hideCompleted;
};

const toggleHideAbandoned = () => {
  local.hideAbandoned = !local.hideAbandoned;
};

const openSection = (key: string) => {
  activeSubPage.value = key;
};

const closeSubPage = () => {
  activeSubPage.value = null;
};

const close = () => {
  emit('update:modelValue', false);
};

const closeOnOverlay = (e: MouseEvent) => {
  if (e.target === e.currentTarget && !activeSubPage.value) {
    close();
  }
};

const handleSave = () => {
  emit('save', { ...local });
  close();
};

const handleSubPageUpdate = (key: string, value: any) => {
  (local as any)[key] = value;
};
</script>

<style lang="scss" scoped>
.ios-settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.ios-settings-drawer {
  background: #f2f2f7;
  border-radius: 20px 20px 0 0;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// Header
.ios-settings-header {
  background: #f2f2f7;
  padding: 8px 0 12px;
  position: sticky;
  top: 0;
  z-index: 10;
  
  .drag-handle {
    width: 36px;
    height: 5px;
    background: #c5c5c7;
    border-radius: 3px;
    margin: 0 auto 12px;
  }
  
  .header-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }
  
  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border: none;
    background: transparent;
    font-size: 17px;
    cursor: pointer;
    
    &.close {
      color: #8e8e93;
      
      svg {
        width: 22px;
        height: 22px;
        fill: #8e8e93;
      }
    }
    
    &.save {
      color: #007aff;
      font-weight: 500;
    }
  }
  
  .nav-title {
    font-size: 17px;
    font-weight: 600;
    color: #000;
  }
}

// Search
.ios-search-section {
  padding: 0 16px 12px;
  background: #f2f2f7;
  
  .ios-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(120, 120, 128, 0.12);
    border-radius: 10px;
    padding: 10px 12px;
    
    .search-icon {
      width: 18px;
      height: 18px;
      fill: #8e8e93;
    }
    
    input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 17px;
      outline: none;
      color: #000;
      
      &::placeholder {
        color: #8e8e93;
      }
    }
  }
}

// Content
.ios-settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

// Settings Group
.ios-settings-group {
  margin-bottom: 20px;
  
  .group-label {
    font-size: 13px;
    font-weight: 400;
    color: #6c6c70;
    text-transform: uppercase;
    margin: 20px 0 8px 16px;
    letter-spacing: 0.3px;
  }
}

// iOS Card
.ios-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

// iOS Cell
.ios-cell {
  display: flex;
  align-items: center;
  padding: 11px 16px;
  min-height: 44px;
  cursor: pointer;
  user-select: none;
  
  &:active {
    background: #f2f2f7;
  }
  
  & + .ios-cell {
    border-top: 0.5px solid #e5e5ea;
  }
  
  .cell-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    margin-right: 12px;
    flex-shrink: 0;
    
    &.blue { background: #007aff; }
    &.gray { background: #8e8e93; }
    &.yellow { background: #ffcc00; }
    &.teal { background: #5ac8fa; }
    &.red { background: #ff3b30; }
    &.green { background: #34c759; }
    &.orange { background: #ff9500; }
    &.purple { background: #af52de; }
    &.indigo { background: #5856d6; }
    &.pink { background: #ff2d55; }
  }
  
  .cell-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .cell-title {
    font-size: 17px;
    color: #000;
    line-height: 22px;
  }
  
  .cell-detail {
    font-size: 15px;
    color: #8e8e93;
    line-height: 20px;
    margin-top: 2px;
  }
  
  .cell-value {
    font-size: 17px;
    color: #8e8e93;
  }
  
  .cell-accessory {
    display: flex;
    align-items: center;
    margin-left: 8px;
    
    .arrow {
      font-size: 20px;
      color: #c5c5c7;
      font-weight: 300;
    }
  }
}

// iOS Switch
.ios-switch {
  width: 51px;
  height: 31px;
  background: #e5e5ea;
  border-radius: 16px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  
  &.on {
    background: #34c759;
    
    .switch-thumb {
      transform: translateX(20px);
    }
  }
  
  .switch-thumb {
    width: 27px;
    height: 27px;
    background: #fff;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}

// Safe Area
.safe-area-bottom {
  height: max(20px, env(safe-area-inset-bottom, 20px));
}

// Sub-page
.ios-subpage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f2f2f7;
  z-index: 100;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
}

.ios-subpage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f2f2f7;
  border-bottom: 0.5px solid #e5e5ea;
  
  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: #007aff;
    font-size: 17px;
    cursor: pointer;
    
    .back-arrow {
      font-size: 28px;
      line-height: 1;
      margin-top: -2px;
    }
  }
  
  .subpage-title {
    font-size: 17px;
    font-weight: 600;
    color: #000;
  }
  
  .header-spacer {
    width: 60px;
  }
}

.ios-subpage-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

// Transitions
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.3s;
  
  .ios-settings-drawer {
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  
  .ios-settings-drawer {
    transform: translateY(100%);
  }
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}
</style>
