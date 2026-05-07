/**
 * 系统级通知工具
 * 优先使用思源原生通知，失败时回退到 Web Notifications API，再回退到站内消息
 */

import * as siyuan from 'siyuan';
import { showMessage } from './dialog';
import { t } from '@/i18n';
import { getCurrentPlugin } from '@/main';
import { useAIStore } from '@/stores/aiStore';
import { getSharedPinia } from '@/utils/sharedPinia';

/**
 * 检查浏览器是否支持 Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
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
 * 发送微信通知（fire-and-forget，不阻塞主流程）
 */
function sendWechatNotification(title: string, body: string): void {
  console.log('[Notification] sendWechatNotification called, title:', title);
  try {
    const pinia = getSharedPinia();
    if (!pinia) {
      console.warn('[Notification] getSharedPinia() returned null');
      return;
    }
    if (getCurrentPlugin()?.isMobile) {
      console.log('[Notification] mobile frontend detected, skip wechat notification');
      return;
    }
    const aiStore = useAIStore(pinia);
    console.log('[Notification] got aiStore, calling sendWechatNotification...');
    aiStore.sendWechatNotification(`${title}\n${body}`).then(() => {
      console.log('[Notification] sendWechatNotification completed');
    }).catch((err: unknown) => {
      console.error('[Notification] sendWechatNotification promise rejected:', err);
    });
  } catch (err) {
    console.error('[Notification] WeChat notification error:', err);
  }
}

/**
 * 显示系统级通知（内部实现）
 */
type NotificationOptions = {
  icon?: string;
  tag?: string;
  onClick?: () => void;
  onClose?: () => void;
};

type UnifiedNotificationResult = number | Notification | null;
type NativeNotificationApi = {
  sendNotification?: (options: {
    title?: string;
    body?: string;
    delayInSeconds?: number;
    channel?: string;
    timeoutType?: 'default' | 'never';
  }) => Promise<number>;
  cancelNotification?: (id: number) => void;
};

function buildNativeNotificationOptions(
  title: string,
  body: string,
  options?: NotificationOptions & { delayInSeconds?: number }
) {
  return {
    title,
    body,
    delayInSeconds: options?.delayInSeconds,
    channel: options?.tag,
    timeoutType: 'never' as const,
  };
}

function getNativeNotificationApi(): NativeNotificationApi {
  const platformUtils = (siyuan as { platformUtils?: NativeNotificationApi }).platformUtils;
  if (platformUtils?.sendNotification || platformUtils?.cancelNotification) {
    return platformUtils;
  }

  return siyuan as NativeNotificationApi;
}

function showFallbackMessage(title: string, body: string): null {
  showMessage(`${title}: ${body}`);
  return null;
}

function _showBrowserNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): Notification | null {
  if (!isNotificationSupported()) {
    console.log('[Notification] 浏览器不支持 Notification API，回退到思源内部通知');
    return showFallbackMessage(title, body);
  }

  if (Notification.permission !== 'granted') {
    console.log('[Notification] 没有通知权限，回退到思源内部通知');
    return showFallbackMessage(title, body);
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon,
      tag: options?.tag,
      requireInteraction: true,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        options.onClick!();
        notification.close();
      };
    }

    if (options?.onClose) {
      notification.onclose = options.onClose;
    }

    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (error) {
    console.error('[Notification] 显示通知失败:', error);
    return showFallbackMessage(title, body);
  }
}

async function sendNativeImmediateNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): Promise<number> {
  const { sendNotification } = getNativeNotificationApi();
  if (!sendNotification) {
    throw new Error('Native notification API unavailable');
  }

  // Native notifications in SiYuan do not expose click/close hooks to plugin code.
  return sendNotification(buildNativeNotificationOptions(title, body, options));
}

/**
 * 显示系统级通知
 * @param title 通知标题
 * @param body 通知内容
 * @param options 其他选项
 * @returns 通知实例或 null
 */
export async function showSystemNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): Promise<UnifiedNotificationResult> {
  let result: UnifiedNotificationResult = null;

  try {
    result = await sendNativeImmediateNotification(title, body, options);
  } catch (error) {
    console.error('[Notification] 原生通知失败，回退到浏览器通知:', error);
    result = _showBrowserNotification(title, body, options);
  }

  sendWechatNotification(title, body);

  return result;
}

export async function scheduleNativeNotification(
  title: string,
  body: string,
  delayInSeconds: number,
  options?: Omit<NotificationOptions, 'onClick' | 'onClose'>,
): Promise<number | null> {
  try {
    const { sendNotification } = getNativeNotificationApi();
    if (!sendNotification) {
      throw new Error('Native notification API unavailable');
    }

    return await sendNotification(buildNativeNotificationOptions(title, body, {
      ...options,
      delayInSeconds,
    }));
  } catch (error) {
    console.error('[Notification] 调度原生通知失败:', error);
    return null;
  }
}

export function cancelNativeNotification(id: number): void {
  getNativeNotificationApi().cancelNotification?.(id);
}

/**
 * 显示专注完成通知
 * @param itemContent 事项内容
 * @param durationMinutes 专注时长（分钟）
 * @param onClick 点击回调
 */
export async function showPomodoroCompleteNotification(
  itemContent: string,
  durationMinutes: number,
  onClick?: () => void,
): Promise<UnifiedNotificationResult> {
  const title = t('pomodoro').completeNotifyTitle;
  const body = t('pomodoro').completeNotifyBody.replace('{content}', itemContent).replace('{minutes}', String(durationMinutes));

  return showSystemNotification(title, body, {
    tag: 'pomodoro-complete',
    icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
    onClick,
  });
}
