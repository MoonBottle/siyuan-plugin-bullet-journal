<template>
  <div class="workbench-widget workbench-widget--habit-week" data-testid="workbench-widget-habit-week">
    <span class="workbench-widget__label">{{ displayTitle }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import type { WorkbenchWidgetInstance } from '@/types/workbench';

const props = defineProps<{
  widget: WorkbenchWidgetInstance;
}>();

const displayTitle = computed(() => props.widget.title || t('habit').title);
</script>

<style lang="scss" scoped>
.workbench-widget {
  display: flex;
  align-items: center;
  min-height: 72px;
}

.workbench-widget__label {
  color: var(--b3-theme-on-background);
}
</style>
