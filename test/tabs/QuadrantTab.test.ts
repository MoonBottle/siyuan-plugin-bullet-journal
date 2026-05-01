// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, defineComponent, h, nextTick, watchEffect } from 'vue';
import { initI18n } from '@/i18n';
import { TAB_TYPES } from '@/constants';

const todoSidebarProps = vi.fn();
const nativePreviewOpen = vi.fn();
const nativePreviewClose = vi.fn();
const nativePreviewOpenCalls: Array<Record<string, any>> = [];
const mockRefresh = vi.fn(() => Promise.resolve());
const mockUpdateBlockPriority = vi.fn(() => Promise.resolve(true));
const mockShowMessage = vi.fn();
const mockLoadFromPlugin = vi.fn();
const mockSaveToPlugin = vi.fn();
const mockEventBusOn = vi.fn(() => () => {});
const mockCreateRefreshChannelGuard = vi.fn(() => ({ dispose: vi.fn() }));
const menuAddItem = vi.fn();
const menuOpen = vi.fn();
const mockGetFilteredAndSortedItems = vi.fn((filters?: {
  priorities?: string[];
  includeNoPriority?: boolean;
}) => {
  if (filters?.includeNoPriority) {
    return [{ id: 'q4' }];
  }
  if (filters?.priorities?.[0] === 'high') {
    return [{ id: 'q1a' }, { id: 'q1b' }];
  }
  if (filters?.priorities?.[0] === 'medium') {
    return [{ id: 'q2' }];
  }
  if (filters?.priorities?.[0] === 'low') {
    return [{ id: 'q3' }, { id: 'q3b' }, { id: 'q3c' }];
  }
  return [];
});

const mockPlugin = { name: 'plugin' };
const mockApp = { name: 'app' };
const mockSettingsStore = {
  scanMode: 'all',
  directories: [],
  defaultGroup: '',
  groups: [
    { id: 'group-a', name: 'Group A' },
    { id: 'group-b', name: 'Group B' },
  ],
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false,
    showLinks: false,
    showReminderAndRecurring: false,
  },
  loadFromPlugin: mockLoadFromPlugin,
  saveToPlugin: mockSaveToPlugin,
  $patch: vi.fn((patch: Record<string, unknown>) => Object.assign(mockSettingsStore, patch)),
};
const mockProjectStore = {
  loading: false,
  hideCompleted: false,
  hideAbandoned: false,
  refresh: mockRefresh,
  toggleHideCompleted: vi.fn(() => {
    mockProjectStore.hideCompleted = !mockProjectStore.hideCompleted;
  }),
  toggleHideAbandoned: vi.fn(() => {
    mockProjectStore.hideAbandoned = !mockProjectStore.hideAbandoned;
  }),
  getFilteredAndSortedItems: mockGetFilteredAndSortedItems,
  getItemByBlockId: vi.fn((blockId: string) => ({
    id: `item-for-${blockId}`,
    content: `item-for-${blockId}`,
    date: '2026-05-01',
    lineNumber: 1,
    blockId,
    docId: 'doc-1',
    status: 'pending',
  })),
};

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => mockPlugin),
  useApp: vi.fn(() => mockApp),
  getCurrentPlugin: vi.fn(() => mockPlugin),
}));

vi.mock('siyuan', () => ({
  Menu: vi.fn(function () {
    return {
      addItem: menuAddItem,
      open: menuOpen,
    };
  }),
}));

vi.mock('@/utils/dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/dialog')>();
  return {
    ...actual,
    showMessage: mockShowMessage,
  };
});

vi.mock('@/utils/fileUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/fileUtils')>();
  return {
    ...actual,
    updateBlockPriority: mockUpdateBlockPriority,
  };
});

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: mockEventBusOn, emit: vi.fn() },
  Events: { DATA_REFRESH: 'data:refresh' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: mockCreateRefreshChannelGuard,
}));

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
  useSettingsStore: () => mockSettingsStore,
}));

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h(
        'select',
        {
          'data-testid': 'quadrant-group-select',
          value: props.modelValue,
          onChange: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLSelectElement).value);
          },
        },
        (props.options ?? []).map((option: { value: string, label: string }) =>
          h('option', { value: option.value }, option.label),
        ),
      );
    },
  }),
}));

vi.mock('@/components/todo/TodoSidebar.vue', () => ({
  default: defineComponent({
    name: 'TodoSidebarStub',
    props: {
      groupId: { type: String, default: '' },
      searchQuery: { type: String, default: '' },
      priorities: { type: Array, default: () => [] },
      includeNoPriority: { type: Boolean, default: false },
      displayMode: { type: String, default: 'default' },
      enableDrag: { type: Boolean, default: false },
      onItemDragStart: { type: Function, default: undefined },
      onItemDragEnd: { type: Function, default: undefined },
      onItemHoverStart: { type: Function, default: undefined },
      onItemHoverEnd: { type: Function, default: undefined },
    },
    setup(props, { expose }) {
      watchEffect(() => {
        todoSidebarProps({
          groupId: props.groupId,
          searchQuery: props.searchQuery,
          priorities: [...props.priorities],
          includeNoPriority: props.includeNoPriority,
          displayMode: props.displayMode,
          enableDrag: props.enableDrag,
          onItemDragStart: props.onItemDragStart,
          onItemDragEnd: props.onItemDragEnd,
          onItemHoverStart: props.onItemHoverStart,
          onItemHoverEnd: props.onItemHoverEnd,
        });
      });

      expose({
        allCollapsed: false,
        toggleCollapseAll: vi.fn(),
      });

      return () => h('div', { 'data-testid': 'todo-sidebar-stub' });
    },
  }),
}));

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: (options: Record<string, any>) => {
      nativePreviewOpen(options);
      nativePreviewOpenCalls.push(options);
    },
    close: nativePreviewClose,
    isOpen: vi.fn(() => false),
  }),
}));

function createDropEvent(payload?: Record<string, unknown>) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: 'none',
      getData: (type: string) => type === 'application/json' && payload
        ? JSON.stringify(payload)
        : '',
    },
  });
  return event;
}

function createDragOverEvent() {
  const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: 'none',
      getData: () => '',
    },
  });
  return event;
}

function mountQuadrantTab() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  return import('@/tabs/QuadrantTab.vue').then(({ default: QuadrantTab }) => {
    const app = createApp(QuadrantTab);
    app.mount(container);

    return {
      container,
      app,
      unmount() {
        app.unmount();
        container.remove();
      },
    };
  });
}

function getLatestTodoSidebarProps() {
  const calls = todoSidebarProps.mock.calls;
  return calls[calls.length - 1]?.[0];
}

describe('QuadrantTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initI18n('en_US');
    vi.clearAllMocks();
    nativePreviewOpenCalls.length = 0;
    mockSettingsStore.scanMode = 'all';
    mockSettingsStore.directories = [];
    mockSettingsStore.defaultGroup = '';
    mockSettingsStore.groups = [
      { id: 'group-a', name: 'Group A' },
      { id: 'group-b', name: 'Group B' },
    ];
    mockSettingsStore.todoDock.hideCompleted = false;
    mockSettingsStore.todoDock.hideAbandoned = false;
    mockSettingsStore.todoDock.showLinks = false;
    mockSettingsStore.todoDock.showReminderAndRecurring = false;
    mockProjectStore.loading = false;
    mockProjectStore.hideCompleted = false;
    mockProjectStore.hideAbandoned = false;
    mockProjectStore.getItemByBlockId.mockReturnValue({
      id: 'item-1',
      content: 'item-for-block-1',
      date: '2026-05-01',
      lineNumber: 1,
      blockId: 'block-1',
      docId: 'doc-1',
      status: 'pending',
    });
    (globalThis as any).BroadcastChannel = vi.fn(function () {
      return {
        onmessage: null,
        close: vi.fn(),
      };
    });
  });

  it('renders four quadrant panels with embedded TodoSidebar filters', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    expect(mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')).toHaveLength(4);
    expect(mounted.container.querySelectorAll('[data-testid="todo-sidebar-stub"]')).toHaveLength(4);
    expect(Array.from(mounted.container.querySelectorAll('.quadrant-panel__title')).map(node => node.textContent)).toEqual([
      'Important & Urgent',
      'Important, Not Urgent',
      'Urgent, Not Important',
      'Neither Urgent nor Important',
    ]);

    expect(todoSidebarProps).toHaveBeenNthCalledWith(1, expect.objectContaining({
      priorities: ['high'],
      includeNoPriority: false,
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart: expect.any(Function),
      onItemDragEnd: expect.any(Function),
      onItemHoverStart: expect.any(Function),
      onItemHoverEnd: expect.any(Function),
    }));
    expect(todoSidebarProps).toHaveBeenNthCalledWith(2, expect.objectContaining({
      priorities: ['medium'],
      includeNoPriority: false,
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart: expect.any(Function),
      onItemDragEnd: expect.any(Function),
      onItemHoverStart: expect.any(Function),
      onItemHoverEnd: expect.any(Function),
    }));
    expect(todoSidebarProps).toHaveBeenNthCalledWith(3, expect.objectContaining({
      priorities: ['low'],
      includeNoPriority: false,
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart: expect.any(Function),
      onItemDragEnd: expect.any(Function),
      onItemHoverStart: expect.any(Function),
      onItemHoverEnd: expect.any(Function),
    }));
    expect(todoSidebarProps).toHaveBeenNthCalledWith(4, expect.objectContaining({
      priorities: [],
      includeNoPriority: true,
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart: expect.any(Function),
      onItemDragEnd: expect.any(Function),
      onItemHoverStart: expect.any(Function),
      onItemHoverEnd: expect.any(Function),
    }));

    expect(mockGetFilteredAndSortedItems).toHaveBeenCalledWith(expect.objectContaining({
      priorities: ['high'],
      includeNoPriority: false,
    }));
    expect(mockGetFilteredAndSortedItems).toHaveBeenCalledWith(expect.objectContaining({
      priorities: ['medium'],
      includeNoPriority: false,
    }));
    expect(mockGetFilteredAndSortedItems).toHaveBeenCalledWith(expect.objectContaining({
      priorities: ['low'],
      includeNoPriority: false,
    }));
    expect(mockGetFilteredAndSortedItems).toHaveBeenCalledWith(expect.objectContaining({
      priorities: undefined,
      includeNoPriority: true,
    }));

    mounted.unmount();
  });

  it('honors defaultGroup loaded on mount for the current selection and sidebar filters', async () => {
    mockLoadFromPlugin.mockImplementationOnce(() => {
      mockSettingsStore.defaultGroup = 'group-b';
    });

    const mounted = await mountQuadrantTab();
    await nextTick();

    const groupSelect = mounted.container.querySelector('[data-testid="quadrant-group-select"]') as HTMLSelectElement;
    expect(groupSelect.value).toBe('group-b');
    expect(todoSidebarProps).toHaveBeenLastCalledWith(expect.objectContaining({
      groupId: 'group-b',
    }));

    mounted.unmount();
  });

  it('preserves a user-selected non-default group across later defaultGroup refreshes', async () => {
    mockSettingsStore.defaultGroup = 'group-b';
    mockSettingsStore.groups = [
      { id: 'group-a', name: 'Group A' },
      { id: 'group-b', name: 'Group B' },
      { id: 'group-c', name: 'Group C' },
    ];

    const mounted = await mountQuadrantTab();
    await nextTick();

    const groupSelect = mounted.container.querySelector('[data-testid="quadrant-group-select"]') as HTMLSelectElement;
    groupSelect.value = 'group-a';
    groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();

    mockRefresh.mockClear();
    todoSidebarProps.mockClear();

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      defaultGroup: 'group-c',
      groups: mockSettingsStore.groups,
    });
    await nextTick();

    expect(groupSelect.value).toBe('group-a');
    expect(todoSidebarProps).not.toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'group-c',
    }));

    mounted.unmount();
  });

  it('preserves an explicit all-groups selection across later defaultGroup refreshes', async () => {
    mockSettingsStore.defaultGroup = 'group-b';

    const mounted = await mountQuadrantTab();
    await nextTick();

    const groupSelect = mounted.container.querySelector('[data-testid="quadrant-group-select"]') as HTMLSelectElement;
    groupSelect.value = '';
    groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();

    mockRefresh.mockClear();
    todoSidebarProps.mockClear();

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      defaultGroup: 'group-a',
      groups: mockSettingsStore.groups,
    });
    await nextTick();

    expect(groupSelect.value).toBe('');
    expect(todoSidebarProps).not.toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'group-a',
    }));

    mounted.unmount();
  });

  it('clicking refresh calls projectStore.refresh', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    (mounted.container.querySelector('[data-testid="quadrant-refresh-button"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mockRefresh).toHaveBeenCalledWith(mockPlugin, 'all', []);

    mounted.unmount();
  });

  it('shows a more menu with the same visibility toggles as Todo Dock', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    (mounted.container.querySelector('[data-testid="quadrant-more-button"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = menuAddItem.mock.calls.map(call => call[0]?.label);

    expect(labels).toEqual([
      'Hide completed',
      'Hide abandoned',
      'Show links',
      'Show reminder & recurring',
    ]);
    expect(menuOpen).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('subscribes to same-context refresh events and reloads settings before refreshing', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    expect(mockEventBusOn).toHaveBeenCalledWith('data:refresh', expect.any(Function));

    const refreshHandler = mockEventBusOn.mock.calls.find(call => call[0] === 'data:refresh')?.[1];
    await refreshHandler?.();

    expect(mockLoadFromPlugin).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledWith(mockPlugin, 'all', []);

    mounted.unmount();
  });

  it('sets up BroadcastChannel refresh handling via createRefreshChannelGuard', async () => {
    mockSettingsStore.defaultGroup = 'group-a';
    const mounted = await mountQuadrantTab();
    await nextTick();

    expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('task-assistant-refresh');
    expect(mockCreateRefreshChannelGuard).toHaveBeenCalledWith(expect.objectContaining({
      channel: expect.any(Object),
      plugin: mockPlugin,
      getCurrentPlugin: expect.any(Function),
      onRefresh: expect.any(Function),
      viewName: 'QuadrantTab',
    }));

    mockLoadFromPlugin.mockClear();
    mockRefresh.mockClear();
    todoSidebarProps.mockClear();

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      scanMode: 'dirs',
      directories: ['updated-dir'],
      defaultGroup: 'group-b',
    });
    await nextTick();

    expect(mockLoadFromPlugin).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledWith(mockPlugin, 'dirs', ['updated-dir']);
    expect(mounted.container.querySelector('[data-testid="quadrant-group-select"]')).toHaveProperty('value', 'group-b');
    expect(todoSidebarProps).toHaveBeenLastCalledWith(expect.objectContaining({
      groupId: 'group-b',
    }));

    mounted.unmount();
  });

  it('maps a drop on the no-priority quadrant to updateBlockPriority(undefined) and refreshes', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const dropTarget = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[3] as HTMLElement;
    dropTarget.dispatchEvent(createDropEvent({
      blockId: 'block-a',
      itemId: 'item-a',
      priority: 'medium',
    }));
    await nextTick();

    expect(mockUpdateBlockPriority).toHaveBeenCalledWith('block-a', undefined);
    expect(mockRefresh).toHaveBeenCalledWith(mockPlugin, 'all', []);

    mounted.unmount();
  });

  it('ignores drops into the same priority quadrant', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const highPanel = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[0] as HTMLElement;
    highPanel.dispatchEvent(createDropEvent({
      blockId: 'block-a',
      itemId: 'item-a',
      priority: 'high',
    }));
    await nextTick();

    expect(mockUpdateBlockPriority).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('uses TodoSidebar drag callbacks as the first payload source for drops', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const { onItemDragStart, onItemDragEnd } = todoSidebarProps.mock.calls[0][0];
    onItemDragStart({
      blockId: 'block-b',
      itemId: 'item-b',
      priority: 'low',
    });

    const mediumPanel = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[1] as HTMLElement;
    mediumPanel.dispatchEvent(createDropEvent());
    await nextTick();

    expect(mockUpdateBlockPriority).toHaveBeenCalledWith('block-b', 'medium');

    onItemDragEnd();
    expect(mediumPanel.classList.contains('quadrant-panel--drop-active')).toBe(false);

    mounted.unmount();
  });

  it('passes hover preview callbacks into embedded todo sidebars', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();

    expect(sidebarProps.onItemHoverStart).toBeTypeOf('function');
    expect(sidebarProps.onItemHoverEnd).toBeTypeOf('function');

    mounted.unmount();
  });

  it('suppresses preview opening while drag is active', async () => {
    vi.useFakeTimers();
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorEl = document.createElement('div');

    sidebarProps.onItemDragStart?.({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    });
    sidebarProps.onItemHoverStart?.({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });

    vi.runAllTimers();
    await nextTick();

    expect(nativePreviewOpen).not.toHaveBeenCalled();

    mounted.unmount();
    vi.useRealTimers();
  });

  it('closes an open preview when dragging starts after hover activation', async () => {
    vi.useFakeTimers();
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorEl = document.createElement('div');

    sidebarProps.onItemHoverStart?.({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });

    vi.advanceTimersByTime(120);
    await nextTick();

    expect(nativePreviewOpen).toHaveBeenCalledWith(expect.objectContaining({
      app: mockApp,
      blockId: 'block-1',
      anchorEl,
      onHoverChange: expect.any(Function),
    }));

    sidebarProps.onItemDragStart?.({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    });
    await nextTick();

    expect(nativePreviewClose).toHaveBeenCalled();

    mounted.unmount();
    vi.useRealTimers();
  });

  it('does not let a stale panel destruction callback clear a newer preview target', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorA = document.createElement('div');
    const anchorB = document.createElement('div');

    sidebarProps.onItemHoverStart?.({
      blockId: 'block-a',
      itemId: 'item-a',
      anchorEl: anchorA,
    });
    await nextTick();

    sidebarProps.onItemHoverStart?.({
      blockId: 'block-b',
      itemId: 'item-b',
      anchorEl: anchorB,
    });
    await nextTick();

    expect(nativePreviewOpenCalls).toHaveLength(2);

    const firstDestroy = nativePreviewOpenCalls[0].onPanelDestroyed as ((payload: {
      initiatedByController: boolean;
      blockId: string;
      anchorEl: HTMLElement;
    }) => void);

    firstDestroy({
      initiatedByController: false,
      blockId: 'block-a',
      anchorEl: anchorA,
    });
    await nextTick();

    expect(nativePreviewClose).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('shows and clears active drop state during dragover and dragleave', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const lowPanel = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[2] as HTMLElement;
    const dragOverEvent = createDragOverEvent();
    lowPanel.dispatchEvent(dragOverEvent);
    await nextTick();

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect((dragOverEvent.dataTransfer as DataTransfer).dropEffect).toBe('move');
    expect(lowPanel.classList.contains('quadrant-panel--drop-active')).toBe(true);

    lowPanel.dispatchEvent(new Event('dragleave', { bubbles: true }));
    await nextTick();

    expect(lowPanel.classList.contains('quadrant-panel--drop-active')).toBe(false);

    mounted.unmount();
  });

  it('keeps active drop state when dragleave moves to a child inside the same panel', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const lowPanel = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[2] as HTMLElement;
    lowPanel.dispatchEvent(createDragOverEvent());
    await nextTick();

    const child = lowPanel.querySelector('.quadrant-panel__body') as HTMLElement;
    const dragLeaveEvent = new Event('dragleave', { bubbles: true }) as DragEvent;
    Object.defineProperty(dragLeaveEvent, 'relatedTarget', {
      value: child,
      configurable: true,
    });

    lowPanel.dispatchEvent(dragLeaveEvent);
    await nextTick();

    expect(lowPanel.classList.contains('quadrant-panel--drop-active')).toBe(true);

    mounted.unmount();
  });

  it('shows a failure message and does not refresh when priority update fails', async () => {
    mockUpdateBlockPriority.mockResolvedValueOnce(false);
    const mounted = await mountQuadrantTab();
    await nextTick();

    const mediumPanel = mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')[1] as HTMLElement;
    mediumPanel.dispatchEvent(createDropEvent({
      blockId: 'block-c',
      itemId: 'item-c',
      priority: 'low',
    }));
    await nextTick();

    expect(mockUpdateBlockPriority).toHaveBeenCalledWith('block-c', 'medium');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockShowMessage).toHaveBeenCalled();

    mounted.unmount();
  });

  it('exposes quadrant tab type', () => {
    expect(TAB_TYPES.QUADRANT).toBe('bullet-journal-quadrant');
  });
});

describe('TaskAssistantPlugin top bar', () => {
  it('only includes Quadrant in the top-bar menu on desktop', async () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*menu\.addItem\(\{\s*icon:\s*"iconGrid",\s*label:\s*t\("quadrant"\)\.title,/s,
    );
  });
});
