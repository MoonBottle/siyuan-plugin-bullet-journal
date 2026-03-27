/**
 * 提醒数据存储层
 */

import type { Plugin } from 'siyuan';
import type { ReminderConfig } from '@/types/models';

// 提醒记录
export interface ReminderRecord {
  id: string;
  blockId: string;
  itemContent: string;
  projectName?: string;
  taskName?: string;
  reminderTime: string;
  alertMode: ReminderConfig['alertMode'];
  nextReminderTime: number;  // 时间戳（毫秒）
  notifiedCount: number;
  createdAt: number;
  updatedAt: number;
}

// 提醒配置（存储到思源插件数据）
const PENDING_FILE = 'reminders/pending.json';
const CHECKSUMS_FILE = 'reminders/checksums.json';

/**
 * 确保目录存在
 */
async function ensureDir(_plugin: Plugin): Promise<void> {
  // 思源 API 会自动创建目录，这里不需要额外操作
}

/**
 * 保存提醒记录
 */
export async function saveReminder(
  plugin: Plugin,
  record: ReminderRecord
): Promise<void> {
  await ensureDir(plugin);
  
  const reminders = await loadPendingReminders(plugin);
  
  // 查找是否已存在
  const existingIndex = record.id
    ? reminders.findIndex(r => r.id === record.id)
    : -1;
  
  if (existingIndex >= 0) {
    // 更新现有记录
    reminders[existingIndex] = { ...reminders[existingIndex], ...record, updatedAt: Date.now() };
  } else {
    // 插入新记录（保持按时间排序）
    const insertIndex = reminders.findIndex(r => r.nextReminderTime > record.nextReminderTime);
    if (insertIndex >= 0) {
      reminders.splice(insertIndex, 0, record);
    } else {
      reminders.push(record);
    }
  }
  
  await plugin.saveData(PENDING_FILE, reminders);
}

/**
 * 获取所有待提醒记录（过滤已过期）
 */
export async function getPendingReminders(plugin: Plugin): Promise<ReminderRecord[]> {
  return loadPendingReminders(plugin);
}

/**
 * 获取所有提醒记录（不过滤）
 */
export async function loadAllReminders(plugin: Plugin): Promise<ReminderRecord[]> {
  try {
    const reminders = await plugin.loadData(PENDING_FILE);
    return reminders || [];
  } catch (e) {
    return [];
  }
}

/**
 * 加载待提醒列表（内部使用）
 */
async function loadPendingReminders(plugin: Plugin): Promise<ReminderRecord[]> {
  try {
    const reminders: ReminderRecord[] = await plugin.loadData(PENDING_FILE) || [];
    const now = Date.now();
    // 过滤掉已过期（5分钟前）且未提醒的记录
    return reminders.filter(r => r.nextReminderTime > now - 5 * 60 * 1000);
  } catch (e) {
    return [];
  }
}

/**
 * 通知后删除记录（单次提醒）
 */
export async function deleteAfterNotified(
  plugin: Plugin,
  reminderId: string
): Promise<void> {
  const reminders = await loadAllReminders(plugin);
  const filtered = reminders.filter(r => r.id !== reminderId);
  await plugin.saveData(PENDING_FILE, filtered);
}

/**
 * 删除提醒记录（根据 blockId）
 */
export async function deleteReminderByBlockId(
  plugin: Plugin,
  blockId: string
): Promise<void> {
  const reminders = await loadAllReminders(plugin);
  const filtered = reminders.filter(r => r.blockId !== blockId);
  await plugin.saveData(PENDING_FILE, filtered);
}

/**
 * 根据 blockId 获取提醒记录
 */
export async function getRemindersByBlockId(
  plugin: Plugin,
  blockId: string
): Promise<ReminderRecord[]> {
  const reminders = await loadAllReminders(plugin);
  return reminders.filter(r => r.blockId === blockId);
}

/**
 * 保存 checksums 缓存（用于增量同步）
 */
export async function saveChecksums(
  plugin: Plugin,
  checksums: Map<string, string>
): Promise<void> {
  const data = Object.fromEntries(checksums);
  await plugin.saveData(CHECKSUMS_FILE, data);
}

/**
 * 加载 checksums 缓存
 */
export async function loadChecksums(plugin: Plugin): Promise<Map<string, string>> {
  try {
    const data = await plugin.loadData(CHECKSUMS_FILE);
    return new Map(Object.entries(data || {}));
  } catch (e) {
    return new Map();
  }
}

/**
 * 清除所有提醒数据（用于重置）
 */
export async function clearAllReminders(plugin: Plugin): Promise<void> {
  await plugin.saveData(PENDING_FILE, []);
  await plugin.saveData(CHECKSUMS_FILE, {});
}
