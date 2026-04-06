export type ProgressBarDirection = 'extend' | 'shrink'

/**
 * 根据计时模式自动确定进度条方向：
 * - 正计时 (stopwatch) → extend（从空到满）
 * - 倒计时 (countdown) / 休息 (undefined) → shrink（从满到空）
 */
export function getProgressDirection(timerMode?: 'countdown' | 'stopwatch'): ProgressBarDirection {
  return timerMode === 'stopwatch' ? 'extend' : 'shrink'
}
