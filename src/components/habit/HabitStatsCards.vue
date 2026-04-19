<template>
  <div class="habit-stats-cards">
    <div class="habit-stats-card">
      <div class="habit-stats-card__value">{{ stats?.monthlyCheckins ?? 0 }}</div>
      <div class="habit-stats-card__label">{{ t('habit').monthlyCheckins }}</div>
    </div>
    <div class="habit-stats-card">
      <div class="habit-stats-card__value">{{ stats?.totalCheckins ?? 0 }}</div>
      <div class="habit-stats-card__label">{{ t('habit').totalCheckins }}</div>
    </div>
    <div class="habit-stats-card">
      <div class="habit-stats-card__value">{{ percentFormatter.format((stats?.monthlyCompletionRate ?? 0)) }}</div>
      <div class="habit-stats-card__label">{{ t('habit').monthlyCompletionRate }}</div>
    </div>
    <div class="habit-stats-card">
      <div class="habit-stats-card__value">
        {{ stats?.currentStreak ?? 0 }}<span class="habit-stats-card__sub">/ {{ stats?.longestStreak ?? 0 }}</span>
      </div>
      <div class="habit-stats-card__label">{{ t('habit').currentStreak }} / {{ t('habit').longestStreak }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import type { HabitStats } from '@/types/models';

defineProps<{
  stats?: HabitStats;
}>();

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
});
</script>

<style scoped>
.habit-stats-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 0;
}

.habit-stats-card {
  background: var(--b3-theme-surface-lighter);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}

.habit-stats-card__value {
  font-size: 20px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  line-height: 1.2;
}

.habit-stats-card__sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--b3-theme-on-surface-light);
}

.habit-stats-card__label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 2px;
}
</style>
