import type {
  WorkbenchDashboard,
  WorkbenchEntry,
  WorkbenchSettings,
  WorkbenchViewType,
} from '@/types/workbench'
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
import { initI18n } from '@/i18n'

import { useWorkbenchStore } from '@/stores/workbenchStore'

const {
  mockLoadWorkbenchSettings,
  mockSaveWorkbenchSettings,
  mockGetWidgetDefinition,
  mockGetViewDefinition,
} = vi.hoisted(() => ({
  mockLoadWorkbenchSettings: vi.fn(),
  mockSaveWorkbenchSettings: vi.fn(),
  mockGetWidgetDefinition: vi.fn((type: string) => ({
    type,
    name: type === 'todoList' ? 'Todo List' : type,
    icon: 'iconTaTodo',
    defaultSize: {
      w: 6,
      h: 4,
    },
    minSize: {
      w: 4,
      h: 3,
    },
    createDefaultConfig: () => ({ source: 'default-config' }),
  })),
  mockGetViewDefinition: vi.fn((viewType: string) => {
    const defaults: Record<string, Record<string, unknown>> = {
      todo: { preset: {} },
      habit: { habitScope: 'active' },
      quadrant: {},
      pomodoroStats: { section: 'overview' },
      focusWorkbench: {},
      project: {},
      calendar: {},
      gantt: {},
    }
    return {
      type: viewType,
      createDefaultConfig: () => defaults[viewType] ?? {},
    }
  }),
}))

vi.mock('@/utils/workbenchStorage', () => ({
  loadWorkbenchSettings: mockLoadWorkbenchSettings,
  saveWorkbenchSettings: mockSaveWorkbenchSettings,
}))

vi.mock('@/workbench/widgetRegistry', () => ({
  getWidgetDefinition: mockGetWidgetDefinition,
}))

vi.mock('@/workbench/viewRegistry', () => ({
  getViewDefinition: mockGetViewDefinition,
}))

interface WorkbenchPlugin {
  loadData: (path: string) => Promise<unknown>
  saveData: (path: string) => Promise<void>
}

function createPlugin(): WorkbenchPlugin {
  return {
    loadData: vi.fn(),
    saveData: vi.fn(),
  } as WorkbenchPlugin
}

function createEntry(overrides: Partial<WorkbenchEntry> = {}): WorkbenchEntry {
  return {
    id: 'entry-1',
    type: 'view',
    title: 'Todo',
    icon: 'iconTaTodo',
    order: 0,
    viewType: 'todo',
    ...overrides,
  }
}

function createDashboard(overrides: Partial<WorkbenchDashboard> = {}): WorkbenchDashboard {
  return {
    id: 'dashboard-1',
    title: 'Dashboard A',
    widgets: [],
    ...overrides,
  }
}

describe('workbenchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    initI18n('en_US')
    vi.clearAllMocks()
    mockLoadWorkbenchSettings.mockResolvedValue({
      entries: [],
      dashboards: [],
      activeEntryId: null,
    } satisfies WorkbenchSettings)
    mockSaveWorkbenchSettings.mockResolvedValue(true)
  })

  it('loads entries dashboards and active entry from storage', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    const entry = createEntry()
    const dashboard = createDashboard()

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [entry],
      dashboards: [dashboard],
      activeEntryId: entry.id,
    } satisfies WorkbenchSettings)

    await store.load(plugin)

    expect(mockLoadWorkbenchSettings).toHaveBeenCalledWith(plugin)
    expect(store.entries).toEqual([{
      ...entry,
      config: { preset: {} },
    }])
    expect(store.dashboards).toEqual([dashboard])
    expect(store.activeEntryId).toBe(entry.id)
    expect(store.activeEntry).toEqual({
      ...entry,
      config: { preset: {} },
    })
  })

  it('falls back stale activeEntryId to first remaining entry on load', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })
    const second = createEntry({
      id: 'entry-2',
      title: 'Habit',
      icon: 'iconTaHabit',
      order: 1,
      viewType: 'habit',
    })

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [first, second],
      dashboards: [],
      activeEntryId: 'missing-entry',
    } satisfies WorkbenchSettings)

    await store.load(plugin)

    expect(store.activeEntryId).toBe(first.id)
    expect(store.activeEntry).toEqual({
      ...first,
      config: { preset: {} },
    })
  })

  it('createDashboardEntry creates dashboard and entry together, activates it, and persists when plugin is bound', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)

    const entry = await store.createDashboardEntry('My Dashboard')

    expect(store.entries).toHaveLength(1)
    expect(store.dashboards).toHaveLength(1)
    expect(entry.type).toBe('dashboard')
    expect(entry.title).toBe('My Dashboard')
    expect(entry.icon).toBe('iconBoard')
    expect(entry.dashboardId).toBe(store.dashboards[0].id)
    expect(store.dashboards[0]).toEqual(expect.objectContaining({
      id: entry.dashboardId,
      title: 'My Dashboard',
      widgets: [],
    }))
    expect(store.activeEntryId).toBe(entry.id)
    expect(store.activeEntry).toEqual(entry)
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: store.entries,
      dashboards: store.dashboards,
      activeEntryId: entry.id,
      sidebarCollapsed: false,
    })
  })

  it.each([
    ['todo', 'Todo', 'iconTaTodo'],
    ['habit', 'Habit Check-in', 'iconTaHabit'],
    ['quadrant', 'Quadrant', 'iconLayout'],
    ['pomodoroStats', 'Focus Statistics', 'iconTaPomodoro'],
    ['calendar', 'Calendar', 'iconTaCalendar'],
    ['gantt', 'Gantt Chart', 'iconTaGantt'],
    ['project', 'Project Workbench', 'iconTaProject'],
  ] satisfies Array<[WorkbenchViewType, string, string]>)(
    'createViewEntry creates %s view metadata and activates it',
    async (viewType, title, icon) => {
      const plugin = createPlugin()
      const store = useWorkbenchStore()
      store.bindPlugin(plugin)

      const entry = await store.createViewEntry(viewType)

      expect(entry).toEqual(expect.objectContaining({
        type: 'view',
        title,
        icon,
        viewType,
      }))
      expect(store.entries).toHaveLength(1)
      expect(store.dashboards).toEqual([])
      expect(store.activeEntryId).toBe(entry.id)
      expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
        entries: store.entries,
        dashboards: [],
        activeEntryId: entry.id,
        sidebarCollapsed: false,
      })
    },
  )

  it('renameEntry renames both dashboard entry and dashboard title, then persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard()
    const entry = createEntry({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: dashboard.title,
      icon: 'iconLayout',
      dashboardId: dashboard.id,
      viewType: undefined,
    })

    store.entries = [entry]
    store.dashboards = [dashboard]
    store.activeEntryId = entry.id

    await store.renameEntry(entry.id, 'Renamed Dashboard')

    expect(store.entries[0].title).toBe('Renamed Dashboard')
    expect(store.dashboards[0].title).toBe('Renamed Dashboard')
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: store.entries,
      dashboards: store.dashboards,
      activeEntryId: entry.id,
      sidebarCollapsed: false,
    })
  })

  it('deleteEntry removes matching dashboard, falls back active entry to first remaining, and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)

    const dashboard = createDashboard()
    const dashboardEntry = createEntry({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: dashboard.title,
      icon: 'iconLayout',
      order: 0,
      dashboardId: dashboard.id,
      viewType: undefined,
    })
    const viewEntry = createEntry({
      id: 'entry-view',
      title: 'Todo',
      icon: 'iconTaTodo',
      order: 1,
      viewType: 'todo',
    })

    store.entries = [dashboardEntry, viewEntry]
    store.dashboards = [dashboard]
    store.activeEntryId = dashboardEntry.id

    await store.deleteEntry(dashboardEntry.id)

    expect(store.entries).toEqual([
      expect.objectContaining({
        ...viewEntry,
        order: 0,
      }),
    ])
    expect(store.dashboards).toEqual([])
    expect(store.activeEntryId).toBe(viewEntry.id)
    expect(store.activeEntry).toEqual(expect.objectContaining({
      ...viewEntry,
      order: 0,
    }))
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [
        expect.objectContaining({
          ...viewEntry,
          order: 0,
        }),
      ],
      dashboards: [],
      activeEntryId: viewEntry.id,
      sidebarCollapsed: false,
    })
  })

  it('deleteEntry clears active entry when nothing remains', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const entry = createEntry()

    store.entries = [entry]
    store.dashboards = []
    store.activeEntryId = entry.id

    await store.deleteEntry(entry.id)

    expect(store.entries).toEqual([])
    expect(store.activeEntryId).toBeNull()
    expect(store.activeEntry).toBeNull()
  })

  it('setActiveEntry updates active entry without persisting when plugin is not bound', async () => {
    const store = useWorkbenchStore()
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })
    const second = createEntry({
      id: 'entry-2',
      title: 'Habit',
      icon: 'iconTaHabit',
      order: 1,
      viewType: 'habit',
    })

    store.entries = [first, second]
    store.activeEntryId = first.id

    await store.setActiveEntry(second.id)

    expect(store.activeEntryId).toBe(second.id)
    expect(store.activeEntry).toEqual(second)
    expect(mockSaveWorkbenchSettings).not.toHaveBeenCalled()
  })

  it('setActiveEntry persists when plugin is bound', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })
    const second = createEntry({
      id: 'entry-2',
      title: 'Habit',
      icon: 'iconTaHabit',
      order: 1,
      viewType: 'habit',
    })

    store.bindPlugin(plugin)
    store.entries = [first, second]
    store.activeEntryId = first.id

    await store.setActiveEntry(second.id)

    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [first, second],
      dashboards: [],
      activeEntryId: second.id,
      sidebarCollapsed: false,
    })
  })

  it('exposes save failure state when persistence returns false', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    mockSaveWorkbenchSettings.mockResolvedValueOnce(false)

    await store.createViewEntry('todo')

    expect(store.saveState).toBe('error')
    expect(store.saveError).toBe('Failed to save workbench settings')
  })

  it('addWidget creates widget using registry defaults and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard()

    store.dashboards = [dashboard]

    await store.addWidget(dashboard.id, 'todoList')

    expect(store.dashboards[0].widgets).toHaveLength(1)
    expect(store.dashboards[0].widgets[0]).toEqual(expect.objectContaining({
      type: 'todoList',
      layout: expect.objectContaining({
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      }),
      config: { source: 'default-config' },
    }))
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('addWidget places new widgets into the next available grid slot', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.addWidget(dashboard.id, 'todoList')
    await store.addWidget(dashboard.id, 'todoList')

    expect(store.dashboards[0].widgets.map((widget) => widget.layout)).toEqual([
      {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      },
      {
        x: 6,
        y: 0,
        w: 6,
        h: 4,
      },
      {
        x: 0,
        y: 4,
        w: 6,
        h: 4,
      },
    ])
  })

  it('removeWidget removes widget from dashboard and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.removeWidget(dashboard.id, 'widget-1')

    expect(store.dashboards[0].widgets).toEqual([])
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('renameWidget updates widget title and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.renameWidget(dashboard.id, 'widget-1', 'Today Todos')

    expect(store.dashboards[0].widgets[0].title).toBe('Today Todos')
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('updateWidgetLayout updates widget layout and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.updateWidgetLayout(dashboard.id, 'widget-1', {
      x: 2,
      y: 1,
      w: 4,
      h: 3,
    })

    expect(store.dashboards[0].widgets[0].layout).toEqual({
      x: 2,
      y: 1,
      w: 4,
      h: 3,
    })
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('updateWidgetLayouts batch updates widget layouts and persists once', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
        {
          id: 'widget-2',
          type: 'habitWeek',
          title: 'Habit Week',
          layout: {
            x: 6,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {},
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.updateWidgetLayouts(dashboard.id, [
      {
        id: 'widget-1',
        x: 1,
        y: 2,
        w: 5,
        h: 3,
      },
      {
        id: 'widget-2',
        x: 6,
        y: 2,
        w: 6,
        h: 5,
      },
    ])

    expect(store.dashboards[0].widgets.map((widget) => widget.layout)).toEqual([
      {
        x: 1,
        y: 2,
        w: 5,
        h: 3,
      },
      {
        x: 6,
        y: 2,
        w: 6,
        h: 5,
      },
    ])
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledTimes(1)
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('updateWidgetConfig updates widget config and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: { preset: { groupId: 'group-a' } },
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.updateWidgetConfig(dashboard.id, 'widget-1', { preset: { groupId: 'group-b' } })

    expect(store.dashboards[0].widgets[0].config).toEqual({ preset: { groupId: 'group-b' } })
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('updateWidgetConfig persists todo preset config', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: {
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
          config: {
            preset: {},
          },
        },
      ],
    })

    store.dashboards = [dashboard]

    await store.updateWidgetConfig(dashboard.id, 'widget-1', {
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    })

    expect(store.dashboards[0].widgets[0].config).toEqual({
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    })
  })

  it('load restores sidebarCollapsed from storage', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [],
      dashboards: [],
      activeEntryId: null,
      sidebarCollapsed: true,
    } satisfies WorkbenchSettings)

    await store.load(plugin)

    expect(store.sidebarCollapsed).toBe(true)
  })

  it('load defaults sidebarCollapsed to false when not in storage', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [],
      dashboards: [],
      activeEntryId: null,
    } satisfies WorkbenchSettings)

    await store.load(plugin)

    expect(store.sidebarCollapsed).toBe(false)
  })

  it('toggleSidebar flips sidebarCollapsed and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)

    expect(store.sidebarCollapsed).toBe(false)

    await store.toggleSidebar()

    expect(store.sidebarCollapsed).toBe(true)
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
      sidebarCollapsed: true,
    }))

    await store.toggleSidebar()

    expect(store.sidebarCollapsed).toBe(false)
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
      sidebarCollapsed: false,
    }))
  })

  it('reorderEntries reorders entries by given ids and persists', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })
    const second = createEntry({
      id: 'entry-2',
      title: 'Habit',
      icon: 'iconTaHabit',
      order: 1,
      viewType: 'habit',
    })
    const third = createEntry({
      id: 'entry-3',
      title: 'Calendar',
      icon: 'iconTaCalendar',
      order: 2,
      viewType: 'calendar',
    })

    store.entries = [first, second, third]

    await store.reorderEntries(['entry-3', 'entry-1', 'entry-2'])

    expect(store.entries.map((e) => e.id)).toEqual(['entry-3', 'entry-1', 'entry-2'])
    expect(store.entries.map((e) => e.order)).toEqual([0, 1, 2])
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
      entries: store.entries,
    }))
  })

  it('reorderEntries preserves entries not in orderedIds at the end', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })
    const second = createEntry({
      id: 'entry-2',
      title: 'Habit',
      icon: 'iconTaHabit',
      order: 1,
      viewType: 'habit',
    })

    store.entries = [first, second]

    await store.reorderEntries(['entry-2'])

    expect(store.entries.map((e) => e.id)).toEqual(['entry-2', 'entry-1'])
    expect(store.entries.map((e) => e.order)).toEqual([0, 1])
  })

  it('reorderEntries ignores unknown ids', async () => {
    const plugin = createPlugin()
    const store = useWorkbenchStore()
    store.bindPlugin(plugin)
    const first = createEntry({
      id: 'entry-1',
      order: 0,
    })

    store.entries = [first]

    await store.reorderEntries(['entry-1', 'nonexistent'])

    expect(store.entries.map((e) => e.id)).toEqual(['entry-1'])
  })
})
