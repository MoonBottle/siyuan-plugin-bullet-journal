// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import type { WorkbenchEntry } from '@/types/workbench';

const {
  mockShowInputDialog,
  mockShowConfirmDialog,
  mockOpenTodoWidgetConfigDialog,
  mockOpenQuadrantWidgetConfigDialog,
  mockOpenCalendarWidgetConfigDialog,
  mockOpenHabitWidgetConfigDialog,
  mockOpenPomodoroWidgetConfigDialog,
} = vi.hoisted(() => ({
  mockShowInputDialog: vi.fn(),
  mockShowConfirmDialog: vi.fn(),
  mockOpenTodoWidgetConfigDialog: vi.fn(),
  mockOpenQuadrantWidgetConfigDialog: vi.fn(),
  mockOpenCalendarWidgetConfigDialog: vi.fn(),
  mockOpenHabitWidgetConfigDialog: vi.fn(),
  mockOpenPomodoroWidgetConfigDialog: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  showInputDialog: mockShowInputDialog,
  showConfirmDialog: mockShowConfirmDialog,
}));

vi.mock('@/workbench/todoWidgetConfigDialog', () => ({
  openTodoWidgetConfigDialog: mockOpenTodoWidgetConfigDialog,
}));

vi.mock('@/workbench/quadrantWidgetConfigDialog', () => ({
  openQuadrantWidgetConfigDialog: mockOpenQuadrantWidgetConfigDialog,
}));

vi.mock('@/workbench/calendarWidgetConfigDialog', () => ({
  openCalendarWidgetConfigDialog: mockOpenCalendarWidgetConfigDialog,
}));

vi.mock('@/workbench/habitWidgetConfigDialog', () => ({
  openHabitWidgetConfigDialog: mockOpenHabitWidgetConfigDialog,
}));

vi.mock('@/workbench/pomodoroWidgetConfigDialog', () => ({
  openPomodoroWidgetConfigDialog: mockOpenPomodoroWidgetConfigDialog,
}));

vi.mock('@/components/workbench/widgets/TodoListWidget.vue', () => ({
  default: defineComponent({
    name: 'TodoListWidgetStub',
    props: {
      widget: {
        type: Object,
        required: false,
      },
    },
    setup() {
      return () => h('div', 'todo widget');
    },
  }),
}));

vi.mock('@/components/workbench/widgets/QuadrantSummaryWidget.vue', () => ({
  default: defineComponent({
    name: 'QuadrantSummaryWidgetStub',
    props: {
      widget: {
        type: Object,
        required: false,
      },
    },
    setup() {
      return () => h('div', 'quadrant widget');
    },
  }),
}));

vi.mock('@/components/workbench/widgets/HabitWeekWidget.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekWidgetStub',
    props: {
      widget: {
        type: Object,
        required: false,
      },
    },
    setup() {
      return () => h('div', 'habit widget');
    },
  }),
}));

vi.mock('@/components/workbench/widgets/MiniCalendarWidget.vue', () => ({
  default: defineComponent({
    name: 'MiniCalendarWidgetStub',
    props: {
      widget: {
        type: Object,
        required: false,
      },
    },
    setup() {
      return () => h('div', 'calendar widget');
    },
  }),
}));

vi.mock('@/components/workbench/widgets/PomodoroStatsWidget.vue', () => ({
  default: defineComponent({
    name: 'PomodoroStatsWidgetStub',
    props: {
      widget: {
        type: Object,
        required: false,
      },
    },
    setup() {
      return () => h('div', 'pomodoro widget');
    },
  }),
}));

vi.mock('grid-layout-plus', () => ({
  GridLayout: defineComponent({
    name: 'GridLayoutStub',
    props: ['layout'],
    emits: ['layout-updated', 'update:layout'],
    setup(props, { emit, slots }) {
      return () => h('div', { 'data-testid': 'grid-layout-stub' }, [
        h('button', {
          type: 'button',
          'data-testid': 'grid-layout-emit-update-layout-changed',
          onClick: () => emit('update:layout', (props.layout as any[]).map((item, index) => ({
            ...item,
            x: index === 0 ? Number(item.x) + 2 : Number(item.x),
            w: index === 0 ? Number(item.w) + 1 : Number(item.w),
          }))),
        }),
        h('button', {
          type: 'button',
          'data-testid': 'grid-layout-emit-updated',
          onClick: () => emit('layout-updated', props.layout),
        }),
        h('button', {
          type: 'button',
          'data-testid': 'grid-layout-emit-updated-changed',
          onClick: () => emit('layout-updated', (props.layout as any[]).map((item, index) => ({
            ...item,
            x: index === 0 ? Number(item.x) + 1 : Number(item.x),
          }))),
        }),
        slots.default?.(),
      ]);
    },
  }),
  GridItem: defineComponent({
    name: 'GridItemStub',
    props: ['x', 'y', 'w', 'h', 'i', 'minW', 'minH', 'maxW'],
    setup(props, { slots }) {
      return () => h('div', {
        'data-testid': `grid-item-stub-${props.i}`,
        'data-x': String(props.x),
        'data-y': String(props.y),
        'data-w': String(props.w),
        'data-h': String(props.h),
        'data-min-w': String(props.minW),
        'data-min-h': String(props.minH),
        'data-max-w': String(props.maxW),
      }, slots.default?.());
    },
  }),
}));

async function mountCanvas(entry: WorkbenchEntry) {
  const { default: DashboardCanvas } = await import('@/components/workbench/dashboard/DashboardCanvas.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(DashboardCanvas, { entry });
  app.use(getActivePinia()!);
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
    setActivePinia(createPinia());
    initI18n('en_US');
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders empty dashboard guidance with add-widget action', async () => {
    const store = useWorkbenchStore();
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-empty"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-placeholder"]')?.textContent)
      .toContain('This dashboard has no widgets yet');
    expect(mounted.container.querySelector('[data-testid="workbench-dashboard-add-widget-empty"]')).not.toBeNull();

    mounted.unmount();
  });

  it('opens rename and delete widget actions from widget card menu', async () => {
    const store = useWorkbenchStore();
    store.renameWidget = vi.fn().mockResolvedValue(undefined) as any;
    store.removeWidget = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-rename"]') as HTMLButtonElement).click();

    expect(mockShowInputDialog).toHaveBeenCalledWith(
      'Rename',
      'Enter a widget name',
      'Todo List',
      expect.any(Function),
    );

    const renameCallback = mockShowInputDialog.mock.calls[0][3];
    await renameCallback('Today Todos');
    expect(store.renameWidget).toHaveBeenCalledWith('dashboard-1', 'widget-1', 'Today Todos');

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-delete"]') as HTMLButtonElement).click();

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      'Delete',
      'Delete widget "Todo List"?',
      expect.any(Function),
    );

    const deleteCallback = mockShowConfirmDialog.mock.calls[0][2];
    await deleteCallback();
    expect(store.removeWidget).toHaveBeenCalledWith('dashboard-1', 'widget-1');

    mounted.unmount();
  });

  it('opens todo widget configure dialog and persists preset filters', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              preset: {
                groupId: 'group-a',
              },
            },
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

    expect(mockShowInputDialog).not.toHaveBeenCalled();
    expect(mockOpenTodoWidgetConfigDialog).toHaveBeenCalledWith({
      initialConfig: {
        preset: {
          groupId: 'group-a',
        },
      },
      onConfirm: expect.any(Function),
    });

    const configureOptions = mockOpenTodoWidgetConfigDialog.mock.calls[0][0];
    await configureOptions.onConfirm({
      preset: {
        groupId: 'group-b',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    });
    expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      preset: {
        groupId: 'group-b',
        dateFilterType: 'today',
        priorities: ['high'],
      },
    });

    mounted.unmount();
  });

  it('opens calendar widget configure dialog and persists group/day config', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'miniCalendar',
            title: 'Calendar',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              groupId: 'group-a',
              view: 'timeGridDay',
            },
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

    expect(mockOpenCalendarWidgetConfigDialog).toHaveBeenCalledWith({
      initialConfig: {
        groupId: 'group-a',
        view: 'timeGridDay',
      },
      onConfirm: expect.any(Function),
    });

    const configureOptions = mockOpenCalendarWidgetConfigDialog.mock.calls[0][0];
    await configureOptions.onConfirm({
      groupId: 'group-b',
      view: 'timeGridDay',
    });
    expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      groupId: 'group-b',
      view: 'timeGridDay',
    });

    mounted.unmount();
  });

  it('opens quadrant widget configure dialog and persists quadrant/group config', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'quadrantSummary',
            title: 'Quadrant',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              groupId: 'group-a',
              quadrant: 'medium',
            },
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

    expect(mockOpenQuadrantWidgetConfigDialog).toHaveBeenCalledWith({
      initialConfig: {
        groupId: 'group-a',
        quadrant: 'medium',
      },
      onConfirm: expect.any(Function),
    });

    const configureOptions = mockOpenQuadrantWidgetConfigDialog.mock.calls[0][0];
    await configureOptions.onConfirm({
      groupId: 'group-b',
      quadrant: 'low',
    });
    expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      groupId: 'group-b',
      quadrant: 'low',
    });

    mounted.unmount();
  });

  it('opens habit widget configure dialog and persists group config', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'habitWeek',
            title: 'Habit Week',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              groupId: 'group-a',
            },
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

    expect(mockOpenHabitWidgetConfigDialog).toHaveBeenCalledWith({
      initialConfig: {
        groupId: 'group-a',
      },
      onConfirm: expect.any(Function),
    });

    const configureOptions = mockOpenHabitWidgetConfigDialog.mock.calls[0][0];
    await configureOptions.onConfirm({
      groupId: 'group-b',
    });
    expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      groupId: 'group-b',
    });

    mounted.unmount();
  });

  it('opens pomodoro stats widget configure dialog and persists section config', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetConfig = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'pomodoroStats',
            title: 'Focus Stats',
            layout: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              section: 'focusTrend',
            },
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="workbench-widget-menu-trigger"]') as HTMLButtonElement).click();
    await nextTick();
    (mounted.container.querySelector('[data-testid="workbench-widget-configure"]') as HTMLButtonElement).click();

    expect(mockOpenPomodoroWidgetConfigDialog).toHaveBeenCalledWith({
      initialConfig: {
        section: 'focusTrend',
      },
      onConfirm: expect.any(Function),
    });

    const configureOptions = mockOpenPomodoroWidgetConfigDialog.mock.calls[0][0];
    await configureOptions.onConfirm({
      section: 'annualHeatmap',
    });

    expect(store.updateWidgetConfig).toHaveBeenCalledWith('dashboard-1', 'widget-1', {
      section: 'annualHeatmap',
    });

    mounted.unmount();
  });

  it('applies widget layout coordinates to rendered grid placement', async () => {
    const store = useWorkbenchStore();
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 2, y: 1, w: 4, h: 3 },
            config: {},
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    expect(mounted.container.innerHTML).toContain('data-x="2"');
    expect(mounted.container.innerHTML).toContain('data-y="1"');
    expect(mounted.container.innerHTML).toContain('data-w="4"');
    expect(mounted.container.innerHTML).toContain('data-h="3"');
    expect(mounted.container.innerHTML).toContain('data-min-w="4"');
    expect(mounted.container.innerHTML).toContain('data-min-h="3"');
    expect(mounted.container.innerHTML).toContain('data-max-w="12"');

    mounted.unmount();
  });

  it('does not persist unchanged widget layouts after grid layout update event', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetLayouts = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 2, y: 1, w: 4, h: 3 },
            config: {},
          },
          {
            id: 'widget-2',
            type: 'habitWeek',
            title: 'Habit Week',
            layout: { x: 6, y: 1, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="grid-layout-emit-updated"]') as HTMLButtonElement).click();
    await nextTick();

    expect(store.updateWidgetLayouts).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('persists changed widget layouts after grid layout update event', async () => {
    const store = useWorkbenchStore();
    store.updateWidgetLayouts = vi.fn().mockResolvedValue(undefined) as any;
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 2, y: 1, w: 4, h: 3 },
            config: {},
          },
          {
            id: 'widget-2',
            type: 'habitWeek',
            title: 'Habit Week',
            layout: { x: 6, y: 1, w: 6, h: 4 },
            config: {},
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    (mounted.container.querySelector('[data-testid="grid-layout-emit-updated-changed"]') as HTMLButtonElement).click();
    await nextTick();

    expect(store.updateWidgetLayouts).toHaveBeenCalledWith('dashboard-1', [
      { id: 'widget-1', x: 3, y: 1, w: 4, h: 3 },
      { id: 'widget-2', x: 6, y: 1, w: 6, h: 4 },
    ]);

    mounted.unmount();
  });

  it('keeps the rendered grid layout in sync with GridLayout update:layout events', async () => {
    const store = useWorkbenchStore();
    store.dashboards = [
      {
        id: 'dashboard-1',
        title: 'Planning Board',
        widgets: [
          {
            id: 'widget-1',
            type: 'todoList',
            title: 'Todo List',
            layout: { x: 2, y: 1, w: 4, h: 3 },
            config: {},
          },
        ],
      },
    ];

    const mounted = await mountCanvas({
      id: 'entry-dashboard',
      type: 'dashboard',
      title: 'Planning Board',
      icon: 'iconBoard',
      order: 0,
      dashboardId: 'dashboard-1',
    });

    expect(mounted.container.innerHTML).toContain('data-x="2"');
    expect(mounted.container.innerHTML).toContain('data-w="4"');

    (mounted.container.querySelector('[data-testid="grid-layout-emit-update-layout-changed"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.innerHTML).toContain('data-x="4"');
    expect(mounted.container.innerHTML).toContain('data-w="5"');

    mounted.unmount();
  });
});
