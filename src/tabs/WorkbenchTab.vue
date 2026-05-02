<template>
  <div class="workbench-tab" data-testid="workbench-tab">
    <WorkbenchSidebar
      :entries="workbenchStore.entries"
      :active-entry-id="currentActiveEntryId"
      @select="handleSelect"
      @create-dashboard="handleCreateDashboard"
      @create-view="handleCreateView"
      @rename-entry="handleRenameEntry"
      @delete-entry="handleDeleteEntry"
    />
    <section class="workbench-tab__main">
      <div v-if="currentActiveEntry" class="workbench-tab__toolbar">
        <div class="workbench-tab__toolbar-title-group">
          <h2 class="workbench-tab__toolbar-title" data-testid="workbench-toolbar-title">
            {{ currentActiveEntry.title }}
          </h2>
        </div>

        <div v-if="isDashboardActive" class="workbench-tab__toolbar-actions">
          <div class="workbench-tab__toolbar-menu-wrap">
            <button
              class="workbench-tab__toolbar-button"
              data-testid="workbench-add-widget-trigger"
              type="button"
              @click="toggleWidgetMenu"
            >
              {{ t('workbench').addWidget }}
            </button>

            <div
              v-if="isWidgetMenuOpen"
              class="workbench-tab__toolbar-menu"
              data-testid="workbench-widget-menu"
            >
              <button
                v-for="definition in widgetDefinitions"
                :key="definition.type"
                class="workbench-tab__toolbar-menu-item"
                :data-testid="`workbench-add-widget-${definition.type}`"
                type="button"
                @click="handleAddWidget(definition.type)"
              >
                <span class="workbench-tab__toolbar-menu-icon" aria-hidden="true">
                  <svg><use :xlink:href="`#${definition.icon}`"></use></svg>
                </span>
                <span>{{ definition.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <WorkbenchContentHost
        :active-entry="currentActiveEntry"
        @request-add-widget="openWidgetMenu"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import WorkbenchContentHost from '@/components/workbench/WorkbenchContentHost.vue';
import WorkbenchSidebar from '@/components/workbench/WorkbenchSidebar.vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { useSettingsStore, useWorkbenchStore } from '@/stores';
import type { WorkbenchViewType, WorkbenchWidgetType } from '@/types/workbench';
import { getWidgetRegistry } from '@/workbench/widgetRegistry';

const plugin = usePlugin();
const workbenchStore = useWorkbenchStore();
const settingsStore = useSettingsStore();
const currentActiveEntryId = computed(() => workbenchStore.activeEntryId);
const currentActiveEntry = computed(() => workbenchStore.activeEntry);
const isDashboardActive = computed(() => currentActiveEntry.value?.type === 'dashboard');
const isWidgetMenuOpen = ref(false);
const widgetDefinitions = computed(() => Object.values(getWidgetRegistry()));

async function handleSelect(id: string) {
  await workbenchStore.setActiveEntry(id);
}

async function handleCreateDashboard() {
  await workbenchStore.createDashboardEntry(t('workbench').newDashboard);
}

async function handleCreateView(viewType: WorkbenchViewType) {
  await workbenchStore.createViewEntry(viewType);
}

async function handleRenameEntry(id: string, title: string) {
  await workbenchStore.renameEntry(id, title);
}

async function handleDeleteEntry(id: string) {
  await workbenchStore.deleteEntry(id);
}

function toggleWidgetMenu() {
  isWidgetMenuOpen.value = !isWidgetMenuOpen.value;
}

function openWidgetMenu() {
  isWidgetMenuOpen.value = true;
}

async function handleAddWidget(type: WorkbenchWidgetType) {
  if (currentActiveEntry.value?.type !== 'dashboard' || !currentActiveEntry.value.dashboardId) {
    return;
  }

  await workbenchStore.addWidget(currentActiveEntry.value.dashboardId, type);
  isWidgetMenuOpen.value = false;
}

onMounted(async () => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin();
  }
  await workbenchStore.load(plugin);
});
</script>

<style lang="scss" scoped>
.workbench-tab {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  background: var(--b3-theme-background);
  overflow: hidden;
}

.workbench-tab__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workbench-tab__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px 0;
  flex-shrink: 0;
}

.workbench-tab__toolbar-title-group {
  min-width: 0;
}

.workbench-tab__toolbar-title {
  margin: 0;
  font-size: 20px;
  color: var(--b3-theme-on-background);
}

.workbench-tab__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workbench-tab__toolbar-menu-wrap {
  position: relative;
}

.workbench-tab__toolbar-button {
  padding: 6px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.workbench-tab__toolbar-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 10;
  min-width: 220px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  box-shadow: var(--b3-dialog-shadow);
}

.workbench-tab__toolbar-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;
}

.workbench-tab__toolbar-menu-item:hover {
  border-color: var(--b3-border-color);
  background: var(--b3-theme-background);
}

.workbench-tab__toolbar-menu-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
}

.workbench-tab__toolbar-menu-icon svg {
  width: 16px;
  height: 16px;
}
</style>
