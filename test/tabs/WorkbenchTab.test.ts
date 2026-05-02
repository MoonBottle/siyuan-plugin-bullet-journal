// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computed, createApp, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { TAB_TYPES } from '@/constants';

const mockPlugin = { name: 'plugin' };
const mockLoad = vi.fn(() => Promise.resolve());
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

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => mockPlugin),
}));

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores');
  return {
    ...actual,
    useWorkbenchStore: () => {
      const entries = ref([
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
      const activeEntryId = ref<string | null>('entry-dashboard');
      const store = {
        get entries() {
          return entries.value;
        },
        get activeEntryId() {
          return activeEntryId.value;
        },
        get activeEntry() {
          return entries.value.find((entry: any) => entry.id === activeEntryId.value) ?? null;
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
          entries.value = [...entries.value, entry];
          activeEntryId.value = entry.id;
          return entry;
        },
        createViewEntry: async (...args: any[]) => {
          const entry = await mockCreateViewEntry(...args);
          entries.value = [...entries.value, entry];
          activeEntryId.value = entry.id;
          return entry;
        },
        setActiveEntry: async (id: string) => {
          mockSetActiveEntry(id);
          activeEntryId.value = id;
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
    const mounted = await mountWorkbenchTab();

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-content-host"]')).not.toBeNull();
    expect(mockLoad).toHaveBeenCalledWith(mockPlugin);

    mounted.unmount();
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
