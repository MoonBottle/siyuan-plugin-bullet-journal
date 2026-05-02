// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
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
      'dateRange',
      'completedDateRange',
      'priorities',
      'displayMode',
      'previewTriggerMode',
      'onItemPreviewClick',
    ],
    setup(props) {
      todoContentPaneProps({
        groupId: props.groupId,
        displayMode: props.displayMode,
        previewTriggerMode: props.previewTriggerMode,
        onItemPreviewClick: props.onItemPreviewClick,
      });

      return () => h('div', {
        'data-testid': 'todo-content-pane-stub',
        'data-group-id': props.groupId,
        'data-display-mode': props.displayMode,
      });
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
    expect(mounted.container.querySelector('[data-group-id="group-a"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-display-mode="embedded"]')).not.toBeNull();
    expect(mounted.container.querySelector('.workbench-widget-todo-list__list')).toBeNull();
    const contentProps = todoContentPaneProps.mock.calls.at(-1)?.[0];
    expect(contentProps.previewTriggerMode).toBe('click');
    expect(contentProps.onItemPreviewClick).toBeTypeOf('function');

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
