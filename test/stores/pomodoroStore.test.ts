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
  savePendingCompletion,
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

const mockIsMobileNotificationsEnabled = vi.hoisted(() => vi.fn(() => false))

const mockKernelAvailable = vi.hoisted(() => ({ value: false }))
const mockRegisterTimer = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }))
const mockCancelTimer = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }))

// Mock dependencies
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({
    kernel: {
      rpc: {
        call: {
          registerTimer: mockRegisterTimer,
          cancelTimer: mockCancelTimer,
          cancelTimersByType: vi.fn().mockResolvedValue({ ok: true }),
        },
      },
    },
  })),
}))

vi.mock('@/composables/useKernelTimer', () => ({
  kernelAvailable: mockKernelAvailable,
}))

vi.mock('@/services/mobileNotificationScheduler', () => ({
  mobileNotificationScheduler: {
    schedulePomodoroFocusEnd: (...args: unknown[]) => mockSchedulePomodoroFocusEnd(...args),
    cancelPomodoroFocusEnd: (...args: unknown[]) => mockCancelPomodoroFocusEnd(...args),
    schedulePomodoroBreakEnd: (...args: unknown[]) => mockSchedulePomodoroBreakEnd(...args),
    cancelPomodoroBreakEnd: (...args: unknown[]) => mockCancelPomodoroBreakEnd(...args),
    isMobileNotificationsEnabled: mockIsMobileNotificationsEnabled,
  },
}))

vi.mock('@/api', () => ({
  setBlockAttrs: vi.fn(),
  getBlockAttrs: vi.fn(),
}))

vi.mock('@/utils/blockWriter', () => ({
  insertBlockAfter: vi.fn().mockResolvedValue(true),
  writeBlock: vi.fn().mockResolvedValue(true),
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
const mockSavePendingCompletion = vi.mocked(savePendingCompletion)

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
    mockIsMobileNotificationsEnabled.mockReturnValue(true)
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
    mockIsMobileNotificationsEnabled.mockReturnValue(true)
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


describe('pomodoroStore completePomodoro durationMinutes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSavePendingCompletion.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('倒计时模式：durationMinutes = round(accumulatedSeconds/60)（实际专注时长）', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-1',
        rootId: 'doc-1',
        itemId: 'item-1',
        itemContent: '设2分钟专注正常到期',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 120,
        remainingSeconds: 0,
        targetDurationMinutes: 2,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      timerInterval: 1,
    })

    await store.completePomodoro(plugin as any)

    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
    const pending = mockSavePendingCompletion.mock.calls[0][1]
    expect(pending.durationMinutes).toBe(2)
    expect(pending.accumulatedSeconds).toBe(120)
  })

  it('倒计时模式手动提前结束：durationMinutes = 实际专注时长（非目标时长）', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-2',
        rootId: 'doc-2',
        itemId: 'item-2',
        itemContent: '设25分钟专注1分钟手动结束',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 90,
        remainingSeconds: 30,
        targetDurationMinutes: 25,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      timerInterval: 1,
    })

    await store.completePomodoro(plugin as any)

    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
    const pending = mockSavePendingCompletion.mock.calls[0][1]
    // 实专注 90 秒 → round(90/60)=2 分钟，不是目标 25 分钟
    expect(pending.durationMinutes).toBe(Math.round(90 / 60))
  })

  it('正计时（stopwatch）→ durationMinutes = round(accumulated/60)', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-3',
        rootId: 'doc-3',
        itemId: 'item-3',
        itemContent: '正计时',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 150,
        remainingSeconds: 0,
        targetDurationMinutes: 16 * 60,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'stopwatch',
      } as any,
      timerInterval: 1,
    })

    await store.completePomodoro(plugin as any)

    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
    const pending = mockSavePendingCompletion.mock.calls[0][1]
    expect(pending.durationMinutes).toBe(Math.round(150 / 60))
  })

  // 回归测试：completePomodoro 内同步累计秒数时不能触发 updateTimer 的完成检查递归
  // 复现真实运行场景：timerStartTimestamp 已设、accumulatedSeconds 已达目标、kernel 不可用
  it('倒计时到期时 completePomodoro 能正常结束专注（不递归崩溃）', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-recur',
        rootId: 'doc-recur',
        itemId: 'item-recur',
        itemContent: '倒计时到期',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 120,
        remainingSeconds: 0,
        targetDurationMinutes: 2,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      // 模拟真实运行：timerStartTimestamp 已设，lastAccumulatedSeconds 已达目标
      // 这样 updateTimer 内部会再次触发 completePomodoro（kernelAvailable=false 时）
      timerStartTimestamp: Date.now(),
      lastAccumulatedSeconds: 120,
      timerInterval: 1,
    })

    await store.completePomodoro(plugin as any)

    // 递归崩溃时 activePomodoro 不会被清空（清空逻辑在递归点之后）
    expect(store.activePomodoro).toBeNull()
    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
  })

  it('completePomodoro 重入保护：并发第二次调用返回 false 且不重复保存', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-reentry',
        rootId: 'doc-reentry',
        itemId: 'item-reentry',
        itemContent: '重入测试',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 120,
        remainingSeconds: 0,
        targetDurationMinutes: 2,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      timerInterval: 1,
    })

    mockSavePendingCompletion.mockClear()

    // 并发触发两次 completePomodoro（模拟内核广播 + 手动结束同时发生）
    const [result1, result2] = await Promise.all([
      store.completePomodoro(plugin as any),
      store.completePomodoro(plugin as any),
    ])

    // 第一次成功，第二次被重入防线拦截
    expect(result1).toBe(true)
    expect(result2).toBe(false)
    // savePendingCompletion 只被调用一次（重入保护生效）
    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
    // 状态已清空
    expect(store.activePomodoro).toBeNull()
    expect(store.timerInterval).toBeNull()
  })
})

describe('pomodoroStore autoExtendPomodoro', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T06:00:00'))
    setActivePinia(createPinia())
    mockIsMobileNotificationsEnabled.mockReturnValue(true)
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

  it('kernel 可用时注册新 timer 并取消旧 timer', async () => {
    mockKernelAvailable.value = true
    mockRegisterTimer.mockClear()
    mockCancelTimer.mockClear()
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试事项',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    expect(mockCancelTimer).toHaveBeenCalledWith({ id: 'pomodoro-b1' })
    expect(mockRegisterTimer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pomodoro-b1',
      type: 'pomodoro',
    }))
    const callArg = mockRegisterTimer.mock.calls[0][0]
    expect(callArg.endTime).toBeCloseTo(Math.floor((Date.now() + 5 * 60 * 1000) / 1000), -1)
    mockKernelAvailable.value = false
  })

  it('kernel 不可用时不调用 registerTimer', async () => {
    mockKernelAvailable.value = false
    mockRegisterTimer.mockClear()
    mockCancelTimer.mockClear()
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b2',
      itemId: 'i2',
      itemContent: '测试事项',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    expect(mockRegisterTimer).not.toHaveBeenCalled()
    expect(mockCancelTimer).not.toHaveBeenCalled()
  })

  it('非整分钟 accumulatedSeconds 时 remainingSeconds 精确等于 extendMinutes*60', async () => {
    mockKernelAvailable.value = true
    mockRegisterTimer.mockClear()
    mockCancelTimer.mockClear()
    const store = usePomodoroStore()
    // 25 分 1 秒 = 1501 秒，Math.ceil(1501/60)=26 会多算 1 分钟
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b3',
      itemId: 'i3',
      itemContent: '非整分钟测试',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60 + 1,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    // accumulatedSeconds 应对齐到整分钟（1500）
    expect(store.activePomodoro?.accumulatedSeconds).toBe(25 * 60)
    // remainingSeconds 应精确等于 extendMinutes*60（300），而非 359
    expect(store.activePomodoro?.remainingSeconds).toBe(5 * 60)
    // targetDurationMinutes 应为 25 + 5 = 30
    expect(store.activePomodoro?.targetDurationMinutes).toBe(30)
    // 内核注册的 endTime 应基于精确的 remainingSeconds
    const callArg = mockRegisterTimer.mock.calls[0][0]
    expect(callArg.endTime).toBe(Math.floor((Date.now() + 5 * 60 * 1000) / 1000))
    mockKernelAvailable.value = false
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
