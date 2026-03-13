<template>
  <div class="sy-settings-section">
    <div v-if="$slots.header" class="sy-settings-section__header">
      <slot name="header" />
    </div>
    <div v-else class="sy-settings-section__header">
      <div class="sy-settings-section__title">{{ title }}</div>
      <div v-if="description" class="sy-settings-section__description">{{ description }}</div>
    </div>
    <div class="sy-settings-section__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>()
</script>

<style scoped>
.sy-settings-section {
  margin-bottom: 24px;
}

.sy-settings-section__header {
  margin-bottom: 10px;
}

.sy-settings-section__title {
  font-weight: 500;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.sy-settings-section__description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 4px;
  line-height: 1.4;
}

.sy-settings-section__content {
  margin-top: 10px;
}
</style>
