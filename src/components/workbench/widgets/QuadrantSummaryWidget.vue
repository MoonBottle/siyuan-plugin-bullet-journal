<template>
  <div class="workbench-widget-summary" data-testid="workbench-widget-quadrant-summary">
    <div v-for="quadrant in quadrants" :key="quadrant.key" class="workbench-widget-summary__row">
      <span>{{ quadrant.label }}</span>
      <strong>{{ quadrant.count }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import type { PriorityLevel } from '@/types/models';
import { useSafeProjectStore } from './useSafeProjectStore';

const projectStore = useSafeProjectStore();

function getCount(priorities: PriorityLevel[]) {
  if (!projectStore) {
    return 0;
  }

  return projectStore.getFilteredAndSortedItems({
    groupId: '',
    priorities,
  }).filter(item => item.status !== 'completed' && item.status !== 'abandoned').length;
}

const quadrants = computed(() => {
  return [
    { key: 'q1', label: t('quadrant').panels.high, count: getCount(['p1']) },
    { key: 'q2', label: t('quadrant').panels.medium, count: getCount(['p2']) },
    { key: 'q3', label: t('quadrant').panels.low, count: getCount(['p3']) },
    { key: 'q4', label: t('quadrant').panels.none, count: getCount(['p4']) },
  ];
});
</script>

<style lang="scss" scoped>
.workbench-widget-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workbench-widget-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-background);
}
</style>
