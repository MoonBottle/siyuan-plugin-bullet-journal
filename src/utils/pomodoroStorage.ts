/**
 * 番茄钟文件存储工具
 * 使用思源 putFile/getFile/removeFile 接口管理进行中的番茄钟
 */

import type { ActivePomodoroData, PendingPomodoroCompletion } from '@/types/models';

const PENDING_COMPLETION_KEY = 'pending-pomodoro-completion.json';

// 文件路径
const ACTIVE_POMODORO_PATH = '/data/storage/pensieve/bullet-journal/active-pomodoro.json';

/**
 * 保存进行中的番茄钟到文件
 * @param plugin 思源插件实例
 * @param data 番茄钟数据
 * @returns 是否成功
 */
export async function saveActivePomodoro(
  plugin: any,
  data: ActivePomodoroData
): Promise<boolean> {
  try {
    if (!plugin) {
      console.error('[PomodoroStorage] 插件实例不存在');
      return false;
    }

    const content = JSON.stringify(data, null, 2);
    await plugin.saveData('active-pomodoro.json', content);

    console.log('[PomodoroStorage] 已保存进行中的番茄钟:', data.itemContent);
    return true;
  } catch (error) {
    console.error('[PomodoroStorage] 保存番茄钟失败:', error);
    return false;
  }
}

/**
 * 读取进行中的番茄钟
 * @param plugin 思源插件实例
 * @returns 番茄钟数据或 null
 */
export async function loadActivePomodoro(
  plugin: any
): Promise<ActivePomodoroData | null> {
  try {
    if (!plugin) {
      console.error('[PomodoroStorage] 插件实例不存在');
      return null;
    }

    const content = await plugin.loadData('active-pomodoro.json');
    if (!content) {
      return null;
    }

    // 如果返回的已经是对象，直接返回
    if (typeof content === 'object' && content !== null) {
      console.log('[PomodoroStorage] 已读取进行中的番茄钟:', content.itemContent);
      return content as ActivePomodoroData;
    }

    // 如果是字符串，解析 JSON
    const data = JSON.parse(content) as ActivePomodoroData;
    console.log('[PomodoroStorage] 已读取进行中的番茄钟:', data.itemContent);
    return data;
  } catch (error) {
    console.error('[PomodoroStorage] 读取番茄钟失败:', error);
    return null;
  }
}

/**
 * 删除进行中的番茄钟文件
 * @param plugin 思源插件实例
 * @returns 是否成功
 */
export async function removeActivePomodoro(
  plugin: any
): Promise<boolean> {
  try {
    if (!plugin) {
      console.error('[PomodoroStorage] 插件实例不存在');
      return false;
    }

    await plugin.removeData('active-pomodoro.json');
    console.log('[PomodoroStorage] 已删除进行中的番茄钟文件');
    return true;
  } catch (error) {
    console.error('[PomodoroStorage] 删除番茄钟文件失败:', error);
    return false;
  }
}

/**
 * 检查是否有进行中的番茄钟
 * @param plugin 思源插件实例
 * @returns 是否有进行中的番茄钟
 */
export async function hasActivePomodoro(
  plugin: any
): Promise<boolean> {
  try {
    if (!plugin) {
      return false;
    }

    const content = await plugin.loadData('active-pomodoro.json');
    return !!content;
  } catch {
    return false;
  }
}

/**
 * 保存待完成番茄钟记录（弹窗补填说明前持久化，重启可恢复）
 */
export async function savePendingCompletion(
  plugin: any,
  data: PendingPomodoroCompletion
): Promise<boolean> {
  try {
    if (!plugin) {
      console.error('[PomodoroStorage] 插件实例不存在');
      return false;
    }
    const content = JSON.stringify(data, null, 2);
    await plugin.saveData(PENDING_COMPLETION_KEY, content);
    console.log('[PomodoroStorage] 已保存待完成记录:', data.itemContent);
    return true;
  } catch (error) {
    console.error('[PomodoroStorage] 保存待完成记录失败:', error);
    return false;
  }
}

/**
 * 读取待完成番茄钟记录
 */
export async function loadPendingCompletion(
  plugin: any
): Promise<PendingPomodoroCompletion | null> {
  try {
    if (!plugin) return null;
    const content = await plugin.loadData(PENDING_COMPLETION_KEY);
    if (!content) return null;
    if (typeof content === 'object' && content !== null) {
      return content as PendingPomodoroCompletion;
    }
    return JSON.parse(content) as PendingPomodoroCompletion;
  } catch (error) {
    console.error('[PomodoroStorage] 读取待完成记录失败:', error);
    return null;
  }
}

/**
 * 删除待完成番茄钟记录
 */
export async function removePendingCompletion(plugin: any): Promise<boolean> {
  try {
    if (!plugin) return false;
    await plugin.removeData(PENDING_COMPLETION_KEY);
    console.log('[PomodoroStorage] 已删除待完成记录');
    return true;
  } catch (error) {
    console.error('[PomodoroStorage] 删除待完成记录失败:', error);
    return false;
  }
}

/**
 * 检查是否有待完成记录
 */
export async function hasPendingCompletion(plugin: any): Promise<boolean> {
  try {
    if (!plugin) return false;
    const content = await plugin.loadData(PENDING_COMPLETION_KEY);
    return !!content;
  } catch {
    return false;
  }
}
