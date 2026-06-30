import type { TimerEntry } from '@/kernel/types'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  cancelTimer,
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
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('already-fired', 'reminder'))
    markTimerNotified('already-fired')

    cancelTimersByType('reminder')
    expect(getTimers().has('already-fired')).toBe(false)
    expect(isTimerNotified('already-fired')).toBe(true)

    const newEntry = makeEntry('already-fired', 'reminder')
    expect(newEntry.notified).toBe(false)

    registerTimer(newEntry)

    const restored = getTimers().get('already-fired')!
    expect(restored.notified).toBe(true)
  })

  it('keeps notified=false when id is NOT in notifiedTimerIds', () => {
    const entry = makeEntry('never-fired', 'reminder')
    registerTimer(entry)

    expect(getTimers().get('never-fired')!.notified).toBe(false)
  })
})

describe('registerTimers — notified state preservation', () => {
  it('preserves notified=true for entries whose id is in notifiedTimerIds', () => {
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('fired-a', 'reminder'))
    markTimerNotified('fired-a')

    cancelTimersByType('reminder')

    const entries = [
      makeEntry('fired-a', 'reminder'),
      makeEntry('never-fired-b', 'reminder'),
    ]

    registerTimers(entries)

    expect(getTimers().get('fired-a')!.notified).toBe(true)
    expect(getTimers().get('never-fired-b')!.notified).toBe(false)
  })

  it('handles pomodoro RPC path: cancel all then register with notified preservation', () => {
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    registerTimer(makeEntry('pomodoro-fired', 'reminder'))
    markTimerNotified('pomodoro-fired')

    cancelTimersByType('reminder')

    const rebuiltEntries = [
      makeEntry('pomodoro-fired', 'reminder'),
      makeEntry('future-timer', 'reminder'),
    ]

    registerTimers(rebuiltEntries)

    expect(getTimers().get('pomodoro-fired')!.notified).toBe(true)
    expect(getTimers().get('future-timer')!.notified).toBe(false)
  })
})

describe('initScheduler guard', () => {
  it('calling initScheduler twice should not create duplicate setInterval timers', async () => {
    vi.useFakeTimers()
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    const pastTime = Math.floor(Date.now() / 1000) - 2
    const entry: TimerEntry = {
      id: 'guard-test-1',
      type: 'reminder',
      endTime: pastTime,
      metadata: {
        blockId: 'b1',
        content: 'guard test',
      },
      notified: false,
    }
    registerTimer(entry)

    ;(globalThis as any).siyuan = {
      rpc: { broadcast: vi.fn() },
    }

    const { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()
    initScheduler()

    vi.advanceTimersByTime(1000)

    expect(dispatchFn).toHaveBeenCalledTimes(1)

    const { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})

describe('notifiedTimerIds as source of truth', () => {
  it('checkTimers skips timer when notifiedTimerIds has the id even if entry.notified is false', async () => {
    vi.useFakeTimers()
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    const futureTime = Math.floor(Date.now() / 1000) + 10
    const entry: TimerEntry = {
      id: 'sot-test-1',
      type: 'reminder',
      endTime: futureTime,
      metadata: {
        blockId: 'b1',
        content: 'sot test',
      },
      notified: false,
    }
    registerTimer(entry)
    markTimerNotified('sot-test-1')

    getTimers().get('sot-test-1')!.notified = false
    getTimers().get('sot-test-1')!.endTime = Math.floor(Date.now() / 1000) - 1

    ;(globalThis as any).siyuan = {
      rpc: { broadcast: vi.fn() },
    }

    const { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()

    vi.advanceTimersByTime(2000)

    expect(dispatchFn).not.toHaveBeenCalled()

    const { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})

describe('cancelTimer clears notifiedTimerIds（pomodoro autoExtend 场景）', () => {
  it('cancelTimer 后用相同 id 重新注册，timer 到期应触发通知', async () => {
    vi.useFakeTimers()
    const dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    const pastTime = Math.floor(Date.now() / 1000) - 1
    const entry: TimerEntry = {
      id: 'pomodoro-block-1',
      type: 'pomodoro',
      endTime: pastTime,
      metadata: {
        blockId: 'block-1',
        content: 'pomodoro test',
      },
      notified: false,
    }

    ;(globalThis as any).siyuan = {
      rpc: { broadcast: vi.fn() },
    }

    const { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()

    // 第一次到期触发通知
    registerTimer(entry)
    vi.advanceTimersByTime(1000)
    expect(dispatchFn).toHaveBeenCalledTimes(1)

    // 模拟 autoExtend：cancelTimer（前端 RPC）+ 重新注册相同 id 的新 endTime
    cancelTimer('pomodoro-block-1')
    const newFutureTime = Math.floor(Date.now() / 1000) + 2
    const newEntry: TimerEntry = {
      id: 'pomodoro-block-1',
      type: 'pomodoro',
      endTime: newFutureTime,
      metadata: {
        blockId: 'block-1',
        content: 'pomodoro test',
      },
      notified: false,
    }
    registerTimer(newEntry)

    // 推进到新 endTime 之后
    vi.advanceTimersByTime(3000)

    // 期望：重新注册的 timer 到期后应再次触发通知（第二次）
    expect(dispatchFn).toHaveBeenCalledTimes(2)

    const { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})

describe('dispatchedNotificationIds 不应阻止 autoExtend 后的二次广播', () => {
  it('autoExtend 后第二次到期应再次调用 siyuan.rpc.broadcast', async () => {
    vi.useFakeTimers()

    // 使用真实的 dispatchNotification 实现（来自 webhook.ts），而非 vi.fn()
    // 这样才能覆盖 scheduler → webhook → siyuan.rpc.broadcast 的完整链路
    const { dispatchNotification } = await import('@/kernel/webhook')
    setDispatchNotification(dispatchNotification)

    const broadcastMock = vi.fn()
    ;(globalThis as any).siyuan = {
      rpc: { broadcast: broadcastMock },
    }

    const { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()

    // 第一次到期：注册一个已过期的 timer
    const pastTime = Math.floor(Date.now() / 1000) - 1
    const entry: TimerEntry = {
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
      endTime: pastTime,
      metadata: {
        blockId: 'block-autoextend',
        content: 'autoextend test',
      },
      notified: false,
    }
    registerTimer(entry)

    // 推进 1 秒，让 checkTimers tick 一次
    vi.advanceTimersByTime(1000)

    // 验证：第一次广播已发出
    expect(broadcastMock).toHaveBeenCalledTimes(1)
    expect(broadcastMock).toHaveBeenCalledWith('timer-expired', expect.objectContaining({
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
    }))

    // 模拟 autoExtend：cancelTimer + 用相同 id 重新注册未来的 endTime
    cancelTimer('pomodoro-block-autoextend')
    const newFutureTime = Math.floor(Date.now() / 1000) + 2
    const newEntry: TimerEntry = {
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
      endTime: newFutureTime,
      metadata: {
        blockId: 'block-autoextend',
        content: 'autoextend test',
      },
      notified: false,
    }
    registerTimer(newEntry)

    // 推进 3 秒，让 newEndTime 到期并被 checkTimers 检测到
    vi.advanceTimersByTime(3000)

    // 期望：autoExtend 后的第二次到期应再次广播（这是修复的目标）
    expect(broadcastMock).toHaveBeenCalledTimes(2)

    const { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})
