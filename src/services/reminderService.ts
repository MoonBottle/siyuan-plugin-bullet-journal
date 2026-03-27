/**
 * 提醒调度服务
 */

import type { Plugin } from 'siyuan';
import type { Item } from '@/types/models';
import { calculateReminderTime } from '@/parser/reminderParser';
import {
  saveReminder,
  getPendingReminders,
  deleteAfterNotified,
  deleteReminderByBlockId,
  getRemindersByBlockId,
  saveChecksums,
  loadChecksums
} from '@/utils/reminderStorage';
import type { ReminderRecord } from '@/utils/reminderStorage';
import { showSystemNotification } from '@/utils/notification';

export class ReminderService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private reminders: ReminderRecord[] = [];
  private reminderChecksums: Map<string, string> = new Map();
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // 60秒检查一次
  private readonly SYNC_DEBOUNCE_MS = 300;

  /**
   * 启动提醒服务
   */
  start(plugin: Plugin): void {
    // 1. 加载上次同步的 checksums
    this.loadChecksums(plugin);

    // 2. 加载待提醒列表
    this.loadReminders(plugin);

    // 3. 启动定时检查
    this.checkInterval = setInterval(() => {
      this.checkReminders(plugin);
    }, this.CHECK_INTERVAL_MS);

    // 4. 请求通知权限
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
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
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
   * 增量同步提醒（带防抖）
   */
  async syncRemindersFromProjects(plugin: Plugin, items: Item[]): Promise<void> {
    // 清除之前的定时器
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      await this.performIncrementalSync(plugin, items);
    }, this.SYNC_DEBOUNCE_MS);
  }

  /**
   * 执行增量同步
   */
  private async performIncrementalSync(plugin: Plugin, items: Item[]): Promise<void> {
    const currentChecksums = new Map<string, string>();
    const itemsWithReminder = items.filter(item => item.reminder?.enabled);

    // 1. 计算当前所有提醒的 checksum（必须包含日期）
    for (const item of itemsWithReminder) {
      const checksum = this.calculateReminderChecksum(item);
      currentChecksums.set(item.blockId || '', checksum);
    }

    // 2. 找出新增的提醒
    for (const [blockId, checksum] of currentChecksums) {
      if (!blockId) continue;
      
      const oldChecksum = this.reminderChecksums.get(blockId);
      if (oldChecksum !== checksum) {
        const item = itemsWithReminder.find(i => i.blockId === blockId);
        if (item) {
          await this.upsertReminder(plugin, item);
        }
      }
    }

    // 3. 找出删除的提醒
    for (const [blockId] of this.reminderChecksums) {
      if (!currentChecksums.has(blockId)) {
        await deleteReminderByBlockId(plugin, blockId);
      }
    }

    // 4. 更新 checksums 缓存
    this.reminderChecksums = currentChecksums;
    await saveChecksums(plugin, this.reminderChecksums);

    // 5. 重新加载待提醒列表
    await this.loadReminders(plugin);
  }

  /**
   * 计算提醒配置的 checksum（关键：必须包含日期）
   */
  private calculateReminderChecksum(item: Item): string {
    const reminder = item.reminder!;
    const data = {
      date: item.date,
      time: reminder.time,
      relativeTo: reminder.relativeTo,
      offsetMinutes: reminder.offsetMinutes,
      type: reminder.type
    };
    return this.hashString(JSON.stringify(data));
  }

  /**
   * 简单的 hash 函数
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 新增或更新提醒记录
   */
  private async upsertReminder(plugin: Plugin, item: Item): Promise<void> {
    if (!item.blockId || !item.reminder) return;

    const existing = await getRemindersByBlockId(plugin, item.blockId);

    // 计算提醒时间
    const startTime = item.startDateTime?.split(' ')[1];
    const endTime = item.endDateTime?.split(' ')[1];
    const nextReminderTime = calculateReminderTime(
      item.date,
      startTime,
      endTime,
      item.reminder
    );

    if (existing.length > 0) {
      // 更新现有记录
      for (const reminder of existing) {
        reminder.reminderTime = item.reminder.time || '00:00';
        reminder.alertMode = item.reminder.alertMode;
        reminder.nextReminderTime = nextReminderTime;
        reminder.updatedAt = Date.now();
        await saveReminder(plugin, reminder);
      }
    } else {
      // 创建新记录
      const newReminder: ReminderRecord = {
        id: this.generateId(),
        blockId: item.blockId,
        itemContent: item.content,
        projectName: item.project?.name,
        taskName: item.task?.name,
        reminderTime: item.reminder.time || '00:00',
        alertMode: item.reminder.alertMode,
        nextReminderTime,
        notifiedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await saveReminder(plugin, newReminder);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查并触发提醒
   */
  private async checkReminders(plugin: Plugin): Promise<void> {
    const now = Date.now();
    const remindersToNotify: ReminderRecord[] = [];

    for (const reminder of this.reminders) {
      if (reminder.nextReminderTime <= now) {
        remindersToNotify.push(reminder);
      }
    }

    // 触发提醒
    for (const reminder of remindersToNotify) {
      await this.triggerNotification(plugin, reminder);
      await deleteAfterNotified(plugin, reminder.id);
    }

    // 重新加载列表
    if (remindersToNotify.length > 0) {
      await this.loadReminders(plugin);
    }
  }

  /**
   * 触发通知
   */
  private async triggerNotification(_plugin: Plugin, reminder: ReminderRecord): Promise<void> {
    const title = `⏰ ${reminder.projectName || '提醒'}`;
    const body = reminder.taskName
      ? `${reminder.taskName}: ${reminder.itemContent}`
      : reminder.itemContent;

    // 显示系统通知
    showSystemNotification(title, body, {
      tag: `reminder-${reminder.id}`,
      icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
      onClick: () => {
        // 跳转到对应块
        this.openBlock(reminder.blockId);
      }
    });

    console.log(`[ReminderService] Notification triggered: ${reminder.itemContent}`);
  }

  /**
   * 打开对应块（需要思源 API）
   */
  private openBlock(blockId: string): void {
    // 通过思源协议打开
    window.open(`siyuan://blocks/${blockId}`, '_blank');
  }

  /**
   * 加载待提醒列表到内存
   */
  private async loadReminders(plugin: Plugin): Promise<void> {
    this.reminders = await getPendingReminders(plugin);
  }

  /**
   * 加载 checksums
   */
  private async loadChecksums(plugin: Plugin): Promise<void> {
    this.reminderChecksums = await loadChecksums(plugin);
  }

  /**
   * 监听事项状态变化
   * 当事项完成或放弃时，删除关联提醒
   */
  async onItemStatusChanged(
    plugin: Plugin,
    blockId: string,
    status: 'pending' | 'completed' | 'abandoned'
  ): Promise<void> {
    if (status === 'completed' || status === 'abandoned') {
      await deleteReminderByBlockId(plugin, blockId);
      await this.loadReminders(plugin);
    }
  }
}

// 导出单例
export const reminderService = new ReminderService();
