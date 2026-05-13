// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import type { WorkbenchEntry } from '@/types/workbench';

const {
  mockMenuAddItem,
  mockMenuOpen,
  mockShowConfirmDialog,
  mockShowInputDialog,
  mockHideIconTooltip,
  mockShowIconTooltip,
} = vi.hoisted(() => ({
  mockMenuAddItem: vi.fn(),
  mockMenuOpen: vi.fn(),
  mockShowConfirmDialog: vi.fn((_title, _message, callback) => callback?.()),
  mockShowInputDialog: vi.fn((_title, _message, defaultValue, callback) => callback?.(defaultValue)),
  mockHideIconTooltip: vi.fn(),
  mockShowIconTooltip: vi.fn(),
}));

vi.mock('siyuan', () => ({
  Menu: class {
    addItem = mockMenuAddItem;
    open = mockMenuOpen;
  },
}));

vi.mock('@/utils/dialog', () => ({
  hideIconTooltip: mockHideIconTooltip,
  showConfirmDialog: mockShowConfirmDialog,
  showIconTooltip: mockShowIconTooltip,
  showInputDialog: mockShowInputDialog,
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
    collapsed: boolean;
  }>) {
    const { default: WorkbenchSidebar } = await import('@/components/workbench/WorkbenchSidebar.vue');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onSelect = vi.fn();
    const onCreateDashboard = vi.fn();
    const onCreateView = vi.fn();
    const onRenameEntry = vi.fn();
    const onDeleteEntry = vi.fn();
    const onToggleSidebar = vi.fn();

    const app = createApp(defineComponent({
      render() {
        return h(WorkbenchSidebar, {
          entries,
          activeEntryId: 'entry-dashboard',
          collapsed: false,
          ...props,
          onSelect,
          onCreateDashboard,
          onCreateView,
          onRenameEntry,
          onDeleteEntry,
          onToggleSidebar,
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
      onToggleSidebar,
      unmount() {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders entry list and marks active entry', async () => {
    const mounted = await mountSidebar();

    expect(mounted.container.querySelectorAll('[data-testid^="workbench-entry-"]')).toHaveLength(2);
    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-search-input"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-collapse"]')).not.toBeNull();
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
    mockShowInputDialog.mockImplementationOnce((_title, _message, _defaultValue, callback) => callback?.('Renamed Todo'));

    (mounted.container.querySelector('[data-testid="workbench-entry-entry-todo"]') as HTMLButtonElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 24 }));

    expect(mockMenuAddItem).toHaveBeenCalledTimes(2);
    expect(mockMenuOpen).toHaveBeenCalledWith({ x: 12, y: 24 });

    const renameConfig = mockMenuAddItem.mock.calls[0][0];
    renameConfig.click();

    expect(mockShowInputDialog).toHaveBeenCalledWith(
      'Rename',
      'Enter a new name',
      'Todo',
      expect.any(Function),
    );
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

  it('shows search popup results and selects an entry from the popup', async () => {
    const mounted = await mountSidebar();
    const searchInput = mounted.container.querySelector('[data-testid="workbench-sidebar-search-input"]') as HTMLInputElement;
    searchInput.value = 'todo';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-search-popup"]')).not.toBeNull();
    expect(mounted.container.querySelectorAll('[data-testid^="workbench-search-result-"]')).toHaveLength(1);

    (mounted.container.querySelector('[data-testid="workbench-search-result-entry-todo"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.onSelect).toHaveBeenCalledWith('entry-todo');
    expect(searchInput.value).toBe('');
    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-search-popup"]')).toBeNull();

    mounted.unmount();
  });

  it('shows an empty state when search has no matches', async () => {
    const mounted = await mountSidebar();
    const searchInput = mounted.container.querySelector('[data-testid="workbench-sidebar-search-input"]') as HTMLInputElement;
    searchInput.value = '111';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-search-popup"]')).not.toBeNull();
    expect(mounted.container.textContent).toContain('No matches found');
    expect(mounted.container.textContent).toContain('Try a different keyword');

    mounted.unmount();
  });

  it('supports keyboard navigation and escape in search popup', async () => {
    const mounted = await mountSidebar({
      entries: [
        ...entries,
        {
          id: 'entry-month',
          type: 'view',
          title: 'Monthly Overview',
          icon: 'iconClock',
          order: 2,
          viewType: 'todo',
        },
      ],
    });
    const searchInput = mounted.container.querySelector('[data-testid="workbench-sidebar-search-input"]') as HTMLInputElement;
    searchInput.value = 'o';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();

    expect(mounted.onSelect).toHaveBeenCalledWith('entry-month');

    searchInput.value = 'todo';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-search-popup"]')).toBeNull();

    mounted.unmount();
  });

  it('uses the top toggle button and hides search input when collapsed', async () => {
    const mounted = await mountSidebar();

    (mounted.container.querySelector('[data-testid="workbench-sidebar-collapse"]') as HTMLButtonElement).click();
    expect(mounted.onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(mounted.container.querySelector('[data-testid="workbench-sidebar-expand-float"]')).toBeNull();

    mounted.unmount();

    const collapsedMounted = await mountSidebar({
      collapsed: true,
    });

    expect(collapsedMounted.container.querySelector('[data-testid="workbench-sidebar-search-input"]')).toBeNull();
    expect(collapsedMounted.container.querySelector('[data-testid="workbench-sidebar-expand"]')).not.toBeNull();

    collapsedMounted.unmount();
  });
});
