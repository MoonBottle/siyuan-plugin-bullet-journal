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
const nativePreviewContainsTarget = vi.fn(() => false);
const nativePreviewOpenCalls: Array<Record<string, any>> = [];
const mockRefresh = vi.fn(() => Promise.resolve());
const mockShowMessage = vi.fn();
const mockLoadFromPlugin = vi.fn();
const mockSaveToPlugin = vi.fn();
const mockEventBusOn = vi.fn(() => () => {});
const mockCreateRefreshChannelGuard = vi.fn(() => ({ dispose: vi.fn() }));
const menuAddItem = vi.fn();
const menuOpen = vi.fn();
const mockGetFilteredAndSortedItems = vi.fn(() => []);

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
};

const mockQuadrantConfigStore = {
  loaded: false,
  config: {
    version: 1,
    panels: [
      { id: 'q1', title: 'My Q1', rules: { priority: ['high'] } },
      { id: 'q2', title: 'My Q2', rules: { priority: ['medium'], date: ['today'] } },
      { id: 'q3', title: 'My Q3', rules: { priority: ['low'] } },
      { id: 'q4', title: 'My Q4', rules: { priority: ['none'] } },
    ],
  },
  panels: [
    { id: 'q1', title: 'My Q1', rules: { priority: ['high'] } },
    { id: 'q2', title: 'My Q2', rules: { priority: ['medium'], date: ['today'] } },
    { id: 'q3', title: 'My Q3', rules: { priority: ['low'] } },
    { id: 'q4', title: 'My Q4', rules: { priority: ['none'] } },
  ],
  loadConfig: vi.fn(async () => {
    mockQuadrantConfigStore.loaded = true;
  }),
  savePanel: vi.fn(),
  resetAll: vi.fn(),
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

vi.mock('@/stores/quadrantConfigStore', () => ({
  useQuadrantConfigStore: () => mockQuadrantConfigStore,
}));

const mockOpenQuadrantRuleDialog = vi.fn();
vi.mock('@/components/quadrant/openQuadrantRuleDialog', () => ({
  openQuadrantRuleDialog: mockOpenQuadrantRuleDialog,
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
      overrideItems: { type: Array, default: undefined },
      displayMode: { type: String, default: 'default' },
      enableDrag: { type: Boolean, default: false },
      onItemDragStart: { type: Function, default: undefined },
      onItemDragEnd: { type: Function, default: undefined },
      onItemHoverStart: { type: Function, default: undefined },
      onItemHoverEnd: { type: Function, default: undefined },
      onItemPreviewClick: { type: Function, default: undefined },
      previewTriggerMode: { type: String, default: 'hover' },
    },
    setup(props, { expose }) {
      watchEffect(() => {
        todoSidebarProps({
          groupId: props.groupId,
          searchQuery: props.searchQuery,
          priorities: [...props.priorities],
          includeNoPriority: props.includeNoPriority,
          overrideItems: props.overrideItems ? [...props.overrideItems] : undefined,
          displayMode: props.displayMode,
          enableDrag: props.enableDrag,
          onItemDragStart: props.onItemDragStart,
          onItemDragEnd: props.onItemDragEnd,
          onItemHoverStart: props.onItemHoverStart,
          onItemHoverEnd: props.onItemHoverEnd,
          onItemPreviewClick: props.onItemPreviewClick,
          previewTriggerMode: props.previewTriggerMode,
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
    containsTarget: nativePreviewContainsTarget,
    isOpen: vi.fn(() => false),
  }),
}));

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
    nativePreviewContainsTarget.mockReturnValue(false);
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
    mockGetFilteredAndSortedItems.mockReturnValue([]);
    mockQuadrantConfigStore.loaded = false;
    (globalThis as any).BroadcastChannel = vi.fn(function () {
      return {
        onmessage: null,
        close: vi.fn(),
      };
    });
  });

  it('renders four quadrant panels with config-driven titles and disabled drag', async () => {
    mockGetFilteredAndSortedItems.mockReturnValue([]);
    const mounted = await mountQuadrantTab();
    await nextTick();

    expect(mounted.container.querySelectorAll('[data-testid="quadrant-panel"]')).toHaveLength(4);
    expect(mounted.container.querySelectorAll('[data-testid="todo-sidebar-stub"]')).toHaveLength(4);
    expect(Array.from(mounted.container.querySelectorAll('.quadrant-panel__title')).map(node => node.textContent)).toEqual([
      'My Q1',
      'My Q2',
      'My Q3',
      'My Q4',
    ]);

    expect(todoSidebarProps).toHaveBeenNthCalledWith(1, expect.objectContaining({
      enableDrag: false,
      displayMode: 'embedded',
      previewTriggerMode: 'click',
      onItemPreviewClick: expect.any(Function),
    }));

    expect(mockQuadrantConfigStore.loadConfig).toHaveBeenCalledTimes(1);

    mounted.unmount();
  }, 10000);

  it('honors defaultGroup loaded on mount', async () => {
    mockLoadFromPlugin.mockImplementationOnce(() => {
      mockSettingsStore.defaultGroup = 'group-b';
    });

    const mounted = await mountQuadrantTab();
    await nextTick();

    const groupSelect = mounted.container.querySelector('[data-testid="quadrant-group-select"]') as HTMLSelectElement;
    expect(groupSelect.value).toBe('group-b');

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

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      defaultGroup: 'group-c',
      groups: mockSettingsStore.groups,
    });
    await nextTick();

    expect(groupSelect.value).toBe('group-a');

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

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      defaultGroup: 'group-a',
      groups: mockSettingsStore.groups,
    });
    await nextTick();

    expect(groupSelect.value).toBe('');

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

    const onRefresh = mockCreateRefreshChannelGuard.mock.calls[0]?.[0]?.onRefresh;
    await onRefresh?.({
      scanMode: 'dirs',
      directories: ['updated-dir'],
      defaultGroup: 'group-b',
    });
    await nextTick();

    expect(mockLoadFromPlugin).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledWith(mockPlugin, 'dirs', ['updated-dir']);

    mounted.unmount();
  });

  it('passes preview click callback into embedded todo sidebars', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();

    expect(sidebarProps.onItemPreviewClick).toBeTypeOf('function');
    expect(sidebarProps.previewTriggerMode).toBe('click');

    mounted.unmount();
  });

  it('opens preview from embedded card click callbacks in click trigger mode', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorEl = document.createElement('div');

    sidebarProps.onItemPreviewClick?.({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    await nextTick();

    expect(nativePreviewOpen).toHaveBeenCalledWith(expect.objectContaining({
      app: mockApp,
      blockId: 'block-1',
      anchorEl,
      onHoverChange: expect.any(Function),
    }));

    mounted.unmount();
  });

  it('closes click-trigger preview when clicking outside the card and preview panel', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorEl = document.createElement('div');
    document.body.appendChild(anchorEl);

    sidebarProps.onItemPreviewClick?.({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    await nextTick();

    expect(nativePreviewOpen).toHaveBeenCalledTimes(1);

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();

    expect(nativePreviewClose).toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not let a stale panel destruction callback clear a newer preview target', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const sidebarProps = getLatestTodoSidebarProps();
    const anchorA = document.createElement('div');
    const anchorB = document.createElement('div');

    sidebarProps.onItemPreviewClick?.({
      blockId: 'block-a',
      itemId: 'item-a',
      anchorEl: anchorA,
    });
    await nextTick();

    sidebarProps.onItemPreviewClick?.({
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

  it('opens the edit dialog when clicking the edit button on a panel', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const editButton = mounted.container.querySelector('[data-testid="quadrant-edit-button-q1"]') as HTMLElement;
    expect(editButton).toBeTruthy();
    editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mockOpenQuadrantRuleDialog).toHaveBeenCalledTimes(1);
    expect(mockOpenQuadrantRuleDialog).toHaveBeenCalledWith(expect.objectContaining({
      panel: expect.objectContaining({ id: 'q1' }),
    }));

    mounted.unmount();
  });

  it('save handler in edit dialog calls quadrantConfigStore.savePanel', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const editButton = mounted.container.querySelector('[data-testid="quadrant-edit-button-q2"]') as HTMLElement;
    editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const { onSave } = mockOpenQuadrantRuleDialog.mock.calls[0][0];
    await onSave({ id: 'q2', title: 'Custom Q2', rules: { priority: ['medium'] } });

    expect(mockQuadrantConfigStore.savePanel).toHaveBeenCalledWith('q2', expect.objectContaining({
      title: 'Custom Q2',
    }));

    mounted.unmount();
  });

  it('reset defaults handler calls quadrantConfigStore.resetAll', async () => {
    const mounted = await mountQuadrantTab();
    await nextTick();

    const editButton = mounted.container.querySelector('[data-testid="quadrant-edit-button-q3"]') as HTMLElement;
    editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const { onResetDefaults } = mockOpenQuadrantRuleDialog.mock.calls[0][0];
    await onResetDefaults();

    expect(mockQuadrantConfigStore.resetAll).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('exposes quadrant tab type', () => {
    expect(TAB_TYPES.QUADRANT).toBe('bullet-journal-quadrant');
  });
});

describe('TaskAssistantPlugin top bar', () => {
  it('includes Quadrant in the desktop top-bar menu', async () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /menu\.addItem\(\{\s*icon:\s*"iconLayout",\s*label:\s*t\("quadrant"\)\.title,/s,
    );
  });
});
