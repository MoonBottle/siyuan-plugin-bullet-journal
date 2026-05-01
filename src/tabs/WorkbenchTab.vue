<template>
  <div class="workbench-tab" data-testid="workbench-tab">
    <WorkbenchSidebar
      :entries="workbenchStore.entries"
      :active-entry-id="currentActiveEntryId"
      @select="handleSelect"
      @create-dashboard="handleCreateDashboard"
      @create-view="handleCreateView"
    />
    <WorkbenchContentHost :active-entry="currentActiveEntry" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import WorkbenchContentHost from '@/components/workbench/WorkbenchContentHost.vue';
import WorkbenchSidebar from '@/components/workbench/WorkbenchSidebar.vue';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { useWorkbenchStore } from '@/stores';
import type { WorkbenchViewType } from '@/types/workbench';

const plugin = usePlugin();
const workbenchStore = useWorkbenchStore();
const currentActiveEntryId = ref<string | null>(workbenchStore.activeEntryId);

const currentActiveEntry = computed(() => {
  return workbenchStore.entries.find(entry => entry.id === currentActiveEntryId.value) ?? null;
});

async function handleSelect(id: string) {
  currentActiveEntryId.value = id;
  await workbenchStore.setActiveEntry(id);
}

async function handleCreateDashboard() {
  const entry = await workbenchStore.createDashboardEntry(t('workbench').newDashboard);
  currentActiveEntryId.value = entry.id;
}

async function handleCreateView(viewType: WorkbenchViewType) {
  const entry = await workbenchStore.createViewEntry(viewType);
  currentActiveEntryId.value = entry.id;
}

onMounted(async () => {
  await workbenchStore.load(plugin);
  currentActiveEntryId.value = workbenchStore.activeEntryId;
});
</script>

<style lang="scss" scoped>
.workbench-tab {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  background: var(--b3-theme-background);
}
</style>
