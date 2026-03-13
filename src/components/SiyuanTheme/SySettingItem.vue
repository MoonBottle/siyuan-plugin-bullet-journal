<template>
  <div class="sy-setting-item fn__flex">
    <div class="sy-setting-item__left">
      <span class="sy-setting-item__label">{{ label }}</span>
      <span v-if="description" class="sy-setting-item__desc">{{ description }}</span>
    </div>
    <div class="sy-setting-item__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
}>()
</script>

<style scoped>
.sy-setting-item {
  align-items: center;
  gap: 12px;
}

.sy-setting-item__left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sy-setting-item__label {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.sy-setting-item__desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.sy-setting-item__control {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
