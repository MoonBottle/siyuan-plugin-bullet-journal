<template>
  <div class="pomodoro-stats-tab">
    <div class="stats-header">
      <h2 class="stats-title">{{ t('pomodoroStats').statsTitle }}</h2>
      <span class="fn__flex-1 fn__space"></span>
      <span class="block__icon refresh-btn b3-tooltips b3-tooltips__sw" :aria-label="t('common').refresh" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>

    <StatsOverview />

    <div class="heatmap-section">
      <AnnualHeatmap />
    </div>

    <div class="stats-cards-grid">
      <FocusDetailSection v-model:range="range" v-model:range-offset="rangeOffset" />
      <FocusTrendChart />
      <FocusTimelineChart />
      <BestFocusTimeChart />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import { buildViewDebugContext } from '@/utils/viewDebug';
import StatsOverview from '@/components/pomodoro/stats/StatsOverview.vue';
import FocusDetailSection from '@/components/pomodoro/stats/FocusDetailSection.vue';
import FocusTrendChart from '@/components/pomodoro/stats/FocusTrendChart.vue';
import FocusTimelineChart from '@/components/pomodoro/stats/FocusTimelineChart.vue';
import BestFocusTimeChart from '@/components/pomodoro/stats/BestFocusTimeChart.vue';
import AnnualHeatmap from '@/components/pomodoro/stats/AnnualHeatmap.vue';

type RangeType = 'today' | 'week' | 'month';
const range = ref<RangeType>('week');
const rangeOffset = ref(0);

const plugin = usePlugin();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
  }
};

// 数据刷新处理函数
const handleDataRefresh = async () => {
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', buildViewDebugContext('PomodoroStatsTab', plugin));
  if (!plugin) return;
  settingsStore.loadFromPlugin();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('PomodoroStatsTab', plugin));
  settingsStore.loadFromPlugin();

  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: () => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('PomodoroStatsTab', plugin),
          data: { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh();
      },
      viewName: 'PomodoroStatsTab',
    });
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('PomodoroStatsTab', plugin));
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannelGuard) {
    refreshChannelGuard.dispose();
    refreshChannelGuard = null;
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});

</script>

<style lang="scss" scoped>
.pomodoro-stats-tab {
  padding: 16px 16px 50px;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.stats-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.stats-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0;
  padding-left: 6px;
}

.refresh-btn {
  margin-left: 6px;
  cursor: pointer;
  opacity: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}

.stats-cards-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: repeat(2, 280px);
  gap: 16px;
  margin-top: 0;
  flex-shrink: 0;

  > * {
    min-width: 0;
  }
}

.heatmap-section {
  flex: 1;
  min-height: 200px;
  margin-top: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

@media (max-width: 768px) {
  .stats-cards-grid {
    grid-template-columns: 1fr;
    grid-template-rows: unset;
    grid-auto-rows: 280px;
  }
}
</style>
