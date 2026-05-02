<template>
  <article class="workbench-widget-card" data-testid="workbench-widget-card">
    <header class="workbench-widget-card__header">
      <span class="workbench-widget-card__title">{{ title }}</span>
      <span class="workbench-widget-card__drag" aria-hidden="true">::</span>
    </header>
    <div class="workbench-widget-card__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style lang="scss" scoped>
.workbench-widget-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
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

.workbench-widget-card__drag {
  color: var(--b3-theme-on-surface);
  letter-spacing: 0;
}

.workbench-widget-card__body {
  color: var(--b3-theme-on-background);
}
</style>
