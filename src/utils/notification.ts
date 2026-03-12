/**
 * 系统级通知工具
 * 使用 Web Notifications API 发送桌面通知
 */

import { showMessage } from './dialog';
import { t } from '@/i18n';

/**
 * 检查浏览器是否支持 Notification API
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * 请求通知权限
 * @returns 是否获得权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.log('[Notification] 浏览器不支持 Notification API');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('[Notification] 用户已拒绝通知权限');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('[Notification] 请求通知权限失败:', error);
    return false;
  }
}

/**
 * 显示系统级通知
 * @param title 通知标题
 * @param body 通知内容
 * @param options 其他选项
 * @returns 通知实例或 null
 */
export function showSystemNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    onClick?: () => void;
    onClose?: () => void;
  }
): Notification | null {
  // 检查支持情况
  if (!isNotificationSupported()) {
    console.log('[Notification] 浏览器不支持 Notification API，回退到思源内部通知');
    showMessage(`${title}: ${body}`);
    return null;
  }

  // 检查权限
  if (Notification.permission !== 'granted') {
    console.log('[Notification] 没有通知权限，回退到思源内部通知');
    showMessage(`${title}: ${body}`);
    return null;
  }

  try {
    // 创建通知
    const notification = new Notification(title, {
      body,
      icon: options?.icon,
      tag: options?.tag,
      requireInteraction: true, // 保持通知直到用户交互
    });

    // 绑定事件
    if (options?.onClick) {
      notification.onclick = () => {
        options.onClick!();
        notification.close();
      };
    }

    if (options?.onClose) {
      notification.onclose = options.onClose;
    }

    // 自动关闭（5秒后）
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (error) {
    console.error('[Notification] 显示通知失败:', error);
    showMessage(`${title}: ${body}`);
    return null;
  }
}

/**
 * 显示专注完成通知
 * @param itemContent 事项内容
 * @param durationMinutes 专注时长（分钟）
 * @param onClick 点击回调
 */
export function showPomodoroCompleteNotification(
  itemContent: string,
  durationMinutes: number,
  onClick?: () => void
): Notification | null {
  const title = t('pomodoro').completeNotifyTitle;
  const body = t('pomodoro').completeNotifyBody.replace('{content}', itemContent).replace('{minutes}', String(durationMinutes));

  return showSystemNotification(title, body, {
    tag: 'pomodoro-complete',
    icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
    onClick,
  });
}
