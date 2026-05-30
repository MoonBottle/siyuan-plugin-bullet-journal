// @vitest-environment happy-dom

import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createDetachedPomodoroWindowHost,
  detectDetachedPomodoroWindowSupport,
} from '@/utils/detachedPomodoroWindow'

const focusState: FloatingPomodoroViewState = {
  phase: 'focus',
  status: '专注中',
  title: '事项',
  primaryText: '25:00',
  secondaryText: '已专注 0 分钟 / 目标 25 分钟',
  progress: 0,
  pauseResumeLabel: '暂停',
  endLabel: '结束专注',
  isPaused: false,
}

describe('detectDetachedPomodoroWindowSupport', () => {
  it('returns false outside desktop frontend', () => {
    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'mobile',
      runtimeRequire: vi.fn(),
    })).toBe(false)
  })

  it('returns true when BrowserWindow is available in desktop frontend', () => {
    const runtimeRequire = vi.fn(() => ({
      BrowserWindow: vi.fn(),
      getCurrentWindow: vi.fn(),
    }))

    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'desktop',
      runtimeRequire,
    })).toBe(true)
  })
})

describe('createDetachedPomodoroWindowHost', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
  })

  it('falls back to unavailable host when support detection fails', () => {
    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop-window',
      runtimeRequire: undefined,
      createMarkup: () => '<div />',
      applyViewState: vi.fn(),
      onAction: vi.fn(),
    })

    expect(host.isAvailable()).toBe(false)
  })

  it('calls executeJavaScript when updating an existing detached window', () => {
    document.documentElement.style.setProperty('--b3-theme-surface', '#ffffff')
    document.documentElement.style.setProperty('--b3-theme-primary', '#3578e5')

    const loadURL = vi.fn()
    const executeJavaScript = vi.fn()
    const lingeringClose = vi.fn()
    const setPosition = vi.fn()
    const BrowserWindow = vi.fn().mockImplementation(class {
      loadURL = loadURL
      showInactive = vi.fn()
      show = vi.fn()
      close = vi.fn()
      isDestroyed = vi.fn(() => false)
      isVisible = vi.fn(() => true)
      webContents = {
        executeJavaScript,
        on: vi.fn(),
      }

      on = vi.fn()
      once = vi.fn()
      setAlwaysOnTop = vi.fn()
      setPosition = setPosition
      setVisibleOnAllWorkspaces = vi.fn()
    })
    BrowserWindow.getAllWindows = vi.fn(() => [
      {
        close: lingeringClose,
        getTitle: vi.fn(() => 'Bullet Journal Pomodoro Floating Window'),
        isDestroyed: vi.fn(() => false),
      },
    ])

    const applyViewState = vi.fn((host: HTMLElement, state: FloatingPomodoroViewState) => {
      host.dataset.primary = state.primaryText
    })

    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop',
      runtimeRequire: () => ({
        BrowserWindow,
        screen: {
          getPrimaryDisplay: () => ({
            workArea: {
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
            },
          }),
        },
      }),
      createMarkup: () => '<div class="floating-tomato-shell"></div>',
      applyViewState,
      onAction: vi.fn(),
    })

    host.show(focusState)
    host.update({
      ...focusState,
      primaryText: '24:59',
      progress: 0.01,
    })

    expect(executeJavaScript).toHaveBeenCalled()
    expect(applyViewState).toHaveBeenCalledTimes(2)
    expect(lingeringClose).toHaveBeenCalledTimes(1)
    expect(setPosition).toHaveBeenCalledWith(1524, 972)
    expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('-webkit-app-region: drag')))
    expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('-webkit-app-region: no-drag')))
    expect(loadURL).not.toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('#f7f1e8')))
    expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('detached-floating-tomato'))
    expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('--b3-theme-surface'))
    expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('--b3-theme-primary'))
  })

  it('closes the window on destroy', () => {
    const close = vi.fn()
    const BrowserWindow = vi.fn().mockImplementation(class {
      loadURL = vi.fn()
      showInactive = vi.fn()
      show = vi.fn()
      close = close
      isDestroyed = vi.fn(() => false)
      isVisible = vi.fn(() => false)
      webContents = {
        executeJavaScript: vi.fn(),
        on: vi.fn(),
      }

      on = vi.fn()
      once = vi.fn()
      setAlwaysOnTop = vi.fn()
      setVisibleOnAllWorkspaces = vi.fn()
    })

    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop',
      runtimeRequire: () => ({ BrowserWindow }),
      createMarkup: () => '<div class="floating-tomato-shell"></div>',
      applyViewState: vi.fn(),
      onAction: vi.fn(),
    })

    host.show(focusState)
    host.destroy()

    expect(close).toHaveBeenCalled()
  })
})
