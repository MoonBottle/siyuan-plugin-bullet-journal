import {
  createPinia,
  setActivePinia,
} from 'pinia'
/**
 * pomodoroStore 单元测试
 * TICK 事件发射、Getters、恢复逻辑
 */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { usePomodoroStore } from '@/stores/pomodoroStore'
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import {
  loadActivePomodoro,
  loadPendingCompletion,
  removePendingCompletion,
  saveActivePomodoro,
} from '@/utils/pomodoroStorage'

// 提供 window 和 document（Node 环境无此全局，vitest fake timers 会替换 setInterval）
beforeAll(() => {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = globalThis
  }
  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    }
  }
})

const mockSchedulePomodoroFocusEnd = vi.fn()
const mockCancelPomodoroFocusEnd = vi.fn()
const mockSchedulePomodoroBreakEnd = vi.fn()
const mockCancelPomodoroBreakEnd = vi.fn()

// Mock dependencies
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
}))

vi.mock('@/services/mobileNotificationScheduler', () => ({
  mobileNotificationScheduler: {
    schedulePomodoroFocusEnd: (...args: unknown[]) => mockSchedulePomodoroFocusEnd(...args),
    cancelPomodoroFocusEnd: (...args: unknown[]) => mockCancelPomodoroFocusEnd(...args),
    schedulePomodoroBreakEnd: (...args: unknown[]) => mockSchedulePomodoroBreakEnd(...args),
    cancelPomodoroBreakEnd: (...args: unknown[]) => mockCancelPomodoroBreakEnd(...args),
    isMobileNotificationsEnabled: vi.fn((plugin?: { isMobile?: boolean }) => !!plugin?.isMobile),
  },
}))

vi.mock('@/api', () => ({
  appendBlock: vi.fn(),
  setBlockAttrs: vi.fn(),
  getBlockAttrs: vi.fn(),
}))

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
  showConfirmDialog: vi.fn((_title, _msg, cb) => cb?.()),
}))

vi.mock('@/utils/notification', () => ({
  showPomodoroCompleteNotification: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/utils/pomodoroStorage', () => ({
  saveActivePomodoro: vi.fn().mockResolvedValue(true),
  loadActivePomodoro: vi.fn().mockResolvedValue(null),
  removeActivePomodoro: vi.fn().mockResolvedValue(true),
  savePendingCompletion: vi.fn().mockResolvedValue(true),
  loadPendingCompletion: vi.fn().mockResolvedValue(null),
  removePendingCompletion: vi.fn().mockResolvedValue(true),
  saveActiveBreak: vi.fn().mockResolvedValue(undefined),
  removeActiveBreak: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'settings') {
      return {
        pomodoro: {
          breakEndMessage: '休息结束',
          breakLabel: '休息',
        },
      }
    }
    return key
  }),
}))

vi.mock('@/settings', () => ({
  defaultPomodoroSettings: {
    recordMode: 'block',
    attrPrefix: 'custom-pomodoro',
  },
}))

const mockLoadActivePomodoro = vi.mocked(loadActivePomodoro)
const mockLoadPendingCompletion = vi.mocked(loadPendingCompletion)
const mockRemovePendingCompletion = vi.mocked(removePendingCompletion)
const mockSaveActivePomodoro = vi.mocked(saveActivePomodoro)

describe('pomodoroStore Getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('remainingTime 倒计时模式返回 remainingSeconds', () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 0,
        timerMode: 'countdown',
        targetDurationMinutes: 25,
      } as any,
    })
    expect(store.remainingTime).toBe(600)
  })

  it('elapsedSeconds 正计时模式返回 accumulatedSeconds', () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: {
        remainingSeconds: 0,
        accumulatedSeconds: 300,
        timerMode: 'stopwatch',
        targetDurationMinutes: 25,
      } as any,
    })
    expect(store.elapsedSeconds).toBe(300)
  })

  it('isStopwatch timerMode=stopwatch 时 true', () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: { timerMode: 'stopwatch' } as any,
    })
    expect(store.isStopwatch).toBe(true)
  })

  it('isStopwatch timerMode=countdown 时 false', () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: { timerMode: 'countdown' } as any,
    })
    expect(store.isStopwatch).toBe(false)
  })

  it('remainingTime 无 activePomodoro 时返回 0', () => {
    const store = usePomodoroStore()
    store.$patch({ activePomodoro: null })
    expect(store.remainingTime).toBe(0)
  })

  it('elapsedSeconds 无 activePomodoro 时返回 0', () => {
    const store = usePomodoroStore()
    store.$patch({ activePomodoro: null })
    expect(store.elapsedSeconds).toBe(0)
  })
})

describe('pomodoroStore POMODORO_TICK', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    emitSpy = vi.spyOn(eventBus, 'emit')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updateTimer 在专注进行中时 emit POMODORO_TICK', () => {
    const store = usePomodoroStore()
    const now = Date.now()
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 900,
        isPaused: false,
        timerMode: 'countdown',
        targetDurationMinutes: 25,
      } as any,
      timerStartTimestamp: now - 5000,
      lastAccumulatedSeconds: 895,
    })

    store.updateTimer()

    expect(emitSpy).toHaveBeenCalledWith(
      Events.POMODORO_TICK,
      expect.objectContaining({
        remainingSeconds: expect.any(Number),
        accumulatedSeconds: expect.any(Number),
        isPaused: false,
        isStopwatch: false,
        targetDurationMinutes: 25,
      }),
    )
  })

  it('updateTimer 在暂停时不 emit POMODORO_TICK', () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 900,
        isPaused: true,
        timerMode: 'countdown',
        targetDurationMinutes: 25,
      } as any,
      timerStartTimestamp: Date.now(),
      lastAccumulatedSeconds: 900,
    })

    emitSpy.mockClear()
    store.updateTimer()

    expect(emitSpy).not.toHaveBeenCalledWith(Events.POMODORO_TICK, expect.anything())
  })
})

describe('pomodoroStore BREAK_TICK', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    emitSpy = vi.spyOn(eventBus, 'emit')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('startBreak 的 breakInterval 每秒 emit BREAK_TICK', async () => {
    const store = usePomodoroStore()
    await store.startBreak(5)

    emitSpy.mockClear()
    vi.advanceTimersByTime(1000)

    expect(emitSpy).toHaveBeenCalledWith(
      Events.BREAK_TICK,
      expect.objectContaining({
        remainingSeconds: expect.any(Number),
        totalSeconds: 300,
      }),
    )
  })

  it('restoreBreak 的 breakInterval 每秒 emit BREAK_TICK', () => {
    const store = usePomodoroStore()
    const mockPlugin = {}
    store.restoreBreak(mockPlugin as any, 120, 300)

    emitSpy.mockClear()
    vi.advanceTimersByTime(1000)

    expect(emitSpy).toHaveBeenCalledWith(
      Events.BREAK_TICK,
      expect.objectContaining({
        remainingSeconds: 119,
        totalSeconds: 300,
      }),
    )
  })
})

describe('pomodoroStore mobile scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T06:00:00'))
    setActivePinia(createPinia())
    mockSchedulePomodoroFocusEnd.mockReset().mockResolvedValue(undefined)
    mockCancelPomodoroFocusEnd.mockReset()
    mockSchedulePomodoroBreakEnd.mockReset().mockResolvedValue(undefined)
    mockCancelPomodoroBreakEnd.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('startPomodoro schedules focus-end notification on mobile', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: true }
    const item = {
      id: 'item-1',
      content: 'Write tests',
      docId: 'doc-1',
      status: 'pending',
    } as any

    await store.startPomodoro(item, 25, 'block-1', plugin, 'countdown')

    expect(mockSchedulePomodoroFocusEnd).toHaveBeenCalledWith(expect.objectContaining({
      expectedEndAt: new Date('2026-05-07T06:25:00').getTime(),
      itemContent: 'Write tests',
    }))
  })

  it('pausePomodoro cancels focus-end notification on mobile', async () => {
    const store = usePomodoroStore()
    store.$patch({
      activePomodoro: {
        itemContent: 'Write tests',
        remainingSeconds: 1200,
        accumulatedSeconds: 300,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        targetDurationMinutes: 25,
        timerMode: 'countdown',
      } as any,
      timerStartTimestamp: Date.now() - 1000,
      lastAccumulatedSeconds: 299,
      timerInterval: 1,
    })

    await store.pausePomodoro({ isMobile: true })

    expect(mockCancelPomodoroFocusEnd).toHaveBeenCalledTimes(1)
  })

  it('startBreak schedules break-end notification on mobile', async () => {
    const store = usePomodoroStore()

    await store.startBreak(5, { isMobile: true })

    expect(mockSchedulePomodoroBreakEnd).toHaveBeenCalledWith(expect.objectContaining({
      expectedEndAt: new Date('2026-05-07T06:05:00').getTime(),
      breakLabel: '休息',
    }))
  })

  it('stopBreak cancels break-end notification on mobile', async () => {
    const store = usePomodoroStore()
    await store.startBreak(5, { isMobile: true })
    mockCancelPomodoroBreakEnd.mockClear()

    await store.stopBreak({ isMobile: true })

    expect(mockCancelPomodoroBreakEnd).toHaveBeenCalledTimes(1)
  })

  it('completePomodoro on mobile still triggers the unified completion notification path', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: true }
    const showPomodoroCompleteNotificationMock = vi.mocked(
      (await import('@/utils/notification')).showPomodoroCompleteNotification,
    )

    store.$patch({
      activePomodoro: {
        blockId: 'block-1',
        rootId: 'doc-1',
        itemId: 'item-1',
        itemContent: 'Write tests',
        startTime: new Date('2026-05-07T05:35:00').getTime(),
        accumulatedSeconds: 25 * 60,
        remainingSeconds: 0,
        targetDurationMinutes: 25,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      timerInterval: 1,
    })

    await store.completePomodoro(plugin as any)

    expect(showPomodoroCompleteNotificationMock).toHaveBeenCalledWith(
      'Write tests',
      25,
      expect.any(Function),
    )
  })
})

describe('pomodoroStore restorePomodoro', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restorePomodoro 未暂停时 startTimer', async () => {
    const store = usePomodoroStore()
    const now = Date.now()
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: now - 60000,
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: false,
      pauseCount: 0,
      totalPausedSeconds: 0,
      timerMode: 'countdown',
    } as any)

    await store.restorePomodoro({} as any)

    expect(store.timerInterval).not.toBeNull()
  })

  it('restorePomodoro 已暂停时不 startTimer', async () => {
    const store = usePomodoroStore()
    const now = Date.now()
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: now - 60000,
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: true,
      pauseCount: 1,
      totalPausedSeconds: 0,
      timerMode: 'countdown',
    } as any)

    await store.restorePomodoro({} as any)

    expect(store.timerInterval).toBeNull()
  })

  it('restorePomodoro 正确重算 accumulatedSeconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T06:02:00'))
    const store = usePomodoroStore()
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: new Date('2026-05-07T06:00:00').getTime(),
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: false,
      pauseCount: 0,
      totalPausedSeconds: 30,
      timerMode: 'countdown',
    } as any)

    await store.restorePomodoro({} as any)

    expect(store.activePomodoro).not.toBeNull()
    expect(store.activePomodoro!.accumulatedSeconds).toBe(90)
    expect(store.activePomodoro!.remainingSeconds).toBe(25 * 60 - 90)
    vi.useRealTimers()
  })

  it('restorePomodoro clears stale mobile focus-end when the restored session is already expired', async () => {
    const store = usePomodoroStore()
    mockCancelPomodoroFocusEnd.mockClear()
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: Date.now() - 30 * 60 * 1000,
      targetDurationMinutes: 25,
      accumulatedSeconds: 25 * 60,
      isPaused: false,
      pauseCount: 0,
      totalPausedSeconds: 0,
      timerMode: 'countdown',
    } as any)
    const expiredSpy = vi.spyOn(store, 'markExpiredPomodoroComplete').mockResolvedValue()

    const restored = await store.restorePomodoro({ isMobile: true } as any)

    expect(restored).toBe(false)
    expect(expiredSpy).toHaveBeenCalledTimes(1)
    expect(mockCancelPomodoroFocusEnd).toHaveBeenCalledTimes(1)
  })
})

describe('pomodoroStore autoExtendPomodoro', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T06:00:00'))
    setActivePinia(createPinia())
    mockSchedulePomodoroFocusEnd.mockReset().mockResolvedValue(undefined)
    mockCancelPomodoroFocusEnd.mockReset()
    mockLoadPendingCompletion.mockReset()
    mockRemovePendingCompletion.mockReset().mockResolvedValue(true)
    mockSaveActivePomodoro.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps pending completion when auto-extend save fails', async () => {
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)
    mockSaveActivePomodoro.mockResolvedValue(false)

    await store.autoExtendPomodoro({ isMobile: true } as any)

    expect(mockRemovePendingCompletion).not.toHaveBeenCalled()
    expect(store.activePomodoro).toBeNull()
    expect(mockSchedulePomodoroFocusEnd).not.toHaveBeenCalled()
  })

  it('reschedules mobile focus-end after successful auto-extend', async () => {
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b1',
      rootId: 'doc-root-1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      projectId: 'p1',
      taskId: 't1',
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    expect(mockSaveActivePomodoro).toHaveBeenCalledTimes(1)
    expect(store.activePomodoro?.rootId).toBe('doc-root-1')
    expect(mockRemovePendingCompletion).toHaveBeenCalledTimes(1)
    expect(mockSchedulePomodoroFocusEnd).toHaveBeenCalledWith(expect.objectContaining({
      expectedEndAt: new Date('2026-05-07T06:05:00').getTime(),
      itemContent: '测试',
    }))
  })
})

describe('pomodoroStore restoreBreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restoreBreak 启动 breakInterval，breakRemainingSeconds 递减', () => {
    const store = usePomodoroStore()
    const mockPlugin = {}
    store.restoreBreak(mockPlugin as any, 120, 300)

    expect(store.breakInterval).not.toBeNull()
    expect(store.breakRemainingSeconds).toBe(120)

    vi.advanceTimersByTime(1000)
    expect(store.breakRemainingSeconds).toBe(119)

    vi.advanceTimersByTime(2000)
    expect(store.breakRemainingSeconds).toBe(117)
  })
})
