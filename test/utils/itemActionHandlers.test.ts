import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mockCompleteItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockAbandonItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToToday = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToDate = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockToggleItemPinned = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSkipOccurrenceItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockShowPomodoroTimerDialog = vi.fn()
const mockShowFocusPlanDialog = vi.fn()
const mockShowItemDetailModal = vi.fn()
const mockShowDatePickerDialog = vi.fn()
const mockOpenDocumentAtLine = vi.fn()
const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('@/utils/itemActions', () => ({
  completeItem: mockCompleteItem,
  abandonItem: mockAbandonItem,
  migrateItem: mockMigrateItem,
  migrateItemToToday: mockMigrateItemToToday,
  migrateItemToDate: mockMigrateItemToDate,
  skipOccurrenceItem: mockSkipOccurrenceItem,
}))

vi.mock('@/utils/itemSettingUtils', () => ({
  toggleItemPinned: mockToggleItemPinned,
}))

vi.mock('@/utils/dialog', () => ({
  showPomodoroTimerDialog: mockShowPomodoroTimerDialog,
  showFocusPlanDialog: mockShowFocusPlanDialog,
  showItemDetailModal: mockShowItemDetailModal,
  showDatePickerDialog: mockShowDatePickerDialog,
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: mockOpenDocumentAtLine,
}))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

describe('getItemActionHandlers', () => {
  const mockItem = {
    id: 'item-1',
    blockId: 'block-1',
    docId: 'doc-1',
    lineNumber: 5,
    date: '2026-06-11',
    status: 'pending',
    content: '测试事项',
  } as any

  const mockPlugin = { openCustomTab: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('complete 调用 completeItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.complete()
    expect(mockCompleteItem).toHaveBeenCalledWith(mockItem)
  })

  it('abandon 调用 abandonItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.abandon()
    expect(mockAbandonItem).toHaveBeenCalledWith(mockItem)
  })

  it('migrate 调用 migrateItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.migrate()
    expect(mockMigrateItem).toHaveBeenCalledWith(mockItem)
  })

  it('migrateToToday 调用 migrateItemToToday', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.migrateToToday()
    expect(mockMigrateItemToToday).toHaveBeenCalledWith(mockItem)
  })

  it('togglePinned 调用 toggleItemPinned', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.togglePinned()
    expect(mockToggleItemPinned).toHaveBeenCalledWith(mockItem)
  })

  it('skipOccurrence 调用 skipOccurrenceItem', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.skipOccurrence()
    expect(mockSkipOccurrenceItem).toHaveBeenCalledWith(mockPlugin, mockItem)
  })

  it('startFocus 调用 showPomodoroTimerDialog', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.startFocus()
    expect(mockShowPomodoroTimerDialog).toHaveBeenCalledWith(mockItem.blockId)
  })

  it('focusPlan 调用 showFocusPlanDialog', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.focusPlan()
    expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(mockItem)
  })

  it('openDetail 调用 showItemDetailModal', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openDetail()
    expect(mockShowItemDetailModal).toHaveBeenCalledWith(mockItem, { showAllDates: true })
  })

  it('openCalendar 调用 plugin.openCustomTab', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openCalendar()
    expect(mockPlugin.openCustomTab).toHaveBeenCalled()
  })

  it('openDoc 调用 openDocumentAtLine', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    handlers.openDoc()
    expect(mockOpenDocumentAtLine).toHaveBeenCalledWith(mockItem.docId, mockItem.lineNumber, mockItem.blockId)
  })

  it('setPriority 调用 writeBlock', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.setPriority('high')
    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: mockItem.blockId },
      {
        type: 'setPriority',
        priority: 'high',
      },
    )
  })

  it('afterAction 在操作成功后调用', async () => {
    const afterAction = vi.fn()
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin, { afterAction })
    await handlers.complete()
    expect(afterAction).toHaveBeenCalled()
  })

  it('migrateToDate 调用 migrateItemToDate', async () => {
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    await handlers.migrateToDate('2026-06-15')
    expect(mockMigrateItemToDate).toHaveBeenCalledWith(mockItem, '2026-06-15')
  })

  it('isProcessing 在异步操作期间为 true', async () => {
    let resolveComplete!: (value: boolean) => void
    mockCompleteItem.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveComplete = resolve
      }),
    )
    const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
    const handlers = getItemActionHandlers(mockItem, mockPlugin)
    expect(handlers.isProcessing.value).toBe(false)
    const promise = handlers.complete()
    expect(handlers.isProcessing.value).toBe(true)
    resolveComplete!(true)
    await promise
    expect(handlers.isProcessing.value).toBe(false)
  })
})
