<template>
  <div class="fn__flex-1 fn__flex-column pomodoro-dock">
    <div class="block__icons">
      <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconClock"></use></svg>
        番茄统计
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span
        v-if="!pomodoroStore.isFocusing"
        class="block__icon b3-tooltips b3-tooltips__sw"
        aria-label="开始专注"
        @click="openTimerDialog"
      >
        <svg><use xlink:href="#iconPlay"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="刷新" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column pomodoro-dock-body">
      <PomodoroActiveTimer v-if="pomodoroStore.isFocusing" />
      <template v-else>
        <PomodoroStats />
        <PomodoroRecordList />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, h, createApp } from 'vue';
import { Dialog } from 'siyuan';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import PomodoroStats from '@/components/pomodoro/PomodoroStats.vue';
import PomodoroRecordList from '@/components/pomodoro/PomodoroRecordList.vue';
import PomodoroActiveTimer from '@/components/pomodoro/PomodoroActiveTimer.vue';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { showMessage } from '@/utils/dialog';
import { requestNotificationPermission } from '@/utils/notification';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();

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

// 打开开始专注弹框
let timerDialog: Dialog | null = null;
let dialogApp: any = null;

const openTimerDialog = () => {
  if (timerDialog) {
    timerDialog.destroy();
    timerDialog = null;
  }
  if (dialogApp) {
    dialogApp.unmount();
    dialogApp = null;
  }

  const closeDialog = () => {
    if (timerDialog) {
      timerDialog.destroy();
      timerDialog = null;
    }
    if (dialogApp) {
      dialogApp.unmount();
      dialogApp = null;
    }
  };

  // 先创建 Dialog，使用占位内容
  timerDialog = new Dialog({
    title: '开始专注',
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '600px',
    destroyCallback: () => {
      if (dialogApp) {
        dialogApp.unmount();
        dialogApp = null;
      }
      timerDialog = null;
    }
  });

  // Dialog 创建后，找到挂载点并渲染 Vue 组件
  setTimeout(() => {
    const mountEl = timerDialog?.element?.querySelector('#pomodoro-timer-dialog-mount');
    if (mountEl) {
      dialogApp = createApp(PomodoroTimerDialog, { closeDialog });
      dialogApp.mount(mountEl);
    }
  }, 0);
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 恢复专注状态
const restorePomodoroState = async () => {
  if (!plugin) return;

  // 从文件读取进行中的番茄钟
  const restored = await pomodoroStore.restorePomodoro(plugin);
  if (!restored) {
    console.log('[PomodoroDock] 没有进行中的番茄钟需要恢复');
  }
};

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 加载项目数据
  if (plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  }

  // 恢复专注状态
  await restorePomodoroState();

  // 请求通知权限（用于专注完成时的系统通知）
  await requestNotificationPermission();

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
