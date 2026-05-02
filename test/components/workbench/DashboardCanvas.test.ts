// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import type { WorkbenchDashboard, WorkbenchEntry } from '@/types/workbench';

const mockWorkbenchStore = {
  dashboards: [] as WorkbenchDashboard[],
  updateWidgetLayout: vi.fn(() => Promise.resolve()),
};

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores');
  return {
    ...actual,
    useWorkbenchStore: () => mockWorkbenchStore,
  };
});

function createDashboardEntry(overrides: Partial<WorkbenchEntry> = {}): WorkbenchEntry {
  return {
    id: 'entry-dashboard',
    type: 'dashboard',
    title: 'Planning Board',
    icon: 'iconLayout',
    order: 0,
    dashboardId: 'dashboard-1',
    ...overrides,
  };
}

async function mountComponent(component: any, props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(component, props);
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

describe('DashboardCanvas', () => {
  beforeEach(() => {
    initI18n('en_US');
    mockWorkbenchStore.dashboards = [];
    mockWorkbenchStore.updateWidgetLayout.mockClear();
  });

  it('renders widgets for selected dashboard', async () => {
    mockWorkbenchStore.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'My Todos',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {},
          },
          {
            id: 'widget-2',
            type: 'quadrantSummary',
            layout: { x: 6, y: 0, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
    const mounted = await mountComponent(DashboardCanvas, {
      entry: createDashboardEntry(),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-canvas"]')).not.toBeNull();
    expect(mounted.container.querySelectorAll('[data-testid="workbench-widget-card"]')).toHaveLength(2);
    expect(mounted.container.textContent).toContain('My Todos');

    mounted.unmount();
  });

  it('renders TodoListWidget when widget.type is todoList', async () => {
    mockWorkbenchStore.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
    const mounted = await mountComponent(DashboardCanvas, {
      entry: createDashboardEntry(),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-widget-todo-list"]')).not.toBeNull();

    mounted.unmount();
  });

  it('renders empty state when dashboard is missing', async () => {
    const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
    const mounted = await mountComponent(DashboardCanvas, {
      entry: createDashboardEntry(),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-empty"]')).not.toBeNull();

    mounted.unmount();
  });

  it('renders empty state when dashboard has no widgets', async () => {
    mockWorkbenchStore.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [],
      },
    ];

    const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
    const mounted = await mountComponent(DashboardCanvas, {
      entry: createDashboardEntry(),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-empty"]')).not.toBeNull();

    mounted.unmount();
  });

  it('updates widget layout through the temporary move action', async () => {
    mockWorkbenchStore.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
    const mounted = await mountComponent(DashboardCanvas, {
      entry: createDashboardEntry(),
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-move-widget-1"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mockWorkbenchStore.updateWidgetLayout).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      x: 1,
      y: 0,
      w: 6,
      h: 4,
    });

    mounted.unmount();
  });
});

describe('WorkbenchContentHost dashboard routing', () => {
  beforeEach(() => {
    initI18n('en_US');
    mockWorkbenchStore.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];
  });

  it('routes dashboard entries to DashboardCanvas', async () => {
    const { default: WorkbenchContentHost } = await import('@/components/workbench/WorkbenchContentHost.vue');
    const mounted = await mountComponent(WorkbenchContentHost, {
      activeEntry: createDashboardEntry(),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-canvas"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-widget-card"]')).not.toBeNull();

    mounted.unmount();
  });
});
