/**
 * 番茄钟专注状态管理
 * 使用文件存储进行中的番茄钟信息
 */
import { defineStore } from 'pinia';
import type { ActivePomodoro, ActivePomodoroData, Item } from '@/types/models';
import { appendBlock } from '@/api';
import { showMessage } from '@/utils/dialog';
import { showPomodoroCompleteNotification } from '@/utils/notification';
import {
  saveActivePomodoro,
  loadActivePomodoro,
  removeActivePomodoro
} from '@/utils/pomodoroStorage';
import dayjs from '@/utils/dayjs';

interface PomodoroState {
  activePomodoro: ActivePomodoro | null;
  timerInterval: number | null;
}

export const usePomodoroStore = defineStore('pomodoro', {
  state: (): PomodoroState => ({
    activePomodoro: null,
    timerInterval: null
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
          durationMinutes,
          projectId: item.project?.id,
          taskId: item.task?.id
        };

        // 保存到文件
        const saved = await saveActivePomodoro(plugin, pomodoroData);
        if (!saved) {
          showMessage('保存专注状态失败', 'error');
          return false;
        }

        // 设置当前专注状态
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds: durationMinutes * 60
        };

        // 启动倒计时
        this.startTimer();

        showMessage(`开始专注：${item.content}（${durationMinutes}分钟）`);
        return true;
      } catch (error) {
        console.error('[Pomodoro] 开始专注失败:', error);
        showMessage('开始专注失败', 'error');
        return false;
      }
    },

    /**
     * 启动倒计时定时器
     */
    startTimer() {
      if (this.timerInterval) {
        window.clearInterval(this.timerInterval);
      }

      this.timerInterval = window.setInterval(() => {
        if (!this.activePomodoro) {
          this.stopTimer();
          return;
        }

        this.activePomodoro.remainingSeconds--;

        if (this.activePomodoro.remainingSeconds <= 0) {
          this.completePomodoro();
        }
      }, 1000);
    },

    /**
     * 停止倒计时定时器
     */
    stopTimer() {
      if (this.timerInterval) {
        window.clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    /**
     * 完成专注
     * @param plugin 思源插件实例
     */
    async completePomodoro(plugin?: any): Promise<boolean> {
      if (!this.activePomodoro) return false;

      try {
        const { blockId, itemContent, startTime, durationMinutes } = this.activePomodoro;
        const now = dayjs();
        const dateStr = now.format('YYYY-MM-DD');
        const endTimeStr = now.format('HH:mm:ss');
        const startTimeStr = dayjs(startTime).format('HH:mm:ss');

        // 在文档中创建完整的番茄钟块
        const pomodoroContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
        await appendBlock('markdown', pomodoroContent, blockId);

        // 删除文件中的进行中的番茄钟记录
        if (plugin) {
          await removeActivePomodoro(plugin);
        }

        // 播放提示音
        this.playNotificationSound();

        // 显示系统级完成通知
        showPomodoroCompleteNotification(itemContent, durationMinutes, () => {
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
        showMessage(`专注完成：${itemContent}`);

        // 清理状态
        this.stopTimer();
        this.activePomodoro = null;

        return true;
      } catch (error) {
        console.error('[Pomodoro] 完成专注失败:', error);
        showMessage('完成专注失败', 'error');
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

        showMessage('已取消专注');
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
      try {
        // 从文件读取进行中的番茄钟
        const data = await loadActivePomodoro(plugin);
        if (!data) {
          return false;
        }

        // 计算剩余时间
        const elapsedSeconds = Math.floor((Date.now() - data.startTime) / 1000);
        const totalSeconds = data.durationMinutes * 60;
        const remainingSeconds = totalSeconds - elapsedSeconds;

        if (remainingSeconds <= 0) {
          // 已经过期，自动标记为完成
          console.log('[Pomodoro] 专注已过期，自动标记为完成');
          await this.markExpiredPomodoroComplete(data, plugin);
          return false;
        }

        // 恢复专注状态
        this.activePomodoro = {
          ...data,
          remainingSeconds
        };

        // 启动倒计时
        this.startTimer();

        console.log('[Pomodoro] 专注状态已恢复，剩余时间:', remainingSeconds, '秒');
        showMessage(`已恢复专注：${data.itemContent}`);
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
        const endTime = startTime.add(data.durationMinutes, 'minute');
        const dateStr = startTime.format('YYYY-MM-DD');
        const startTimeStr = startTime.format('HH:mm:ss');
        const endTimeStr = endTime.format('HH:mm:ss');

        // 在文档中创建完整的番茄钟块
        const pomodoroContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
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
