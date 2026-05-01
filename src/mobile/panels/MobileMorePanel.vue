<template>
  <section class="mobile-more-panel" data-testid="more-panel">
    <header class="mobile-more-panel__header">
      <h2 class="mobile-more-panel__title">{{ t('settings').title }}</h2>
    </header>

    <div class="mobile-more-panel__section">
      <div class="mobile-more-panel__section-label">
        {{ t('mobile.settings.view') || '视图设置' }}
      </div>

      <button
        class="mobile-more-panel__item"
        data-testid="more-toggle-hide-completed"
        type="button"
        @click="projectStore.toggleHideCompleted()"
      >
        <div class="mobile-more-panel__item-copy">
          <span class="mobile-more-panel__item-title">
            {{ t('mobile.settings.hideCompleted') || '隐藏已完成' }}
          </span>
          <span class="mobile-more-panel__item-value">
            {{ projectStore.hideCompleted ? t('todo').hideCompleted : t('todo').showCompleted }}
          </span>
        </div>
        <div
          class="mobile-more-panel__switch"
          :class="{ 'mobile-more-panel__switch--active': projectStore.hideCompleted }"
        >
          <span class="mobile-more-panel__switch-thumb"></span>
        </div>
      </button>

      <button
        class="mobile-more-panel__item"
        data-testid="more-toggle-hide-abandoned"
        type="button"
        @click="projectStore.toggleHideAbandoned()"
      >
        <div class="mobile-more-panel__item-copy">
          <span class="mobile-more-panel__item-title">
            {{ t('mobile.settings.hideAbandoned') || '隐藏已放弃' }}
          </span>
          <span class="mobile-more-panel__item-value">
            {{ projectStore.hideAbandoned ? t('todo').hideAbandoned : t('todo').showAbandoned }}
          </span>
        </div>
        <div
          class="mobile-more-panel__switch"
          :class="{ 'mobile-more-panel__switch--active': projectStore.hideAbandoned }"
        >
          <span class="mobile-more-panel__switch-thumb"></span>
        </div>
      </button>
    </div>

    <div class="mobile-more-panel__section">
      <div class="mobile-more-panel__section-label">
        {{ t('mobile.settings.about') || '关于' }}
      </div>

      <div class="mobile-more-panel__item mobile-more-panel__item--static">
        <div class="mobile-more-panel__item-copy">
          <span class="mobile-more-panel__item-title">
            {{ t('mobile.settings.version') || '版本' }}
          </span>
          <span class="mobile-more-panel__item-value" data-testid="more-version">
            v{{ version }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PluginInfo from '@/../plugin.json';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { useProjectStore } from '@/stores';

const projectStore = useProjectStore();
const plugin = usePlugin();
const fallbackVersion = PluginInfo.version || '0.12.8';

const version = computed(() => plugin?.manifest?.version || fallbackVersion);
</script>

<style lang="scss" scoped>
.mobile-more-panel {
  min-height: 100%;
  box-sizing: border-box;
  padding: 20px 16px 88px;
  background: var(--b3-theme-surface, #fff);
}

.mobile-more-panel__header {
  margin-bottom: 20px;
}

.mobile-more-panel__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--b3-theme-on-background, #111827);
}

.mobile-more-panel__section + .mobile-more-panel__section {
  margin-top: 20px;
}

.mobile-more-panel__section-label {
  margin-bottom: 10px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-more-panel__item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 14px;
  background: var(--b3-theme-background, #fff);
  text-align: left;
  color: inherit;
}

.mobile-more-panel__item + .mobile-more-panel__item {
  margin-top: 10px;
}

.mobile-more-panel__item-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-more-panel__item-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background, #111827);
}

.mobile-more-panel__item-value {
  font-size: 12px;
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-more-panel__item--static {
  cursor: default;
}

.mobile-more-panel__switch {
  position: relative;
  width: 46px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--b3-theme-surface-lighter, #d1d5db);
  transition: background-color 0.2s ease;
}

.mobile-more-panel__switch--active {
  background: var(--b3-theme-primary, #3b82f6);
}

.mobile-more-panel__switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.22);
}

.mobile-more-panel__switch--active .mobile-more-panel__switch-thumb {
  transform: translateX(18px);
}
</style>
