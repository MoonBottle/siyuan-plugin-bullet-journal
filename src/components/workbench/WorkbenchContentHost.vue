<template>
  <section class="workbench-content-host" data-testid="workbench-content-host">
    <template v-if="activeEntry">
      <h2 class="workbench-content-host__title" data-testid="workbench-content-title">
        {{ activeEntry.title }}
      </h2>

      <DashboardCanvas
        v-if="activeEntry.type === 'dashboard'"
        :entry="activeEntry"
      />
      <WorkbenchViewHost
        v-else
        :entry="activeEntry"
      />
    </template>
    <div v-else class="workbench-content-host__empty" data-testid="workbench-content-empty">
      {{ t('workbench').emptyState }}
    </div>
  </section>
</template>

<script setup lang="ts">
import DashboardCanvas from '@/components/workbench/dashboard/DashboardCanvas.vue';
import WorkbenchViewHost from '@/components/workbench/view/WorkbenchViewHost.vue';
import { t } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

defineProps<{
  activeEntry: WorkbenchEntry | null;
}>();
</script>

<style lang="scss" scoped>
.workbench-content-host {
  flex: 1;
  min-width: 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--b3-theme-background);
}

.workbench-content-host__title {
  margin: 0;
  font-size: 20px;
  color: var(--b3-theme-on-background);
}

.workbench-content-host__empty {
  color: var(--b3-theme-on-surface);
}
</style>
