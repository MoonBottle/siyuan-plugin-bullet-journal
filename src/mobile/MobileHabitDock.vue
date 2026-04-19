<template>
  <div class="mobile-habit-dock">
    <div class="mobile-habit-dock__placeholder">
      <div class="mobile-habit-dock__icon">🎯</div>
      <div class="mobile-habit-dock__title">{{ t('habit').title }}</div>
      <div class="mobile-habit-dock__desc">移动端习惯打卡即将推出</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
</script>

<style scoped>
.mobile-habit-dock {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-habit-dock__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--b3-theme-on-surface-light);
}

.mobile-habit-dock__icon {
  font-size: 48px;
}

.mobile-habit-dock__title {
  font-size: 18px;
  font-weight: 500;
}

.mobile-habit-dock__desc {
  font-size: 12px;
  opacity: 0.6;
}
</style>
