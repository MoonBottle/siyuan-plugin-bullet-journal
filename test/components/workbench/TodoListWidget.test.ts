// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { Pinia } from 'pinia';
import { createPinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import { useProjectStore } from '@/stores';

const todoContentPaneProps = vi.fn();
const nativePreviewOpen = vi.fn();
const nativePreviewClose = vi.fn();
const nativePreviewContainsTarget = vi.fn(() => false);
const mockPlugin = { name: 'plugin' };
const mockApp = { name: 'app' };

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => mockPlugin),
  useApp: vi.fn(() => mockApp),
}));

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: nativePreviewOpen,
    close: nativePreviewClose,
    containsTarget: nativePreviewContainsTarget,
    isOpen: vi.fn(() => false),
  }),
}));

vi.mock('@/components/todo/TodoContentPane.vue', () => ({
  default: defineComponent({
    name: 'TodoContentPaneStub',
    props: [
      'groupId',
      'searchQuery',
      'selectedTags',
      'sortRules',
      'dateRange',
      'completedDateRange',
      'priorities',
      'displayMode',
      'previewTriggerMode',
      'onItemPreviewClick',
    ],
    setup(props) {
      return () => h('div', {
        'data-testid': 'todo-content-pane-stub',
        'data-group-id': props.groupId,
        'data-display-mode': props.displayMode,
        'data-search-query': props.searchQuery,
      }, (() => {
        todoContentPaneProps({
          groupId: props.groupId,
          searchQuery: props.searchQuery,
          selectedTags: props.selectedTags,
          sortRules: props.sortRules,
          displayMode: props.displayMode,
          previewTriggerMode: props.previewTriggerMode,
          onItemPreviewClick: props.onItemPreviewClick,
        });
        return [];
      })());
    },
  }),
}));

async function mountWidget(widgetConfig: Record<string, unknown>, pinia: Pinia, onOpenTodoView?: ReturnType<typeof vi.fn>) {
  const { default: TodoListWidget } = await import('@/components/workbench/widgets/TodoListWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(TodoListWidget, {
    widget: {
      id: 'widget-1',
      type: 'todoList',
      title: 'Todo List',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      config: widgetConfig,
    },
    onOpenTodoView,
  });

  app.use(pinia);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

async function mountReactiveWidget(initialWidgetConfig: Record<string, unknown>, pinia: Pinia) {
  const { default: TodoListWidget } = await import('@/components/workbench/widgets/TodoListWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const widgetConfig = ref<Record<string, unknown>>(initialWidgetConfig);

  const app = createApp(defineComponent({
    setup() {
      return () => h(TodoListWidget, {
        widget: {
          id: 'widget-1',
          type: 'todoList',
          title: 'Todo List',
          layout: { x: 0, y: 0, w: 6, h: 4 },
          config: widgetConfig.value,
        },
      });
    },
  }));

  app.use(pinia);
  app.mount(container);
  await nextTick();

  return {
    container,
    widgetConfig,
    async updateWidgetConfig(nextConfig: Record<string, unknown>) {
      widgetConfig.value = nextConfig;
      await nextTick();
    },
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('TodoListWidget', () => {
  beforeEach(() => {
    initI18n('en_US');
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders shared todo content pane instead of the legacy bullet preview list', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => ([
      { id: 'item-1', status: 'pending' },
      { id: 'item-2', status: 'completed' },
      { id: 'item-3', status: 'pending' },
    ])) as any;

    const mounted = await mountWidget({
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    }, pinia);

    expect(mounted.container.querySelector('[data-testid="todo-content-pane-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-todo-widget-content"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-todo-widget-search"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-group-id="group-a"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-display-mode="embedded"]')).not.toBeNull();
    expect(mounted.container.querySelector('.workbench-widget-todo-list__list')).toBeNull();
    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.searchQuery).toBe('');
    expect(contentProps.selectedTags).toEqual([]);
    expect(contentProps.sortRules).toEqual(undefined);
    expect(contentProps.previewTriggerMode).toBe('click');
    expect(contentProps.onItemPreviewClick).toBeTypeOf('function');

    mounted.unmount();
  });

  it('applies widget-local search input instead of persisting search through preset config', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;

    const mounted = await mountWidget({
      preset: {
        groupId: 'group-a',
        searchQuery: 'legacy preset search',
      },
    }, pinia);

    const searchInput = mounted.container.querySelector('[data-testid="workbench-todo-widget-search"]') as HTMLInputElement;
    expect(searchInput.value).toBe('');

    searchInput.value = 'runtime search';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.searchQuery).toBe('runtime search');

    mounted.unmount();
  });

  it('passes widget preset sort rules into the shared todo content pane', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;

    await mountWidget({
      preset: {
        groupId: 'group-a',
        sortRules: [
          { field: 'time', direction: 'asc' },
          { field: 'priority', direction: 'desc' },
        ],
      },
    }, pinia);

    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.sortRules).toEqual([
      { field: 'time', direction: 'asc' },
      { field: 'priority', direction: 'desc' },
    ]);
  });

  it('applies preset selected tags and exposes a runtime tag filter input', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;
    projectStore.getTodoTagOptions = vi.fn(() => [
      { name: 'Alpha', count: 2 },
      { name: 'Beta', count: 1 },
    ]) as any;

    const mounted = await mountWidget({
      preset: {
        groupId: 'group-a',
        selectedTags: ['Alpha'],
      },
    }, pinia);

    expect(mounted.container.querySelector('[data-testid="workbench-todo-widget-tag-filter"]')).not.toBeNull();

    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.selectedTags).toEqual(['Alpha']);

    mounted.unmount();
  });

  it('refreshes selected tags when the widget preset config changes', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;
    projectStore.getTodoTagOptions = vi.fn(() => [
      { name: 'Alpha', count: 2 },
      { name: 'Beta', count: 1 },
    ]) as any;

    const mounted = await mountReactiveWidget({
      preset: {
        groupId: 'group-a',
        selectedTags: ['Alpha'],
      },
    }, pinia);

    expect(todoContentPaneProps.mock.calls.at(-1)?.[0]?.selectedTags).toEqual(['Alpha']);

    await mounted.updateWidgetConfig({
      preset: {
        groupId: 'group-a',
        selectedTags: ['Beta'],
      },
    });

    expect(todoContentPaneProps.mock.calls.at(-1)?.[0]?.selectedTags).toEqual(['Beta']);

    mounted.unmount();
  });

  it('does not emit navigation events when clicking the widget surface', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;
    const onOpenTodoView = vi.fn();

    const mounted = await mountWidget({
      preset: {},
    }, pinia, onOpenTodoView);

    (mounted.container.querySelector('[data-testid="workbench-widget-todo-list"]') as HTMLDivElement).click();

    expect(onOpenTodoView).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('opens native preview when the embedded todo list reports a card click', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';
    projectStore.getFilteredAndSortedItems = vi.fn(() => []) as any;

    await mountWidget({
      preset: {},
    }, pinia);

    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.onItemPreviewClick).toBeTypeOf('function');

    const anchorEl = document.createElement('div');
    document.body.appendChild(anchorEl);

    contentProps.onItemPreviewClick({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    await nextTick();

    expect(nativePreviewOpen).toHaveBeenCalledWith(expect.objectContaining({
      app: mockApp,
      plugin: mockPlugin,
      blockId: 'block-1',
      anchorEl,
      onHoverChange: expect.any(Function),
      onPanelDestroyed: expect.any(Function),
    }));
  });
});
