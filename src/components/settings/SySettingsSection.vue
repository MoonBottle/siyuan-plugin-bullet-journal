<template>
  <div class="sy-settings-section">
    <div v-if="$slots.header" class="sy-settings-section__header">
      <slot name="header" />
    </div>
    <div v-else class="sy-settings-section__header" :class="{ 'sy-settings-section__header--inline': $slots.headerRight }">
      <div class="sy-settings-section__header-left">
        <div class="sy-settings-section__title-row fn__flex">
          <svg v-if="icon" class="sy-settings-section__icon">
            <use :xlink:href="`#${icon}`"></use>
          </svg>
          <span class="sy-settings-section__title">{{ title }}</span>
        </div>
        <div v-if="description" class="sy-settings-section__description">{{ description }}</div>
      </div>
      <div v-if="$slots.headerRight" class="sy-settings-section__header-right">
        <slot name="headerRight" />
      </div>
    </div>
    <div v-if="!$slots.headerRight" class="sy-settings-section__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  /** 思源图标名，如 iconFolder、iconCalendar，与 dock/tab 一致 */
  icon?: string;
}>()
</script>

<style scoped>
.sy-settings-section {
  margin-bottom: 20px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 16px;
}

.sy-settings-section__header {
  margin-bottom: 12px;
}

.sy-settings-section__header--inline {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 0;
}

.sy-settings-section__header-left {
  flex: 1;
  min-width: 0;
}

.sy-settings-section__header-right {
  flex-shrink: 0;
}

.sy-settings-section__title-row {
  align-items: center;
  gap: 8px;
}

.sy-settings-section__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: var(--b3-theme-on-surface);
  opacity: 0.85;
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
  margin-top: 12px;
}
</style>
