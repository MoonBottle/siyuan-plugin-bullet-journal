// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

const {
  mockMenuAddItem,
  mockMenuOpen,
  mockShowConfirmDialog,
} = vi.hoisted(() => ({
  mockMenuAddItem: vi.fn(),
  mockMenuOpen: vi.fn(),
  mockShowConfirmDialog: vi.fn((_title, _message, callback) => callback?.()),
}));

vi.mock('siyuan', () => ({
  Menu: class {
    addItem = mockMenuAddItem;
    open = mockMenuOpen;
  },
}));

vi.mock('@/utils/dialog', () => ({
  showConfirmDialog: mockShowConfirmDialog,
}));

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
    vi.clearAllMocks();
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
    const onRenameEntry = vi.fn();
    const onDeleteEntry = vi.fn();

    const app = createApp(defineComponent({
      render() {
        return h(WorkbenchSidebar, {
          entries,
          activeEntryId: 'entry-dashboard',
          ...props,
          onSelect,
          onCreateDashboard,
          onCreateView,
          onRenameEntry,
          onDeleteEntry,
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
      onRenameEntry,
      onDeleteEntry,
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
    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-create-dashboard"]') as HTMLButtonElement).click();
    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-create-todo-view"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.onSelect).toHaveBeenCalledWith('entry-todo');
    expect(mounted.onCreateDashboard).toHaveBeenCalledTimes(1);
    expect(mounted.onCreateView).toHaveBeenCalledWith('todo');

    mounted.unmount();
  });

  it('supports opening the create menu and creating other view types', async () => {
    const mounted = await mountSidebar();

    (mounted.container.querySelector('[data-testid="workbench-create-trigger"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-create-menu"]')).not.toBeNull();

    (mounted.container.querySelector('[data-testid="workbench-create-quadrant-view"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.onCreateView).toHaveBeenCalledWith('quadrant');
    expect(mounted.container.querySelector('[data-testid="workbench-create-menu"]')).toBeNull();

    mounted.unmount();
  });

  it('opens context menu and emits rename entry when choosing rename', async () => {
    const mounted = await mountSidebar();
    const promptMock = vi.fn(() => 'Renamed Todo');
    Object.defineProperty(window, 'prompt', {
      value: promptMock,
      writable: true,
      configurable: true,
    });

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 24 }));

    expect(mockMenuAddItem).toHaveBeenCalledTimes(2);
    expect(mockMenuOpen).toHaveBeenCalledWith({ x: 12, y: 24 });

    const renameConfig = mockMenuAddItem.mock.calls[0][0];
    renameConfig.click();

    expect(promptMock).toHaveBeenCalled();
    expect(mounted.onRenameEntry).toHaveBeenCalledWith('entry-todo', 'Renamed Todo');
    mounted.unmount();
  });

  it('opens context menu and emits delete entry after confirmation', async () => {
    const mounted = await mountSidebar();

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 24 }));

    const deleteConfig = mockMenuAddItem.mock.calls[1][0];
    deleteConfig.click();

    expect(mockShowConfirmDialog).toHaveBeenCalled();
    expect(mounted.onDeleteEntry).toHaveBeenCalledWith('entry-todo');

    mounted.unmount();
  });
});
