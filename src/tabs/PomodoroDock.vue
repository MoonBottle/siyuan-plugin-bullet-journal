<template>
  <div class="fn__flex-1 fn__flex-column pomodoro-dock">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconClock"></use></svg>
        番茄统计
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="刷新" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column pomodoro-dock-body">
      <PomodoroStats />
      <PomodoroRecordList />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import PomodoroStats from '@/components/pomodoro/PomodoroStats.vue';
import PomodoroRecordList from '@/components/pomodoro/PomodoroRecordList.vue';
import { showMessage } from '@/utils/dialog';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

// 数据刷新处理函数
const handleDataRefresh = async () => {
  if (!plugin) return;
  settingsStore.loadFromPlugin();
  await projectStore.refresh(plugin, settingsStore.enabledDirectories);
};

// 手动刷新
const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    showMessage('数据已刷新');
  }
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 加载项目数据
  if (plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  }

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：Dock 可能在 iframe 中，收不到主窗口的 eventBus，用 BroadcastChannel 接收
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = (e: MessageEvent) => {
      const data = e?.data;
      if (data?.type === 'DATA_REFRESH') {
        handleDataRefresh();
      }
    };
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});
</script>

<style lang="scss" scoped>
.pomodoro-dock {
  height: 100%;
  overflow: hidden;
}

.pomodoro-dock-body {
  min-height: 0;
  overflow: hidden;
}

.block__icons {
  .block__icon {
    opacity: 1;
  }
}
</style>
