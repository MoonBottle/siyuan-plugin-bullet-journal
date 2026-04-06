/**
 * 提醒调度服务
 * 从 ProjectStore 实时读取需要提醒的事项
 */

import type { Plugin } from 'siyuan';
import type { Item } from '@/types/models';
import type { ProjectStore } from '@/stores/projectStore';
import { showSystemNotification } from '@/utils/notification';

export class ReminderService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private notifiedKeys: Set<string> = new Set(); // 已提醒的 key（blockId-date）
  private projectStore: ProjectStore | null = null;
  private readonly CHECK_INTERVAL_MS = 10000; // 10秒检查一次

  /**
   * 启动提醒服务
   */
  start(plugin: Plugin, projectStore: ProjectStore): void {
    this.projectStore = projectStore;

    // 启动定时检查
    this.checkInterval = setInterval(() => {
      this.checkReminders(plugin);
    }, this.CHECK_INTERVAL_MS);

    // 请求通知权限
    this.requestNotificationPermission();

    console.log('[ReminderService] Started');
  }

  /**
   * 停止提醒服务
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.projectStore = null;
    console.log('[ReminderService] Stopped');
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
   * 检查并触发提醒
   */
  private async checkReminders(plugin: Plugin): Promise<void> {
    if (!this.projectStore) {
      console.log('[ReminderService] No projectStore, skipping check');
      return;
    }

    const now = Date.now();
    const nowStr = new Date(now).toLocaleString();
    const items = this.projectStore.itemsNeedingReminder;

    console.log(`[ReminderService] Checking reminders at ${nowStr}, found ${items.length} items`);

    for (const item of items) {
      const reminderTime = (item as any)._reminderTime || 0;
      const reminderTimeStr = new Date(reminderTime).toLocaleString();
      const diff = reminderTime - now;

      console.log(`[ReminderService] Checking: "${item.content.substring(0, 20)}..." | reminderTime=${reminderTimeStr} | diff=${diff}ms | now=${now}`);

      // 检查是否到时间（允许10秒误差）
      if (reminderTime <= now && reminderTime > now - 10000) {
        const key = `${item.blockId}-${item.date}`;
        console.log(`[ReminderService] Time matched for "${item.content.substring(0, 20)}..." | key=${key} | alreadyNotified=${this.notifiedKeys.has(key)}`);

        if (!this.notifiedKeys.has(key)) {
          await this.triggerNotification(plugin, item);
          this.notifiedKeys.add(key);

          // 24小时后清理（避免内存泄漏）
          setTimeout(() => this.notifiedKeys.delete(key), 24 * 60 * 60 * 1000);
        }
      }

      // 列表已排序，如果当前提醒时间 > now + 10秒，后面的都不用检查
      if (reminderTime > now + 10000) {
        console.log(`[ReminderService] Breaking early: reminderTime > now + 10s`);
        break;
      }
    }
  }

  /**
   * 触发通知
   */
  private async triggerNotification(_plugin: Plugin, item: Item): Promise<void> {
    const title = `⏰ ${item.project?.name || '提醒'}`;
    const body = item.task?.name
      ? `${item.task.name}: ${item.content}`
      : item.content;

    // 显示系统通知
    showSystemNotification(title, body, {
      tag: `reminder-${item.blockId}`,
      icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
      onClick: () => {
        // 跳转到对应块
        this.openBlock(item.blockId);
      }
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
}

// 导出单例
export const reminderService = new ReminderService();
