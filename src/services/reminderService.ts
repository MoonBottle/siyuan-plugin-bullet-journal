/**
 * 提醒调度服务（基于 croner）
 * 在数据刷新时为每个提醒事项创建精确的 Cron 定时任务
 * 配合 visibilitychange 校准，确保提醒不丢失
 */

import { Cron } from 'croner';
import type { Plugin } from 'siyuan';
import type { Item } from '@/types/models';
import { useProjectStore } from '@/stores';
import { calculateReminderTime } from '@/parser/reminderParser';
import { showSystemNotification } from '@/utils/notification';

type ProjectStoreType = ReturnType<typeof useProjectStore>;

export class ReminderService {
  private scheduledJobs: Map<string, Cron> = new Map(); // key: blockId-date → Cron job
  private notifiedKeys: Set<string> = new Set(); // 已提醒的 key
  private projectStore: ProjectStoreType | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * 启动提醒服务
   */
  start(_plugin: Plugin, projectStore: ProjectStoreType): void {
    this.projectStore = projectStore;

    this.requestNotificationPermission();
    this.setupVisibilityListener();
    this.rebuildSchedule();

    console.log('[ReminderService] Started with croner');
  }

  /**
   * 停止提醒服务
   */
  stop(): void {
    this.clearAllJobs();
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.projectStore = null;
    console.log('[ReminderService] Stopped');
  }

  /**
   * 数据刷新后调用（防抖），由 index.ts 的 scheduleRefresh 触发
   */
  scheduleRebuild(): void {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => this.rebuildSchedule(), 300);
  }

  /**
   * 请求通知权限
   */
  private requestNotificationPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }

  /**
   * 监听页面可见性变化，回到前台时重建调度
   */
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ReminderService] Page became visible, rebuilding schedule');
        this.rebuildSchedule();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * 重建调度表：遍历事项，diff 新旧，增删 Cron job
   */
  private rebuildSchedule(): void {
    if (!this.projectStore) return;

    const now = Date.now();
    const newKeys = new Map<string, { item: Item; reminderTime: number }>();

    // 遍历所有事项，计算提醒时间
    for (const project of this.projectStore.projects) {
      for (const task of project.tasks) {
        for (const item of task.items) {
          // 跳过已完成/已放弃的
          if (item.status === 'completed' || item.status === 'abandoned') continue;
          // 跳过没有启用提醒的
          if (!item.reminder?.enabled) continue;

          const reminderTime = calculateReminderTime(
            item.date,
            item.startDateTime,
            item.endDateTime,
            undefined,
            undefined,
            item.reminder,
          );

          if (reminderTime <= 0) continue;

          const key = `${item.blockId}-${item.date}`;

          if (reminderTime <= now) {
            // 已过提醒时间但未通知过 → 立即触发
            if (!this.notifiedKeys.has(key)) {
              console.log(`[ReminderService] Missed reminder, triggering now: "${item.content.substring(0, 20)}..."`);
              this.triggerNotification(item);
              this.notifiedKeys.add(key);
              this.scheduleCleanup(key);
            }
          } else if (reminderTime < now + 24 * 60 * 60 * 1000) {
            // 未来 24 小时内 → 加入调度
            newKeys.set(key, { item, reminderTime });
          }
        }
      }
    }

    // Diff：停掉已删除的 job
    for (const [key, job] of this.scheduledJobs) {
      if (!newKeys.has(key)) {
        job.stop();
        this.scheduledJobs.delete(key);
      }
    }

    // 新增 job（已存在的跳过）
    for (const [key, { item, reminderTime }] of newKeys) {
      if (this.scheduledJobs.has(key)) continue;

      const job = new Cron(new Date(reminderTime), () => {
        const notifyKey = `${item.blockId}-${item.date}`;
        if (!this.notifiedKeys.has(notifyKey)) {
          this.triggerNotification(item);
          this.notifiedKeys.add(notifyKey);
          this.scheduleCleanup(notifyKey);
        }
        this.scheduledJobs.delete(key);
      });

      this.scheduledJobs.set(key, job);
    }

    console.log(`[ReminderService] Schedule rebuilt: ${this.scheduledJobs.size} active jobs, ${newKeys.size} items scanned`);
  }

  /**
   * 停止所有 job
   */
  private clearAllJobs(): void {
    for (const [, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();
  }

  /**
   * 触发通知
   */
  private triggerNotification(item: Item): void {
    const title = `⏰ ${item.project?.name || '提醒'}`;
    const body = item.task?.name
      ? `${item.task.name}: ${item.content}`
      : item.content;

    showSystemNotification(title, body, {
      tag: `reminder-${item.blockId}`,
      icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
      onClick: () => {
        this.openBlock(item.blockId);
      },
    });

    console.log(`[ReminderService] Notification triggered: ${item.content}`);
  }

  /**
   * 打开对应块
   */
  private openBlock(blockId: string | undefined): void {
    if (!blockId) return;
    window.open(`siyuan://blocks/${blockId}`, '_blank');
  }

  /**
   * 定时清理 notifiedKey（避免内存泄漏）
   */
  private scheduleCleanup(key: string): void {
    setTimeout(() => this.notifiedKeys.delete(key), 24 * 60 * 60 * 1000);
  }
}

// 导出单例
export const reminderService = new ReminderService();
