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
      <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('common').refresh" @click="handleRefresh">
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
    <!-- 休息弹窗 -->
    <PomodoroBreakOverlay :visible="pomodoroStore.isBreakOverlayVisible" @close="onBreakOverlayClose" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, h, createApp } from 'vue';
import { getSharedPinia } from '@/utils/sharedPinia';
import { Dialog } from 'siyuan';
import { getCurrentPlugin, usePlugin } from '@/main';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';
import PomodoroStats from '@/components/pomodoro/PomodoroStats.vue';
import PomodoroRecordList from '@/components/pomodoro/PomodoroRecordList.vue';
import PomodoroActiveTimer from '@/components/pomodoro/PomodoroActiveTimer.vue';
import PomodoroBreakTimer from '@/components/pomodoro/PomodoroBreakTimer.vue';
import PomodoroCompleteDialog from '@/components/pomodoro/PomodoroCompleteDialog.vue';
import PomodoroBreakOverlay from '@/components/pomodoro/PomodoroBreakOverlay.vue';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import type { PendingPomodoroCompletion } from '@/types/models';
import { showMessage, showPomodoroTimerDialog } from '@/utils/dialog';
import { getBlockByID } from '@/api';
import { removePendingCompletion } from '@/utils/pomodoroStorage';
import { requestNotificationPermission } from '@/utils/notification';
import { buildViewDebugContext } from '@/utils/viewDebug';
import { TAB_TYPES } from '@/constants';
import { t } from '@/i18n';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();

// 数据刷新处理函数
const handleDataRefresh = async () => {
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', buildViewDebugContext('PomodoroDock', plugin));
  if (!plugin) return;
  settingsStore.loadFromPlugin();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

// 手动刷新
const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
  }
};

// 打开番茄统计 Tab
const openStatsTab = () => {
  if (plugin?.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.POMODORO_STATS);
  }
};

// 打开开始专注弹框（使用共享函数，与底栏等调用方一致）
const openTimerDialog = () => {
  showPomodoroTimerDialog(undefined, settingsStore.todoDock.selectedGroup);
};

// 打开专注完成弹窗（补填说明）
let completeDialog: Dialog | null = null;
let completeDialogApp: any = null;

const openCompleteDialog = async (pending: PendingPomodoroCompletion) => {
  // 校验 block 有效性：如果关联的块已不存在（文档被删除），静默清理不弹框
  try {
    const block = await getBlockByID(pending.blockId);
    if (!block) {
      console.log(`[PomodoroDock] Block ${pending.blockId} not found, skipping complete dialog`);
      // 删除待完成记录并提示用户
      if (plugin) {
        await removePendingCompletion(plugin);
      }
      showMessage('关联事项已不存在，番茄钟记录已清理', 'info');
      return;
    }
  } catch (error) {
    // API 调用失败，假设块不存在
    console.log(`[PomodoroDock] Failed to check block ${pending.blockId}, skipping dialog`);
    if (plugin) {
      await removePendingCompletion(plugin);
    }
    showMessage('关联事项已不存在，番茄钟记录已清理', 'info');
    return;
  }

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
    title: t('settings').pomodoro.completeTitle,
    content: '<div id="pomodoro-complete-dialog-mount"></div>',
    width: '600px',
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
const handlePendingCompletion = async (pending: PendingPomodoroCompletion) => {
  await openCompleteDialog(pending);
};

// 处理休息弹窗关闭
const onBreakOverlayClose = () => {
  // 弹窗关闭时不需要额外操作，store 中的状态已经更新
  console.log('[PomodoroDock] 休息弹窗已关闭');
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let unsubscribePomodoroRestore: (() => void) | null = null;
let unsubscribePendingCompletion: (() => void) | null = null;
let unsubscribeOpenTimerDialog: (() => void) | null = null;
let unsubscribeBreakStarted: (() => void) | null = null;
let unsubscribeBreakEnded: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null;

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
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('PomodoroDock', plugin));
  // 从插件加载设置
  settingsStore.loadFromPlugin();

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
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: () => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('PomodoroDock', plugin),
          data: { type: 'DATA_REFRESH' },
        });
        return handleDataRefresh();
      },
      viewName: 'PomodoroDock',
    });
  } catch {
    // 忽略
  }
});

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('PomodoroDock', plugin));
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
  if (unsubscribeBreakStarted) {
    unsubscribeBreakStarted();
  }
  if (unsubscribeBreakEnded) {
    unsubscribeBreakEnded();
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
