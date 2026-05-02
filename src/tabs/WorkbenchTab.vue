<template>
  <div class="workbench-tab" data-testid="workbench-tab">
    <WorkbenchSidebar
      :entries="workbenchStore.entries"
      :active-entry-id="currentActiveEntryId"
      @select="handleSelect"
      @create-dashboard="handleCreateDashboard"
      @create-view="handleCreateView"
    />
    <section class="workbench-tab__main">
      <div
        v-if="isDashboardActive"
        class="workbench-tab__toolbar"
      >
        <button
          class="workbench-tab__toolbar-button"
          data-testid="workbench-add-todo-widget"
          type="button"
          @click="handleAddTodoWidget"
        >
          {{ t('todo').title }}
        </button>
      </div>
      <WorkbenchContentHost :active-entry="currentActiveEntry" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import WorkbenchContentHost from '@/components/workbench/WorkbenchContentHost.vue';
import WorkbenchSidebar from '@/components/workbench/WorkbenchSidebar.vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { useWorkbenchStore } from '@/stores';
import type { WorkbenchViewType } from '@/types/workbench';

const plugin = usePlugin();
const workbenchStore = useWorkbenchStore();
const currentActiveEntryId = computed(() => workbenchStore.activeEntryId);
const currentActiveEntry = computed(() => workbenchStore.activeEntry);
const isDashboardActive = computed(() => currentActiveEntry.value?.type === 'dashboard');

async function handleSelect(id: string) {
  await workbenchStore.setActiveEntry(id);
}

async function handleCreateDashboard() {
  await workbenchStore.createDashboardEntry(t('workbench').newDashboard);
}

async function handleCreateView(viewType: WorkbenchViewType) {
  await workbenchStore.createViewEntry(viewType);
}

async function handleAddTodoWidget() {
  if (currentActiveEntry.value?.type !== 'dashboard' || !currentActiveEntry.value.dashboardId) {
    return;
  }

  await workbenchStore.addWidget(currentActiveEntry.value.dashboardId, 'todoList');
}

onMounted(async () => {
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
  justify-content: flex-end;
  padding: 16px 24px 0;
}

.workbench-tab__toolbar-button {
  padding: 6px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}
</style>
