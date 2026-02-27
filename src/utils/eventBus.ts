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
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[Bullet Journal] Error in event handler for ${event}:`, error);
        }
      });
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

// 事件类型
export const Events = {
  DATA_REFRESH: 'data:refresh',
  SETTINGS_CHANGED: 'settings:changed',
  DOCUMENT_CHANGED: 'document:changed',
  CALENDAR_NAVIGATE: 'calendar:navigate' // 导航到指定日期
};
