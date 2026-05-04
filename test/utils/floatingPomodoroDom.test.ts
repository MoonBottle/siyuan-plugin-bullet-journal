// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  applyFloatingPomodoroViewState,
  createFloatingPomodoroMarkup,
} from '@/utils/floatingPomodoroDom';
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

function createHost() {
  const host = document.createElement('div');
  host.className = 'floating-tomato-btn';
  host.innerHTML = createFloatingPomodoroMarkup();
  return host;
}

describe('applyFloatingPomodoroViewState', () => {
  it('renders focus content and actions', () => {
    const host = createHost();
    const state: FloatingPomodoroViewState = {
      phase: 'focus',
      status: '专注中',
      title: 'Write capsule spec',
      primaryText: '18:05',
      secondaryText: '已专注 6 分钟 / 目标 25 分钟',
      progress: 0.3,
      pauseResumeLabel: '暂停',
      endLabel: '结束专注',
      isPaused: false,
    };

    applyFloatingPomodoroViewState(host, state);

    expect(host.classList.contains('is-break')).toBe(false);
    expect(host.classList.contains('is-paused')).toBe(false);
    expect(host.querySelector('.floating-tomato-status')?.textContent).toBe('专注中');
    expect(host.querySelector('.floating-tomato-primary')?.textContent).toBe('18:05');
    expect(host.querySelector('.floating-tomato-item')?.textContent).toBe('Write capsule spec');
    expect(host.querySelector('.floating-tomato-secondary')?.textContent).toBe('已专注 6 分钟 / 目标 25 分钟');
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause')?.hidden).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete')?.hidden).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip')?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause')?.textContent).toBe('暂停');
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete')?.textContent).toBe('结束专注');
    expect(host.querySelector<HTMLElement>('.floating-tomato-progress-fill')?.style.transform).toBe('scaleX(0.3)');
  });

  it('renders break content and hides focus actions', () => {
    const host = createHost();
    const state: FloatingPomodoroViewState = {
      phase: 'break',
      status: '休息中',
      title: '',
      primaryText: '04:12',
      secondaryText: '休息剩余 4 分钟',
      progress: 0.16,
      skipBreakLabel: '跳过休息',
      isPaused: false,
    };

    applyFloatingPomodoroViewState(host, state);

    expect(host.classList.contains('is-break')).toBe(true);
    expect(host.classList.contains('has-item-title')).toBe(false);
    expect(host.querySelector('.floating-tomato-status')?.textContent).toBe('休息中');
    expect(host.querySelector('.floating-tomato-item')?.textContent).toBe('');
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause')?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete')?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip')?.hidden).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip')?.textContent).toBe('跳过休息');
    expect(host.querySelector<HTMLElement>('.floating-tomato-progress-fill')?.style.transform).toBe('scaleX(0.16)');
  });

  it('keeps the item row visible when focus state has a title', () => {
    const host = createHost();

    applyFloatingPomodoroViewState(host, {
      phase: 'focus',
      status: '专注中',
      title: 'Draft note',
      primaryText: '10:00',
      secondaryText: '已专注 15 分钟 / 目标 25 分钟',
      progress: 0.6,
      pauseResumeLabel: '暂停',
      endLabel: '结束专注',
      isPaused: false,
    });

    expect(host.classList.contains('has-item-title')).toBe(true);
    expect(host.querySelector('.floating-tomato-item')?.textContent).toBe('Draft note');
  });

  it('updates paused class and clamps progress when reapplying state', () => {
    const host = createHost();
    applyFloatingPomodoroViewState(host, {
      phase: 'focus',
      status: '专注中',
      title: 'Draft note',
      primaryText: '10:00',
      secondaryText: '已专注 15 分钟 / 目标 25 分钟',
      progress: 0.6,
      pauseResumeLabel: '暂停',
      endLabel: '结束专注',
      isPaused: false,
    });

    applyFloatingPomodoroViewState(host, {
      phase: 'focus',
      status: '已暂停',
      title: 'Draft note',
      primaryText: '10:00',
      secondaryText: '已专注 15 分钟 / 目标 25 分钟',
      progress: 2,
      pauseResumeLabel: '继续',
      endLabel: '结束专注',
      isPaused: true,
    });

    expect(host.classList.contains('is-break')).toBe(false);
    expect(host.classList.contains('is-paused')).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause')?.textContent).toBe('继续');
    expect(host.querySelector<HTMLElement>('.floating-tomato-progress-fill')?.style.transform).toBe('scaleX(1)');
  });
});
