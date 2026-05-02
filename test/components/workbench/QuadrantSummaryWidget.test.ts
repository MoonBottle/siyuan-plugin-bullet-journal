// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { Item } from '@/types/models';

const todoSidebarProps = vi.fn();
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

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: ['modelValue', 'options', 'placeholder', 'disabled'],
    emits: ['update:modelValue'],
    inheritAttrs: false,
    setup(props, { emit, attrs }) {
      return () => h('select', {
        ...attrs,
        value: props.modelValue,
        disabled: props.disabled,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
      }, [
        props.placeholder
          ? h('option', { value: '' }, props.placeholder)
          : null,
        ...(props.options ?? []).map((option: { value: string, label: string }) =>
          h('option', { value: option.value }, option.label),
        ),
      ]);
    },
  }),
}));

vi.mock('@/components/todo/TodoSidebar.vue', () => ({
  default: defineComponent({
    name: 'TodoSidebarStub',
    props: [
      'groupId',
      'priorities',
      'includeNoPriority',
      'previewTriggerMode',
      'onItemPreviewClick',
    ],
    setup(props) {
      todoSidebarProps({
        groupId: props.groupId,
        priorities: props.priorities,
        includeNoPriority: props.includeNoPriority,
        previewTriggerMode: props.previewTriggerMode,
        onItemPreviewClick: props.onItemPreviewClick,
      });

      return () => h('div', {
        'data-testid': 'quadrant-widget-todo-sidebar',
        'data-group-id': props.groupId,
        'data-priorities': JSON.stringify(props.priorities ?? []),
        'data-include-no-priority': String(Boolean(props.includeNoPriority)),
      });
    },
  }),
}));

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    content: 'Task',
    date: '2026-05-02',
    lineNumber: 1,
    docId: 'doc-1',
    status: 'pending',
    ...overrides,
  };
}

async function mountDialog(options?: {
  initialConfig?: Record<string, unknown>;
  onConfirm?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
}) {
  const { default: QuadrantWidgetConfigDialog } = await import('@/components/workbench/dialogs/QuadrantWidgetConfigDialog.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const onConfirm = options?.onConfirm ?? vi.fn();
  const onCancel = options?.onCancel ?? vi.fn();

  const app = createApp(QuadrantWidgetConfigDialog, {
    initialConfig: options?.initialConfig ?? {},
    onConfirm,
    onCancel,
  });

  app.use(getActivePinia()!);
  app.mount(container);
  await nextTick();

  return {
    container,
    onConfirm,
    onCancel,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

async function mountWidget(widgetConfig: Record<string, unknown>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const projectStore = useProjectStore();
  projectStore.projects = [
    {
      id: 'project-a',
      name: 'Project A',
      tasks: [
        {
          id: 'task-a',
          name: 'Task A',
          level: 'L1',
          lineNumber: 1,
          items: [
            createItem({ id: 'item-high-a', priority: 'high' }),
            createItem({ id: 'item-high-b', priority: 'high', status: 'completed' }),
          ],
        },
      ],
      habits: [],
      links: [],
      groupId: 'group-a',
    } as any,
    {
      id: 'project-b',
      name: 'Project B',
      tasks: [
        {
          id: 'task-b',
          name: 'Task B',
          level: 'L1',
          lineNumber: 1,
          items: [
            createItem({ id: 'item-low-a', priority: 'low' }),
            createItem({ id: 'item-none-a' }),
          ],
        },
      ],
      habits: [],
      links: [],
      groupId: 'group-b',
    } as any,
  ];

  const { default: QuadrantSummaryWidget } = await import('@/components/workbench/widgets/QuadrantSummaryWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(QuadrantSummaryWidget, {
    widget: {
      id: 'widget-1',
      type: 'quadrantSummary',
      title: 'Quadrant Widget',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      config: widgetConfig,
    },
  });

  app.use(pinia);
  app.mount(container);
  await nextTick();

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('QuadrantWidgetConfigDialog', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('confirms selected quadrant and group', async () => {
    const settingsStore = useSettingsStore();
    settingsStore.loaded = true;
    settingsStore.groups = [
      { id: 'group-a', name: 'Alpha' } as any,
      { id: 'group-b', name: 'Beta' } as any,
    ];

    const mounted = await mountDialog({
      initialConfig: {
        groupId: 'group-a',
        quadrant: 'high',
      },
    });

    const quadrantSelect = mounted.container.querySelector('[data-testid="quadrant-widget-select"]') as HTMLSelectElement;
    quadrantSelect.value = 'none';
    quadrantSelect.dispatchEvent(new Event('change'));
    await nextTick();

    const groupSelect = mounted.container.querySelector('[data-testid="quadrant-widget-group-select"]') as HTMLSelectElement;
    groupSelect.value = 'group-b';
    groupSelect.dispatchEvent(new Event('change'));
    await nextTick();

    (mounted.container.querySelector('[data-testid="quadrant-widget-config-confirm"]') as HTMLButtonElement).click();

    expect(mounted.onConfirm).toHaveBeenCalledWith({
      groupId: 'group-b',
      quadrant: 'none',
    });

    mounted.unmount();
  });
});

describe('QuadrantSummaryWidget', () => {
  beforeEach(() => {
    initI18n('en_US');
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders a single configured quadrant with embedded todo filtering', async () => {
    const mounted = await mountWidget({
      groupId: 'group-b',
      quadrant: 'none',
    });

    expect(mounted.container.textContent).toContain('1');
    expect(mounted.container.textContent).toContain('Neither Urgent nor Important');

    const sidebar = mounted.container.querySelector('[data-testid="quadrant-widget-todo-sidebar"]');
    expect(sidebar?.getAttribute('data-group-id')).toBe('group-b');
    expect(sidebar?.getAttribute('data-priorities')).toBe('[]');
    expect(sidebar?.getAttribute('data-include-no-priority')).toBe('true');

    mounted.unmount();
  });

  it('wires click-trigger preview callbacks and opens native preview from card clicks', async () => {
    const mounted = await mountWidget({
      groupId: 'group-b',
      quadrant: 'none',
    });

    const sidebarPropsCall = todoSidebarProps.mock.calls.at(-1)?.[0];
    expect(sidebarPropsCall.previewTriggerMode).toBe('click');
    expect(sidebarPropsCall.onItemPreviewClick).toBeTypeOf('function');

    const anchorEl = document.createElement('div');
    document.body.appendChild(anchorEl);

    sidebarPropsCall.onItemPreviewClick({
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

    mounted.unmount();
  });
});
