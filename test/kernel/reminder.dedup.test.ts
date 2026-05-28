import type {
  KernelData,
  TimerEntry,
} from '@/kernel/types'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mockRegisterTimers = vi.fn<(entries: TimerEntry[]) => void>()
const mockCancelTimersByType = vi.fn<(type: string) => void>()
const mockCalculateReminderTime = vi.fn<(...args: any[]) => number>()

const mockStorageGet = vi.fn<(path: string) => Promise<{ json: () => Promise<KernelData> }>>()

vi.mock('@/kernel/scheduler', () => ({
  registerTimers: mockRegisterTimers,
  cancelTimersByType: mockCancelTimersByType,
}))

vi.mock('@/kernel/utils', () => ({
  calculateReminderTime: mockCalculateReminderTime,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockCancelTimersByType.mockReturnValue(undefined)
  mockRegisterTimers.mockReturnValue(undefined)

  const now = Date.now()
  mockCalculateReminderTime.mockReturnValue(now + 3600 * 1000)

  const emptyData: KernelData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: [],
    projects: [],
    items: [],
    habits: [],
  }
  mockStorageGet.mockResolvedValue({
    json: () => Promise.resolve(emptyData),
  })

  globalThis.siyuan = {
    storage: {
      get: mockStorageGet,
    },
  } as any
})

async function callRebuild(): Promise<void> {
  const { rebuildReminderSchedule } = await import('@/kernel/reminder')
  await rebuildReminderSchedule()
}

function makeItem(overrides: Partial<KernelData['items'][0]> = {}): KernelData['items'][0] {
  return {
    id: 'item-1',
    blockId: 'stable-block-id',
    content: 'test item',
    date: '2026-05-28',
    startDateTime: undefined,
    endDateTime: undefined,
    status: 'todo',
    projectName: undefined,
    taskName: undefined,
    projectId: 'proj-1',
    links: undefined,
    pomodoros: [],
    reminder: {
      enabled: true,
      type: 'absolute',
      time: '10:00',
    },
    ...overrides,
  }
}

function makeHabit(overrides: Partial<KernelData['habits'][0]> = {}): KernelData['habits'][0] {
  return {
    id: 'habit-1',
    name: 'test habit',
    type: 'daily',
    targetDate: '2026-05-28',
    blockId: 'block-h1',
    reminder: {
      enabled: true,
      type: 'absolute',
      time: '08:00',
    },
    ...overrides,
  }
}

describe('rebuildReminderSchedule — timer registration', () => {
  it('registers reminder entries with notified=false by default', async () => {
    const item = makeItem()
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered.length).toBe(1)
    expect(registered[0].notified).toBe(false)
  })

  it('registers habit entries', async () => {
    const habit = makeHabit()
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [],
      habits: [habit],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered.length).toBe(1)
    expect(registered[0].type).toBe('habit')
  })

  it('does not call registerTimers when no entries are produced', async () => {
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockRegisterTimers).not.toHaveBeenCalled()
  })

  it('cancels timers before registering new ones', async () => {
    const item = makeItem()
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockCancelTimersByType).toHaveBeenCalledWith('reminder')
    expect(mockCancelTimersByType).toHaveBeenCalledWith('habit')
  })
})

describe('handleFsNotify — .tmp file filtering', () => {
  async function importHandleFsNotify() {
    const mod = await import('@/kernel/reminder')
    return mod.handleFsNotify
  }

  it('ignores .tmp file events and does not log', async () => {
    const handleFsNotify = await importHandleFsNotify()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleFsNotify({
      type: 'fs-notify',
      detail: {
        path: 'kernel-data.json.tmp',
      },
    })

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[reminder] fs-notify:'))

    logSpy.mockRestore()
  })

  it('processes non-.tmp file events normally', async () => {
    const handleFsNotify = await importHandleFsNotify()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleFsNotify({
      type: 'fs-notify',
      detail: {
        path: 'kernel-data.json',
      },
    })

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[reminder] fs-notify: path=kernel-data.json'))

    logSpy.mockRestore()
  })

  it('ignores timer-registry.json events and does not trigger rebuild', async () => {
    const handleFsNotify = await importHandleFsNotify()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleFsNotify({
      type: 'fs-notify',
      detail: {
        path: 'timer-registry.json',
      },
    })

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[reminder] fs-notify: path=timer-registry.json'))

    logSpy.mockRestore()
  })
})

describe('rebuildReminderSchedule — timer ID uses blockId', () => {
  it('uses blockId instead of item.id in timer ID when blockId is present', async () => {
    const item = makeItem({ id: 'volatile-id-123', blockId: 'stable-block-id' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered.length).toBe(1)
    expect(registered[0].id).toContain('stable-block-id')
    expect(registered[0].id).not.toContain('volatile-id-123')
  })

  it('uses blockId in metadata.blockId when blockId is present', async () => {
    const item = makeItem({ id: 'volatile-id-456', blockId: 'stable-block-id-2' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered[0].metadata.blockId).toBe('stable-block-id-2')
  })

  it('falls back to item.id when blockId is undefined', async () => {
    const item = makeItem({ id: 'fallback-id', blockId: undefined })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered[0].id).toContain('fallback-id')
    expect(registered[0].metadata.blockId).toBe('fallback-id')
  })

  it('rebuild with same blockId produces same timer ID, preserving notified state', async () => {
    const item = makeItem({ id: 'old-volatile-id', blockId: 'stable-block-id' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()
    const firstId = (mockRegisterTimers.mock.calls[0][0] as TimerEntry[])[0].id

    vi.clearAllMocks()
    mockCancelTimersByType.mockReturnValue(undefined)
    mockRegisterTimers.mockReturnValue(undefined)

    const item2 = makeItem({ id: 'new-volatile-id', blockId: 'stable-block-id' })
    const data2: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item2],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data2),
    })

    await callRebuild()
    const secondId = (mockRegisterTimers.mock.calls[0][0] as TimerEntry[])[0].id

    expect(firstId).toBe(secondId)
  })
})
