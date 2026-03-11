<template>
  <div class="pomodoro-stats-tab">
    <h2 class="stats-title">{{ t('pomodoroStats').statsTitle }}</h2>

    <StatsOverview />

    <div class="stats-cards-grid">
      <FocusDetailSection v-model:range="range" v-model:range-offset="rangeOffset" />
      <FocusRecordsCard :start-date="rangeDates.startDate" :end-date="rangeDates.endDate" />
      <FocusTrendChart />
      <FocusTimelineChart />
      <BestFocusTimeChart />
      <AnnualHeatmap />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import StatsOverview from '@/components/pomodoro/stats/StatsOverview.vue';
import FocusDetailSection from '@/components/pomodoro/stats/FocusDetailSection.vue';
import FocusRecordsCard from '@/components/pomodoro/stats/FocusRecordsCard.vue';
import FocusTrendChart from '@/components/pomodoro/stats/FocusTrendChart.vue';
import FocusTimelineChart from '@/components/pomodoro/stats/FocusTimelineChart.vue';
import BestFocusTimeChart from '@/components/pomodoro/stats/BestFocusTimeChart.vue';
import AnnualHeatmap from '@/components/pomodoro/stats/AnnualHeatmap.vue';

type RangeType = 'today' | 'week' | 'month';
const range = ref<RangeType>('week');
const rangeOffset = ref(0);

const rangeDates = computed(() => {
  const base = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  switch (range.value) {
    case 'today': {
      const d = base.add(rangeOffset.value, 'day');
      const s = d.format('YYYY-MM-DD');
      return { startDate: s, endDate: s };
    }
    case 'week': {
      const d = base.add(rangeOffset.value, 'week');
      start = d.startOf('week').add(1, 'day');
      end = d.endOf('week').add(1, 'day');
      break;
    }
    case 'month': {
      const d = base.add(rangeOffset.value, 'month');
      start = d.startOf('month');
      end = d.endOf('month');
      break;
    }
    default:
      return { startDate: base.format('YYYY-MM-DD'), endDate: base.format('YYYY-MM-DD') };
  }
  return { startDate: start!.format('YYYY-MM-DD'), endDate: end!.format('YYYY-MM-DD') };
});
</script>

<style lang="scss" scoped>
.pomodoro-stats-tab {
  padding: 16px 16px 50px;
  min-height: 100%;
  box-sizing: border-box;
}

.stats-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 20px 0;
}

.stats-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 280px);
  gap: 16px;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .stats-cards-grid {
    grid-template-columns: 1fr;
    grid-template-rows: unset;
    grid-auto-rows: 280px;
  }
}
</style>
