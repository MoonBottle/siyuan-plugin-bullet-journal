<template>
  <section class="workbench-content-host" data-testid="workbench-content-host">
    <template v-if="activeEntry">
      <h2 class="workbench-content-host__title" data-testid="workbench-content-title">
        {{ activeEntry.title }}
      </h2>

      <div
        v-if="activeEntry.type === 'dashboard'"
        class="workbench-content-host__placeholder"
        data-testid="workbench-dashboard-placeholder"
      >
        Dashboard canvas coming next
      </div>
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

.workbench-content-host__placeholder {
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}
</style>
