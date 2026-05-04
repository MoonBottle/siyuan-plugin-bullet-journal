<template>
  <button
    :aria-label="t('common').create"
    :title="t('common').create"
    class="mobile-create-fab"
    data-testid="mobile-create-fab"
    type="button"
  >
    +
  </button>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
</script>

<style lang="scss" scoped>
.mobile-create-fab {
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: var(--b3-theme-primary, #3b82f6);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  box-shadow: 0 4px 12px rgb(0 0 0 / 16%);
}
</style>
