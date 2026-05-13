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

export type RefreshRequestPayload
  = | { type: 'settings-only'; payload?: Record<string, unknown> }
    | { type: 'directed'; docIds: string[]; reason?: string; payload?: Record<string, unknown> }
    | { type: 'full'; reason: string; payload?: Record<string, unknown> };

export const RefreshReasons = {
  ON_DATA_CHANGED: 'onDataChanged',
  LOCAL_MUTATION: 'local-mutation',
  LOCAL_MUTATION_MISSING_BLOCK_ID: 'local-mutation-missing-block-id',
  LOCAL_MUTATION_UNRESOLVED_DOC: 'local-mutation-unresolved-doc',
  INDEX_SET_PROJECT_DIRECTORIES: 'index:set-project-directories',
  INDEX_CREATE_NEXT_OCCURRENCE: 'index:create-next-occurrence',
  REMOVE_DOC: 'removeDoc',
  SLASH_COMMAND_HABIT_DATA: 'slash-command:habit-data',
  SLASH_COMMAND_SET_PROJECT_DIR: 'slash-command:set-project-dir',
  SETTINGS_DIALOG_SAVE: 'settings-dialog:save',
  AI_TOOLS_CREATE_PROJECT_DOC: 'ai-tools:create-project-doc',
  POMODORO_STORE_SAVE_RECORD: 'pomodoro-store:save-record',
} as const;

export const WS_MAIN_FULL_REFRESH_COMMANDS = [
  'txerr',
  'refreshdoc',
  'createdailynote',
  'moveDoc',
] as const;

export function isWsMainFullRefreshCommand(cmd?: string): cmd is typeof WS_MAIN_FULL_REFRESH_COMMANDS[number] {
  return typeof cmd === 'string' && WS_MAIN_FULL_REFRESH_COMMANDS.includes(
    cmd as typeof WS_MAIN_FULL_REFRESH_COMMANDS[number],
  );
}

export function createWsMainFullRefreshReason(cmd: typeof WS_MAIN_FULL_REFRESH_COMMANDS[number]): string {
  return cmd;
}

export function createMissingRootIdsRefreshReason(cmd?: string): string {
  return `${cmd || 'ws-main'}:missing-rootIDs`;
}

export function createWsMainDirectedRefreshReason(cmd?: string): string {
  return cmd || 'ws-main-directed';
}

export function createSettingsOnlyRefreshRequest(
  payload?: Record<string, unknown>,
): RefreshRequestPayload {
  return payload === undefined
    ? { type: 'settings-only' }
    : { type: 'settings-only', payload };
}

export function createDirectedRefreshRequest(
  docIds: string[],
  options?: { reason?: string; payload?: Record<string, unknown> },
): RefreshRequestPayload {
  const request: RefreshRequestPayload = {
    type: 'directed',
    docIds,
  };

  if (options?.reason) {
    request.reason = options.reason;
  }
  if (options?.payload) {
    request.payload = options.payload;
  }

  return request;
}

export function createFullRefreshRequest(
  reason: string,
  payload?: Record<string, unknown>,
): RefreshRequestPayload {
  return payload === undefined
    ? { type: 'full', reason }
    : { type: 'full', reason, payload };
}

/** BroadcastChannel 名称，用于跨 iframe/上下文通知（如 Dock 与主窗口分离时） */
export const DATA_REFRESH_CHANNEL = 'siyuan-bullet-journal-data-refresh';

export function broadcastSettingsChanged(payload?: object): void {
  try {
    const channel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    channel.postMessage({ type: 'SETTINGS_CHANGED', ...payload });
    channel.close();
  } catch {
    // 忽略不支持或跨源场景
  }
}

export function broadcastDataRefreshed(): void {
  try {
    const channel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    channel.postMessage({ type: 'DATA_REFRESHED' });
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
  REFRESH_REQUEST_SUBMITTED: 'refresh:request-submitted',
  LOCAL_DATA_MUTATED: 'data:mutated',
  DATA_REFRESHED: 'data:refreshed', // 数据已刷新完成（用于通知其他模块）
  SETTINGS_CHANGED: 'settings:changed',
  DOCUMENT_CHANGED: 'document:changed',
  CALENDAR_NAVIGATE: 'calendar:navigate', // 导航到指定日期
  CALENDAR_CHANGE_VIEW: 'calendar:change-view', // 切换日历视图
  MOBILE_MAIN_SHELL_NAVIGATE: 'mobile-main-shell:navigate',
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

export function submitRefreshRequest(request: RefreshRequestPayload): void {
  eventBus.emit(Events.REFRESH_REQUEST_SUBMITTED, request);
}
