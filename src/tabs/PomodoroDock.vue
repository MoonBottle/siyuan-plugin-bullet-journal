<template>
  <div class="fn__flex-1 fn__flex-column pomodoro-dock">
    <div class="block__icons">
      <div class="block__logo">
        <TomatoIcon :width="16" :height="16" class="block__logoicon" />
        {{ t('pomodoro').dockTitle }}
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span
        v-if="!pomodoroStore.isFocusing"
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('pomodoro').startFocus"
        @click="openTimerDialog"
      >
        <svg><use xlink:href="#iconPlay"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('pomodoro').stats"
        @click="openStatsTab"
      >
        <svg><use xlink:href="#iconGraph"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="刷新" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="fn__flex-1 fn__flex-column pomodoro-dock-body">
      <PomodoroActiveTimer v-if="pomodoroStore.isFocusing" />
      <PomodoroBreakTimer v-else-if="pomodoroStore.isBreakActive" />
      <template v-else>
        <PomodoroStats />
        <PomodoroRecordList />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, h, createApp } from 'vue';
import { getSharedPinia } from '@/index';
import { Dialog } from 'siyuan';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import PomodoroStats from '@/components/pomodoro/PomodoroStats.vue';
import PomodoroRecordList from '@/components/pomodoro/PomodoroRecordList.vue';
import PomodoroActiveTimer from '@/components/pomodoro/PomodoroActiveTimer.vue';
import PomodoroBreakTimer from '@/components/pomodoro/PomodoroBreakTimer.vue';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import PomodoroCompleteDialog from '@/components/pomodoro/PomodoroCompleteDialog.vue';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import type { PendingPomodoroCompletion } from '@/types/models';
import { showMessage } from '@/utils/dialog';
import { requestNotificationPermission } from '@/utils/notification';
import { TAB_TYPES } from '@/constants';
import { t } from '@/i18n';

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
    showMessage(t('common').dataRefreshed);
  }
};

// 打开番茄统计 Tab
const openStatsTab = () => {
  if (plugin?.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.POMODORO_STATS);
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
    title: t('pomodoro').startFocusTitle,
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

// 打开专注完成弹窗（补填说明）
let completeDialog: Dialog | null = null;
let completeDialogApp: any = null;

const openCompleteDialog = (pending: PendingPomodoroCompletion) => {
  if (completeDialog) {
    completeDialog.destroy();
    completeDialog = null;
  }
  if (completeDialogApp) {
    completeDialogApp.unmount();
    completeDialogApp = null;
  }

  const closeCompleteDialog = () => {
    if (completeDialog) {
      completeDialog.destroy();
      completeDialog = null;
    }
    if (completeDialogApp) {
      completeDialogApp.unmount();
      completeDialogApp = null;
    }
  };

  completeDialog = new Dialog({
    title: '专注完成',
    content: '<div id="pomodoro-complete-dialog-mount"></div>',
    width: '400px',
    destroyCallback: () => {
      if (completeDialogApp) {
        completeDialogApp.unmount();
        completeDialogApp = null;
      }
      completeDialog = null;
    }
  });

  setTimeout(() => {
    const mountEl = completeDialog?.element?.querySelector('#pomodoro-complete-dialog-mount');
    if (mountEl) {
      const pinia = getSharedPinia();
      completeDialogApp = createApp(PomodoroCompleteDialog, {
        pending,
        closeDialog: closeCompleteDialog
      });
      if (pinia) completeDialogApp.use(pinia);
      completeDialogApp.mount(mountEl);
    }
  }, 0);
};

// 处理待完成记录（专注结束后需补填说明）
const handlePendingCompletion = (pending: PendingPomodoroCompletion) => {
  openCompleteDialog(pending);
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let unsubscribePomodoroRestore: (() => void) | null = null;
let unsubscribePendingCompletion: (() => void) | null = null;
let unsubscribeOpenTimerDialog: (() => void) | null = null;
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

// 处理番茄钟恢复事件（从插件主逻辑触发）
const handlePomodoroRestore = async (data: any) => {
  console.log('[PomodoroDock] 收到番茄钟恢复事件');
  if (!plugin) return;

  // 如果当前没有进行中的番茄钟，则恢复
  if (!pomodoroStore.isFocusing) {
    const restored = await pomodoroStore.restorePomodoro(plugin);
    if (restored) {
      console.log('[PomodoroDock] 番茄钟状态已从事件恢复');
    }
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

  // 恢复专注状态（如果插件启动时没有恢复）
  await restorePomodoroState();

  // 请求通知权限（用于专注完成时的系统通知）
  await requestNotificationPermission();

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 监听番茄钟恢复事件（从插件主逻辑触发）
  unsubscribePomodoroRestore = eventBus.on(Events.POMODORO_RESTORE, handlePomodoroRestore);

  // 监听待完成记录（专注结束后弹窗补填说明）
  unsubscribePendingCompletion = eventBus.on(Events.POMODORO_PENDING_COMPLETION, handlePendingCompletion);

  // 监听打开开始专注弹框事件（从底栏触发）
  unsubscribeOpenTimerDialog = eventBus.on(Events.POMODORO_OPEN_TIMER_DIALOG, openTimerDialog);

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
  if (unsubscribePomodoroRestore) {
    unsubscribePomodoroRestore();
  }
  if (unsubscribePendingCompletion) {
    unsubscribePendingCompletion();
  }
  if (unsubscribeOpenTimerDialog) {
    unsubscribeOpenTimerDialog();
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
  padding: 0 12px;
}

.block__icons {
  .block__icon {
    opacity: 1;
  }
}
</style>
