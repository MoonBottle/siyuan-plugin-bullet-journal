// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

const entries: WorkbenchEntry[] = [
  {
    id: 'entry-dashboard',
    type: 'dashboard',
    title: 'Planning Board',
    icon: 'iconLayout',
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

describe('WorkbenchSidebar', () => {
  beforeEach(() => {
    initI18n('en_US');
  });

  async function mountSidebar(props?: Partial<{
    entries: WorkbenchEntry[];
    activeEntryId: string | null;
  }>) {
    const { default: WorkbenchSidebar } = await import('@/components/workbench/WorkbenchSidebar.vue');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onSelect = vi.fn();
    const onCreateDashboard = vi.fn();
    const onCreateView = vi.fn();

    const app = createApp(defineComponent({
      render() {
        return h(WorkbenchSidebar, {
          entries,
          activeEntryId: 'entry-dashboard',
          ...props,
          onSelect,
          onCreateDashboard,
          onCreateView,
        });
      },
    }));
    app.mount(container);
    await nextTick();

    return {
      container,
      app,
      onSelect,
      onCreateDashboard,
      onCreateView,
      unmount() {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders entry list and marks active entry', async () => {
    const mounted = await mountSidebar();

    expect(mounted.container.querySelectorAll('[data-testid^="workbench-entry-"]')).toHaveLength(2);
    expect(
      mounted.container.querySelector('[data-testid="workbench-entry-entry-dashboard"]')?.getAttribute('data-active'),
    ).toBe('true');
    expect(
      mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]')?.getAttribute('data-active'),
    ).toBe('false');

    mounted.unmount();
  });

  it('emits select and create actions', async () => {
    const mounted = await mountSidebar();

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement).click();
    (mounted.container.querySelector('[data-testid="workbench-create-dashboard"]') as HTMLButtonElement).click();
    (mounted.container.querySelector('[data-testid="workbench-create-todo-view"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.onSelect).toHaveBeenCalledWith('entry-todo');
    expect(mounted.onCreateDashboard).toHaveBeenCalledTimes(1);
    expect(mounted.onCreateView).toHaveBeenCalledWith('todo');

    mounted.unmount();
  });
});
