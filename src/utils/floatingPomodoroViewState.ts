export interface FloatingPomodoroLabels {
  focusing: string;
  paused: string;
  breaking: string;
  pause: string;
  resume: string;
  endFocus: string;
  skipBreak: string;
  unknownItem: string;
  formatFocusSummary?: (focusedMinutes: number, targetMinutes: number) => string;
  formatStopwatchSummary?: (focusedMinutes: number) => string;
  formatBreakSummary?: (remainingMinutes: number) => string;
}

export interface FloatingPomodoroFocusSourceState {
  phase: 'focus';
  remainingSeconds: number;
  accumulatedSeconds: number;
  isPaused: boolean;
  itemTitle?: string | null;
  labels: FloatingPomodoroLabels;
  timerMode?: 'countdown' | 'stopwatch';
  targetDurationMinutes?: number;
}

export interface FloatingPomodoroBreakSourceState {
  phase: 'break';
  remainingSeconds: number;
  breakDurationSeconds: number;
  itemTitle?: string | null;
  labels: FloatingPomodoroLabels;
}

export type FloatingPomodoroSourceState =
  | FloatingPomodoroFocusSourceState
  | FloatingPomodoroBreakSourceState;

interface FloatingPomodoroViewStateBase {
  status: string;
  title: string;
  primaryText: string;
  secondaryText: string;
  progress: number;
  isPaused: boolean;
}

export interface FloatingPomodoroFocusViewState extends FloatingPomodoroViewStateBase {
  phase: 'focus';
  pauseResumeLabel: string;
  endLabel: string;
}

export interface FloatingPomodoroBreakViewState extends FloatingPomodoroViewStateBase {
  phase: 'break';
  skipBreakLabel: string;
}

export type FloatingPomodoroViewState =
  | FloatingPomodoroFocusViewState
  | FloatingPomodoroBreakViewState;

export function buildFloatingPomodoroViewState(
  source: FloatingPomodoroSourceState
): FloatingPomodoroViewState {
  const title = source.itemTitle?.trim() || source.labels.unknownItem;

  if (source.phase === 'break') {
    const remainingSeconds = normalizeNonNegativeNumber(source.remainingSeconds);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    const breakTargetSeconds = normalizeNonNegativeNumber(source.breakDurationSeconds);

    return {
      phase: 'break',
      status: source.labels.breaking,
      title,
      primaryText: formatClock(remainingSeconds),
      secondaryText: formatBreakSummary(source.labels, remainingMinutes),
      progress: normalizeProgress(
        breakTargetSeconds > 0
          ? (breakTargetSeconds - remainingSeconds) / breakTargetSeconds
          : 0
      ),
      skipBreakLabel: source.labels.skipBreak,
      isPaused: false,
    };
  }

  const timerMode = source.timerMode ?? 'countdown';
  const accumulatedSeconds = normalizeNonNegativeNumber(source.accumulatedSeconds);
  const remainingSeconds = normalizeNonNegativeNumber(source.remainingSeconds);
  const focusedMinutes = Math.floor(accumulatedSeconds / 60);
  const targetMinutes = normalizePositiveMinutes(source.targetDurationMinutes);
  const progressReferenceSeconds = normalizeNonNegativeNumber(targetMinutes * 60);

  return {
    phase: 'focus',
    status: source.isPaused ? source.labels.paused : source.labels.focusing,
    title,
    primaryText: formatClock(
      timerMode === 'stopwatch' ? accumulatedSeconds : remainingSeconds
    ),
    secondaryText: timerMode === 'stopwatch'
      ? formatStopwatchSummary(source.labels, focusedMinutes)
      : formatFocusSummary(source.labels, focusedMinutes, targetMinutes),
    progress: normalizeProgress(
      progressReferenceSeconds > 0
        ? accumulatedSeconds / progressReferenceSeconds
        : 0
    ),
    pauseResumeLabel: source.isPaused ? source.labels.resume : source.labels.pause,
    endLabel: source.labels.endFocus,
    isPaused: source.isPaused,
  };
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.floor(normalizeNonNegativeNumber(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatFocusSummary(
  labels: FloatingPomodoroLabels,
  focusedMinutes: number,
  targetMinutes: number
): string {
  return labels.formatFocusSummary?.(focusedMinutes, targetMinutes)
    ?? `已专注 ${focusedMinutes} 分钟 / 目标 ${targetMinutes} 分钟`;
}

function formatStopwatchSummary(
  labels: FloatingPomodoroLabels,
  focusedMinutes: number
): string {
  return labels.formatStopwatchSummary?.(focusedMinutes)
    ?? `已专注 ${focusedMinutes} 分钟`;
}

function formatBreakSummary(
  labels: FloatingPomodoroLabels,
  remainingMinutes: number
): string {
  return labels.formatBreakSummary?.(remainingMinutes)
    ?? `休息剩余 ${remainingMinutes} 分钟`;
}

function normalizeProgress(progress: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(progress)));
}

function normalizePositiveMinutes(minutes: number | undefined): number {
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
    ? minutes
    : 25;
}

function normalizeFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeNonNegativeNumber(value: number): number {
  return Math.max(0, normalizeFiniteNumber(value));
}
