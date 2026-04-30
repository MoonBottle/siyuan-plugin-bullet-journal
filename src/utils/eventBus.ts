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
    console.log(`[Task Assistant] Event emitted: ${event}`, args);
    const handlers = this.handlers.get(event);
    if (handlers) {
      console.log(`[Task Assistant] Handlers count for ${event}: ${handlers.size}`);
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[Task Assistant] Error in event handler for ${event}:`, error);
        }
      });
    } else {
      console.log(`[Task Assistant] No handlers registered for ${event}`);
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
 * 通过 BroadcastChannel 发送 DATA_REFRESH，供无法收到 eventBus 的上下文（如 Dock）接收。
 * 同上下文可不传 payload（各端 loadFromPlugin）；跨上下文传入完整设置对象以便对端 $patch。
 */
export function broadcastDataRefresh(payload?: object): void {
  try {
    const channel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    channel.postMessage({ type: 'DATA_REFRESH', ...payload });
    channel.close();
  } catch {
    // 忽略不支持或跨源场景
  }
}

export function broadcastPluginUnloading(pluginInstanceId?: string): void {
  try {
    const channel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    channel.postMessage({ type: 'PLUGIN_UNLOADING', pluginInstanceId });
    channel.close();
  } catch {
    // 忽略不支持或跨源场景
  }
}

// 事件类型
export const Events = {
  DATA_REFRESH: 'data:refresh',
  DATA_REFRESHED: 'data:refreshed', // 数据已刷新完成（用于通知其他模块）
  SETTINGS_CHANGED: 'settings:changed',
  DOCUMENT_CHANGED: 'document:changed',
  CALENDAR_NAVIGATE: 'calendar:navigate', // 导航到指定日期
  CALENDAR_CHANGE_VIEW: 'calendar:change-view', // 切换日历视图
  HABIT_DOCK_NAVIGATE: 'habit-dock:navigate',
  POMODORO_STARTED: 'pomodoro:started',
  POMODORO_COMPLETED: 'pomodoro:completed',
  POMODORO_CANCELLED: 'pomodoro:cancelled',
  POMODORO_RESTORE: 'pomodoro:restore', // 恢复进行中的番茄钟
  POMODORO_PENDING_COMPLETION: 'pomodoro:pending-completion', // 待完成记录已持久化，需弹窗补填说明
  POMODORO_OPEN_TIMER_DIALOG: 'pomodoro:open-timer-dialog', // 打开开始专注弹框
  POMODORO_TICK: 'pomodoro:tick', // 专注每秒更新
  BREAK_TICK: 'break:tick', // 休息每秒更新
  BREAK_STARTED: 'break:started',
  BREAK_ENDED: 'break:ended',
  POMODORO_AUTO_EXTENDED: 'pomodoro:auto-extended', // 自动延迟番茄钟，通知弹窗关闭
};
