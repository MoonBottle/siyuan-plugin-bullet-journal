// @vitest-environment happy-dom

import type { Item } from '@/types/models'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  h,
  nextTick,
  ref,
} from 'vue'
import TodoSidebarList from '@/components/todo/TodoSidebarList.vue'

const mockToggleItemPinned = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockShowFocusPlanDialog = vi.hoisted(() => vi.fn())
const mockCompleteItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockAbandonItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToToday = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItemToDate = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('siyuan', async () => {
  return await import('../../__mocks__/siyuan')
})
const pendingItem: Item = {
  id: 'item-1',
  content: '处理优先级',
  date: '2026-05-01',
  lineNumber: 1,
  docId: 'doc-1',
  blockId: 'block-1',
  status: 'pending',
  priority: 'high',
  project: {
    id: 'project-1',
    name: '项目A',
    tasks: [],
    habits: [],
    links: [],
    path: '/',
  },
}

const mockProjectStore = {
  currentDate: '2026-05-01',
  loading: false,
  hideCompleted: false,
  hideAbandoned: false,
  getDisplayItems: vi.fn(() => [pendingItem]),
}

const mockPomodoroStore = {
  isFocusing: false,
  activePomodoro: null,
  restorePomodoro: vi.fn(() => Promise.resolve(false)),
}

const mockSettingsStore = {
  groups: [] as Array<{ id: string, name: string }>,
}

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
  usePomodoroStore: () => mockPomodoroStore,
  useSettingsStore: () => mockSettingsStore,
}))

vi.mock('@/main', () => ({
  usePlugin: () => null,
  useApp: () => null,
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        loading: '加载中',
        expired: '已过期',
        today: '今天',
        tomorrow: '明天',
        future: '未来',
        completed: '已完成',
        abandoned: '已放弃',
        allDay: '全天',
        detail: '详情',
        calendar: '日历',
        complete: '完成',
        abandon: '放弃',
        startFocusAria: '开始专注',
        migrateToToday: '迁移到今天',
        migrateToTomorrow: '迁移到明天',
        emptyGuideTitle: '空',
        emptyGuideDesc: '空',
        createExampleDoc: '创建',
        pinned: '已置顶',
        pin: '置顶',
        unpin: '取消置顶',
        openDoc: '打开文档',
      }
    }
    if (key === 'common') {
      return {
        loading: '加载中',
      }
    }
    if (key === 'statusTag') {
      return {
        completed: '#done',
        abandoned: '#abandoned',
      }
    }
    if (key === 'pomodoro') {
      return {
        startFocusTitle: '开始专注',
      }
    }
    if (key === 'focusPlan') {
      return {
        estimatedShort: '预计',
        setAction: '设置预计',
        editAction: '修改预计',
      }
    }
    if (key === 'recurring') {
      return {
        skipThis: '跳过本次',
        skipTooltip: '跳过本次，下次日期：{date}',
      }
    }
    return {}
  }),
}))

vi.mock('@/components/SiyuanTheme/SyLoading.vue', () => ({
  default: {
    name: 'SyLoadingStub',
    template: '<div data-testid="todo-loading-stub"></div>',
  },
}))

vi.mock('@/components/todo/TodoItemMeta.vue', () => ({
  default: {
    name: 'TodoItemMetaStub',
    props: ['item'],
    template: '<div data-testid="todo-item-meta-stub"></div>',
  },
}))

vi.mock('@/components/pomodoro/PomodoroTimerDialog.vue', () => ({
  default: {
    name: 'PomodoroTimerDialogStub',
    template: '<div></div>',
  },
}))

vi.mock('@/utils/dateUtils', () => ({
  formatDateLabel: (date: string) => date,
  formatTimeRange: () => '',
}))

vi.mock('@/utils/dateRangeUtils', () => ({
  getDateRangeStatus: vi.fn(() => ''),
  getTimeRangeStatus: vi.fn(() => ''),
  dateRangeStatusToEmoji: vi.fn(() => ''),
  getEffectiveDate: (item: Item) => item.date,
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

vi.mock('@/utils/dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/dialog')>()

  return {
    ...actual,
    showItemDetailModal: vi.fn(),
    showDatePickerDialog: vi.fn(),
    createDialog: vi.fn(),
    showFocusPlanDialog: mockShowFocusPlanDialog,
  }
})

vi.mock('@/utils/contextMenu', () => ({
  showContextMenu: vi.fn(),
  createItemMenu: vi.fn(() => ({})),
}))

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    on: vi.fn(() => () => {}),
  },
  Events: {
    POMODORO_RESTORE: 'pomodoro:restore',
  },
}))

vi.mock('@/utils/exampleDocUtils', () => ({
  createExampleDocument: vi.fn(),
}))

vi.mock('@/utils/itemSettingUtils', () => ({
  toggleItemPinned: mockToggleItemPinned,
}))

vi.mock('@/utils/itemActions', () => ({
  completeItem: mockCompleteItem,
  abandonItem: mockAbandonItem,
  migrateItem: mockMigrateItem,
  migrateItemToToday: mockMigrateItemToToday,
  migrateItemToDate: mockMigrateItemToDate,
}))

vi.mock('@/utils/itemActionHandlers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/itemActionHandlers')>()
  return {
    ...actual,
  }
})

vi.mock('@/services/recurringService', () => ({
  skipCurrentOccurrence: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/composables/useBlockFocusPreview', () => ({
  useBlockFocusPreview: () => ({
    showNow: vi.fn(),
    isOpen: { value: false },
    activeBlockId: { value: null },
    anchorEl: { value: null },
    markPopoverHovered: vi.fn(),
    forceClose: vi.fn(),
    dispose: vi.fn(),
  }),
}))

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: vi.fn(),
    close: vi.fn(),
    containsTarget: vi.fn(() => false),
  }),
}))

vi.mock('@/parser/recurringParser', () => ({
  getNextOccurrenceDate: vi.fn(() => '2026-05-08'),
}))

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    format: () => '2026-05-01',
    add: () => ({
      format: () => '2026-05-02',
    }),
  }),
}))

function mountList(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render() {
      return h(TodoSidebarList, props)
    },
  })

  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function mountReactiveList(initialItems: Item[]) {
  const items = ref(initialItems)
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    setup() {
      return {
        items,
      }
    },
    render() {
      return h(TodoSidebarList, {
        items: this.items,
        hasAnyItemsRaw: true,
      })
    },
  })

  app.mount(container)

  return {
    container,
    items,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  mockProjectStore.hideCompleted = false
  mockProjectStore.hideAbandoned = false
  mockToggleItemPinned.mockClear()
  mockWriteBlock.mockReset()
  mockWriteBlock.mockResolvedValue(true)
  mockCompleteItem.mockReset()
  mockCompleteItem.mockResolvedValue(true)
  mockAbandonItem.mockReset()
  mockAbandonItem.mockResolvedValue(true)
  mockMigrateItem.mockReset()
  mockMigrateItem.mockResolvedValue(true)
  mockMigrateItemToToday.mockReset()
  mockMigrateItemToToday.mockResolvedValue(true)
  mockMigrateItemToDate.mockReset()
  mockMigrateItemToDate.mockResolvedValue(true)
})

describe('todoSidebarList', () => {
  it('renders a neutral panel empty state when configured for embedded panel mode', async () => {
    const mounted = mountList({
      items: [],
      hasAnyItemsRaw: true,
      hasActiveFilters: true,
      emptyStateMode: 'panel',
      emptyStateTitle: '当前象限暂无事项',
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('当前象限暂无事项')
    expect(mounted.container.textContent).not.toContain('没有找到符合条件的事项')

    mounted.unmount()
  })

  it('keeps rendered items visible while loading when partial results already exist', async () => {
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
      loading: true,
    })

    await nextTick()

    expect(mounted.container.querySelector('[data-testid="todo-loading-stub"]')).toBeNull()
    expect(mounted.container.textContent).toContain('处理优先级')

    mounted.unmount()
  })

  it('事项存在 focusPlan 时显示预计时长标签', async () => {
    const mounted = mountList({
      items: [{
        ...pendingItem,
        focusPlan: {
          type: 'duration',
          rawValue: 70,
          normalizedMinutes: 70,
          sourceText: '⏳1h10m',
        },
      }],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('⏳1h10m')

    mounted.unmount()
  })

  it('事项存在 focusPlan 时显示预计番茄钟标签', async () => {
    const mounted = mountList({
      items: [{
        ...pendingItem,
        focusPlan: {
          type: 'pomodoro',
          rawValue: 3,
          normalizedMinutes: 75,
          sourceText: '🍅x3',
        },
      }],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('🍅x3')

    mounted.unmount()
  })

  it('pending 事项操作栏显示设置预计，并可打开预计弹框', async () => {
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    const planButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '设置预计') as HTMLElement | undefined

    expect(planButton).toBeTruthy()

    planButton?.click()

    expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
    )

    mounted.unmount()
  })

  it('emits drag-start payload for embedded cards when drag support is enabled', async () => {
    const onItemDragStart = vi.fn()
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart,
    })

    await nextTick()

    const card = mounted.container.querySelector('.todo-list .ta-card') as HTMLDivElement | null
    expect(card).not.toBeNull()
    expect(card?.classList.contains('card')).toBe(false)
    expect(card?.getAttribute('draggable')).toBe('true')

    const setData = vi.fn()
    const dragStartEvent = new Event('dragstart', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        setData,
        effectAllowed: 'none',
      },
      configurable: true,
    })
    card?.dispatchEvent(dragStartEvent)

    expect(onItemDragStart).toHaveBeenCalledTimes(1)
    expect(onItemDragStart).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    }, dragStartEvent)

    mounted.unmount()
  })

  it('emits preview-click payload and suppresses document open when previewTriggerMode is click', async () => {
    const onItemPreviewClick = vi.fn()
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
      displayMode: 'embedded',
      previewTriggerMode: 'click',
      onItemPreviewClick,
    })

    await nextTick()

    const card = mounted.container.querySelector('.todo-list .ta-card') as HTMLDivElement | null
    expect(card).not.toBeNull()
    expect(card?.classList.contains('card')).toBe(false)

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
    card?.dispatchEvent(clickEvent)

    expect(onItemPreviewClick).toHaveBeenCalledTimes(1)
    expect(onItemPreviewClick).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl: card,
    }, clickEvent)

    mounted.unmount()
  })

  it('renders priority emoji in header and project name in task line and keeps status emoji in content line', async () => {
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    const headerRightEl = mounted.container.querySelector('.item-header-right') as HTMLDivElement | null
    const taskEl = mounted.container.querySelector('.item-task') as HTMLDivElement | null
    const contentEl = mounted.container.querySelector('.item-content') as HTMLDivElement | null

    expect(headerRightEl?.textContent?.trim()).toContain('🔥')
    expect(headerRightEl?.textContent?.trim()).not.toContain('项目A')
    expect(taskEl?.textContent?.trim()).toContain('项目A')
    expect(contentEl?.textContent?.trim()).toBe('处理优先级')

    mounted.unmount()
  })

  it('hides the shared icon tooltip after clicking complete when the action row is removed', async () => {
    const { WRAPPER_ID } = await import('@/utils/tooltip')
    const mounted = mountReactiveList([pendingItem])

    mockCompleteItem.mockImplementationOnce(async () => {
      mounted.items.value = []
      return true
    })

    await nextTick()

    const completeAction = mounted.container.querySelector('.item-action-bar .block__icon[aria-label="完成"]') as HTMLSpanElement | null
    expect(completeAction).not.toBeNull()

    completeAction?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    await nextTick()

    const wrapper = document.getElementById(WRAPPER_ID)
    expect(wrapper).not.toBeNull()
    const inner = wrapper?.firstElementChild as HTMLElement | null
    expect(inner?.getAttribute('aria-label')).toBe('完成')
    expect(inner?.classList.contains('sy-tip-visible')).toBe(true)

    completeAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await nextTick()

    expect(mounted.container.querySelector('.item-action-bar .block__icon[aria-label="完成"]')).toBeNull()
    expect(inner?.classList.contains('sy-tip-visible')).toBe(false)

    mounted.unmount()
  })

  it('calls completeItem when completing an item from the list', async () => {
    const mounted = mountList({
      items: [pendingItem],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    const completeAction = mounted.container.querySelector('.item-action-bar .block__icon[aria-label="完成"]') as HTMLSpanElement | null
    expect(completeAction).not.toBeNull()

    completeAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()

    expect(mockCompleteItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        blockId: 'block-1',
      }),
    )

    mounted.unmount()
  })

  it('calls migrateItem when migrating today item to tomorrow', async () => {
    const mounted = mountList({
      items: [{
        ...pendingItem,
        startDateTime: '2026-05-01 14:00',
        endDateTime: '2026-05-01 15:30',
        siblingItems: [{ date: '2026-05-03' }],
      }],
      hasAnyItemsRaw: true,
    })

    await nextTick()

    const migrateAction = mounted.container.querySelector('.item-action-bar .block__icon[aria-label="迁移到明天"]') as HTMLSpanElement | null
    expect(migrateAction).not.toBeNull()

    migrateAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()

    expect(mockMigrateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        blockId: 'block-1',
      }),
    )

    mounted.unmount()
  })
})
