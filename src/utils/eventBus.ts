/**
 * 事件总线
 * 用于插件内部的组件通信
 */

type EventHandler = (...args: any[]) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /**
   * 订阅事件
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): void {
    console.log(`[Bullet Journal] Event emitted: ${event}`, args);
    const handlers = this.handlers.get(event);
    if (handlers) {
      console.log(`[Bullet Journal] Handlers count for ${event}: ${handlers.size}`);
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[Bullet Journal] Error in event handler for ${event}:`, error);
        }
      });
    } else {
      console.log(`[Bullet Journal] No handlers registered for ${event}`);
    }
  }

  /**
   * 清除所有事件
   */
  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();

/** BroadcastChannel 名称，用于跨 iframe/上下文通知（如 Dock 与主窗口分离时） */
export const DATA_REFRESH_CHANNEL = 'siyuan-bullet-journal-data-refresh';

/**
 * 通过 BroadcastChannel 发送 DATA_REFRESH，供无法收到 eventBus 的上下文（如 Dock）接收
 */
export function broadcastDataRefresh(payload?: { directories?: unknown[] }): void {
  try {
    const channel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    channel.postMessage({ type: 'DATA_REFRESH', ...payload });
    channel.close();
  } catch {
    // 忽略不支持或跨源场景
  }
}

// 事件类型
export const Events = {
  DATA_REFRESH: 'data:refresh',
  SETTINGS_CHANGED: 'settings:changed',
  DOCUMENT_CHANGED: 'document:changed',
  CALENDAR_NAVIGATE: 'calendar:navigate' // 导航到指定日期
};
