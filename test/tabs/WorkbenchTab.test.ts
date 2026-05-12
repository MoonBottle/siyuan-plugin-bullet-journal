// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computed, createApp, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { TAB_TYPES } from '@/constants';

const mockPlugin = { name: 'plugin' };
const mockApp = { name: 'app' };
const mockLoad = vi.fn(() => Promise.resolve());
const mockSettingsLoadFromPlugin = vi.fn();
const mockRequestDataRefresh = vi.fn(() => Promise.resolve());
const mockEventBusOn = vi.fn(() => () => {});
const mockRefreshChannelDispose = vi.fn();
const mockCreateRefreshChannelGuard = vi.fn(() => ({
  dispose: mockRefreshChannelDispose,
}));
const mockCreateDashboardEntry = vi.fn(() => Promise.resolve({
  id: 'entry-created-dashboard',
  type: 'dashboard',
  title: 'New Dashboard',
  icon: 'iconBoard',
  order: 2,
  dashboardId: 'dashboard-created',
}));
const mockCreateViewEntry = vi.fn(() => Promise.resolve({
  id: 'entry-created-view',
  type: 'view',
  title: 'Todo',
  icon: 'iconList',
  order: 2,
  viewType: 'todo',
}));
const mockSetActiveEntry = vi.fn(() => Promise.resolve());
const mockAddWidget = vi.fn(() => Promise.resolve());
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
  },
]);
const mockActiveEntryId = ref<string | null>('entry-dashboard');
const mockSettingsStore = {
  loaded: true,
  scanMode: 'all',
  directories: [],
  sidebarCollapsed: false,
  loadFromPlugin: mockSettingsLoadFromPlugin,
  $patch: vi.fn((patch: Record<string, unknown>) => Object.assign(mockSettingsStore, patch)),
};
const mockProjectStore = {};

vi.mock('@/main', async () => {
  const actual = await vi.importActual<typeof import('@/main')>('@/main');
  return {
    ...actual,
    usePlugin: vi.fn(() => ({ ...mockPlugin, requestDataRefresh: mockRequestDataRefresh })),
    useApp: vi.fn(() => mockApp),
    getCurrentPlugin: vi.fn(() => ({ ...mockPlugin, requestDataRefresh: mockRequestDataRefresh })),
  };
});

vi.mock('@/components/workbench/dashboard/DashboardCanvas.vue', () => ({
  default: {
    name: 'DashboardCanvasStub',
    template: '<div data-testid="workbench-dashboard-canvas-stub"></div>',
  },
}));

vi.mock('@/tabs/DesktopTodoDock.vue', () => ({
  default: {
    name: 'DesktopTodoDockStub',
    template: '<div data-testid="desktop-todo-dock-stub"></div>',
  },
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: mockEventBusOn, emit: vi.fn() },
  Events: { DATA_REFRESH: 'data:refresh' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: mockCreateRefreshChannelGuard,
}));

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores');
  return {
    ...actual,
    useProjectStore: () => mockProjectStore,
    useSettingsStore: () => mockSettingsStore,
    useWorkbenchStore: () => {
      const store = {
        get entries() {
          return mockEntries.value;
        },
        get activeEntryId() {
          return mockActiveEntryId.value;
        },
        get activeEntry() {
          return mockEntries.value.find((entry: any) => entry.id === mockActiveEntryId.value) ?? null;
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
          const entry = await mockCreateDashboardEntry(...args);
          mockEntries.value = [...mockEntries.value, entry];
          mockActiveEntryId.value = entry.id;
          return entry;
        },
        createViewEntry: async (...args: any[]) => {
          const entry = await mockCreateViewEntry(...args);
          mockEntries.value = [...mockEntries.value, entry];
          mockActiveEntryId.value = entry.id;
          return entry;
        },
        setActiveEntry: async (id: string) => {
          mockSetActiveEntry(id);
          mockActiveEntryId.value = id;
        },
        addWidget: mockAddWidget,
      };
      return store;
    },
  };
});

describe('Workbench tab constants', () => {
  it('exposes workbench tab type', () => {
    expect(TAB_TYPES.WORKBENCH).toBe('bullet-journal-workbench');
  });
});

describe('WorkbenchTab shell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    initI18n('en_US');
    vi.clearAllMocks();
    mockSettingsStore.loaded = true;
    mockSettingsStore.scanMode = 'all';
    mockSettingsStore.directories = [];
    mockSettingsStore.sidebarCollapsed = false;
    mockRequestDataRefresh.mockClear();
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
      },
    ];
    mockActiveEntryId.value = 'entry-dashboard';
    mockCreateDashboardEntry.mockResolvedValue({
      id: 'entry-created-dashboard',
      type: 'dashboard',
      title: 'New Dashboard',
      icon: 'iconBoard',
      order: 2,
      dashboardId: 'dashboard-created',
    });
    mockCreateViewEntry.mockResolvedValue({
      id: 'entry-created-view',
      type: 'view',
      title: 'Todo',
      icon: 'iconList',
      order: 2,
      viewType: 'todo',
    });
    (globalThis as any).BroadcastChannel = vi.fn(function () {
      return {
      close: vi.fn(),
      };
    });
  });

  async function mountWorkbenchTab() {
    const { default: WorkbenchTab } = await import('@/tabs/WorkbenchTab.vue');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp(WorkbenchTab);
    app.use(createPinia());
    app.mount(container);
    await nextTick();

    return {
      container,
      app,
      unmount() {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders sidebar and content host and loads store on mount', async () => {
    mockActiveEntryId.value = 'entry-todo';
    const mounted = await mountWorkbenchTab();

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-content-host"]')).not.toBeNull();
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ name: 'plugin' }));

    mounted.unmount();
  }, 10000);

  it('subscribes to same-context refresh events and reloads settings without refreshing projects directly', async () => {
    const mounted = await mountWorkbenchTab();
    await nextTick();

    expect(mockEventBusOn).toHaveBeenCalledWith('data:refresh', expect.any(Function));

    const refreshHandler = mockEventBusOn.mock.calls.find(call => call[0] === 'data:refresh')?.[1];
    await refreshHandler?.();

    expect(mockSettingsLoadFromPlugin).toHaveBeenCalled();

    mounted.unmount();
  });

  it('sets up BroadcastChannel refresh handling and applies payload without refreshing projects directly', async () => {
    const mounted = await mountWorkbenchTab();
    await nextTick();

    expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('task-assistant-refresh');
    expect(mockCreateRefreshChannelGuard).toHaveBeenCalledWith(expect.objectContaining({
      channel: expect.any(Object),
      plugin: expect.objectContaining({ name: 'plugin' }),
      getCurrentPlugin: expect.any(Function),
      onRefresh: expect.any(Function),
      viewName: 'WorkbenchTab',
    }));

    mockSettingsLoadFromPlugin.mockClear();
    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      scanMode: 'dirs',
      directories: ['updated-dir'],
    });
    await nextTick();

    expect(mockSettingsLoadFromPlugin).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('cleans up refresh subscriptions and BroadcastChannel on unmount', async () => {
    const unsubscribeRefresh = vi.fn();
    const closeChannel = vi.fn();
    mockEventBusOn.mockReturnValueOnce(unsubscribeRefresh);
    (globalThis as any).BroadcastChannel = vi.fn(function () {
      return {
      close: closeChannel,
      };
    });

    const mounted = await mountWorkbenchTab();
    await nextTick();

    mounted.unmount();

    expect(unsubscribeRefresh).toHaveBeenCalled();
    expect(mockRefreshChannelDispose).toHaveBeenCalled();
    expect(closeChannel).toHaveBeenCalled();
  });

  it('sidebar actions create dashboard and todo view entries', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement)
      .click();
    await nextTick();

    (mounted.container.querySelector('[data-testid="workbench-create-dashboard"]') as HTMLButtonElement)
      .click();
    await nextTick();

    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement)
      .click();
    await nextTick();

    (mounted.container.querySelector('[data-testid="workbench-create-todo-view"]') as HTMLButtonElement)
      .click();
    await nextTick();

    expect(mockCreateDashboardEntry).toHaveBeenCalledWith('New Dashboard');
    expect(mockCreateViewEntry).toHaveBeenCalledWith('todo');

    mounted.unmount();
  });

  it('selecting an entry updates active state and content title', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mockSetActiveEntry).toHaveBeenCalledWith('entry-todo');
    expect(mounted.container.querySelector('[data-testid="workbench-toolbar-title"]')?.textContent).toContain('Todo');
    expect(mounted.container.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull();

    mounted.unmount();
  });

  it('shows add todoList widget action for active dashboard and wires it to the store', async () => {
    const mounted = await mountWorkbenchTab();

    const addWidgetTrigger = mounted.container.querySelector('[data-testid="workbench-add-widget-trigger"]') as HTMLButtonElement;
    expect(addWidgetTrigger).not.toBeNull();

    addWidgetTrigger.click();
    await nextTick();

    const addWidgetButton = mounted.container.querySelector('[data-testid="workbench-add-widget-todoList"]') as HTMLButtonElement;
    expect(addWidgetButton).not.toBeNull();

    addWidgetButton.click();
    await nextTick();

    expect(mockAddWidget).toHaveBeenCalledWith('dashboard-1', 'todoList');

    mounted.unmount();
  });

  it('opens widget menu with all first-batch widget types for active dashboard', async () => {
    const mounted = await mountWorkbenchTab();

    (mounted.container.querySelector('[data-testid="workbench-add-widget-trigger"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-widget-menu"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-todoList"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-quadrantSummary"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-habitWeek"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-miniCalendar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-add-widget-pomodoroStats"]')).not.toBeNull();

    mounted.unmount();
  });
});

describe('Workbench registration', () => {
  it('registers the desktop workbench tab and top-bar entry in index.ts', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*this\.addTab\(\{\s*type:\s*TAB_TYPES\.WORKBENCH,/s,
    );
    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*menu\.addItem\(\{\s*icon:\s*"iconWorkspace",\s*label:\s*t\("workbench"\)\.title,\s*click:\s*\(\)\s*=>\s*\{\s*this\.openCustomTab\(TAB_TYPES\.WORKBENCH\);/s,
    );
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*"iconWorkspace"/);
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*t\("workbench"\)\.title/);
  });

  it('defines required workbench i18n labels', () => {
    const zh = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/zh_CN.json'), 'utf-8'));
    const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/en_US.json'), 'utf-8'));

    expect(en.workbench).toMatchObject({
      title: 'Workbench',
      newDashboard: 'New Dashboard',
      newView: 'New View',
      addWidget: 'Add Widget',
      emptyState: 'Select a workbench item',
    });
    expect(zh.workbench).toMatchObject({
      title: '工作台',
      newDashboard: '新建仪表盘',
      newView: '新建视图',
      addWidget: '添加组件',
      emptyState: '请选择一个工作台条目',
    });
  });
});
