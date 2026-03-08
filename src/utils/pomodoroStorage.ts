/**
 * 番茄钟文件存储工具
 * 使用思源 putFile/getFile/removeFile 接口管理进行中的番茄钟
 */

import type { ActivePomodoroData } from '@/types/models';

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
