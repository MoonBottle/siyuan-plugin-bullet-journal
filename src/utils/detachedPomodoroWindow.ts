import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

export type DetachedPomodoroAction = 'pause' | 'resume' | 'complete';

export interface DetachedPomodoroWindowHost {
  isAvailable(): boolean;
  show(state: FloatingPomodoroViewState): void;
  update(state: FloatingPomodoroViewState): void;
  hide(): void;
  destroy(): void;
}

interface RemoteLike {
  BrowserWindow: new (options: Record<string, unknown>) => BrowserWindowLike;
}

interface BrowserWindowLike {
  loadURL?: (url: string) => void;
  showInactive?: () => void;
  show?: () => void;
  close?: () => void;
  isDestroyed?: () => boolean;
  isVisible?: () => boolean;
  webContents?: {
    executeJavaScript?: (code: string) => Promise<unknown> | unknown;
    on?: (event: string, listener: (...args: any[]) => void) => void;
  };
  on?: (event: string, listener: (...args: any[]) => void) => void;
  once?: (event: string, listener: (...args: any[]) => void) => void;
  setAlwaysOnTop?: (flag: boolean, level?: string) => void;
  setVisibleOnAllWorkspaces?: (
    visible: boolean,
    options?: { visibleOnFullScreen?: boolean }
  ) => void;
}

interface DetachedPomodoroWindowSupportInput {
  frontEnd: string | undefined;
  runtimeRequire?: ((id: string) => any) | undefined;
}

interface CreateDetachedPomodoroWindowHostOptions
  extends DetachedPomodoroWindowSupportInput {
  createMarkup: () => string;
  applyViewState: (
    host: HTMLElement,
    state: FloatingPomodoroViewState
  ) => void;
  onAction: (action: DetachedPomodoroAction) => void;
}

const ROOT_ID = 'bullet-journal-detached-pomodoro-root';
const UPDATE_FN = '__BULLET_JOURNAL_POMODORO_UPDATE__';
const ACTION_CHANNEL = 'bullet-journal:detached-pomodoro-action';
const DETACHED_HOST_CLASS = 'detached-floating-tomato';

export function detectDetachedPomodoroWindowSupport(
  input: DetachedPomodoroWindowSupportInput
): boolean {
  if (input.frontEnd !== 'desktop' || !input.runtimeRequire) {
    return false;
  }

  try {
    const remote = input.runtimeRequire('@electron/remote');
    return typeof remote?.BrowserWindow === 'function';
  } catch {
    return false;
  }
}

export function createDetachedPomodoroWindowHost(
  options: CreateDetachedPomodoroWindowHostOptions
): DetachedPomodoroWindowHost {
  const remote = getRemote(options);
  if (!remote) {
    return createNoopHost();
  }

  let detachedWindow: BrowserWindowLike | null = null;
  let lastRenderedPayload: RenderedPayload | null = null;

  const handleActionMessage = (_event: unknown, channel: string, action: DetachedPomodoroAction) => {
    if (channel !== ACTION_CHANNEL) {
      return;
    }
    if (action === 'pause' || action === 'resume' || action === 'complete') {
      options.onAction(action);
    }
  };

  const ensureWindow = () => {
    if (detachedWindow && !detachedWindow.isDestroyed?.()) {
      return detachedWindow;
    }

    detachedWindow = new remote.BrowserWindow({
      width: 360,
      height: 84,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
      },
    });

    detachedWindow.setAlwaysOnTop?.(true, 'screen-saver');
    detachedWindow.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
    detachedWindow.webContents?.on?.('ipc-message', handleActionMessage);
    detachedWindow.loadURL?.(
      `data:text/html;charset=UTF-8,${encodeURIComponent(buildDetachedWindowHtml())}`
    );
    detachedWindow.once?.('ready-to-show', () => {
      detachedWindow?.showInactive?.();
      if (!detachedWindow?.isVisible?.()) {
        detachedWindow?.show?.();
      }
      if (lastRenderedPayload) {
        syncPayload(lastRenderedPayload);
      }
    });

    return detachedWindow;
  };

  const renderPayload = (state: FloatingPomodoroViewState): RenderedPayload => {
    const host = document.createElement('div');
    host.className = `floating-tomato-btn ${DETACHED_HOST_CLASS}`;
    host.innerHTML = options.createMarkup();
    options.applyViewState(host, state);
    return {
      className: host.className,
      innerHTML: host.innerHTML,
      state: {
        phase: state.phase,
        isPaused: state.isPaused,
      },
    };
  };

  const syncPayload = (payload: RenderedPayload) => {
    const currentWindow = ensureWindow();
    const script = `window.${UPDATE_FN}(${JSON.stringify(payload)});`;
    currentWindow.webContents?.executeJavaScript?.(script);
    currentWindow.showInactive?.();
    if (!currentWindow.isVisible?.()) {
      currentWindow.show?.();
    }
  };

  return {
    isAvailable: () => true,
    show: (state) => {
      lastRenderedPayload = renderPayload(state);
      syncPayload(lastRenderedPayload);
    },
    update: (state) => {
      lastRenderedPayload = renderPayload(state);
      syncPayload(lastRenderedPayload);
    },
    hide: () => {
      closeDetachedWindow(detachedWindow);
      detachedWindow = null;
    },
    destroy: () => {
      closeDetachedWindow(detachedWindow);
      detachedWindow = null;
      lastRenderedPayload = null;
    },
  };
}

function getRemote(
  options: DetachedPomodoroWindowSupportInput
): RemoteLike | null {
  if (!detectDetachedPomodoroWindowSupport(options)) {
    return null;
  }

  try {
    return options.runtimeRequire?.('@electron/remote') ?? null;
  } catch {
    return null;
  }
}

function createNoopHost(): DetachedPomodoroWindowHost {
  return {
    isAvailable: () => false,
    show: () => {},
    update: () => {},
    hide: () => {},
    destroy: () => {},
  };
}

function closeDetachedWindow(windowInstance: BrowserWindowLike | null) {
  if (!windowInstance || windowInstance.isDestroyed?.()) {
    return;
  }

  windowInstance.close?.();
}

function buildDetachedWindowHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
        padding: 8px 10px;
        font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      #${ROOT_ID} {
        display: inline-flex;
      }
      .floating-tomato-btn {
        width: 348px;
        min-height: 50px;
        border-radius: 999px;
        background: var(--b3-theme-surface, #f7f1e8);
        color: var(--b3-theme-on-surface, #6f6255);
        border: 1px solid var(--b3-border-color, rgba(129, 110, 91, 0.18));
        overflow: hidden;
        user-select: none;
        touch-action: none;
      }
      .floating-tomato-shell {
        min-height: 50px;
      }
      .floating-tomato-main {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        min-height: 50px;
        padding: 7px 12px 7px 10px;
        -webkit-app-region: drag;
      }
      .floating-tomato-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        color: var(--b3-theme-primary, #d67a4d);
        flex: 0 0 auto;
      }
      .floating-tomato-icon svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .floating-tomato-summary {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        justify-content: center;
        margin-left: 5px;
        padding-right: 0;
      }
      .floating-tomato-topline {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .floating-tomato-primary {
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        letter-spacing: 0;
      }
      .floating-tomato-status {
        display: block;
        color: var(--b3-theme-primary, #d67a4d);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .floating-tomato-item {
        display: none;
        font-size: 12px;
        font-weight: 500;
        color: var(--b3-theme-on-surface, #6f6255);
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .floating-tomato-btn.has-item-title .floating-tomato-item {
        display: block;
      }
      .floating-tomato-secondary {
        display: block;
        font-size: 11px;
        color: var(--b3-theme-on-surface-light, #9a8d81);
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .floating-tomato-actions {
        display: flex;
        align-items: center;
        align-self: center;
        gap: 6px;
        margin-left: auto;
        -webkit-app-region: no-drag;
      }
      .floating-tomato-action {
        border: none;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 10px;
        font-weight: 500;
        line-height: 1;
        color: var(--b3-theme-on-background, #6f6255);
        background: var(--b3-theme-surface-lighter, rgba(129, 110, 91, 0.08));
        cursor: pointer;
        white-space: nowrap;
      }
      .floating-tomato-action[hidden] {
        display: none !important;
      }
      .floating-tomato-action--complete {
        color: var(--b3-theme-primary, #d67a4d);
        background: rgba(214, 122, 77, 0.12);
      }
      .floating-tomato-progress,
      .floating-tomato-progress-fill {
        display: none;
      }
      .floating-tomato-btn.is-break .floating-tomato-icon,
      .floating-tomato-btn.is-break .floating-tomato-status {
        color: var(--b3-card-success-color, #4d8b63);
      }
      .floating-tomato-btn.is-paused .floating-tomato-icon,
      .floating-tomato-btn.is-paused .floating-tomato-status {
        color: var(--b3-card-warning-color, #c68a3c);
      }
    </style>
  </head>
  <body>
    <div id="${ROOT_ID}"></div>
    <script>
      (() => {
        const root = document.getElementById('${ROOT_ID}');
        let currentState = { phase: 'focus', isPaused: false };
        const sendAction = (action) => {
          try {
            const electron = window.require?.('electron');
            electron?.ipcRenderer?.send?.('${ACTION_CHANNEL}', action);
          } catch {}
        };
        window.${UPDATE_FN} = (payload) => {
          if (!root || !payload) return;
          currentState = payload.state || currentState;
          root.className = payload.className || '';
          root.innerHTML = payload.innerHTML || '';
        };
        document.addEventListener('click', (event) => {
          const actionEl = event.target instanceof Element
            ? event.target.closest('[data-action]')
            : null;
          if (!actionEl) return;
          const action = actionEl.getAttribute('data-action');
          if (action === 'pause') {
            sendAction(currentState.isPaused ? 'resume' : 'pause');
            return;
          }
          if (action === 'complete') {
            sendAction('complete');
          }
        });
      })();
    </script>
  </body>
</html>`;
}

interface RenderedPayload {
  className: string;
  innerHTML: string;
  state: {
    phase: FloatingPomodoroViewState['phase'];
    isPaused: boolean;
  };
}
