// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import type {
  FloatingPomodoroBreakViewState,
  FloatingPomodoroFocusViewState,
} from '@/utils/floatingPomodoroViewState';
import {
  applyFloatingPomodoroViewState,
  createFloatingPomodoroMarkup,
} from '@/utils/floatingPomodoroDom';

function createFocusState(
  overrides: Partial<FloatingPomodoroFocusViewState> = {}
): FloatingPomodoroFocusViewState {
  return {
    phase: 'focus',
    status: '专注中',
    title: '整理需求',
    primaryText: '12:30',
    secondaryText: '已专注 12 分钟 / 目标 25 分钟',
    progress: 0.5,
    isPaused: false,
    pauseResumeLabel: '暂停',
    endLabel: '结束专注',
    ...overrides,
  };
}

function createBreakState(
  overrides: Partial<FloatingPomodoroBreakViewState> = {}
): FloatingPomodoroBreakViewState {
  return {
    phase: 'break',
    status: '休息中',
    title: '整理需求',
    primaryText: '04:00',
    secondaryText: '休息剩余 4 分钟',
    progress: 0.25,
    isPaused: false,
    skipBreakLabel: '跳过休息',
    ...overrides,
  };
}

describe('floatingPomodoroDom', () => {
  it('creates stable capsule markup with the required hooks', () => {
    const host = document.createElement('div');

    host.innerHTML = createFloatingPomodoroMarkup();

    expect(host.querySelector('.floating-tomato-shell')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-main')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-icon')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-status')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-primary')).not.toBeNull();
    expect(host.querySelectorAll('.floating-tomato-item')).toHaveLength(2);
    expect(host.querySelector('.floating-tomato-secondary')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-actions')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-action--pause')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-action--complete')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-action--skip')).not.toBeNull();
    expect(host.querySelector('.floating-tomato-progress-fill')).not.toBeNull();
  });

  it('applies focus state text, classes, actions, and clamped progress', () => {
    const host = document.createElement('div');

    host.innerHTML = createFloatingPomodoroMarkup();
    applyFloatingPomodoroViewState(host, createFocusState({
      progress: 1.4,
      isPaused: true,
      status: '已暂停',
      pauseResumeLabel: '继续',
    }));

    const shell = host.querySelector<HTMLElement>('.floating-tomato-shell');
    const status = host.querySelector('.floating-tomato-status');
    const primary = host.querySelector('.floating-tomato-primary');
    const secondary = host.querySelector('.floating-tomato-secondary');
    const pauseButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause');
    const completeButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete');
    const skipButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip');
    const progressFill = host.querySelector<HTMLElement>('.floating-tomato-progress-fill');

    expect(shell?.classList.contains('is-paused')).toBe(true);
    expect(shell?.classList.contains('is-break')).toBe(false);
    expect(status?.textContent).toBe('已暂停');
    expect(primary?.textContent).toBe('12:30');
    expect(secondary?.textContent).toBe('已专注 12 分钟 / 目标 25 分钟');
    expect(pauseButton?.textContent).toBe('继续');
    expect(completeButton?.textContent).toBe('结束专注');
    expect(skipButton?.hidden).toBe(true);
    expect(pauseButton?.hidden).toBe(false);
    expect(completeButton?.hidden).toBe(false);
    expect(progressFill?.style.transform).toBe('scaleX(1)');
  });

  it('switches to break state and keeps the same host reusable across repeated calls', () => {
    const host = document.createElement('div');

    host.innerHTML = createFloatingPomodoroMarkup();
    applyFloatingPomodoroViewState(host, createFocusState());
    applyFloatingPomodoroViewState(host, createBreakState({
      progress: -10,
      title: '散步恢复',
    }));

    const shell = host.querySelector<HTMLElement>('.floating-tomato-shell');
    const icon = host.querySelector('.floating-tomato-icon');
    const status = host.querySelector('.floating-tomato-status');
    const primary = host.querySelector('.floating-tomato-primary');
    const secondary = host.querySelector('.floating-tomato-secondary');
    const pauseButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause');
    const completeButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete');
    const skipButton = host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip');
    const progressFill = host.querySelector<HTMLElement>('.floating-tomato-progress-fill');

    expect(host.querySelectorAll('.floating-tomato-shell')).toHaveLength(1);
    expect(shell?.classList.contains('is-break')).toBe(true);
    expect(shell?.classList.contains('is-paused')).toBe(false);
    expect(icon?.textContent).toBe('散步恢复');
    expect(status?.textContent).toBe('休息中');
    expect(primary?.textContent).toBe('04:00');
    expect(secondary?.textContent).toBe('休息剩余 4 分钟');
    expect(skipButton?.textContent).toBe('跳过休息');
    expect(skipButton?.hidden).toBe(false);
    expect(pauseButton?.hidden).toBe(true);
    expect(completeButton?.hidden).toBe(true);
    expect(progressFill?.style.transform).toBe('scaleX(0)');
  });
});
