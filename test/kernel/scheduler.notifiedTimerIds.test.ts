import type { TimerEntry } from '@/kernel/types'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  cancelTimersByType,
  getTimers,
  isTimerNotified,
  markTimerNotified,
  registerTimer,
  registerTimers,
  setDispatchNotification,
} from '@/kernel/scheduler'

function makeEntry(id: string, type: TimerEntry['type'] = 'reminder', notified = false): TimerEntry {
  return {
    id,
    type,
    endTime: Date.now() / 1000 + 3600,
    metadata: {
      blockId: `block-${id}`,
      content: `test-${id}`,
    },
    notified,
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

describe('registerTimer — notified state preservation', () => {
  it('preserves notified=true when id is already in notifiedTimerIds', () => {
    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('already-fired', 'reminder'))
    markTimerNotified('already-fired')

    cancelTimersByType('reminder')
    expect(getTimers().has('already-fired')).toBe(false)
    expect(isTimerNotified('already-fired')).toBe(true)

    var newEntry = makeEntry('already-fired', 'reminder')
    expect(newEntry.notified).toBe(false)

    registerTimer(newEntry)

    var restored = getTimers().get('already-fired')!
    expect(restored.notified).toBe(true)
  })

  it('keeps notified=false when id is NOT in notifiedTimerIds', () => {
    var entry = makeEntry('never-fired', 'reminder')
    registerTimer(entry)

    expect(getTimers().get('never-fired')!.notified).toBe(false)
  })
})

describe('registerTimers — notified state preservation', () => {
  it('preserves notified=true for entries whose id is in notifiedTimerIds', () => {
    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('fired-a', 'reminder'))
    markTimerNotified('fired-a')

    cancelTimersByType('reminder')

    var entries = [
      makeEntry('fired-a', 'reminder'),
      makeEntry('never-fired-b', 'reminder'),
    ]

    registerTimers(entries)

    expect(getTimers().get('fired-a')!.notified).toBe(true)
    expect(getTimers().get('never-fired-b')!.notified).toBe(false)
  })

  it('handles pomodoro RPC path: cancel all then register with notified preservation', () => {
    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('pomodoro-fired', 'reminder'))
    markTimerNotified('pomodoro-fired')

    cancelTimersByType('reminder')

    var rebuiltEntries = [
      makeEntry('pomodoro-fired', 'reminder'),
      makeEntry('future-timer', 'reminder'),
    ]

    registerTimers(rebuiltEntries)

    expect(getTimers().get('pomodoro-fired')!.notified).toBe(true)
    expect(getTimers().get('future-timer')!.notified).toBe(false)
  })
})
