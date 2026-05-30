// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPinia,
  setActivePinia,
} from 'pinia'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
  ref,
} from 'vue'
import { TAB_TYPES } from '@/constants'
import { initI18n } from '@/i18n'

const mockPlugin = { name: 'plugin' }
const mockApp = { name: 'app' }
const mockLoad = vi.fn(() => Promise.resolve())
const mockSettingsLoadFromPlugin = vi.fn()
const mockRequestRefresh = vi.fn(() => Promise.resolve())
const mockEventBusOn = vi.fn(() => () => {})
const mockRefreshChannelDispose = vi.fn()
const mockCreateRefreshChannelGuard = vi.fn(() => ({
  dispose: mockRefreshChannelDispose,
}))
const mockCreateDashboardEntry = vi.fn(() => Promise.resolve({
  id: 'entry-created-dashboard',
  type: 'dashboard',
  title: 'New Dashboard',
  icon: 'iconBoard',
  order: 2,
  dashboardId: 'dashboard-created',
}))
const mockCreateViewEntry = vi.fn(() => Promise.resolve({
  id: 'entry-created-view',
  type: 'view',
  title: 'Todo',
  icon: 'iconList',
  order: 2,
  viewType: 'todo',
  config: { preset: {} },
}))
const mockSetActiveEntry = vi.fn(() => Promise.resolve())
const mockAddWidget = vi.fn(() => Promise.resolve())
const mockSidebarCollapsed = ref(false)
const mockToggleSidebar = vi.fn(() => Promise.resolve())
const mockEntries = ref([
  {
    id: 'entry-dashboard',
    type: 'dashboard',
    title: 'Planning Board',
    icon: 'iconBoard',
    order: 0,
    dashboardId: 'dashboard-1',
  },
  {
    id: 'entry-todo',
    type: 'view',
    title: 'Todo',
    icon: 'iconList',
    order: 1,
    viewType: 'todo',
    config: { preset: {} },
  },
])
const mockActiveEntryId = ref<string | null>('entry-dashboard')
const mockSettingsStore = {
  loaded: true,
  scanMode: 'all',
  directories: [],
  sidebarCollapsed: false,
  loadFromPlugin: mockSettingsLoadFromPlugin,
  $patch: vi.fn((patch: Record<string, unknown>) => Object.assign(mockSettingsStore, patch)),
}
const mockProjectStore = {}

vi.mock('@/main', async () => {
  const actual = await vi.importActual<typeof import('@/main')>('@/main')
  return {
    ...actual,
    usePlugin: vi.fn(() => ({
      ...mockPlugin,
      requestRefresh: mockRequestRefresh,
    })),
    useApp: vi.fn(() => mockApp),
    getCurrentPlugin: vi.fn(() => ({
      ...mockPlugin,
      requestRefresh: mockRequestRefresh,
    })),
  }
})

vi.mock('@/components/workbench/dashboard/DashboardCanvas.vue', () => ({
  default: {
    name: 'DashboardCanvasStub',
    template: '<div data-testid="workbench-dashboard-canvas-stub"></div>',
  },
}))

vi.mock('@/tabs/DesktopTodoDock.vue', () => ({
  default: {
    name: 'DesktopTodoDockStub',
    template: '<div data-testid="desktop-todo-dock-stub"></div>',
  },
}))

vi.mock('@/components/workbench/view/AiChatView.vue', () => ({
  default: {
    name: 'AiChatViewStub',
    template: '<div data-testid="ai-chat-view-stub"></div>',
  },
}))

vi.mock('@/components/workbench/view/WorkbenchHabitView.vue', () => ({
  default: {
    name: 'WorkbenchHabitViewStub',
    template: '<div data-testid="workbench-habit-view-stub"></div>',
  },
}))

vi.mock('@/tabs/FocusWorkbenchTab.vue', () => ({
  default: {
    name: 'FocusWorkbenchTabStub',
    template: '<div data-testid="focus-workbench-tab-stub"></div>',
  },
}))

vi.mock('@/tabs/PomodoroStatsTab.vue', () => ({
  default: {
    name: 'PomodoroStatsTabStub',
    template: '<div data-testid="pomodoro-stats-tab-stub"></div>',
  },
}))

vi.mock('@/tabs/ProjectTab.vue', () => ({
  default: {
    name: 'ProjectTabStub',
    template: '<div data-testid="project-tab-stub"></div>',
  },
}))

vi.mock('@/tabs/QuadrantTab.vue', () => ({
  default: {
    name: 'QuadrantTabStub',
    template: '<div data-testid="quadrant-tab-stub"></div>',
  },
}))

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    on: mockEventBusOn,
    emit: vi.fn(),
  },
  Events: { SETTINGS_CHANGED: 'settings:changed' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}))

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: mockCreateRefreshChannelGuard,
}))

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores')
  return {
    ...actual,
    useProjectStore: () => mockProjectStore,
    useSettingsStore: () => mockSettingsStore,
    useWorkbenchStore: () => {
      const store = {
        get entries() {
          return mockEntries.value
        },
        get activeEntryId() {
          return mockActiveEntryId.value
        },
        get activeEntry() {
          return mockEntries.value.find((entry: any) => entry.id === mockActiveEntryId.value) ?? null
        },
        dashboards: [
          {
            id: 'dashboard-1',
            title: 'Planning Board',
            widgets: [],
          },
        ],
        load: mockLoad,
        createDashboardEntry: async (...args: any[]) => {
          const entry = await mockCreateDashboardEntry(...args)
          mockEntries.value = [...mockEntries.value, entry]
          mockActiveEntryId.value = entry.id
          return entry
        },
        createViewEntry: async (...args: any[]) => {
          const entry = await mockCreateViewEntry(...args)
          mockEntries.value = [...mockEntries.value, entry]
          mockActiveEntryId.value = entry.id
          return entry
        },
        setActiveEntry: async (id: string) => {
          mockSetActiveEntry(id)
          mockActiveEntryId.value = id
        },
        addWidget: mockAddWidget,
        get sidebarCollapsed() {
          return mockSidebarCollapsed.value
        },
        toggleSidebar: mockToggleSidebar,
      }
      return store
    },
  }
})

const mockViewConfigDialog = vi.fn()

vi.mock('@/workbench/viewRegistry', () => ({
  getViewDefinition: (viewType: string) => {
    const defaults: Record<string, () => Record<string, unknown>> = {
      todo: () => ({ preset: {} }),
      habit: () => ({ habitScope: 'active' }),
      quadrant: () => ({}),
      pomodoroStats: () => ({ section: 'overview' }),
      focusWorkbench: () => ({}),
      project: () => ({}),
      calendar: () => ({}),
      gantt: () => ({}),
    }
    return {
      type: viewType,
      createDefaultConfig: defaults[viewType] ?? (() => ({})),
      openConfigDialog: viewType === 'calendar' || viewType === 'gantt' || viewType === 'aiChat'
        ? undefined
        : mockViewConfigDialog,
    }
  },
}))

describe('workbench tab constants', () => {
  it('exposes workbench tab type', () => {
    expect(TAB_TYPES.WORKBENCH).toBe('bullet-journal-workbench')
  })
})

describe('workbenchTab shell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    initI18n('en_US')
    vi.clearAllMocks()
    mockSettingsStore.loaded = true
    mockSettingsStore.scanMode = 'all'
    mockSettingsStore.directories = []
    mockSettingsStore.sidebarCollapsed = false
    mockRequestRefresh.mockClear()
    mockEntries.value = [
      {
        id: 'entry-dashboard',
        type: 'dashboard',
        title: 'Planning Board',
        icon: 'iconBoard',
        order: 0,
        dashboardId: 'dashboard-1',
      },
      {
        id: 'entry-todo',
        type: 'view',
        title: 'Todo',
        icon: 'iconList',
        order: 1,
        viewType: 'todo',
        config: { preset: {} },
      },
    ]
    mockActiveEntryId.value = 'entry-dashboard'
    mockCreateDashboardEntry.mockResolvedValue({
      id: 'entry-created-dashboard',
      type: 'dashboard',
      title: 'New Dashboard',
      icon: 'iconBoard',
      order: 2,
      dashboardId: 'dashboard-created',
    })
    mockCreateViewEntry.mockResolvedValue({
      id: 'entry-created-view',
      type: 'view',
      title: 'Todo',
      icon: 'iconList',
      order: 2,
      viewType: 'todo',
      config: { preset: {} },
    })
    ;(globalThis as any).BroadcastChannel = vi.fn().mockImplementation(class {
      close = vi.fn()
    })
  })

  async function mountWorkbenchTab() {
    const { default: WorkbenchTab } = await import('@/tabs/WorkbenchTab.vue')
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(WorkbenchTab)
    app.use(createPinia())
    app.mount(container)
    await nextTick()

    return {
      container,
      app,
      unmount() {
        app.unmount()
        container.remove()
      },
    }
  }

  it('renders sidebar and content host and loads store on mount', async () => {
    mockActiveEntryId.value = 'entry-todo'
    const mounted = await mountWorkbenchTab()

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-content-host"]')).not.toBeNull()
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ name: 'plugin' }))

    mounted.unmount()
  }, 10000)

  it('subscribes to same-context settings-changed events and reloads settings without refreshing projects directly', async () => {
    const mounted = await mountWorkbenchTab()
    await nextTick()

    expect(mockEventBusOn).toHaveBeenCalledWith('settings:changed', expect.any(Function))

    const refreshHandler = mockEventBusOn.mock.calls.find((call) => call[0] === 'settings:changed')?.[1]
    await refreshHandler?.()

    expect(mockSettingsLoadFromPlugin).toHaveBeenCalled()

    mounted.unmount()
  })

  it('sets up BroadcastChannel refresh handling and applies payload without refreshing projects directly', async () => {
    const mounted = await mountWorkbenchTab()
    await nextTick()

    expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('task-assistant-refresh')
    expect(mockCreateRefreshChannelGuard).toHaveBeenCalledWith(expect.objectContaining({
      channel: expect.any(Object),
      plugin: expect.objectContaining({ name: 'plugin' }),
      getCurrentPlugin: expect.any(Function),
      onRefresh: expect.any(Function),
      viewName: 'WorkbenchTab',
    }))

    mockSettingsLoadFromPlugin.mockClear()
    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh
    await onRefresh?.({
      scanMode: 'dirs',
      directories: ['updated-dir'],
    })
    await nextTick()

    expect(mockSettingsLoadFromPlugin).not.toHaveBeenCalled()

    mounted.unmount()
  }, 10000)

  it('cleans up refresh subscriptions and BroadcastChannel on unmount', async () => {
    const unsubscribeRefresh = vi.fn()
    const closeChannel = vi.fn()
    mockEventBusOn.mockReturnValueOnce(unsubscribeRefresh)
    ;(globalThis as any).BroadcastChannel = vi.fn().mockImplementation(class {
      close = closeChannel
    })

    const mounted = await mountWorkbenchTab()
    await nextTick()

    mounted.unmount()

    expect(unsubscribeRefresh).toHaveBeenCalled()
    expect(mockRefreshChannelDispose).toHaveBeenCalled()
    expect(closeChannel).toHaveBeenCalled()
  }, 10000)

  it('sidebar actions create dashboard and todo view entries', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement)
      .click()
    await nextTick();

    (document.querySelector('[data-testid="workbench-create-dashboard"]') as HTMLButtonElement)
      .click()
    await nextTick();

    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement)
      .click()
    await nextTick();

    (document.querySelector('[data-testid="workbench-create-todo-view"]') as HTMLButtonElement)
      .click()
    await nextTick()

    expect(mockCreateDashboardEntry).toHaveBeenCalledWith('New Dashboard')
    expect(mockCreateViewEntry).toHaveBeenCalledWith('todo')

    mounted.unmount()
  })

  it('selecting an entry updates active state and content title', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement).click()
    await nextTick()

    expect(mockSetActiveEntry).toHaveBeenCalledWith('entry-todo')
    expect(mounted.container.querySelector('[data-testid="workbench-toolbar-title"]')?.textContent).toContain('Todo')
    expect(mounted.container.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull()

    mounted.unmount()
  })

  it('shows add todoList widget action for active dashboard and wires it to the store', async () => {
    const mounted = await mountWorkbenchTab()

    const addWidgetTrigger = mounted.container.querySelector('[data-testid="workbench-add-widget-trigger"]') as HTMLButtonElement
    expect(addWidgetTrigger).not.toBeNull()

    addWidgetTrigger.click()
    await nextTick()

    const addWidgetButton = mounted.container.querySelector('[data-testid="workbench-add-widget-todoList"]') as HTMLButtonElement
    expect(addWidgetButton).not.toBeNull()

    addWidgetButton.click()
    await nextTick()

    expect(mockAddWidget).toHaveBeenCalledWith('dashboard-1', 'todoList')

    mounted.unmount()
  })

  it('opens widget menu with all first-batch widget types for active dashboard', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-add-widget-trigger"]') as HTMLButtonElement).click()
    await nextTick()

    expect(mounted.container.querySelector('[data-testid="workbench-widget-menu"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-todoList"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-quadrantSummary"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-habitWeek"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-miniCalendar"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-pomodoroStats"]')).not.toBeNull()

    mounted.unmount()
  })

  it('creates view entries with default config per view type', async () => {
    const { getViewDefinition } = await import('@/workbench/viewRegistry')

    expect(getViewDefinition('todo').createDefaultConfig()).toEqual({ preset: {} })
    expect(getViewDefinition('habit').createDefaultConfig()).toEqual({ habitScope: 'active' })
    expect(getViewDefinition('quadrant').createDefaultConfig()).toEqual({})
    expect(getViewDefinition('pomodoroStats').createDefaultConfig()).toEqual({ section: 'overview' })
    expect(getViewDefinition('focusWorkbench').createDefaultConfig()).toEqual({})
    expect(getViewDefinition('project').createDefaultConfig()).toEqual({})
  })

  it('shows configure button for view entries', async () => {
    mockActiveEntryId.value = 'entry-todo'
    const mounted = await mountWorkbenchTab()
    await nextTick()

    expect(document.querySelector('[data-testid="workbench-view-config-trigger"]')).not.toBeNull()

    mounted.unmount()
  })

  it('hides configure button for ai chat view entries without config dialog', async () => {
    mockEntries.value = [
      ...mockEntries.value,
      {
        id: 'entry-ai-chat',
        type: 'view',
        title: 'AI Chat',
        icon: 'iconSparkles',
        order: 2,
        viewType: 'aiChat',
        config: {},
      },
    ]
    mockActiveEntryId.value = 'entry-ai-chat'

    const mounted = await mountWorkbenchTab()
    await nextTick()

    expect(document.querySelector('[data-testid="workbench-view-config-trigger"]')).toBeNull()

    mounted.unmount()
  })

  it('opens view config dialog when configure button is clicked', async () => {
    mockActiveEntryId.value = 'entry-todo'
    const mounted = await mountWorkbenchTab()
    await nextTick()

    const configBtn = document.querySelector('[data-testid="workbench-view-config-trigger"]') as HTMLButtonElement
    expect(configBtn).not.toBeNull()

    configBtn.click()
    await nextTick()

    expect(mockViewConfigDialog).toHaveBeenCalled()

    mounted.unmount()
  })
})

describe('workbench registration', () => {
  it('registers the desktop workbench tab and top-bar entry in index.ts', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8')

    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*menu\.addItem\(\{\s*icon:\s*"iconLayout",/,
    )
    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{[\s\S]*?menu\.addItem\(\{\s*icon:\s*"iconWorkspace",\s*label:\s*t\("workbench"\)\.title,\s*click:\s*\(\)\s*=>\s*\{\s*this\.openCustomTab\(TAB_TYPES\.WORKBENCH\)/,
    )
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*"iconWorkspace"/)
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*t\("workbench"\)\.title/)
  })

  it('defines required workbench i18n labels', () => {
    const zh = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/zh_CN.json'), 'utf-8'))
    const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/en_US.json'), 'utf-8'))

    expect(en.workbench).toMatchObject({
      title: 'Workbench',
      newDashboard: 'New Dashboard',
      newView: 'New View',
      addWidget: 'Add Widget',
      emptyState: 'Select a workbench item',
    })
    expect(zh.workbench).toMatchObject({
      title: '工作台',
      newDashboard: '新建仪表盘',
      newView: '新建视图',
      addWidget: '添加组件',
      emptyState: '请选择一个工作台条目',
    })
  })
})
