// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

function createViewEntry(viewType: WorkbenchEntry['viewType']): WorkbenchEntry {
  return {
    id: `entry-${viewType}`,
    type: 'view',
    title: String(viewType),
    icon: 'iconFile',
    order: 0,
    viewType,
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

describe('WorkbenchViewHost', () => {
  beforeEach(() => {
    initI18n('en_US');
  });

  it('todo view entry renders workbench todo host', async () => {
    const { default: WorkbenchViewHost } = await import('@/components/workbench/view/WorkbenchViewHost.vue');
    const mounted = await mountComponent(WorkbenchViewHost, {
      entry: createViewEntry('todo'),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull();

    mounted.unmount();
  });

  it('quadrant view entry renders workbench quadrant host', async () => {
    const { default: WorkbenchViewHost } = await import('@/components/workbench/view/WorkbenchViewHost.vue');
    const mounted = await mountComponent(WorkbenchViewHost, {
      entry: createViewEntry('quadrant'),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-view-quadrant"]')).not.toBeNull();

    mounted.unmount();
  });

  it('unsupported view entry renders unsupported placeholder', async () => {
    const { default: WorkbenchViewHost } = await import('@/components/workbench/view/WorkbenchViewHost.vue');
    const mounted = await mountComponent(WorkbenchViewHost, {
      entry: createViewEntry('calendar'),
    });

    expect(mounted.container.querySelector('[data-testid="workbench-view-unsupported"]')).not.toBeNull();

    mounted.unmount();
  });
});

describe('WorkbenchContentHost routing', () => {
  beforeEach(() => {
    initI18n('en_US');
  });

  it('routes empty, dashboard, and view entry states', async () => {
    const { default: WorkbenchContentHost } = await import('@/components/workbench/WorkbenchContentHost.vue');

    const emptyMounted = await mountComponent(WorkbenchContentHost, {
      activeEntry: null,
    });
    expect(emptyMounted.container.querySelector('[data-testid="workbench-content-empty"]')).not.toBeNull();
    emptyMounted.unmount();

    const dashboardMounted = await mountComponent(WorkbenchContentHost, {
      activeEntry: {
        id: 'entry-dashboard',
        type: 'dashboard',
        title: 'Planning Board',
        icon: 'iconLayout',
        order: 0,
        dashboardId: 'dashboard-1',
      } satisfies WorkbenchEntry,
    });
    expect(dashboardMounted.container.querySelector('[data-testid="workbench-dashboard-placeholder"]')).not.toBeNull();
    dashboardMounted.unmount();

    const viewMounted = await mountComponent(WorkbenchContentHost, {
      activeEntry: createViewEntry('todo'),
    });
    expect(viewMounted.container.querySelector('[data-testid="workbench-view-host"]')).not.toBeNull();
    expect(viewMounted.container.querySelector('[data-testid="workbench-view-todo"]')).not.toBeNull();
    viewMounted.unmount();
  });
});
