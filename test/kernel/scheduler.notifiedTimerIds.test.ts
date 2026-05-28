import type { TimerEntry } from '@/kernel/types'
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  cancelTimersByType,
  getTimers,
  isTimerNotified,
  registerTimer,
} from '@/kernel/scheduler'

function makeEntry(id: string, type: TimerEntry['type'] = 'reminder'): TimerEntry {
  return {
    id,
    type,
    endTime: Date.now() / 1000 + 3600,
    metadata: {
      blockId: `block-${id}`,
      content: `test-${id}`,
    },
    notified: false,
  }
}

beforeEach(() => {
  getTimers().clear()
})

describe('isTimerNotified', () => {
  it('returns false for an id not in the set', () => {
    expect(isTimerNotified('nonexistent-id')).toBe(false)
  })

  it('returns false for an empty string id', () => {
    expect(isTimerNotified('')).toBe(false)
  })

  it('is independent of cancelTimersByType — cancelling timers does not affect notified state', () => {
    registerTimer(makeEntry('timer-1', 'reminder'))
    registerTimer(makeEntry('timer-2', 'pomodoro'))

    cancelTimersByType('reminder')

    expect(getTimers().has('timer-1')).toBe(false)
    expect(isTimerNotified('timer-1')).toBe(false)
    expect(isTimerNotified('timer-2')).toBe(false)
  })

  it('is independent of the timers Map — adding timers does not mark them as notified', () => {
    registerTimer(makeEntry('timer-a'))
    registerTimer(makeEntry('timer-b'))

    expect(getTimers().size).toBe(2)
    expect(isTimerNotified('timer-a')).toBe(false)
    expect(isTimerNotified('timer-b')).toBe(false)
  })
})
