<template>
  <div class="mobile-bottom-nav">
    <button class="nav-item" @click="emit('refresh')">
      <svg class="nav-icon"><use xlink:href="#iconRefresh"></use></svg>
      <span class="nav-label">{{ t('common').refresh }}</span>
    </button>
    <button class="nav-item nav-item-primary" @click="emit('create')">
      <div class="add-btn">
        <svg><use xlink:href="#iconAdd"></use></svg>
      </div>
    </button>
    <button class="nav-item" @click="showSettings">
      <svg class="nav-icon"><use xlink:href="#iconSettings"></use></svg>
      <span class="nav-label">{{ t('common').more }}</span>
    </button>
  </div>
  
  <!-- Settings Drawer -->
  <SettingsDrawer v-model="showSettingsDrawer" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';
import SettingsDrawer from '../drawers/SettingsDrawer.vue';

const emit = defineEmits<{
  refresh: [];
  create: [];
}>();

const showSettingsDrawer = ref(false);

const showSettings = () => {
  showSettingsDrawer.value = true;
};
</script>

<style lang="scss" scoped>
.mobile-bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 56px;
  background: var(--b3-theme-background);
  border-top: 1px solid var(--b3-border-color);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  
  &:active {
    opacity: 0.7;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.nav-label {
  font-size: 10px;
}

.nav-item-primary {
  padding: 0;
}

.add-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  &:active {
    transform: scale(0.95);
  }
}

.add-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
