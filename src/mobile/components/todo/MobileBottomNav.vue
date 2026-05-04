<template>
  <div class="mobile-bottom-nav">
    <div class="nav-content">
      <button class="nav-item" @click="handleOpenPomodoro">
        <div class="nav-icon-wrapper">
          <svg class="nav-icon"><use xlink:href="#iconClock"></use></svg>
        </div>
        <span class="nav-label">{{ t('pomodoro').title || '番茄钟' }}</span>
      </button>
      
      <button class="nav-item" @click="emit('open-habit')">
        <div class="nav-icon-wrapper">
          <svg class="nav-icon"><use xlink:href="#iconCheck"></use></svg>
        </div>
        <span class="nav-label">{{ t('habit').title }}</span>
      </button>
      
      <div class="nav-spacer">
        <button class="add-btn" @click="emit('create')">
          <svg><use xlink:href="#iconAdd"></use></svg>
        </button>
      </div>
      
      <button class="nav-item" @click="showSettings">
        <div class="nav-icon-wrapper">
          <svg class="nav-icon"><use xlink:href="#iconSettings"></use></svg>
        </div>
        <span class="nav-label">{{ t('common').more }}</span>
      </button>
    </div>
  </div>
  
  <!-- Settings Drawer -->
  <SettingsDrawer v-model="showSettingsDrawer" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';
import SettingsDrawer from '../../drawers/settings/SettingsDrawer.vue';

const emit = defineEmits<{
  'open-pomodoro': [];
  'open-habit': [];
  create: [];
}>();

const showSettingsDrawer = ref(false);

const showSettings = () => {
  showSettingsDrawer.value = true;
};

const handleOpenPomodoro = () => {
  console.log('[MobileBottomNav] 番茄钟按钮被点击');
  emit('open-pomodoro');
};
</script>

<style lang="scss" scoped>
.mobile-bottom-nav {
  background: var(--b3-theme-background);
  border-top: 1px solid var(--b3-border-color);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  flex-shrink: 0;
}

.nav-content {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 60px;
  padding: 0 16px;
  max-width: 480px;
  margin: 0 auto;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    opacity: 1;
    color: var(--b3-theme-primary);
  }
}

.nav-icon-wrapper {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
}

.nav-spacer {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--b3-theme-primary) 0%, rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.8) 100%);
  color: var(--b3-theme-on-primary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow: 
    0 4px 12px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.4),
    0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 6px 16px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.5),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0) scale(0.95);
    box-shadow: 
      0 2px 8px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3);
  }
  
  svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
}
</style>
