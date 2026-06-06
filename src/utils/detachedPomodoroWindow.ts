import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState'

export type DetachedPomodoroAction = 'pause' | 'resume' | 'complete'

export interface DetachedPomodoroWindowHost {
  isAvailable: () => boolean
  show: (state: FloatingPomodoroViewState) => void
  update: (state: FloatingPomodoroViewState) => void
  hide: () => void
  destroy: () => void
}

interface RemoteLike {
  BrowserWindow: BrowserWindowConstructorLike
  screen?: {
    getPrimaryDisplay?: () => {
      workArea?: {
        x: number
        y: number
        width: number
        height: number
      }
    }
  }
}

interface BrowserWindowConstructorLike {
  new (options: Record<string, unknown>): BrowserWindowLike
  getAllWindows?: () => BrowserWindowLike[]
}

interface BrowserWindowLike {
  loadURL?: (url: string) => void
  showInactive?: () => void
  show?: () => void
  close?: () => void
  isDestroyed?: () => boolean
  isVisible?: () => boolean
  webContents?: {
    executeJavaScript?: (code: string) => Promise<unknown> | unknown
    on?: (event: string, listener: (...args: any[]) => void) => void
  }
  on?: (event: string, listener: (...args: any[]) => void) => void
  once?: (event: string, listener: (...args: any[]) => void) => void
  setAlwaysOnTop?: (flag: boolean, level?: string) => void
  getTitle?: () => string
  setPosition?: (x: number, y: number) => void
  setVisibleOnAllWorkspaces?: (
    visible: boolean,
    options?: { visibleOnFullScreen?: boolean },
  ) => void
}

interface DetachedPomodoroWindowSupportInput {
  frontEnd: string | undefined
  runtimeRequire?: ((id: string) => any) | undefined
}

interface CreateDetachedPomodoroWindowHostOptions
  extends DetachedPomodoroWindowSupportInput {
  createMarkup: () => string
  applyViewState: (
    host: HTMLElement,
    state: FloatingPomodoroViewState,
  ) => void
  onAction: (action: DetachedPomodoroAction) => void
}

const ROOT_ID = 'bullet-journal-detached-pomodoro-root'
const UPDATE_FN = '__BULLET_JOURNAL_POMODORO_UPDATE__'
const ACTION_CHANNEL = 'bullet-journal:detached-pomodoro-action'
const DETACHED_HOST_CLASS = 'detached-floating-tomato'
const DETACHED_WINDOW_TITLE = 'Bullet Journal Pomodoro Floating Window'
const DETACHED_WINDOW_WIDTH = 372
const DETACHED_WINDOW_HEIGHT = 84
const DETACHED_WINDOW_MARGIN_RIGHT = 24
const DETACHED_WINDOW_MARGIN_BOTTOM = 24
const THEME_VARIABLE_PREFIX = '--b3-'

export function detectDetachedPomodoroWindowSupport(
  input: DetachedPomodoroWindowSupportInput,
): boolean {
  if (input.frontEnd !== 'desktop' || !input.runtimeRequire) {
    return false
  }

  try {
    const remote = input.runtimeRequire('@electron/remote')
    return typeof remote?.BrowserWindow === 'function'
  } catch {
    return false
  }
}

export function createDetachedPomodoroWindowHost(
  options: CreateDetachedPomodoroWindowHostOptions,
): DetachedPomodoroWindowHost {
  const remote = getRemote(options)
  if (!remote) {
    return createNoopHost()
  }

  let detachedWindow: BrowserWindowLike | null = null
  let lastRenderedPayload: RenderedPayload | null = null

  const handleActionMessage = (_event: unknown, channel: string, action: DetachedPomodoroAction) => {
    if (channel !== ACTION_CHANNEL) {
      return
    }
    if (action === 'pause' || action === 'resume' || action === 'complete') {
      options.onAction(action)
    }
  }

  const syncPayload = (payload: RenderedPayload) => {
    const currentWindow = ensureWindow()
    const script = `window.${UPDATE_FN}(${JSON.stringify(payload)});`
    currentWindow.webContents?.executeJavaScript?.(script)
    currentWindow.showInactive?.()
    if (!currentWindow.isVisible?.()) {
      currentWindow.show?.()
    }
  }

  function ensureWindow() {
    if (detachedWindow && !detachedWindow.isDestroyed?.()) {
      return detachedWindow
    }

    closeLingeringDetachedPomodoroWindows(remote)

    detachedWindow = new remote.BrowserWindow({
      width: DETACHED_WINDOW_WIDTH,
      height: DETACHED_WINDOW_HEIGHT,
      title: DETACHED_WINDOW_TITLE,
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
    })

    positionDetachedWindow(detachedWindow, remote)
    detachedWindow.setAlwaysOnTop?.(true, 'screen-saver')
    detachedWindow.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true })
    detachedWindow.webContents?.on?.('ipc-message', handleActionMessage)
    detachedWindow.loadURL?.(
      `data:text/html;charset=UTF-8,${encodeURIComponent(buildDetachedWindowHtml())}`,
    )
    detachedWindow.once?.('ready-to-show', () => {
      detachedWindow?.showInactive?.()
      if (!detachedWindow?.isVisible?.()) {
        detachedWindow?.show?.()
      }
      if (lastRenderedPayload) {
        syncPayload(lastRenderedPayload)
      }
    })

    return detachedWindow
  }

  const renderPayload = (state: FloatingPomodoroViewState): RenderedPayload => {
    const host = document.createElement('div')
    host.className = `floating-tomato-btn ${DETACHED_HOST_CLASS}`
    host.innerHTML = options.createMarkup()
    options.applyViewState(host, state)
    return {
      className: host.className,
      innerHTML: host.innerHTML,
      themeStyleText: collectSiyuanThemeStyleText(),
      state: {
        phase: state.phase,
        isPaused: state.isPaused,
      },
    }
  }

  return {
    isAvailable: () => true,
    show: (state) => {
      lastRenderedPayload = renderPayload(state)
      syncPayload(lastRenderedPayload)
    },
    update: (state) => {
      lastRenderedPayload = renderPayload(state)
      syncPayload(lastRenderedPayload)
    },
    hide: () => {
      closeDetachedWindow(detachedWindow)
      detachedWindow = null
    },
    destroy: () => {
      closeDetachedWindow(detachedWindow)
      detachedWindow = null
      lastRenderedPayload = null
    },
  }
}

function getRemote(
  options: DetachedPomodoroWindowSupportInput,
): RemoteLike | null {
  if (!detectDetachedPomodoroWindowSupport(options)) {
    return null
  }

  try {
    return options.runtimeRequire?.('@electron/remote') ?? null
  } catch {
    return null
  }
}

function createNoopHost(): DetachedPomodoroWindowHost {
  return {
    isAvailable: () => false,
    show: () => {},
    update: () => {},
    hide: () => {},
    destroy: () => {},
  }
}

function closeDetachedWindow(windowInstance: BrowserWindowLike | null) {
  if (!windowInstance || windowInstance.isDestroyed?.()) {
    return
  }

  windowInstance.close?.()
}

function closeLingeringDetachedPomodoroWindows(remote: RemoteLike) {
  const allWindows = remote.BrowserWindow.getAllWindows?.() ?? []

  for (const windowInstance of allWindows) {
    if (windowInstance.isDestroyed?.()) {
      continue
    }

    if (windowInstance.getTitle?.() !== DETACHED_WINDOW_TITLE) {
      continue
    }

    windowInstance.close?.()
  }
}

function positionDetachedWindow(
  windowInstance: BrowserWindowLike,
  remote: RemoteLike,
) {
  const workArea = remote.screen?.getPrimaryDisplay?.()?.workArea
  if (!workArea) {
    return
  }

  const x =
    workArea.x
    + Math.max(0, workArea.width - DETACHED_WINDOW_WIDTH - DETACHED_WINDOW_MARGIN_RIGHT)
  const y =
    workArea.y
    + Math.max(0, workArea.height - DETACHED_WINDOW_HEIGHT - DETACHED_WINDOW_MARGIN_BOTTOM)

  windowInstance.setPosition?.(x, y)
}

function collectSiyuanThemeStyleText(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return ''
  }

  const computedStyle = window.getComputedStyle?.(document.documentElement)
  if (!computedStyle) {
    return ''
  }

  const declarations: string[] = []
  for (let index = 0; index < computedStyle.length; index += 1) {
    const propertyName = computedStyle.item(index)
    if (!propertyName.startsWith(THEME_VARIABLE_PREFIX)) {
      continue
    }

    const propertyValue = computedStyle.getPropertyValue(propertyName).trim()
    if (!propertyValue) {
      continue
    }

    declarations.push(`${propertyName}: ${propertyValue};`)
  }

  return declarations.join(' ')
}

function buildDetachedWindowHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html {
        margin: 0;
        padding: 0;
        background: transparent;
        width: 100%;
        height: 100%;
      }
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
        padding: 6px;
        font-family: var(--b3-font-family, "Inter", "PingFang SC", "Microsoft YaHei", sans-serif);
      }
      #${ROOT_ID} {
        display: block;
        overflow: hidden;
      }
      .floating-tomato-btn {
        display: block;
        width: 348px;
        min-height: 50px;
        border-radius: 999px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        border: 1px solid var(--b3-border-color);
        overflow: hidden;
        user-select: none;
        touch-action: none;
      }
      .floating-tomato-shell {
        width: 100%;
        min-height: 50px;
      }
      .floating-tomato-main {
        display: grid;
        width: 100%;
        box-sizing: border-box;
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
        color: var(--b3-theme-primary);
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
        color: var(--b3-theme-primary);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .floating-tomato-item {
        display: none;
        font-size: 12px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
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
        color: var(--b3-theme-on-surface-light);
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
        width: 24px;
        height: 24px;
        padding: 0;
        color: var(--b3-theme-on-background);
        background: var(--b3-theme-surface-lighter);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .floating-tomato-action svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .floating-tomato-action[hidden] {
        display: none !important;
      }
      .floating-tomato-action--complete {
        color: var(--b3-theme-primary);
        background: color-mix(
          in srgb,
          var(--b3-theme-primary) 12%,
          var(--b3-theme-surface) 88%
        );
      }
      .floating-tomato-progress,
      .floating-tomato-progress-fill {
        display: none;
      }
      .floating-tomato-btn.is-break .floating-tomato-icon,
      .floating-tomato-btn.is-break .floating-tomato-status {
        color: var(--b3-card-success-color);
      }
      .floating-tomato-btn.is-paused .floating-tomato-icon,
      .floating-tomato-btn.is-paused .floating-tomato-status {
        color: var(--b3-card-warning-color);
      }
      /* tooltip 包装容器：position: fixed 定位到触发元素位置，逃逸 overflow 裁剪 */
      #sy-tooltip-wrapper {
        position: fixed;
        pointer-events: none;
        z-index: 1000000;
      }
      /* 内部 .b3-tooltips 元素：与思源 _tooltips.scss 对齐 */
      .b3-tooltips {
        position: relative;
        cursor: pointer;
        overflow: visible;
      }
      .b3-tooltips::after {
        z-index: 1000000;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: normal;
        -webkit-font-smoothing: subpixel-antialiased;
        color: var(--b3-tooltips-color);
        word-wrap: break-word;
        white-space: pre;
        content: attr(aria-label);
        background-color: var(--b3-tooltips-background);
        border-radius: var(--b3-border-radius);
        line-height: 17px;
        transform: scale(.9);
        max-width: 60vw;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
        box-shadow: var(--b3-tooltips-shadow);
        font-family: var(--b3-font-family);
        pointer-events: none;
        position: absolute;
        opacity: 0;
        transition: opacity 150ms cubic-bezier(0, 0, .2, 1), transform 150ms cubic-bezier(0, 0, .2, 1);
      }
      /* 方向定位：__n（上方居中） */
      .b3-tooltips__n::after {
        right: 50%;
        bottom: 100%;
        margin-bottom: 5px;
        transform: translateX(50%) scale(.9);
      }
      .b3-tooltips__n.sy-tip-visible::after {
        opacity: 1;
        transform: translateX(50%) scale(1);
      }
      /* 类控制可见性（覆盖 :hover） */
      .sy-fixed-tooltip:hover::after {
        opacity: 0;
        transform: translateX(50%) scale(.9);
      }
      .sy-fixed-tooltip.sy-tip-visible::after {
        opacity: 1;
        transform: translateX(50%) scale(1);
      }
    </style>
  </head>
  <body>
    <div id="${ROOT_ID}"></div>
    <div id="sy-tooltip-wrapper"><span class="b3-tooltips b3-tooltips__n sy-fixed-tooltip"></span></div>
    <script>
      (() => {
        const root = document.getElementById('${ROOT_ID}');
        const tooltipWrapper = document.getElementById('sy-tooltip-wrapper');
        const tooltipInner = tooltipWrapper?.firstElementChild;
        let currentState = { phase: 'focus', isPaused: false };
        let activeTooltipTrigger = null;
        const sendAction = (action) => {
          try {
            const electron = window.require?.('electron');
            electron?.ipcRenderer?.send?.('${ACTION_CHANNEL}', action);
          } catch {}
        };
        const hideTooltip = () => {
          activeTooltipTrigger = null;
          if (tooltipInner) {
            // 先移除可见性类（opacity 立即变为 0），再清空内容
            tooltipInner.classList.remove('sy-tip-visible');
            tooltipInner.removeAttribute('aria-label');
          }
          if (tooltipWrapper) {
            tooltipWrapper.style.left = '';
            tooltipWrapper.style.top = '';
            tooltipWrapper.style.width = '';
            tooltipWrapper.style.height = '';
          }
        };
        const showTooltip = (el, text, skipHide = false) => {
          if (!tooltipWrapper || !tooltipInner || !text) return;
          if (!skipHide) hideTooltip();
          activeTooltipTrigger = el;
          tooltipInner.setAttribute('aria-label', text);
          tooltipInner.className = 'b3-tooltips b3-tooltips__n sy-fixed-tooltip';
          const rect = el.getBoundingClientRect();
          tooltipWrapper.style.left = rect.left + 'px';
          tooltipWrapper.style.top = rect.top + 'px';
          tooltipWrapper.style.width = rect.width + 'px';
          tooltipWrapper.style.height = rect.height + 'px';
          tooltipInner.classList.add('sy-tip-visible');
          requestAnimationFrame(() => {
            if (activeTooltipTrigger !== el) return;
            const tipRect = tooltipInner.getBoundingClientRect();
            if (tipRect.right > window.innerWidth - 8) {
              tooltipWrapper.style.left = (window.innerWidth - tipRect.width - 8) + 'px';
            }
            if (tipRect.left < 8) {
              tooltipWrapper.style.left = '8px';
            }
          });
        };
        window.${UPDATE_FN} = (payload) => {
          if (!root || !payload) return;
          document.documentElement.style.cssText = payload.themeStyleText || '';
          currentState = payload.state || currentState;
          root.className = payload.className || '';
          // 保存当前 tooltip 状态，innerHTML 替换后恢复
          const savedTooltipText = activeTooltipTrigger?.dataset?.tooltip || null;
          root.innerHTML = payload.innerHTML || '';
          // innerHTML 替换后触发元素被移除，在新 DOM 中查找同 data-tooltip 元素并恢复
          if (savedTooltipText) {
            const newEl = root.querySelector('[data-tooltip="' + savedTooltipText + '"]');
            if (newEl instanceof HTMLElement) {
              // 跳过 hide，直接更新位置和内容，避免闪烁
              showTooltip(newEl, savedTooltipText, true);
            } else {
              hideTooltip();
            }
          }
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
        document.addEventListener('mouseover', (event) => {
          const actionEl = event.target instanceof Element
            ? event.target.closest('[data-tooltip]')
            : null;
          if (!actionEl || !(actionEl instanceof HTMLElement)) return;
          const text = actionEl.dataset.tooltip;
          if (!text) return;
          showTooltip(actionEl, text);
        });
        document.addEventListener('mouseout', (event) => {
          const target = event.target instanceof Element
            ? event.target.closest('[data-tooltip]')
            : null;
          if (!target) return;
          const related = event.relatedTarget;
          if (related instanceof Node && target.contains(related)) return;
          hideTooltip();
        });
      })();
    </script>
  </body>
</html>`
}

interface RenderedPayload {
  className: string
  innerHTML: string
  themeStyleText: string
  state: {
    phase: FloatingPomodoroViewState['phase']
    isPaused: boolean
  }
}
