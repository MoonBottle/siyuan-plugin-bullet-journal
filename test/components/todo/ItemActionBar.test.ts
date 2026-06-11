// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'

const mockShowFocusPlanDialog = vi.fn()
const mockCompleteItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockAbandonItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockMigrateItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockToggleItemPinned = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSkipOccurrenceItem = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockShowItemDetailModal = vi.fn()

vi.mock('@/stores', () => ({
  usePomodoroStore: () => ({
    isFocusing: false,
  }),
}))

vi.mock('@/main', () => ({
  useApp: () => ({}),
  usePlugin: () => ({
    openCustomTab: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => {
  const todo = {
    complete: '完成',
    startFocusAria: '开始专注',
    abandon: '放弃',
    openDoc: '打开文档',
    calendar: '日历',
    migrateToToday: '迁移到今天',
    migrateToTomorrow: '迁移到明天',
    detail: '详情',
    pin: '置顶',
    unpin: '取消置顶',
  }
  const focusPlan = {
    setAction: '设置预计',
    editAction: '修改预计',
  }
  const recurring = {
    skipThis: '跳过本次',
    skipTooltip: '跳过本次，下次：{date}',
  }
  const flatMap: Record<string, string> = {
    'todo.complete': '完成',
    'todo.startFocusAria': '开始专注',
    'todo.abandon': '放弃',
    'todo.openDoc': '打开文档',
    'todo.calendar': '日历',
    'todo.migrateToToday': '迁移到今天',
    'todo.migrateToTomorrow': '迁移到明天',
    'todo.detail': '详情',
    'todo.pin': '置顶',
    'todo.unpin': '取消置顶',
    'focusPlan.setAction': '设置预计',
    'focusPlan.editAction': '修改预计',
    'recurring.skipThis': '跳过本次',
    'recurring.skipTooltip': '跳过本次，下次：{date}',
  }
  return {
    t: vi.fn((key: string, params?: Record<string, string>) => {
      if (key === 'todo') return todo
      if (key === 'focusPlan') return focusPlan
      if (key === 'recurring') return recurring
      let result = flatMap[key] ?? ''
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, v)
        }
      }
      return result
    }),
  }
})

vi.mock('@/utils/dialog', () => ({
  showPomodoroTimerDialog: vi.fn(),
  showFocusPlanDialog: mockShowFocusPlanDialog,
  showItemDetailModal: mockShowItemDetailModal,
}))

vi.mock('@/utils/tooltip', () => ({
  hideTooltip: vi.fn(),
  showTooltip: vi.fn(),
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

vi.mock('@/utils/itemActions', () => ({
  completeItem: mockCompleteItem,
  abandonItem: mockAbandonItem,
  migrateItem: mockMigrateItem,
  skipOccurrenceItem: mockSkipOccurrenceItem,
}))

vi.mock('@/utils/itemSettingUtils', () => ({
  toggleItemPinned: mockToggleItemPinned,
}))

vi.mock('@/parser/recurringParser', () => ({
  getNextOccurrenceDate: vi.fn(() => '2026-05-15'),
}))

async function mountComponent(item: any, extraProps: Record<string, any> = {}) {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ItemActionBar, {
    item,
    ...extraProps,
  })
  app.mount(container)
  await nextTick()

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('itemActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows set-focus-plan action and opens dialog for the current item', async () => {
    const mounted = await mountComponent({
      id: 'item-1',
      blockId: 'block-1',
      content: '整理日报',
      date: '2026-05-14',
      status: 'pending',
    })

    const buttons = [...mounted.container.querySelectorAll('.block__icon')]
    const planButton = buttons.find((node) => node.getAttribute('aria-label') === '设置预计')
    expect(planButton).toBeTruthy();

    (planButton as HTMLElement).click()

    expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
    )

    mounted.unmount()
  })

  it('hides abandon action for completed items', async () => {
    const mounted = await mountComponent({
      id: 'item-2',
      blockId: 'block-2',
      content: '已完成事项',
      date: '2026-05-14',
      status: 'completed',
    })

    const buttons = [...mounted.container.querySelectorAll('.block__icon')]
    const abandonButton = buttons.find((node) => node.getAttribute('aria-label') === '放弃')

    expect(abandonButton).toBeFalsy()

    mounted.unmount()
  })

  it('calls completeItem when clicking complete', async () => {
    const mounted = await mountComponent({
      id: 'item-3',
      blockId: 'block-3',
      content: '待完成事项',
      date: '2026-05-14',
      status: 'pending',
    })

    const completeButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '完成') as HTMLElement | undefined

    completeButton?.click()
    await nextTick()

    expect(mockCompleteItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-3' }),
    )

    mounted.unmount()
  })

  it('calls migrateItem when migrating an overdue item', async () => {
    const mounted = await mountComponent({
      id: 'item-4',
      blockId: 'block-4',
      content: '过期事项',
      date: '2026-05-13',
      startDateTime: '2026-05-13 09:00',
      endDateTime: '2026-05-13 10:30',
      status: 'pending',
      siblingItems: [{ date: '2026-05-20' }],
    })

    const migrateButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '迁移到今天') as HTMLElement | undefined

    migrateButton?.click()
    await nextTick()

    expect(mockMigrateItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-4' }),
    )

    mounted.unmount()
  })

  it('shows pin icon when showPin is true', async () => {
    const mounted = await mountComponent({
      id: 'item-5',
      blockId: 'block-5',
      content: '置顶事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showPin: true })

    const pinButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '置顶')
    expect(pinButton).toBeTruthy()

    mounted.unmount()
  })

  it('hides pin icon when showPin is false (default)', async () => {
    const mounted = await mountComponent({
      id: 'item-6',
      blockId: 'block-6',
      content: '普通事项',
      date: '2026-05-14',
      status: 'pending',
    })

    const pinButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '置顶')
    expect(pinButton).toBeFalsy()

    mounted.unmount()
  })

  it('shows detail icon when showDetail is true', async () => {
    const mounted = await mountComponent({
      id: 'item-7',
      blockId: 'block-7',
      content: '详情事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showDetail: true })

    const detailButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '详情')
    expect(detailButton).toBeTruthy()

    mounted.unmount()
  })

  it('renders fixed row icons when showPin or showDetail is true', async () => {
    const mounted = await mountComponent({
      id: 'item-8',
      blockId: 'block-8',
      content: '固定行事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showPin: true })

    const pinButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '置顶')
    expect(pinButton).toBeTruthy()

    mounted.unmount()
  })

  it('does not render pin/detail icons when showPin and showDetail are both false', async () => {
    const mounted = await mountComponent({
      id: 'item-9',
      blockId: 'block-9',
      content: '无固定行事项',
      date: '2026-05-14',
      status: 'pending',
    })

    const pinButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '置顶')
    expect(pinButton).toBeFalsy()

    const detailButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '详情')
    expect(detailButton).toBeFalsy()

    mounted.unmount()
  })

  it('renders only one calendar icon when fixed row exists', async () => {
    const mounted = await mountComponent({
      id: 'item-10',
      blockId: 'block-10',
      content: '日历移动事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showDetail: true })

    // When hasFixedRow is true, calendar is rendered in the fixed-row template area
    // (not in the v-if="!hasFixedRow" slot), so there should be exactly one calendar icon
    const allCalendarIcons = [...mounted.container.querySelectorAll('.block__icon')]
      .filter((node) => node.getAttribute('aria-label') === '日历')
    expect(allCalendarIcons.length).toBe(1)

    mounted.unmount()
  })

  it('keeps calendar icon when no fixed row', async () => {
    const mounted = await mountComponent({
      id: 'item-11',
      blockId: 'block-11',
      content: '日历保留事项',
      date: '2026-05-14',
      status: 'pending',
    })

    const hoverCalendar = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '日历')
    expect(hoverCalendar).toBeTruthy()

    mounted.unmount()
  })

  it('calls toggleItemPinned when pin icon is clicked', async () => {
    const mounted = await mountComponent({
      id: 'item-12',
      blockId: 'block-12',
      content: '置顶点击事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showPin: true })

    const pinButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '置顶') as HTMLElement | undefined

    pinButton?.click()
    await nextTick()

    expect(mockToggleItemPinned).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-12' }),
    )

    mounted.unmount()
  })

  it('calls showItemDetailModal when detail icon is clicked', async () => {
    const mounted = await mountComponent({
      id: 'item-13',
      blockId: 'block-13',
      content: '详情点击事项',
      date: '2026-05-14',
      status: 'pending',
    }, { showDetail: true })

    const detailButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '详情') as HTMLElement | undefined

    detailButton?.click()
    await nextTick()

    expect(mockShowItemDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-13' }),
      { showAllDates: true },
    )

    mounted.unmount()
  })

  it('shows skip icon for recurring overdue item', async () => {
    const mounted = await mountComponent({
      id: 'item-14',
      blockId: 'block-14',
      content: '循环过期事项',
      date: '2026-05-13',
      status: 'pending',
      repeatRule: 'FREQ=DAILY;INTERVAL=1',
    })

    const skipButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '跳过本次')
    expect(skipButton).toBeTruthy()

    mounted.unmount()
  })

  it('hides skip icon for non-recurring item', async () => {
    const mounted = await mountComponent({
      id: 'item-15',
      blockId: 'block-15',
      content: '非循环事项',
      date: '2026-05-13',
      status: 'pending',
    })

    const skipButton = [...mounted.container.querySelectorAll('.block__icon')]
      .find((node) => node.getAttribute('aria-label') === '跳过本次')
    expect(skipButton).toBeFalsy()

    mounted.unmount()
  })
})
