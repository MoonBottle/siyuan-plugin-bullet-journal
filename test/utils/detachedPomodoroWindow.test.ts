// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';
import {
  createDetachedPomodoroWindowHost,
  detectDetachedPomodoroWindowSupport,
} from '@/utils/detachedPomodoroWindow';

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
};

describe('detectDetachedPomodoroWindowSupport', () => {
  it('returns false outside desktop frontend', () => {
    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'mobile',
      runtimeRequire: vi.fn(),
    })).toBe(false);
  });

  it('returns true when BrowserWindow is available in desktop frontend', () => {
    const runtimeRequire = vi.fn(() => ({
      BrowserWindow: vi.fn(),
      getCurrentWindow: vi.fn(),
    }));

    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'desktop',
      runtimeRequire,
    })).toBe(true);
  });
});

describe('createDetachedPomodoroWindowHost', () => {
  it('falls back to unavailable host when support detection fails', () => {
    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop-window',
      runtimeRequire: undefined,
      createMarkup: () => '<div />',
      applyViewState: vi.fn(),
      onAction: vi.fn(),
    });

    expect(host.isAvailable()).toBe(false);
  });

  it('calls executeJavaScript when updating an existing detached window', () => {
    const loadURL = vi.fn();
    const executeJavaScript = vi.fn();
    const BrowserWindow = vi.fn(function BrowserWindowMock() {
      return {
        loadURL,
        showInactive: vi.fn(),
        show: vi.fn(),
        close: vi.fn(),
        isDestroyed: vi.fn(() => false),
        isVisible: vi.fn(() => true),
        webContents: { executeJavaScript, on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        setVisibleOnAllWorkspaces: vi.fn(),
      };
    });

    const applyViewState = vi.fn((host: HTMLElement, state: FloatingPomodoroViewState) => {
      host.dataset.primary = state.primaryText;
    });

    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop',
      runtimeRequire: () => ({ BrowserWindow }),
      createMarkup: () => '<div class="floating-tomato-shell"></div>',
      applyViewState,
      onAction: vi.fn(),
    });

    host.show(focusState);
    host.update({
      ...focusState,
      primaryText: '24:59',
      progress: 0.01,
    });

    expect(executeJavaScript).toHaveBeenCalled();
    expect(applyViewState).toHaveBeenCalledTimes(2);
    expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('-webkit-app-region: drag')));
    expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('-webkit-app-region: no-drag')));
    expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('detached-floating-tomato'));
  });

  it('closes the window on destroy', () => {
    const close = vi.fn();
    const BrowserWindow = vi.fn(function BrowserWindowMock() {
      return {
        loadURL: vi.fn(),
        showInactive: vi.fn(),
        show: vi.fn(),
        close,
        isDestroyed: vi.fn(() => false),
        isVisible: vi.fn(() => false),
        webContents: { executeJavaScript: vi.fn(), on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        setVisibleOnAllWorkspaces: vi.fn(),
      };
    });

    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop',
      runtimeRequire: () => ({ BrowserWindow }),
      createMarkup: () => '<div class="floating-tomato-shell"></div>',
      applyViewState: vi.fn(),
      onAction: vi.fn(),
    });

    host.show(focusState);
    host.destroy();

    expect(close).toHaveBeenCalled();
  });
});
