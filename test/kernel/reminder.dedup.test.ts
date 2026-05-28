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

const mockIsTimerNotified = vi.fn<(id: string) => boolean>()
const mockRegisterTimers = vi.fn<(entries: TimerEntry[]) => void>()
const mockCancelTimersByType = vi.fn<(type: string) => void>()
const mockCalculateReminderTime = vi.fn<(...args: any[]) => number>()

const mockStorageGet = vi.fn<(path: string) => Promise<{ json: () => Promise<KernelData> }>>()

vi.mock('@/kernel/scheduler', () => ({
  isTimerNotified: mockIsTimerNotified,
  registerTimers: mockRegisterTimers,
  cancelTimersByType: mockCancelTimersByType,
}))

vi.mock('@/kernel/utils', () => ({
  calculateReminderTime: mockCalculateReminderTime,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockIsTimerNotified.mockReturnValue(false)
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

describe('rebuildReminderSchedule — notified state restoration', () => {
  it('restores notified=true for entries whose id is in notifiedTimerIds', async () => {
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

    const expectedId = `reminder-${item.id}-${item.date}-${mockCalculateReminderTime()}`
    mockIsTimerNotified.mockImplementation((id: string) => id === expectedId)

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    const entry = registered.find((e) => e.id === expectedId)
    expect(entry).toBeDefined()
    expect(entry!.notified).toBe(true)
  })

  it('keeps notified=false for entries whose id is NOT in notifiedTimerIds', async () => {
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

    mockIsTimerNotified.mockReturnValue(false)

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered.length).toBe(1)
    expect(registered[0].notified).toBe(false)
  })

  it('handles mixed notified states across multiple entries', async () => {
    const item1 = makeItem({ id: 'item-a' })
    const item2 = makeItem({ id: 'item-b' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item1, item2],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    const notifiedId = `reminder-${item1.id}-${item1.date}-${mockCalculateReminderTime()}`
    mockIsTimerNotified.mockImplementation((id: string) => id === notifiedId)

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    const entryA = registered.find((e) => e.id.includes('item-a'))
    const entryB = registered.find((e) => e.id.includes('item-b'))
    expect(entryA!.notified).toBe(true)
    expect(entryB!.notified).toBe(false)
  })

  it('restores notified=true for habit entries', async () => {
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

    const expectedId = `habit-${habit.blockId}-${habit.targetDate}-${mockCalculateReminderTime()}`
    mockIsTimerNotified.mockImplementation((id: string) => id === expectedId)

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    const entry = registered.find((e) => e.id === expectedId)
    expect(entry).toBeDefined()
    expect(entry!.notified).toBe(true)
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

  it('calls isTimerNotified for every entry before registerTimers', async () => {
    const item1 = makeItem({ id: 'item-x' })
    const item2 = makeItem({ id: 'item-y' })
    const habit1 = makeHabit({ blockId: 'block-hz' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item1, item2],
      habits: [habit1],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    mockIsTimerNotified.mockReturnValue(false)

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    expect(mockIsTimerNotified).toHaveBeenCalledTimes(3)
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
})
