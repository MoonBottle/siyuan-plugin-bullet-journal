// @vitest-environment happy-dom

import type { Item } from '@/types/models'
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
  h,
  nextTick,
} from 'vue'

vi.mock('siyuan', async () => {
  return await import('../../__mocks__/siyuan')
})

const timerDialogProjectStore = {
  getItemByBlockId: vi.fn(),
  getItemActualFocusMinutes: vi.fn(),
  getExpiredItems: vi.fn(() => []),
  getFutureItems: vi.fn(() => []),
}

const activeTimerProjectStore = {
  getItemByBlockId: vi.fn(),
}

const pomodoroStoreForDialog = {
  startPomodoro: vi.fn(() => Promise.resolve(true)),
}

const pomodoroStoreForActive = {
  activePomodoro: {
    blockId: 'block-1',
    itemContent: '整理日报',
    accumulatedSeconds: 600,
    remainingSeconds: 900,
    targetDurationMinutes: 25,
    timerMode: 'countdown',
    isPaused: false,
  },
  elapsedSeconds: 600,
  remainingTime: 900,
  isStopwatch: false,
  pausePomodoro: vi.fn(() => Promise.resolve(true)),
  resumePomodoro: vi.fn(() => Promise.resolve(true)),
  completePomodoro: vi.fn(() => Promise.resolve(true)),
}

const settingsStore = {
  groups: [],
}

let mountMode: 'dialog' | 'active' = 'dialog'

vi.mock('@/stores', () => ({
  useProjectStore: vi.fn(() => mountMode === 'active' ? activeTimerProjectStore : timerDialogProjectStore),
  usePomodoroStore: vi.fn(() => mountMode === 'active' ? pomodoroStoreForActive : pomodoroStoreForDialog),
  useSettingsStore: vi.fn(() => settingsStore),
}))

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => 'dialog'),
}))

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({
    name: 'bullet-journal',
    getSettings: () => ({
      pomodoro: {
        focusDurationPresets: [25, 45],
        defaultFocusDuration: 25,
      },
    }),
    openCustomTab: vi.fn(),
    requestRefresh: vi.fn(() => Promise.resolve()),
  })),
}))

vi.mock('@/utils/dayjs', () => ({
  default: vi.fn(() => ({
    format: () => '2026-05-14',
    diff: () => 0,
  })),
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'pomodoroDialog') {
      return {
        selectItem: '选择待办事项',
        expiredItems: '过期事项',
        todayItems: '今天事项',
        noItems: '暂无待办事项',
        timerMode: '计时模式',
        countdown: '倒计时',
        stopwatch: '正计时',
        setDuration: '设置专注时长',
        custom: '自定义',
        minutes: '分钟',
        startFocus: '开始专注',
        cancel: '取消',
        yesterday: '昨天',
        dayBeforeYesterday: '前天',
      }
    }
    if (key === 'pomodoroActive') {
      return {
        paused: '已暂停',
        focusing: '专注中',
        focusedFor: '已专注 {minutes}分钟',
        stopwatchFocused: '正计时 · 已专注 {minutes}分钟',
        pauseBadge: '已暂停',
        pomodoroTimer: '番茄计时',
        target: '目标：{minutes}分钟',
        stopwatch: '正计时',
        start: '开始',
        manualEnd: '手动结束',
        estimatedEnd: '预计结束',
        pause: '暂停',
        resume: '继续',
        endFocus: '结束专注',
        confirmEndTitle: '结束专注',
        confirmEndMessage: '确定结束吗',
      }
    }
    if (key === 'focusPlan') {
      return {
        currentPlan: '当前预计',
        actualShort: '累计',
      }
    }
    if (key === 'settings') {
      return {
        projectGroups: {
          allGroups: '全部分组',
          unnamed: '未命名',
        },
      }
    }
    if (key === 'todo') {
      return {
        project: '项目',
        task: '任务',
        item: '事项',
        complete: '完成',
        abandon: '放弃',
        detail: '详情',
        calendar: '日历',
      }
    }
    if (key === 'statusTag') {
      return {
        completed: '#done',
        abandoned: '#abandoned',
      }
    }
    if (key === 'common') {
      return {
        blockIdError: '块错误',
      }
    }
    return {}
  }),
}))

vi.mock('@/components/pomodoro/SelectedItemCard.vue', () => ({
  default: {
    name: 'SelectedItemCardStub',
    props: ['item'],
    template: '<div data-testid="selected-item-card">{{ item.content }}</div>',
  },
}))

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: {
    name: 'SySelectStub',
    props: ['modelValue', 'options'],
    template: '<div data-testid="sy-select-stub"></div>',
  },
}))

vi.mock('@/components/common/Card.vue', () => ({
  default: {
    name: 'CardStub',
    template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
  },
}))

vi.mock('@/components/todo/TodoTypedLinks.vue', () => ({
  default: {
    name: 'TodoTypedLinksStub',
    template: '<div data-testid="todo-links-stub"></div>',
  },
}))

vi.mock('@/components/icons/TomatoIcon.vue', () => ({ default: { template: '<i></i>' } }))
vi.mock('@/components/icons/PlayIcon.vue', () => ({ default: { template: '<i></i>' } }))
vi.mock('@/components/icons/StopIcon.vue', () => ({ default: { template: '<i></i>' } }))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(() => Promise.resolve(true)),
}))

const mockWriteBlock = vi.fn(() => Promise.resolve(true))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

vi.mock('@/utils/dialog', () => ({
  showConfirmDialog: vi.fn(),
  showItemDetailModal: vi.fn(),
}))

vi.mock('@/utils/linkNavigation', () => ({
  resolveAttachmentTargetBlockId: vi.fn(),
}))

vi.mock('@/utils/progressDirection', () => ({
  getProgressDirection: vi.fn(() => 'shrink'),
}))

vi.mock('@/constants', () => ({
  DOCK_TYPES: { POMODORO: 'pomodoro' },
  TAB_TYPES: { CALENDAR: 'calendar' },
}))

function mountComponent(component: any, props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render() {
      return h(component, props)
    },
  })
  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('pomodoro focus plan UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mountMode = 'dialog'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pomodoroTimerDialog 在开始前展示事项预计与已累计专注', async () => {
    const item: Item = {
      id: 'item-1',
      content: '整理日报',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      blockId: 'block-1',
      status: 'pending',
      focusPlan: {
        type: 'duration',
        rawValue: 70,
        normalizedMinutes: 70,
        sourceText: '⏳1h10m',
      },
    }
    timerDialogProjectStore.getItemByBlockId.mockReturnValue(item)
    timerDialogProjectStore.getItemActualFocusMinutes.mockReturnValue(50)
    mountMode = 'dialog'

    const { default: PomodoroTimerDialog } = await import('@/components/pomodoro/PomodoroTimerDialog.vue')
    const mounted = mountComponent(PomodoroTimerDialog, {
      closeDialog: vi.fn(),
      preselectedBlockId: 'block-1',
      hideItemList: true,
    })

    await nextTick()
    await nextTick()

    expect(mounted.container.textContent).toContain('当前预计')
    expect(mounted.container.textContent).toContain('1h10m')
    expect(mounted.container.textContent).toContain('累计')
    expect(mounted.container.textContent).toContain('50m')

    mounted.unmount()
  })

  it('pomodoroActiveTimer 展示进行中的实际与预计进度', async () => {
    const item: Item = {
      id: 'item-1',
      content: '整理日报',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      blockId: 'block-1',
      status: 'pending',
      focusPlan: {
        type: 'duration',
        rawValue: 70,
        normalizedMinutes: 70,
        sourceText: '⏳1h10m',
      },
      pomodoros: [
        {
          id: 'p-1',
          date: '2026-05-14',
          startTime: '09:00:00',
          durationMinutes: 50,
          actualDurationMinutes: 50,
        } as any,
      ],
    }
    activeTimerProjectStore.getItemByBlockId.mockReturnValue(item)
    mountMode = 'active'

    const { default: PomodoroActiveTimer } = await import('@/components/pomodoro/PomodoroActiveTimer.vue')
    const mounted = mountComponent(PomodoroActiveTimer, {})

    await nextTick()

    expect(mounted.container.textContent).toContain('当前预计')
    expect(mounted.container.textContent).toContain('1h10m')
    expect(mounted.container.textContent).toContain('累计 1h / 1h10m')

    mounted.unmount()
  })

  it('pomodoroActiveTimer 的完成按钮走 writeBlock', async () => {
    const item: Item = {
      id: 'item-1',
      content: '整理日报',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      blockId: 'block-1',
      status: 'pending',
    }
    activeTimerProjectStore.getItemByBlockId.mockReturnValue(item)
    mountMode = 'active'

    const { default: PomodoroActiveTimer } = await import('@/components/pomodoro/PomodoroActiveTimer.vue')
    const mounted = mountComponent(PomodoroActiveTimer, {})

    await nextTick()

    mounted.container.querySelector('[aria-label="完成"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      {
        type: 'setStatus',
        status: 'completed',
      },
    )

    mounted.unmount()
  })

  it('pomodoroActiveTimer 的放弃按钮走 writeBlock', async () => {
    const item: Item = {
      id: 'item-1',
      content: '整理日报',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      blockId: 'block-1',
      status: 'pending',
    }
    activeTimerProjectStore.getItemByBlockId.mockReturnValue(item)
    mountMode = 'active'

    const { default: PomodoroActiveTimer } = await import('@/components/pomodoro/PomodoroActiveTimer.vue')
    const mounted = mountComponent(PomodoroActiveTimer, {})

    await nextTick()

    mounted.container.querySelector('[aria-label="放弃"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      {
        type: 'setStatus',
        status: 'abandoned',
      },
    )

    mounted.unmount()
  })
})
