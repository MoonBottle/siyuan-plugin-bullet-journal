<template>
  <article class="workbench-widget-card" data-testid="workbench-widget-card">
    <span class="workbench-widget-card__drag" aria-hidden="true">::</span>
    <header class="workbench-widget-card__header">
      <span class="workbench-widget-card__title">{{ title }}</span>
      <div class="workbench-widget-card__controls">
        <div class="workbench-widget-card__menu-wrap">
          <button
            class="workbench-widget-card__menu-trigger block__icon b3-tooltips b3-tooltips__sw"
            data-testid="workbench-widget-menu-trigger"
            type="button"
            :aria-label="t('common').more"
            @click="toggleMenu"
          >
            <svg><use xlink:href="#iconMore"></use></svg>
          </button>
          <div
            v-if="isMenuOpen"
            class="workbench-widget-card__menu"
            data-testid="workbench-widget-menu"
          >
            <button
              v-if="showConfigure"
              class="workbench-widget-card__menu-item"
              data-testid="workbench-widget-configure"
              type="button"
              @click="handleConfigure"
            >
              {{ t('workbench').configure }}
            </button>
            <button
              class="workbench-widget-card__menu-item"
              data-testid="workbench-widget-rename"
              type="button"
              @click="handleRename"
            >
              {{ t('workbench').rename }}
            </button>
            <button
              class="workbench-widget-card__menu-item"
              data-testid="workbench-widget-delete"
              type="button"
              @click="handleDelete"
            >
              {{ t('workbench').delete }}
            </button>
          </div>
        </div>
      </div>
    </header>
    <div class="workbench-widget-card__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';

defineProps<{
  title: string;
  showConfigure?: boolean;
}>();

const emit = defineEmits<{
  (event: 'configure'): void;
  (event: 'rename'): void;
  (event: 'delete'): void;
}>();

const isMenuOpen = ref(false);

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function handleRename() {
  isMenuOpen.value = false;
  emit('rename');
}

function handleConfigure() {
  isMenuOpen.value = false;
  emit('configure');
}

function handleDelete() {
  isMenuOpen.value = false;
  emit('delete');
}
</script>

<style lang="scss" scoped>
.workbench-widget-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
}

.workbench-widget-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workbench-widget-card__title {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.workbench-widget-card__controls {
  display: flex;
  align-items: center;
}

.workbench-widget-card__drag {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 2px 8px;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  letter-spacing: 0;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  cursor: move;
  user-select: none;
  transition: opacity 0.18s ease;
}

.workbench-widget-card:hover .workbench-widget-card__drag,
.workbench-widget-card:focus-within .workbench-widget-card__drag {
  opacity: 1;
  pointer-events: auto;
}

.workbench-widget-card__menu-wrap {
  position: relative;
}

.workbench-widget-card__menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  line-height: 1;
  opacity: 1;

  svg {
    display: block;
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}

.workbench-widget-card__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5;
  min-width: 120px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  box-shadow: var(--b3-dialog-shadow);
}

.workbench-widget-card__menu-item {
  width: 100%;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;
}

.workbench-widget-card__menu-item:hover {
  border-color: var(--b3-border-color);
  background: var(--b3-theme-background);
}

.workbench-widget-card__body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--b3-theme-on-background);
}
</style>
