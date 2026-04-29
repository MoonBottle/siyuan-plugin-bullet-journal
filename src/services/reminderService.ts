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
import { getHabitsNeedingReminder } from '@/services/habitReminder';

type ProjectStoreType = ReturnType<typeof useProjectStore>;

/**
 * 生成调度 key：blockId-date-reminderTime
 * 包含 reminderTime 确保同一事项改了提醒时间后能正确重新调度
 */
function makeScheduleKey(item: Item, reminderTime: number): string {
  return `${item.blockId}-${item.date}-${reminderTime}`;
}

export class ReminderService {
  private scheduledJobs: Map<string, Cron> = new Map(); // key → Cron job
  private notifiedKeys: Set<string> = new Set(); // 已提醒的 scheduleKey
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
    const newEntries = new Map<string, { item: Item; reminderTime: number }>();

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

          const key = makeScheduleKey(item, reminderTime);

          // 提醒时间已过：仅当在宽容窗口（5 分钟）内才视为漏掉的提醒
          // 超过 5 分钟说明是事后编辑，不应触发
          const MISSED_THRESHOLD_MS = 5 * 60 * 1000;
          if (reminderTime <= now && (now - reminderTime) <= MISSED_THRESHOLD_MS) {
            if (!this.notifiedKeys.has(key)) {
              console.log(`[ReminderService] Missed reminder, triggering now: "${item.content.substring(0, 20)}..." | key=${key}`);
              this.triggerNotification(item);
              this.notifiedKeys.add(key);
              this.scheduleCleanup(key);
            } else {
              console.log(`[ReminderService] Already notified for key=${key}, skipping`);
            }
          } else if (reminderTime <= now) {
            // 超过宽容窗口的已过期提醒，静默跳过
            if (!this.notifiedKeys.has(key)) {
              console.log(`[ReminderService] Stale reminder (${Math.round((now - reminderTime) / 60000)}min ago), skipping: "${item.content.substring(0, 20)}..." | key=${key}`);
              this.notifiedKeys.add(key); // 标记为已处理，避免重复日志
            }
          } else if (reminderTime < now + 24 * 60 * 60 * 1000) {
            // 未来 24 小时内 → 加入调度
            newEntries.set(key, { item, reminderTime });
          }
        }
      }
    }

    // Diff：停掉不再需要的 job
    for (const [key, job] of this.scheduledJobs) {
      if (!newEntries.has(key)) {
        console.log(`[ReminderService] Removing obsolete job: key=${key}`);
        job.stop();
        this.scheduledJobs.delete(key);
      }
    }

    // 新增 job（已存在的跳过）
    for (const [key, { item, reminderTime }] of newEntries) {
      if (this.scheduledJobs.has(key)) continue;

      console.log(`[ReminderService] Scheduling job: key=${key} at ${new Date(reminderTime).toLocaleString()}`);

      const job = new Cron(new Date(reminderTime), () => {
        const notifyKey = makeScheduleKey(item, reminderTime);
        if (!this.notifiedKeys.has(notifyKey)) {
          console.log(`[ReminderService] Cron fired, triggering notification: key=${notifyKey}`);
          this.triggerNotification(item);
          this.notifiedKeys.add(notifyKey);
          this.scheduleCleanup(notifyKey);
        } else {
          console.log(`[ReminderService] Cron fired but already notified: key=${notifyKey}`);
        }
        this.scheduledJobs.delete(key);
      });

      this.scheduledJobs.set(key, job);
    }

    console.log(`[ReminderService] Schedule rebuilt: ${this.scheduledJobs.size} active jobs, ${newEntries.size} items scanned, ${this.notifiedKeys.size} notified keys`);
    this.checkHabitReminders();
  }

  /**
   * 检查习惯提醒
   */
  private checkHabitReminders(): void {
    if (!this.projectStore) return;
    if (typeof this.projectStore.getHabits !== 'function') return;

    const now = Date.now();
    const currentDate = this.projectStore.currentDate;
    const habits = this.projectStore.getHabits('');

    const habitReminders = getHabitsNeedingReminder(habits, currentDate, now);

    for (const { habit, key } of habitReminders) {
      if (this.notifiedKeys.has(key)) continue;

      const title = `🎯 ${habit.name}`;
      const body = habit.type === 'count'
        ? `${habit.name} ${habit.target || 0}${habit.unit || ''}`
        : habit.name;

      showSystemNotification(title, body, {
        tag: `habit-reminder-${habit.blockId}`,
        icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
        onClick: () => {
          window.open(`siyuan://blocks/${habit.blockId}`, '_blank');
        },
      });

      this.notifiedKeys.add(key);
      this.scheduleCleanup(key);

      console.log(`[ReminderService] Habit notification triggered: ${habit.name}`);
    }
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
