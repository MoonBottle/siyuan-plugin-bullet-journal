<template>
  <div class="workbench-tab" data-testid="workbench-tab">
    <header class="workbench-tab__header">
      <h1 class="workbench-tab__title">
        {{ t('workbench').title }}
      </h1>
    </header>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
</script>

<style lang="scss" scoped>
.workbench-tab {
  padding: 16px;
}

.workbench-tab__header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.workbench-tab__title {
  margin: 0;
  font-size: 20px;
  color: var(--b3-theme-on-background);
}
</style>
