import { describe, expect, it } from 'vitest';
import type {
  FloatingPomodoroLabels,
  FloatingPomodoroSourceState,
} from '@/utils/floatingPomodoroViewState';
import { buildFloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

const labels: FloatingPomodoroLabels = {
  focusing: '专注中',
  paused: '已暂停',
  breaking: '休息中',
  pause: '暂停',
  resume: '继续',
  endFocus: '结束专注',
  skipBreak: '跳过休息',
  unknownItem: '未知事项',
};

function createFocusSource(
  overrides: Partial<FloatingPomodoroSourceState> = {}
): FloatingPomodoroSourceState {
  return {
    phase: 'focus',
    timerMode: 'countdown',
    remainingSeconds: 15 * 60 + 5,
    accumulatedSeconds: 9 * 60,
    targetDurationMinutes: 25,
    isPaused: false,
    itemTitle: '撰写周报',
    labels,
    ...overrides,
  };
}

describe('buildFloatingPomodoroViewState', () => {
  it('builds a countdown focus capsule state', () => {
    const viewState = buildFloatingPomodoroViewState(createFocusSource());

    expect(viewState).toEqual({
      status: '专注中',
      title: '撰写周报',
      primaryText: '15:05',
      secondaryText: '已专注 9 分钟 / 目标 25 分钟',
      pauseResumeLabel: '暂停',
      endLabel: '结束专注',
      skipBreakLabel: null,
      showSkipBreak: false,
      isPaused: false,
      phase: 'focus',
    });
  });

  it('builds a stopwatch focus capsule state', () => {
    const viewState = buildFloatingPomodoroViewState(createFocusSource({
      timerMode: 'stopwatch',
      remainingSeconds: 0,
      accumulatedSeconds: 12 * 60 + 34,
    }));

    expect(viewState.primaryText).toBe('12:34');
    expect(viewState.secondaryText).toBe('已专注 12 分钟');
    expect(viewState.status).toBe('专注中');
    expect(viewState.pauseResumeLabel).toBe('暂停');
    expect(viewState.showSkipBreak).toBe(false);
  });

  it('marks paused focus state and switches the action label to resume', () => {
    const viewState = buildFloatingPomodoroViewState(createFocusSource({
      isPaused: true,
    }));

    expect(viewState.status).toBe('已暂停');
    expect(viewState.pauseResumeLabel).toBe('继续');
    expect(viewState.isPaused).toBe(true);
    expect(viewState.secondaryText).toBe('已专注 9 分钟 / 目标 25 分钟');
  });

  it('builds a break capsule state with skip-break control and fallback title', () => {
    const viewState = buildFloatingPomodoroViewState({
      phase: 'break',
      remainingSeconds: 5 * 60,
      accumulatedSeconds: 0,
      isPaused: false,
      itemTitle: '',
      labels,
    });

    expect(viewState).toEqual({
      status: '休息中',
      title: '未知事项',
      primaryText: '05:00',
      secondaryText: '休息剩余 5 分钟',
      pauseResumeLabel: null,
      endLabel: null,
      skipBreakLabel: '跳过休息',
      showSkipBreak: true,
      isPaused: false,
      phase: 'break',
    });
  });
});
