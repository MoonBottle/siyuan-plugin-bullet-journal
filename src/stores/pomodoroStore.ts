/**
 * 番茄钟专注状态管理
 * 使用文件存储进行中的番茄钟信息
 */
import { defineStore } from 'pinia';
import type { ActivePomodoro, ActivePomodoroData, Item } from '@/types/models';
import { appendBlock } from '@/api';
import { showMessage } from '@/utils/dialog';
import { showPomodoroCompleteNotification } from '@/utils/notification';
import { eventBus, Events } from '@/utils/eventBus';
import {
  saveActivePomodoro,
  loadActivePomodoro,
  removeActivePomodoro
} from '@/utils/pomodoroStorage';
import dayjs from '@/utils/dayjs';

interface PomodoroState {
  activePomodoro: ActivePomodoro | null;
  timerInterval: number | null;
  timerStartTimestamp: number | null; // 计时器启动时的时间戳
  lastAccumulatedSeconds: number; // 用于计算时间差的基础累计秒数
}

export const usePomodoroStore = defineStore('pomodoro', {
  state: (): PomodoroState => ({
    activePomodoro: null,
    timerInterval: null,
    timerStartTimestamp: null,
    lastAccumulatedSeconds: 0
  }),

  getters: {
    isFocusing: (state) => !!state.activePomodoro,
    remainingTime: (state) => {
      if (!state.activePomodoro) return 0;
      return state.activePomodoro.remainingSeconds;
    }
  },

  actions: {
    /**
     * 开始专注
     * @param item 选中的事项
     * @param durationMinutes 专注时长（分钟）
     * @param parentBlockId 父块ID（事项块ID）
     * @param plugin 思源插件实例
     */
    async startPomodoro(
      item: Item,
      durationMinutes: number,
      parentBlockId: string,
      plugin: any
    ): Promise<boolean> {
      try {
        const now = dayjs();
        const startTimestamp = now.valueOf();

        // 构建番茄钟数据
        const pomodoroData: ActivePomodoroData = {
          blockId: parentBlockId,
          itemId: item.id,
          itemContent: item.content,
          startTime: startTimestamp,
          targetDurationMinutes: durationMinutes,
          accumulatedSeconds: 0,
          isPaused: false,
          pauseCount: 0,
          totalPausedSeconds: 0,
          projectId: item.project?.id,
          projectName: item.project?.name,
          taskId: item.task?.id,
          taskName: item.task?.name,
          taskLevel: item.task?.level
        };

        // 保存到文件
        const saved = await saveActivePomodoro(plugin, pomodoroData);
        if (!saved) {
          showMessage('❌ 保存专注状态失败', 'error');
          return false;
        }

        // 设置当前专注状态
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds: durationMinutes * 60
        };

        // 启动倒计时
        this.startTimer();

        // 触发专注开始事件
        eventBus.emit(Events.POMODORO_STARTED);

        showMessage(`🍅 开始专注「${item.content}」· ${durationMinutes}分钟`);
        return true;
      } catch (error) {
        console.error('[Pomodoro] 开始专注失败:', error);
        showMessage('❌ 开始专注失败', 'error');
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

      // 检查是否达到目标时长
      if (this.activePomodoro.accumulatedSeconds >= targetSeconds) {
        this.completePomodoro();
      }
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
     * 完成专注
     * @param plugin 思源插件实例
     */
    async completePomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro) return false;

      try {
        const {
          blockId,
          itemContent,
          startTime,
          accumulatedSeconds
        } = this.activePomodoro;

        const now = dayjs();
        const dateStr = now.format('YYYY-MM-DD');
        const endTimeStr = now.format('HH:mm:ss');
        const startTimeStr = dayjs(startTime).format('HH:mm:ss');

        // 计算实际专注分钟数
        const actualMinutes = Math.floor(accumulatedSeconds / 60);

        // 判断是否有暂停
        const hasPause = this.activePomodoro.pauseCount > 0 || this.activePomodoro.totalPausedSeconds > 0;

        // 在文档中创建番茄钟记录
        let pomodoroContent: string;
        if (hasPause) {
          // 有暂停时，包含实际专注时长
          pomodoroContent = `🍅${actualMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;
        } else {
          // 正常完成的只显示时间范围
          pomodoroContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
        }
        await appendBlock('markdown', pomodoroContent, blockId);

        // 删除文件中的进行中的番茄钟记录
        if (plugin) {
          await removeActivePomodoro(plugin);
        }

        // 播放提示音
        this.playNotificationSound();

        // 显示系统级完成通知
        showPomodoroCompleteNotification(itemContent, actualMinutes, () => {
          // 点击通知时聚焦思源窗口
          if (typeof window !== 'undefined' && (window as any).require) {
            try {
              const { ipcRenderer } = (window as any).require('electron');
              ipcRenderer.send('focus-window');
            } catch {
              // 忽略错误
            }
          }
        });

        // 同时显示思源内部通知（作为备份）
        showMessage(`✅ 专注完成「${itemContent}」· 实际专注 ${actualMinutes} 分钟`);

        // 清理状态
        this.stopTimer();
        this.activePomodoro = null;

        // 触发专注完成事件
        eventBus.emit(Events.POMODORO_COMPLETED);

        return true;
      } catch (error) {
        console.error('[Pomodoro] 完成专注失败:', error);
        showMessage('❌ 完成专注失败', 'error');
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

        // 计算实际专注分钟数（使用目标时长，因为已经过期）
        const actualMinutes = data.targetDurationMinutes;

        // 在文档中创建带实际时长的番茄钟块
        const pomodoroContent = `🍅${actualMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;
        await appendBlock('markdown', pomodoroContent, data.blockId);

        // 删除文件
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
    }
  }
});
