<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="modelValue" class="settings-drawer-overlay" @click="closeOnOverlay">
        <div class="settings-drawer" @click.stop>
          <!-- Header -->
          <div class="drawer-header">
            <div class="drag-handle"></div>
            <span class="header-title">{{ t('mobile.settings.title') || '设置' }}</span>
            <button class="close-btn" @click="close">
              <svg><use xlink:href="#iconClose"></use></svg>
            </button>
          </div>
          
          <!-- Content -->
          <div class="drawer-content">
            <!-- View Settings Section -->
            <div class="settings-section">
              <div class="section-title">{{ t('mobile.settings.view') || '视图设置' }}</div>
              
              <div class="setting-item" @click="toggleHideCompleted">
                <div class="setting-info">
                  <span class="setting-icon">👁️</span>
                  <span class="setting-label">{{ t('mobile.settings.hideCompleted') || '隐藏已完成' }}</span>
                </div>
                <div class="setting-control">
                  <div class="switch" :class="{ active: projectStore.hideCompleted }">
                    <div class="switch-thumb"></div>
                  </div>
                </div>
              </div>
              
              <div class="setting-item" @click="toggleHideAbandoned">
                <div class="setting-info">
                  <span class="setting-icon">🚫</span>
                  <span class="setting-label">{{ t('mobile.settings.hideAbandoned') || '隐藏已放弃' }}</span>
                </div>
                <div class="setting-control">
                  <div class="switch" :class="{ active: projectStore.hideAbandoned }">
                    <div class="switch-thumb"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- About Section -->
            <div class="settings-section">
              <div class="section-title">{{ t('mobile.settings.about') || '关于' }}</div>
              
              <div class="setting-item" @click="openPluginSettings">
                <div class="setting-info">
                  <span class="setting-icon">⚙️</span>
                  <span class="setting-label">{{ t('mobile.settings.pluginSettings') || '插件设置' }}</span>
                </div>
                <div class="setting-control">
                  <span class="arrow">›</span>
                </div>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <span class="setting-icon">📦</span>
                  <span class="setting-label">{{ t('mobile.settings.version') || '版本' }}</span>
                </div>
                <div class="setting-control">
                  <span class="version-text">v{{ version }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import { usePlugin } from '@/main';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const projectStore = useProjectStore();
const plugin = usePlugin();

const version = computed(() => plugin?.manifest?.version || '0.12.2');

const close = () => {
  emit('update:modelValue', false);
};

const closeOnOverlay = (e: MouseEvent) => {
  // 只有点击遮罩层本身才关闭
  if (e.target === e.currentTarget) {
    close();
  }
};

const toggleHideCompleted = () => {
  projectStore.toggleHideCompleted();
};

const toggleHideAbandoned = () => {
  projectStore.toggleHideAbandoned();
};



const openPluginSettings = () => {
  // 打开插件设置页面
  if (plugin?.openSetting) {
    plugin.openSetting();
  }
  close();
};
</script>

<style lang="scss" scoped>
.settings-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.settings-drawer {
  background: var(--b3-theme-background);
  border-radius: 16px 16px 0 0;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  position: relative;
  border-bottom: 1px solid var(--b3-border-color);
}

.drag-handle {
  width: 36px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.3;
  border-radius: 2px;
  position: absolute;
  top: 8px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  margin-top: 8px;
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  
  &:active {
    background: var(--b3-theme-surface-lighter);
  }
  
  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-on-surface);
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 24px;
}

.settings-section {
  padding: 16px;
  
  & + .settings-section {
    border-top: 1px solid var(--b3-border-color);
  }
}

.section-title {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-left: 4px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: background 0.2s;
  
  &:active {
    background: var(--b3-theme-surface-lighter);
  }
  
  & + .setting-item {
    margin-top: 4px;
  }
}

.setting-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.setting-label {
  font-size: 15px;
  color: var(--b3-theme-on-background);
}

.setting-control {
  display: flex;
  align-items: center;
}

// Switch component
.switch {
  width: 48px;
  height: 28px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 14px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  
  &.active {
    background: var(--b3-theme-primary);
    
    .switch-thumb {
      transform: translateX(20px);
    }
  }
}

.switch-thumb {
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.arrow {
  font-size: 18px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.version-text {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

// Transition animations
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.3s;
  
  .settings-drawer {
    transition: transform 0.3s ease-out;
  }
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  
  .settings-drawer {
    transform: translateY(100%);
  }
}
</style>
