import { describe, expect, it } from 'vitest';
import type {
  FloatingPomodoroBreakSourceState,
  FloatingPomodoroFocusSourceState,
  FloatingPomodoroLabels,
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
  overrides: Partial<FloatingPomodoroFocusSourceState> = {}
): FloatingPomodoroFocusSourceState {
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

function createBreakSource(
  overrides: Partial<FloatingPomodoroBreakSourceState> = {}
): FloatingPomodoroBreakSourceState {
  return {
    phase: 'break',
    remainingSeconds: 5 * 60,
    breakDurationSeconds: 5 * 60,
    itemTitle: '',
    labels,
    ...overrides,
  };
}

describe('buildFloatingPomodoroViewState', () => {
  it('builds a countdown focus capsule state', () => {
    const viewState = buildFloatingPomodoroViewState(createFocusSource());

    expect(viewState).toEqual({
      phase: 'focus',
      status: '专注中',
      title: '撰写周报',
      primaryText: '15:05',
      secondaryText: '已专注 9 分钟 / 目标 25 分钟',
      progress: 0.36,
      pauseResumeLabel: '暂停',
      endLabel: '结束专注',
      isPaused: false,
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
    expect(viewState.progress).toBeCloseTo((12 * 60 + 34) / (25 * 60), 5);
    expect(viewState.pauseResumeLabel).toBe('暂停');
    expect('skipBreakLabel' in viewState).toBe(false);
  });

  it('marks paused focus state and switches the action label to resume', () => {
    const viewState = buildFloatingPomodoroViewState(createFocusSource({
      isPaused: true,
    }));

    expect(viewState.status).toBe('已暂停');
    expect(viewState.pauseResumeLabel).toBe('继续');
    expect(viewState.isPaused).toBe(true);
    expect(viewState.progress).toBe(0.36);
    expect(viewState.secondaryText).toBe('已专注 9 分钟 / 目标 25 分钟');
  });

  it('builds a break capsule state without item fallback title', () => {
    const viewState = buildFloatingPomodoroViewState(createBreakSource());

    expect(viewState).toEqual({
      phase: 'break',
      status: '休息中',
      title: '',
      primaryText: '05:00',
      secondaryText: '休息剩余 5 分钟',
      progress: 0,
      skipBreakLabel: '跳过休息',
      isPaused: false,
    });
  });

  it('keeps break progress monotonic with an explicit stable total', () => {
    const initialState = buildFloatingPomodoroViewState(createBreakSource({
      remainingSeconds: 4 * 60,
      breakDurationSeconds: 5 * 60,
    }));
    const laterState = buildFloatingPomodoroViewState(createBreakSource({
      remainingSeconds: 3 * 60,
      breakDurationSeconds: 5 * 60,
    }));

    expect(initialState.progress).toBeCloseTo(0.2, 5);
    expect(laterState.progress).toBeCloseTo(0.4, 5);
    expect(laterState.progress).toBeGreaterThan(initialState.progress);
  });

  it('normalizes progress to the 0..1 range', () => {
    const overtimeState = buildFloatingPomodoroViewState(createFocusSource({
      remainingSeconds: -20,
      accumulatedSeconds: 40 * 60,
    }));
    const negativeState = buildFloatingPomodoroViewState(createBreakSource({
      remainingSeconds: 7 * 60,
      breakDurationSeconds: 5 * 60,
      itemTitle: null,
    }));

    expect(overtimeState.progress).toBe(1);
    expect(negativeState.progress).toBe(0);
  });

  it('sanitizes invalid focus target minutes for summary text and progress', () => {
    const zeroTargetState = buildFloatingPomodoroViewState(createFocusSource({
      accumulatedSeconds: 5 * 60,
      remainingSeconds: 0,
      targetDurationMinutes: 0,
    }));
    const negativeTargetState = buildFloatingPomodoroViewState(createFocusSource({
      accumulatedSeconds: 5 * 60,
      remainingSeconds: 0,
      targetDurationMinutes: -10,
    }));

    expect(zeroTargetState.secondaryText).toBe('已专注 5 分钟 / 目标 25 分钟');
    expect(zeroTargetState.progress).toBeCloseTo(0.2, 5);
    expect(negativeTargetState.secondaryText).toBe('已专注 5 分钟 / 目标 25 分钟');
    expect(negativeTargetState.progress).toBeCloseTo(0.2, 5);
  });

  it('sanitizes non-finite numeric inputs for display and progress', () => {
    const nonFiniteFocusState = buildFloatingPomodoroViewState(createFocusSource({
      accumulatedSeconds: Number.POSITIVE_INFINITY,
      remainingSeconds: Number.NaN,
      targetDurationMinutes: Number.NEGATIVE_INFINITY,
    }));
    const nonFiniteBreakState = buildFloatingPomodoroViewState(createBreakSource({
      remainingSeconds: Number.POSITIVE_INFINITY,
      breakDurationSeconds: Number.NaN,
    }));

    expect(nonFiniteFocusState.primaryText).toBe('00:00');
    expect(nonFiniteFocusState.secondaryText).toBe('已专注 0 分钟 / 目标 25 分钟');
    expect(nonFiniteFocusState.progress).toBe(0);
    expect(nonFiniteBreakState.primaryText).toBe('00:00');
    expect(nonFiniteBreakState.secondaryText).toBe('休息剩余 0 分钟');
    expect(nonFiniteBreakState.progress).toBe(0);
  });

  it('uses formatter callbacks when provided', () => {
    const localizedLabels: FloatingPomodoroLabels = {
      ...labels,
      formatFocusSummary: (focusedMinutes, targetMinutes) => `focus:${focusedMinutes}/${targetMinutes}`,
      formatStopwatchSummary: focusedMinutes => `stopwatch:${focusedMinutes}`,
      formatBreakSummary: remainingMinutes => `break:${remainingMinutes}`,
    };

    const focusState = buildFloatingPomodoroViewState(createFocusSource({
      labels: localizedLabels,
    }));
    const stopwatchState = buildFloatingPomodoroViewState(createFocusSource({
      labels: localizedLabels,
      timerMode: 'stopwatch',
      accumulatedSeconds: 12 * 60,
      remainingSeconds: 0,
    }));
    const breakState = buildFloatingPomodoroViewState(createBreakSource({
      labels: localizedLabels,
      remainingSeconds: 4 * 60,
    }));

    expect(focusState.secondaryText).toBe('focus:9/25');
    expect(stopwatchState.secondaryText).toBe('stopwatch:12');
    expect(breakState.secondaryText).toBe('break:4');
  });
});
