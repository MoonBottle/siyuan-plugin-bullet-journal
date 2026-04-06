/**
 * 番茄钟专注状态管理
 * 使用文件存储进行中的番茄钟信息
 */
import { defineStore } from 'pinia';
import type { ActivePomodoro, ActivePomodoroData, Item, PendingPomodoroCompletion } from '@/types/models';
import { appendBlock, setBlockAttrs, getBlockAttrs } from '@/api';
import { showMessage } from '@/utils/dialog';
import { showPomodoroCompleteNotification } from '@/utils/notification';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import {
  saveActivePomodoro,
  loadActivePomodoro,
  removeActivePomodoro,
  savePendingCompletion,
  loadPendingCompletion,
  removePendingCompletion,
  saveActiveBreak,
  removeActiveBreak
} from '@/utils/pomodoroStorage';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import { extractDatesFromBlock } from '@/utils/slashCommandUtils';
import { updateBlockDateTime } from '@/utils/fileUtils';
import { defaultPomodoroSettings } from '@/settings';
import { t } from '@/i18n';

interface PomodoroState {
  activePomodoro: ActivePomodoro | null;
  timerInterval: number | null;
  timerStartTimestamp: number | null; // 计时器启动时的时间戳
  lastAccumulatedSeconds: number; // 用于计算时间差的基础累计秒数
  // 休息状态（不持久化）
  isBreakActive: boolean;
  breakRemainingSeconds: number;
  breakTotalSeconds: number; // 休息总时长（秒），用于进度环
  breakInterval: number | null;
  // 休息弹窗状态
  isBreakOverlayVisible: boolean;
  // 自动延迟状态（不持久化）
  autoExtendCount: number;
  autoExtendTimeoutId: ReturnType<typeof setTimeout> | null;
}

export const usePomodoroStore = defineStore('pomodoro', {
  state: (): PomodoroState => ({
    activePomodoro: null,
    timerInterval: null,
    timerStartTimestamp: null,
    lastAccumulatedSeconds: 0,
    isBreakActive: false,
    breakRemainingSeconds: 0,
    breakTotalSeconds: 0,
    breakInterval: null,
    isBreakOverlayVisible: false,
    autoExtendCount: 0,
    autoExtendTimeoutId: null,
  }),

  getters: {
    isFocusing: (state) => !!state.activePomodoro,
    remainingTime: (state) => {
      if (!state.activePomodoro) return 0;
      return state.activePomodoro.remainingSeconds;
    },
    isStopwatch: (state) => state.activePomodoro?.timerMode === 'stopwatch',
    elapsedSeconds: (state) => {
      if (!state.activePomodoro) return 0;
      return state.activePomodoro.accumulatedSeconds;
    }
  },

  actions: {
    /**
     * 开始专注
     * @param item 选中的事项
     * @param durationMinutes 专注时长（分钟），正计时时为 0
     * @param parentBlockId 父块ID（事项块ID）
     * @param plugin 思源插件实例
     * @param timerMode 计时模式：countdown 倒计时 / stopwatch 正计时
     */
    async startPomodoro(
      item: Item,
      durationMinutes: number,
      parentBlockId: string,
      plugin: any,
      timerMode: 'countdown' | 'stopwatch' = 'countdown'
    ): Promise<boolean> {
      try {
        // 重置自动延迟计数
        this.autoExtendCount = 0;
        this.cancelAutoExtend();

        const now = dayjs();
        const startTimestamp = now.valueOf();

        // 正计时：targetDurationMinutes 设为极大值，不自动结束
        const targetMinutes = timerMode === 'stopwatch' ? 16 * 60 : durationMinutes;

        // 构建番茄钟数据
        const pomodoroData: ActivePomodoroData = {
          blockId: parentBlockId,
          itemId: item.id,
          itemContent: item.content,
          startTime: startTimestamp,
          targetDurationMinutes: targetMinutes,
          accumulatedSeconds: 0,
          isPaused: false,
          pauseCount: 0,
          totalPausedSeconds: 0,
          projectId: item.project?.id,
          projectName: item.project?.name,
          projectLinks: item.project?.links,
          taskId: item.task?.id,
          taskName: item.task?.name,
          taskLevel: item.task?.level,
          taskLinks: item.task?.links,
          itemStatus: item.status,
          itemLinks: item.links,
          timerMode
        };

        // 保存到文件
        const saved = await saveActivePomodoro(plugin, pomodoroData);
        if (!saved) {
          showMessage('❌ 保存专注状态失败', 'error');
          return false;
        }

        // 设置当前专注状态（正计时 remainingSeconds 表示剩余，正计时不自动结束故设大值）
        const remainingSeconds = timerMode === 'stopwatch' ? targetMinutes * 60 : durationMinutes * 60;
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds
        };

        // 启动倒计时
        this.startTimer();

        // 触发专注开始事件
        eventBus.emit(Events.POMODORO_STARTED);

        const mode = timerMode === 'stopwatch' ? t('pomodoro').startFocusStatusStopwatch : `${durationMinutes}${t('common').minutes}`;
        const msg = t('pomodoro').startFocusStatus.replace('{content}', item.content).replace('{mode}', mode);
        showMessage(msg);
        return true;
      } catch (error) {
        console.error('[Pomodoro] 开始专注失败:', error);
        showMessage(`❌ ${t('pomodoro').startFocusFailed}`, 'error');
        return false;
      }
    },

    /**
     * 暂停专注
     * @param plugin 思源插件实例
     */
    async pausePomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro || this.activePomodoro.isPaused) return false;

      try {
        // 先更新一次计时，确保 accumulatedSeconds 是最新的
        this.updateTimer();

        // 设置暂停状态
        this.activePomodoro.isPaused = true;
        this.activePomodoro.pauseCount++;
        this.activePomodoro.currentPauseStartTime = Date.now();

        // 更新 lastAccumulatedSeconds，以便恢复时正确计算
        this.lastAccumulatedSeconds = this.activePomodoro.accumulatedSeconds;

        // 停止定时器
        this.stopTimer();

        // 保存状态
        if (plugin) {
          await saveActivePomodoro(plugin, this.activePomodoro);
        }

        // 触发 TICK 更新悬浮按钮和底栏（暂停时显示播放图标）
        eventBus.emit(Events.POMODORO_TICK, {
          remainingSeconds: this.activePomodoro.remainingSeconds,
          accumulatedSeconds: this.activePomodoro.accumulatedSeconds,
          isPaused: true,
          isStopwatch: this.activePomodoro.timerMode === 'stopwatch',
          targetDurationMinutes: this.activePomodoro.targetDurationMinutes
        });

        showMessage(`⏸️ 已暂停 · 第 ${this.activePomodoro.pauseCount} 次`);
        return true;
      } catch (error) {
        console.error('[Pomodoro] 暂停专注失败:', error);
        showMessage('❌ 暂停专注失败', 'error');
        return false;
      }
    },

    /**
     * 继续专注
     * @param plugin 思源插件实例
     */
    async resumePomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro || !this.activePomodoro.isPaused) return false;

      try {
        // 计算本次暂停时长
        const pauseDuration = Math.floor(
          (Date.now() - this.activePomodoro.currentPauseStartTime!) / 1000
        );

        // 更新总暂停时长
        this.activePomodoro.totalPausedSeconds += pauseDuration;

        // 清除暂停状态
        this.activePomodoro.isPaused = false;
        this.activePomodoro.currentPauseStartTime = undefined;

        // 重新设置时间戳，从当前时间开始计算
        this.timerStartTimestamp = Date.now();
        // lastAccumulatedSeconds 已经在暂停时保存了

        // 重新启动定时器
        this.startTimer();

        // 保存状态
        if (plugin) {
          await saveActivePomodoro(plugin, this.activePomodoro);
        }

        // 触发 TICK 更新悬浮按钮和底栏（恢复时显示暂停图标）
        eventBus.emit(Events.POMODORO_TICK, {
          remainingSeconds: this.activePomodoro.remainingSeconds,
          accumulatedSeconds: this.activePomodoro.accumulatedSeconds,
          isPaused: false,
          isStopwatch: this.activePomodoro.timerMode === 'stopwatch',
          targetDurationMinutes: this.activePomodoro.targetDurationMinutes
        });

        showMessage('▶️ 继续专注');
        return true;
      } catch (error) {
        console.error('[Pomodoro] 继续专注失败:', error);
        showMessage('❌ 继续专注失败', 'error');
        return false;
      }
    },

    /**
     * 启动倒计时定时器
     * 使用 Date.now() 时间戳计算，避免页面后台时 setInterval 被节流导致计时不准
     */
    startTimer() {
      if (this.timerInterval) {
        window.clearInterval(this.timerInterval);
      }

      // 记录计时器启动时的时间戳和基础累计秒数
      this.timerStartTimestamp = Date.now();
      this.lastAccumulatedSeconds = this.activePomodoro?.accumulatedSeconds || 0;

      // 添加页面可见性变化监听
      this.setupVisibilityListener();

      this.timerInterval = window.setInterval(() => {
        this.updateTimer();
      }, 1000);
    },

    /**
     * 更新计时器状态
     * 基于时间戳计算经过的时间
     */
    updateTimer() {
      if (!this.activePomodoro) {
        this.stopTimer();
        return;
      }

      // 如果处于暂停状态，不更新计时
      if (this.activePomodoro.isPaused) {
        return;
      }

      // 基于时间戳计算经过的时间（不受 setInterval 节流影响）
      const elapsedMs = Date.now() - this.timerStartTimestamp!;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // 更新累计专注秒数（加上之前已经专注的时间）
      this.activePomodoro.accumulatedSeconds = this.lastAccumulatedSeconds + elapsedSeconds;

      // 更新剩余时间
      const targetSeconds = this.activePomodoro.targetDurationMinutes * 60;
      this.activePomodoro.remainingSeconds = Math.max(0, targetSeconds - this.activePomodoro.accumulatedSeconds);

      // 检查是否达到目标时长（正计时不自动完成，由用户手动结束）
      const isStopwatch = this.activePomodoro.timerMode === 'stopwatch';
      if (!isStopwatch && this.activePomodoro.accumulatedSeconds >= targetSeconds) {
        this.completePomodoro();
      }

      // 触发每秒更新事件，供外部（悬浮按钮、底栏）订阅
      eventBus.emit(Events.POMODORO_TICK, {
        remainingSeconds: this.activePomodoro.remainingSeconds,
        accumulatedSeconds: this.activePomodoro.accumulatedSeconds,
        isPaused: this.activePomodoro.isPaused,
        isStopwatch: this.activePomodoro.timerMode === 'stopwatch',
        targetDurationMinutes: this.activePomodoro.targetDurationMinutes
      });
    },

    /**
     * 设置页面可见性变化监听
     * 当页面重新可见时，立即校准时间
     */
    setupVisibilityListener() {
      // 先移除已有的监听
      this.removeVisibilityListener();

      // 创建监听函数
      const visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.activePomodoro && !this.activePomodoro.isPaused) {
          // 页面重新可见，立即校准时间
          this.updateTimer();
        }
      };

      // 保存引用以便后续移除
      (this as any)._visibilityHandler = visibilityHandler;
      document.addEventListener('visibilitychange', visibilityHandler);
    },

    /**
     * 移除页面可见性变化监听
     */
    removeVisibilityListener() {
      const handler = (this as any)._visibilityHandler;
      if (handler) {
        document.removeEventListener('visibilitychange', handler);
        (this as any)._visibilityHandler = null;
      }
    },

    /**
     * 设置数据刷新监听
     * 当项目数据刷新后，检测当前专注的事项是否已完成
     */
    setupDataRefreshListener() {
      // 先移除已有的监听
      this.removeDataRefreshListener();

      // 创建监听函数
      const dataRefreshHandler = ({ plugin, items }: { plugin: any; items: Item[] }) => {
        if (!plugin) return;

        // 检查设置是否开启自动结束番茄钟
        const pomodoroSettings = plugin.getSettings?.()?.pomodoro;
        const autoCompleteOnItemDone = pomodoroSettings?.autoCompleteOnItemDone !== false; // 默认 true
        if (!autoCompleteOnItemDone) return;

        if (!this.isFocusing) return;

        const activeBlockId = this.activePomodoro?.blockId;
        if (!activeBlockId) return;

        // 查找当前专注的事项
        const focusingItem = items.find((item: Item) => item.blockId === activeBlockId);
        if (!focusingItem) return;

        // 如果事项已完成，结束番茄钟
        if (focusingItem.status === 'completed') {
          this.completePomodoro(plugin);
        }
      };

      // 保存引用以便后续移除
      (this as any)._dataRefreshHandler = dataRefreshHandler;
      eventBus.on(Events.DATA_REFRESHED, dataRefreshHandler);
    },

    /**
     * 移除数据刷新监听
     */
    removeDataRefreshListener() {
      const handler = (this as any)._dataRefreshHandler;
      if (handler) {
        // eventBus.on 返回的是取消订阅函数
        handler();
        (this as any)._dataRefreshHandler = null;
      }
    },

    /**
     * 停止倒计时定时器
     */
    stopTimer() {
      if (this.timerInterval) {
        window.clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      // 清理页面可见性监听
      this.removeVisibilityListener();
      // 重置时间戳
      this.timerStartTimestamp = null;
    },

    /**
     * 完成专注：先持久化待完成记录，再删除进行中文件，触发弹窗补填说明
     * 记录由 savePomodoroRecordFromPending 在用户确认后写入
     */
    async completePomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro) return false;

      const pluginToUse = plugin ?? usePlugin();
      if (!pluginToUse) {
        showMessage('❌ 无法保存专注记录', 'error');
        return false;
      }

      try {
        const ap = this.activePomodoro;
        const now = Date.now();
        const actualMinutes = Math.floor(ap.accumulatedSeconds / 60);

        // 1. 构建并持久化待完成记录
        const pending: PendingPomodoroCompletion = {
          blockId: ap.blockId,
          itemId: ap.itemId,
          itemContent: ap.itemContent,
          startTime: ap.startTime,
          endTime: now,
          accumulatedSeconds: ap.accumulatedSeconds,
          durationMinutes: actualMinutes,
          projectId: ap.projectId,
          projectName: ap.projectName,
          projectLinks: ap.projectLinks,
          taskId: ap.taskId,
          taskName: ap.taskName,
          taskLevel: ap.taskLevel,
          taskLinks: ap.taskLinks,
          itemStatus: ap.itemStatus,
          itemLinks: ap.itemLinks,
          timerMode: ap.timerMode
        };

        const saved = await savePendingCompletion(pluginToUse, pending);
        if (!saved) {
          showMessage('❌ 保存待完成记录失败', 'error');
          return false;
        }

        // 2. 删除进行中文件
        await removeActivePomodoro(pluginToUse);

        // 3. 清理状态
        this.stopTimer();
        this.activePomodoro = null;

        // 3.5 触发完成事件，通知悬浮窗和底栏隐藏
        eventBus.emit(Events.POMODORO_COMPLETED);

        // 4. 播放提示音
        this.playNotificationSound();

        // 5. 系统通知（此时用户可能在其他应用，提醒回来补填说明）
        showPomodoroCompleteNotification(ap.itemContent, actualMinutes, () => {
          if (typeof window !== 'undefined' && (window as any).require) {
            try {
              const { ipcRenderer } = (window as any).require('electron');
              ipcRenderer.send('focus-window');
            } catch {
              // 忽略
            }
          }
        });

        // 6. 触发弹窗（由监听器显示完成弹窗）
        eventBus.emit(Events.POMODORO_PENDING_COMPLETION, pending);

        // 启动自动延迟倒计时（如果开启）
        this.scheduleAutoExtend(pluginToUse);

        return true;
      } catch (error) {
        console.error('[Pomodoro] 完成专注失败:', error);
        showMessage('❌ 完成专注失败', 'error');
        return false;
      }
    },

    /**
     * 从待完成记录保存番茄钟（弹窗确认后调用）
     * @param plugin 思源插件实例
     * @param pending 待完成记录
     * @param description 事项说明（选填）
     */
    async savePomodoroRecordFromPending(
      plugin: any,
      pending: PendingPomodoroCompletion,
      description: string
    ): Promise<boolean> {
      try {
        // 用户确认保存，取消自动延迟
        this.cancelAutoExtend();

        const pomodoro = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
        const recordMode = pomodoro.recordMode ?? 'block';
        const attrPrefix = pomodoro.attrPrefix ?? 'custom-pomodoro';

        const dateStr = dayjs(pending.startTime).format('YYYY-MM-DD');
        const startTimeStr = dayjs(pending.startTime).format('HH:mm:ss');
        const endTimeStr = dayjs(pending.endTime).format('HH:mm:ss');
        const trimmedDesc = description.trim();

        let valueContent: string;
        let blockContent: string;

        if (trimmedDesc) {
          if (trimmedDesc.includes('\n')) {
            const descLines = trimmedDesc.split('\n').map(line => line.trim()).filter(line => line);
            // attr 模式：用 \n 转义表示换行（块属性不支持真正的换行符）
            valueContent = `${pending.durationMinutes},${dateStr} ${startTimeStr}~${endTimeStr}\n${descLines.join('\n')}`;
            blockContent = `🍅${pending.durationMinutes},${dateStr} ${startTimeStr}~${endTimeStr}\n${descLines.join('\n')}`;
          } else {
            valueContent = `${pending.durationMinutes},${dateStr} ${startTimeStr}~${endTimeStr} ${trimmedDesc}`;
            blockContent = `🍅${valueContent}`;
          }
        } else {
          valueContent = `${pending.durationMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;
          blockContent = `🍅${valueContent}`;
        }

        // 先检查并追加日期（如果需要）
        const pomodoroDate = dayjs(pending.startTime).format('YYYY-MM-DD');
        const existingDates = await extractDatesFromBlock(pending.blockId);
        const hasDate = existingDates.some(item => item.date === pomodoroDate);

        if (!hasDate) {
          await updateBlockDateTime(
            pending.blockId,
            pomodoroDate,
            undefined, // newStartTime
            undefined, // newEndTime
            true,      // allDay
            undefined, // originalDate - undefined 表示添加新日期
            existingDates.length > 0 ? existingDates : undefined,
            undefined  // status
          );
        }

        if (recordMode === 'attr') {
          const attrName = `${attrPrefix}-${pending.startTime}`;
          const existingAttrs = await getBlockAttrs(pending.blockId).catch(() => ({}));
          const newAttrs: Record<string, string> = {
            ...existingAttrs,
            [attrName]: valueContent,
            bookmark: '🍅'
          };
          await setBlockAttrs(pending.blockId, newAttrs);
        } else {
          await appendBlock('markdown', blockContent, pending.blockId);
        }

        await removePendingCompletion(plugin);

        showMessage(t('pomodoro').completeMessage.replace('{content}', pending.itemContent ?? '').replace('{minutes}', String(pending.durationMinutes)));

        // 触发数据刷新，专注列表（含 attr 模式新记录）自动更新
        eventBus.emit(Events.DATA_REFRESH);
        broadcastDataRefresh();
        return true;
      } catch (error) {
        console.error('[Pomodoro] 保存记录失败:', error);
        showMessage(`❌ ${t('pomodoro').saveFailed}`, 'error');
        return false;
      }
    },

    /**
     * 取消专注
     * @param plugin 思源插件实例
     */
    async cancelPomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro) return false;

      try {
        // 删除文件中的进行中的番茄钟记录
        if (plugin) {
          await removeActivePomodoro(plugin);
        }

        // 清理状态
        this.stopTimer();
        this.activePomodoro = null;

        // 触发专注取消事件
        eventBus.emit(Events.POMODORO_CANCELLED);

        showMessage('❌ 已取消专注');
        return true;
      } catch (error) {
        console.error('[Pomodoro] 取消专注失败:', error);
        showMessage('取消专注失败', 'error');
        return false;
      }
    },

    /**
     * 启动自动延迟倒计时
     */
    scheduleAutoExtend(plugin: any) {
      this.cancelAutoExtend();

      const settings = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
      if (!settings.autoExtendEnabled) return;
      if (this.autoExtendCount >= (settings.autoExtendMaxCount ?? 3)) return;

      const waitSeconds = settings.autoExtendWaitSeconds ?? 30;
      this.autoExtendTimeoutId = setTimeout(() => {
        this.autoExtendTimeoutId = null;
        this.autoExtendPomodoro(plugin);
      }, waitSeconds * 1000);
    },

    /**
     * 自动延迟番茄钟：从 pending 恢复并延长倒计时
     */
    async autoExtendPomodoro(plugin: any) {
      try {
        const pending = await loadPendingCompletion(plugin);
        if (!pending) {
          console.log('[Pomodoro] 自动延迟：无待完成记录，跳过');
          return;
        }

        // 删除 pending 文件
        await removePendingCompletion(plugin);

        const settings = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
        const extendMinutes = settings.autoExtendMinutes ?? 5;
        const newTargetMinutes = Math.ceil(pending.accumulatedSeconds / 60) + extendMinutes;

        // 基于 pending 数据创建新的 active pomodoro
        const pomodoroData: ActivePomodoroData = {
          blockId: pending.blockId,
          itemId: pending.itemId,
          itemContent: pending.itemContent,
          startTime: pending.startTime,
          targetDurationMinutes: newTargetMinutes,
          accumulatedSeconds: pending.accumulatedSeconds,
          isPaused: false,
          pauseCount: 0,
          totalPausedSeconds: 0,
          projectId: pending.projectId,
          projectName: pending.projectName,
          projectLinks: pending.projectLinks,
          taskId: pending.taskId,
          taskName: pending.taskName,
          taskLevel: pending.taskLevel,
          taskLinks: pending.taskLinks,
          itemStatus: pending.itemStatus,
          itemLinks: pending.itemLinks,
          timerMode: 'countdown'
        };

        const saved = await saveActivePomodoro(plugin, pomodoroData);
        if (!saved) {
          console.error('[Pomodoro] 自动延迟：保存失败');
          return;
        }

        const remainingSeconds = newTargetMinutes * 60 - pending.accumulatedSeconds;
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds
        };

        this.startTimer();

        this.autoExtendCount++;

        // 通知弹窗关闭
        eventBus.emit(Events.POMODORO_AUTO_EXTENDED);

        const msg = `🔄 已自动延迟 ${extendMinutes} 分钟（第 ${this.autoExtendCount} 次）`;
        showMessage(msg);
        console.log(`[Pomodoro] 自动延迟：第 ${this.autoExtendCount} 次，延长 ${extendMinutes} 分钟`);
      } catch (error) {
        console.error('[Pomodoro] 自动延迟失败:', error);
      }
    },

    /**
     * 取消自动延迟
     */
    cancelAutoExtend() {
      if (this.autoExtendTimeoutId) {
        clearTimeout(this.autoExtendTimeoutId);
        this.autoExtendTimeoutId = null;
      }
      this.autoExtendCount = 0;
    },

    /**
     * 提前结束专注（与取消相同）
     * @param plugin 思源插件实例
     */
    async endPomodoroEarly(plugin?: any): Promise<boolean> {
      return this.cancelPomodoro(plugin);
    },

    /**
     * 从文件恢复专注状态
     * @param plugin 思源插件实例
     */
    async restorePomodoro(plugin: any): Promise<boolean> {
      // 如果已经有活跃状态，不需要重复恢复
      if (this.activePomodoro) {
        console.log('[Pomodoro] 已有活跃专注状态，跳过恢复');
        return true;
      }

      try {
        // 从文件读取进行中的番茄钟
        const data = await loadActivePomodoro(plugin);
        if (!data) {
          return false;
        }

        // 如果处于暂停状态，不计算经过的时间
        let effectiveAccumulatedSeconds = data.accumulatedSeconds;
        if (!data.isPaused) {
          // 计算从上次保存到现在经过的时间（秒）
          const elapsedSinceLastSave = Math.floor((Date.now() - data.startTime) / 1000);
          effectiveAccumulatedSeconds = data.accumulatedSeconds + elapsedSinceLastSave;
        }

        const targetSeconds = data.targetDurationMinutes * 60;
        const remainingSeconds = targetSeconds - effectiveAccumulatedSeconds;

        if (remainingSeconds <= 0) {
          // 已经过期，自动标记为完成
          console.log('[Pomodoro] 专注已过期，自动标记为完成');
          await this.markExpiredPomodoroComplete(data, plugin);
          return false;
        }

        // 恢复专注状态
        this.activePomodoro = {
          ...data,
          accumulatedSeconds: effectiveAccumulatedSeconds,
          remainingSeconds
        };

        // 只有在非暂停状态才启动定时器
        if (!data.isPaused) {
          this.startTimer();
          console.log('[Pomodoro] 专注状态已恢复，剩余时间:', remainingSeconds, '秒');
          showMessage(`🔄 已恢复专注「${data.itemContent}」`);
        } else {
          console.log('[Pomodoro] 专注状态已恢复（暂停中），已专注:', effectiveAccumulatedSeconds, '秒');
          showMessage(`⏸️ 继续专注「${data.itemContent}」· 第 ${data.pauseCount} 次暂停`);
        }

        // 触发专注开始事件（恢复状态也触发，以便悬浮按钮显示）
        eventBus.emit(Events.POMODORO_STARTED);

        return true;
      } catch (error) {
        console.error('[Pomodoro] 恢复专注状态失败:', error);
        return false;
      }
    },

    /**
     * 标记过期的番茄钟为完成
     * @param data 番茄钟数据
     * @param plugin 思源插件实例
     */
    async markExpiredPomodoroComplete(
      data: ActivePomodoroData,
      plugin?: any
    ): Promise<void> {
      try {
        const startTime = dayjs(data.startTime);
        const endTime = startTime.add(data.targetDurationMinutes, 'minute');
        const dateStr = startTime.format('YYYY-MM-DD');
        const startTimeStr = startTime.format('HH:mm:ss');
        const endTimeStr = endTime.format('HH:mm:ss');
        const actualMinutes = data.targetDurationMinutes;
        const valueContent = `${actualMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;

        const pomodoro = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
        const recordMode = pomodoro.recordMode ?? 'block';
        const attrPrefix = pomodoro.attrPrefix ?? 'custom-pomodoro';

        if (recordMode === 'attr') {
          const attrName = `${attrPrefix}-${data.startTime}`;
          const existingAttrs = await getBlockAttrs(data.blockId).catch(() => ({}));
          await setBlockAttrs(data.blockId, {
            ...existingAttrs,
            [attrName]: valueContent,
            bookmark: '🍅'
          });
        } else {
          const pomodoroContent = `🍅${valueContent}`;
          await appendBlock('markdown', pomodoroContent, data.blockId);
        }

        if (plugin) {
          await removeActivePomodoro(plugin);
        }

        showMessage(`专注已自动完成：${data.itemContent}`);
      } catch (error) {
        console.error('[Pomodoro] 标记过期番茄钟失败:', error);
      }
    },

    /**
     * 播放提示音
     */
    playNotificationSound() {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.warn('[Pomodoro] 播放提示音失败:', error);
      }
    },

    /**
     * 开始休息（持久化到 active-break.json）
     * @param minutes 休息时长（分钟）
     * @param plugin 思源插件实例，用于持久化
     */
    async startBreak(minutes: number, plugin?: any): Promise<void> {
      this.stopBreak(plugin);
      const startTime = Date.now();
      const totalSeconds = minutes * 60;
      this.isBreakActive = true;
      this.breakRemainingSeconds = totalSeconds;
      this.breakTotalSeconds = totalSeconds;
      // 休息开始时自动显示弹窗
      this.isBreakOverlayVisible = true;

      if (plugin) {
        await saveActiveBreak(plugin, { startTime, durationMinutes: minutes });
      }

      this.breakInterval = window.setInterval(() => {
        this.breakRemainingSeconds = Math.max(0, this.breakRemainingSeconds - 1);
        eventBus.emit(Events.BREAK_TICK, {
          remainingSeconds: this.breakRemainingSeconds,
          totalSeconds: this.breakTotalSeconds
        });
        if (this.breakRemainingSeconds <= 0) {
          this.stopBreak(plugin ?? usePlugin()); // 会 emit BREAK_ENDED
          showMessage(t('settings').pomodoro.breakEndMessage);
          this.playNotificationSound();
        }
      }, 1000);

      eventBus.emit(Events.BREAK_STARTED);
    },

    /**
     * 显示休息弹窗
     */
    showBreakOverlay(): void {
      if (this.isBreakActive) {
        this.isBreakOverlayVisible = true;
      }
    },

    /**
     * 隐藏休息弹窗
     */
    hideBreakOverlay(): void {
      this.isBreakOverlayVisible = false;
    },

    /**
     * 停止休息
     * @param plugin 思源插件实例，用于删除持久化文件
     */
    async stopBreak(plugin?: any): Promise<void> {
      const wasActive = this.isBreakActive;
      if (this.breakInterval) {
        window.clearInterval(this.breakInterval);
        this.breakInterval = null;
      }
      this.isBreakActive = false;
      this.breakRemainingSeconds = 0;
      this.breakTotalSeconds = 0;
      // 休息结束时关闭弹窗
      this.isBreakOverlayVisible = false;
      if (wasActive && plugin) {
        await removeActiveBreak(plugin);
      }
      if (wasActive) {
        eventBus.emit(Events.BREAK_ENDED);
      }
    },

    /**
     * 从文件恢复休息状态（重启后调用）
     * @param plugin 思源插件实例
     * @param remainingSeconds 剩余秒数（由调用方根据 startTime/durationMinutes 计算）
     */
    restoreBreak(plugin: any, remainingSeconds: number, totalSeconds?: number): void {
      if (this.isBreakActive) return;
      this.isBreakActive = true;
      this.breakRemainingSeconds = remainingSeconds;
      this.breakTotalSeconds = totalSeconds ?? remainingSeconds;

      this.breakInterval = window.setInterval(() => {
        this.breakRemainingSeconds = Math.max(0, this.breakRemainingSeconds - 1);
        eventBus.emit(Events.BREAK_TICK, {
          remainingSeconds: this.breakRemainingSeconds,
          totalSeconds: this.breakTotalSeconds
        });
        if (this.breakRemainingSeconds <= 0) {
          this.stopBreak(plugin);
          showMessage(t('settings').pomodoro.breakEndMessage);
          this.playNotificationSound();
        }
      }, 1000);

      eventBus.emit(Events.BREAK_STARTED);
    }
  }
});
