/**
 * 番茄钟专注状态管理
 */
import { defineStore } from 'pinia';
import type { ActivePomodoro, Item } from '@/types/models';
import { appendBlock, setBlockAttrs, updateBlock, deleteBlock, getBlockAttrs } from '@/api';
import { showMessage } from '@/utils/dialog';
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
     */
    async startPomodoro(item: Item, durationMinutes: number, parentBlockId: string): Promise<boolean> {
      try {
        const now = dayjs();
        const dateStr = now.format('YYYY-MM-DD');
        const timeStr = now.format('HH:mm:ss');
        const startTimestamp = now.valueOf();

        // 创建番茄钟块内容
        const pomodoroContent = `🍅${dateStr} ${timeStr}`;

        // 调用思源 API 在事项下添加子块
        const result = await appendBlock('markdown', pomodoroContent, parentBlockId);

        if (!result || result.length === 0) {
          showMessage('创建番茄钟失败', 'error');
          return false;
        }

        const blockId = result[0].doOperations[0]?.id;
        if (!blockId) {
          showMessage('获取番茄钟块ID失败', 'error');
          return false;
        }

        // 设置块属性
        await setBlockAttrs(blockId, {
          'custom-pomodoro-status': 'running',
          'custom-pomodoro-start': String(startTimestamp),
          'custom-pomodoro-duration': String(durationMinutes),
          'custom-pomodoro-item-id': item.id,
          'custom-pomodoro-item-content': item.content
        });

        // 设置当前专注状态
        this.activePomodoro = {
          blockId,
          itemId: item.id,
          itemContent: item.content,
          startTime: startTimestamp,
          durationMinutes,
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
     */
    async completePomodoro(): Promise<boolean> {
      if (!this.activePomodoro) return false;

      try {
        const { blockId, itemContent, startTime, durationMinutes } = this.activePomodoro;
        const now = dayjs();
        const dateStr = now.format('YYYY-MM-DD');
        const endTimeStr = now.format('HH:mm:ss');
        const startTimeStr = dayjs(startTime).format('HH:mm:ss');

        // 更新块内容为完整格式（包含结束时间）
        const updatedContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
        await updateBlock('markdown', updatedContent, blockId);

        // 更新块属性为已完成
        await setBlockAttrs(blockId, {
          'custom-pomodoro-status': 'completed'
        });

        // 播放提示音
        this.playNotificationSound();

        // 显示完成通知
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
     * 取消专注（删除番茄钟块）
     */
    async cancelPomodoro(): Promise<boolean> {
      if (!this.activePomodoro) return false;

      try {
        const { blockId } = this.activePomodoro;

        // 删除番茄钟块
        await deleteBlock(blockId);

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
     * 提前结束专注（与取消相同，删除块）
     */
    async endPomodoroEarly(): Promise<boolean> {
      return this.cancelPomodoro();
    },

    /**
     * 从块属性恢复专注状态
     * @param blockId 番茄钟块ID
     * @param attrs 块属性
     */
    async restorePomodoro(blockId: string, attrs: { [key: string]: string }): Promise<boolean> {
      try {
        const status = attrs['custom-pomodoro-status'];
        if (status !== 'running') return false;

        const startTimestamp = parseInt(attrs['custom-pomodoro-start'], 10);
        const durationMinutes = parseInt(attrs['custom-pomodoro-duration'], 10);
        const itemId = attrs['custom-pomodoro-item-id'];
        const itemContent = attrs['custom-pomodoro-item-content'];

        if (!startTimestamp || !durationMinutes || !itemId) {
          console.warn('[Pomodoro] 块属性不完整，无法恢复专注状态');
          return false;
        }

        // 计算剩余时间
        const elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
        const totalSeconds = durationMinutes * 60;
        const remainingSeconds = totalSeconds - elapsedSeconds;

        if (remainingSeconds <= 0) {
          // 已经过期，自动标记为完成
          console.log('[Pomodoro] 专注已过期，自动标记为完成');
          await this.markExpiredPomodoroComplete(blockId, startTimestamp, durationMinutes);
          return false;
        }

        // 恢复专注状态
        this.activePomodoro = {
          blockId,
          itemId,
          itemContent: itemContent || '未知事项',
          startTime: startTimestamp,
          durationMinutes,
          remainingSeconds
        };

        // 启动倒计时
        this.startTimer();

        console.log('[Pomodoro] 专注状态已恢复，剩余时间:', remainingSeconds, '秒');
        return true;
      } catch (error) {
        console.error('[Pomodoro] 恢复专注状态失败:', error);
        return false;
      }
    },

    /**
     * 标记过期的番茄钟为完成
     */
    async markExpiredPomodoroComplete(
      blockId: string,
      startTimestamp: number,
      durationMinutes: number
    ): Promise<void> {
      try {
        const startTime = dayjs(startTimestamp);
        const endTime = startTime.add(durationMinutes, 'minute');
        const dateStr = startTime.format('YYYY-MM-DD');
        const startTimeStr = startTime.format('HH:mm:ss');
        const endTimeStr = endTime.format('HH:mm:ss');

        // 更新块内容
        const updatedContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
        await updateBlock('markdown', updatedContent, blockId);

        // 更新块属性
        await setBlockAttrs(blockId, {
          'custom-pomodoro-status': 'completed'
        });
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
