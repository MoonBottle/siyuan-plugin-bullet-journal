<template>
  <section class="mobile-panel" data-testid="more-panel">
    {{ t('common').more }}
  </section>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
</script>

<style lang="scss" scoped>
.mobile-panel {
  padding: 16px;
}
</style>
