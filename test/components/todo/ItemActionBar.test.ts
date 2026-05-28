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
const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

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

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        complete: '完成',
        startFocusAria: '开始专注',
        abandon: '放弃',
        openDoc: '打开文档',
        calendar: '日历',
        migrateToToday: '迁移到今天',
        migrateToTomorrow: '迁移到明天',
      }
    }
    if (key === 'focusPlan') {
      return {
        setAction: '设置预计',
        editAction: '修改预计',
      }
    }
    if (key === 'statusTag') {
      return {
        completed: '#完成',
        abandoned: '#放弃',
      }
    }
    return {}
  }),
}))

vi.mock('@/utils/dialog', () => ({
  hideIconTooltip: vi.fn(),
  showIconTooltip: vi.fn(),
  showPomodoroTimerDialog: vi.fn(),
  showFocusPlanDialog: mockShowFocusPlanDialog,
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

async function mountComponent(item: any) {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ItemActionBar, { item })
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

  it('uses BlockWriter setStatus when clicking complete', async () => {
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

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-3' },
      {
        type: 'setStatus',
        status: 'completed',
      },
    )

    mounted.unmount()
  })

  it('uses BlockWriter addDate when migrating an overdue item', async () => {
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

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-4' },
      {
        type: 'addDate',
        date: '2026-05-14',
        startTime: '09:00',
        endTime: '10:30',
        allDay: false,
        originalDate: '2026-05-13',
        siblingItems: [
          { date: '2026-05-20' },
          {
            date: '2026-05-13',
            startDateTime: '2026-05-13 09:00',
            endDateTime: '2026-05-13 10:30',
          },
        ],
      },
    )

    mounted.unmount()
  })
})
