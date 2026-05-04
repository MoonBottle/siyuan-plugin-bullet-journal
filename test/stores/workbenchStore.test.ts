import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import type {
  WorkbenchDashboard,
  WorkbenchEntry,
  WorkbenchSettings,
  WorkbenchViewType,
} from '@/types/workbench';

const {
  mockLoadWorkbenchSettings,
  mockSaveWorkbenchSettings,
  mockGetWidgetDefinition,
} = vi.hoisted(() => ({
  mockLoadWorkbenchSettings: vi.fn(),
  mockSaveWorkbenchSettings: vi.fn(),
  mockGetWidgetDefinition: vi.fn((type: string) => ({
    type,
    name: type === 'todoList' ? 'Todo List' : type,
    icon: 'iconList',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    createDefaultConfig: () => ({ source: 'default-config' }),
  })),
}));

vi.mock('@/utils/workbenchStorage', () => ({
  loadWorkbenchSettings: mockLoadWorkbenchSettings,
  saveWorkbenchSettings: mockSaveWorkbenchSettings,
}));

vi.mock('@/workbench/widgetRegistry', () => ({
  getWidgetDefinition: mockGetWidgetDefinition,
}));

import { useWorkbenchStore } from '@/stores/workbenchStore';

type MockPlugin = {
  loadData: ReturnType<typeof vi.fn>;
  saveData: ReturnType<typeof vi.fn>;
};

function createPlugin(): MockPlugin {
  return {
    loadData: vi.fn(),
    saveData: vi.fn(),
  };
}

function createEntry(overrides: Partial<WorkbenchEntry> = {}): WorkbenchEntry {
  return {
    id: 'entry-1',
    type: 'view',
    title: 'Todo',
    icon: 'iconList',
    order: 0,
    viewType: 'todo',
    ...overrides,
  };
}

function createDashboard(overrides: Partial<WorkbenchDashboard> = {}): WorkbenchDashboard {
  return {
    id: 'dashboard-1',
    title: 'Dashboard A',
    widgets: [],
    ...overrides,
  };
}

describe('workbenchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    initI18n('en_US');
    vi.clearAllMocks();
    mockLoadWorkbenchSettings.mockResolvedValue({
      entries: [],
      dashboards: [],
      activeEntryId: null,
    } satisfies WorkbenchSettings);
    mockSaveWorkbenchSettings.mockResolvedValue(true);
  });

  it('loads entries dashboards and active entry from storage', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    const entry = createEntry();
    const dashboard = createDashboard();

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [entry],
      dashboards: [dashboard],
      activeEntryId: entry.id,
    } satisfies WorkbenchSettings);

    await store.load(plugin);

    expect(mockLoadWorkbenchSettings).toHaveBeenCalledWith(plugin);
    expect(store.entries).toEqual([entry]);
    expect(store.dashboards).toEqual([dashboard]);
    expect(store.activeEntryId).toBe(entry.id);
    expect(store.activeEntry).toEqual(entry);
  });

  it('falls back stale activeEntryId to first remaining entry on load', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    const first = createEntry({ id: 'entry-1', order: 0 });
    const second = createEntry({ id: 'entry-2', title: 'Habit', icon: 'iconCheck', order: 1, viewType: 'habit' });

    mockLoadWorkbenchSettings.mockResolvedValueOnce({
      entries: [first, second],
      dashboards: [],
      activeEntryId: 'missing-entry',
    } satisfies WorkbenchSettings);

    await store.load(plugin);

    expect(store.activeEntryId).toBe(first.id);
    expect(store.activeEntry).toEqual(first);
  });

  it('createDashboardEntry creates dashboard and entry together, activates it, and persists when plugin is bound', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);

    const entry = await store.createDashboardEntry('My Dashboard');

    expect(store.entries).toHaveLength(1);
    expect(store.dashboards).toHaveLength(1);
    expect(entry.type).toBe('dashboard');
    expect(entry.title).toBe('My Dashboard');
    expect(entry.icon).toBe('iconBoard');
    expect(entry.dashboardId).toBe(store.dashboards[0].id);
    expect(store.dashboards[0]).toEqual(expect.objectContaining({
      id: entry.dashboardId,
      title: 'My Dashboard',
      widgets: [],
    }));
    expect(store.activeEntryId).toBe(entry.id);
    expect(store.activeEntry).toEqual(entry);
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: store.entries,
      dashboards: store.dashboards,
      activeEntryId: entry.id,
    });
  });

  it.each([
    ['todo', 'Todo', 'iconList'],
    ['habit', 'Habit Check-in', 'iconCheck'],
    ['quadrant', 'Quadrant', 'iconLayout'],
    ['pomodoroStats', 'Focus Statistics', 'iconClock'],
    ['calendar', 'Calendar', 'iconCalendar'],
    ['gantt', 'Gantt Chart', 'iconGraph'],
    ['project', 'Projects', 'iconFolder'],
  ] satisfies Array<[WorkbenchViewType, string, string]>)(
    'createViewEntry creates %s view metadata and activates it',
    async (viewType, title, icon) => {
      const plugin = createPlugin();
      const store = useWorkbenchStore();
      store.bindPlugin(plugin);

      const entry = await store.createViewEntry(viewType);

      expect(entry).toEqual(expect.objectContaining({
        type: 'view',
        title,
        icon,
        viewType,
      }));
      expect(store.entries).toHaveLength(1);
      expect(store.dashboards).toEqual([]);
      expect(store.activeEntryId).toBe(entry.id);
      expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
        entries: store.entries,
        dashboards: [],
        activeEntryId: entry.id,
      });
    },
  );

  it('renameEntry renames both dashboard entry and dashboard title, then persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard();
    const entry = createEntry({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: dashboard.title,
      icon: 'iconLayout',
      dashboardId: dashboard.id,
      viewType: undefined,
    });

    store.entries = [entry];
    store.dashboards = [dashboard];
    store.activeEntryId = entry.id;

    await store.renameEntry(entry.id, 'Renamed Dashboard');

    expect(store.entries[0].title).toBe('Renamed Dashboard');
    expect(store.dashboards[0].title).toBe('Renamed Dashboard');
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: store.entries,
      dashboards: store.dashboards,
      activeEntryId: entry.id,
    });
  });

  it('deleteEntry removes matching dashboard, falls back active entry to first remaining, and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);

    const dashboard = createDashboard();
    const dashboardEntry = createEntry({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: dashboard.title,
      icon: 'iconLayout',
      order: 0,
      dashboardId: dashboard.id,
      viewType: undefined,
    });
    const viewEntry = createEntry({
      id: 'entry-view',
      title: 'Todo',
      icon: 'iconList',
      order: 1,
      viewType: 'todo',
    });

    store.entries = [dashboardEntry, viewEntry];
    store.dashboards = [dashboard];
    store.activeEntryId = dashboardEntry.id;

    await store.deleteEntry(dashboardEntry.id);

    expect(store.entries).toEqual([
      expect.objectContaining({
        ...viewEntry,
        order: 0,
      }),
    ]);
    expect(store.dashboards).toEqual([]);
    expect(store.activeEntryId).toBe(viewEntry.id);
    expect(store.activeEntry).toEqual(expect.objectContaining({
      ...viewEntry,
      order: 0,
    }));
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [
        expect.objectContaining({
          ...viewEntry,
          order: 0,
        }),
      ],
      dashboards: [],
      activeEntryId: viewEntry.id,
    });
  });

  it('deleteEntry clears active entry when nothing remains', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const entry = createEntry();

    store.entries = [entry];
    store.dashboards = [];
    store.activeEntryId = entry.id;

    await store.deleteEntry(entry.id);

    expect(store.entries).toEqual([]);
    expect(store.activeEntryId).toBeNull();
    expect(store.activeEntry).toBeNull();
  });

  it('setActiveEntry updates active entry without persisting when plugin is not bound', async () => {
    const store = useWorkbenchStore();
    const first = createEntry({ id: 'entry-1', order: 0 });
    const second = createEntry({ id: 'entry-2', title: 'Habit', icon: 'iconCheck', order: 1, viewType: 'habit' });

    store.entries = [first, second];
    store.activeEntryId = first.id;

    await store.setActiveEntry(second.id);

    expect(store.activeEntryId).toBe(second.id);
    expect(store.activeEntry).toEqual(second);
    expect(mockSaveWorkbenchSettings).not.toHaveBeenCalled();
  });

  it('setActiveEntry persists when plugin is bound', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    const first = createEntry({ id: 'entry-1', order: 0 });
    const second = createEntry({ id: 'entry-2', title: 'Habit', icon: 'iconCheck', order: 1, viewType: 'habit' });

    store.bindPlugin(plugin);
    store.entries = [first, second];
    store.activeEntryId = first.id;

    await store.setActiveEntry(second.id);

    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [first, second],
      dashboards: [],
      activeEntryId: second.id,
    });
  });

  it('exposes save failure state when persistence returns false', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    mockSaveWorkbenchSettings.mockResolvedValueOnce(false);

    await store.createViewEntry('todo');

    expect(store.saveState).toBe('error');
    expect(store.saveError).toBe('Failed to save workbench settings');
  });

  it('addWidget creates widget using registry defaults and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard();

    store.dashboards = [dashboard];

    await store.addWidget(dashboard.id, 'todoList');

    expect(store.dashboards[0].widgets).toHaveLength(1);
    expect(store.dashboards[0].widgets[0]).toEqual(expect.objectContaining({
      type: 'todoList',
      layout: expect.objectContaining({
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      }),
      config: { source: 'default-config' },
    }));
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('addWidget places new widgets into the next available grid slot', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.addWidget(dashboard.id, 'todoList');
    await store.addWidget(dashboard.id, 'todoList');

    expect(store.dashboards[0].widgets.map(widget => widget.layout)).toEqual([
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 6, h: 4 },
      { x: 0, y: 4, w: 6, h: 4 },
    ]);
  });

  it('removeWidget removes widget from dashboard and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.removeWidget(dashboard.id, 'widget-1');

    expect(store.dashboards[0].widgets).toEqual([]);
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('renameWidget updates widget title and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.renameWidget(dashboard.id, 'widget-1', 'Today Todos');

    expect(store.dashboards[0].widgets[0].title).toBe('Today Todos');
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('updateWidgetLayout updates widget layout and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.updateWidgetLayout(dashboard.id, 'widget-1', { x: 2, y: 1, w: 4, h: 3 });

    expect(store.dashboards[0].widgets[0].layout).toEqual({ x: 2, y: 1, w: 4, h: 3 });
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('updateWidgetLayouts batch updates widget layouts and persists once', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
        {
          id: 'widget-2',
          type: 'habitWeek',
          title: 'Habit Week',
          layout: { x: 6, y: 0, w: 6, h: 4 },
          config: {},
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.updateWidgetLayouts(dashboard.id, [
      { id: 'widget-1', x: 1, y: 2, w: 5, h: 3 },
      { id: 'widget-2', x: 6, y: 2, w: 6, h: 5 },
    ]);

    expect(store.dashboards[0].widgets.map(widget => widget.layout)).toEqual([
      { x: 1, y: 2, w: 5, h: 3 },
      { x: 6, y: 2, w: 6, h: 5 },
    ]);
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('updateWidgetConfig updates widget config and persists', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: { preset: { groupId: 'group-a' } },
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.updateWidgetConfig(dashboard.id, 'widget-1', { preset: { groupId: 'group-b' } });

    expect(store.dashboards[0].widgets[0].config).toEqual({ preset: { groupId: 'group-b' } });
    expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, {
      entries: [],
      dashboards: store.dashboards,
      activeEntryId: null,
    });
  });

  it('updateWidgetConfig persists todo preset config', async () => {
    const plugin = createPlugin();
    const store = useWorkbenchStore();
    store.bindPlugin(plugin);
    const dashboard = createDashboard({
      widgets: [
        {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: {
            preset: {},
          },
        },
      ],
    });

    store.dashboards = [dashboard];

    await store.updateWidgetConfig(dashboard.id, 'widget-1', {
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    });

    expect(store.dashboards[0].widgets[0].config).toEqual({
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    });
  });
});
