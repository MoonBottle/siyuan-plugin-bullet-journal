// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileTodoPanel from '@/mobile/panels/MobileTodoPanel.vue';

const {
  mockLoadFromPlugin,
  mockRefresh,
  mockShowMessage,
} = vi.hoisted(() => ({
  mockLoadFromPlugin: vi.fn(),
  mockRefresh: vi.fn(async () => {}),
  mockShowMessage: vi.fn(),
}));

vi.mock('@/mobile/components/todo/MobileFilterBar.vue', () => ({
  default: defineComponent({
    name: 'MobileFilterBarStub',
    setup() {
      return () => h('div', { 'data-testid': 'filter-bar' }, 'filter');
    },
  }),
}));

vi.mock('@/mobile/components/todo/MobileTodoList.vue', () => ({
  default: defineComponent({
    name: 'MobileTodoListStub',
    setup() {
      return () => h('div', { 'data-testid': 'todo-list' }, 'list');
    },
  }),
}));

vi.mock('@/mobile/drawers/filter/FilterDrawer.vue', () => ({
  default: defineComponent({
    name: 'FilterDrawerStub',
    setup() {
      return () => h('div', { 'data-testid': 'filter-drawer' }, 'filter-drawer');
    },
  }),
}));

vi.mock('@/mobile/drawers/action/ActionDrawer.vue', () => ({
  default: defineComponent({
    name: 'ActionDrawerStub',
    emits: ['open-pomodoro'],
    setup(_, { emit }) {
      return () => h(
        'button',
        {
          'data-testid': 'action-drawer-pomodoro',
          onClick: () => emit('open-pomodoro', { blockId: 'action-item' }),
        },
        'action-pomodoro',
      );
    },
  }),
}));

vi.mock('@/mobile/drawers/item/MobileItemDetail.vue', () => ({
  default: defineComponent({
    name: 'MobileItemDetailStub',
    emits: ['open-pomodoro'],
    setup(_, { emit }) {
      return () => h(
        'button',
        {
          'data-testid': 'item-detail-pomodoro',
          onClick: () => emit('open-pomodoro', { blockId: 'detail-item' }),
        },
        'detail-pomodoro',
      );
    },
  }),
}));

vi.mock('@/mobile/drawers/task/TaskItemDetail.vue', () => ({
  default: defineComponent({
    name: 'TaskItemDetailStub',
    emits: ['open-pomodoro'],
    setup(_, { emit }) {
      return () => h(
        'button',
        {
          'data-testid': 'task-item-detail-pomodoro',
          onClick: () => emit('open-pomodoro', { blockId: 'task-detail-item' }),
        },
        'task-detail-pomodoro',
      );
    },
  }),
}));

vi.mock('@/mobile/drawers/project/ProjectDetail.vue', () => ({
  default: defineComponent({
    name: 'ProjectDetailStub',
    setup() {
      return () => h('div', { 'data-testid': 'project-detail' }, 'project-detail');
    },
  }),
}));

vi.mock('@/mobile/drawers/task/TaskDetail.vue', () => ({
  default: defineComponent({
    name: 'TaskDetailStub',
    setup() {
      return () => h('div', { 'data-testid': 'task-detail' }, 'task-detail');
    },
  }),
}));

vi.mock('@/mobile/drawers/quick-create/QuickCreateDrawer.vue', () => ({
  default: defineComponent({
    name: 'QuickCreateDrawerStub',
    setup() {
      return () => h('div', { 'data-testid': 'quick-create-drawer' }, 'quick-create');
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/MobileReminderDrawer.vue', () => ({
  default: defineComponent({
    name: 'MobileReminderDrawerStub',
    setup() {
      return () => h('div', { 'data-testid': 'reminder-drawer' }, 'reminder');
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/MobileRecurringDrawer.vue', () => ({
  default: defineComponent({
    name: 'MobileRecurringDrawerStub',
    setup() {
      return () => h('div', { 'data-testid': 'recurring-drawer' }, 'recurring');
    },
  }),
}));

vi.mock('@/mobile/composables/useItemDetail', () => ({
  useItemDetail: () => ({
    state: {},
    openItem: vi.fn(),
    openProject: vi.fn(),
    openTask: vi.fn(),
  }),
}));

vi.mock('@/stores', () => ({
  useProjectStore: () => ({
    currentDate: '2026-05-01',
    loading: false,
    hideCompleted: false,
    hideAbandoned: false,
    projects: [],
    getDisplayItems: vi.fn(() => []),
    refresh: mockRefresh,
  }),
  useSettingsStore: () => ({
    scanMode: 'full',
    directories: [],
    todoDock: {
      hideCompleted: false,
      hideAbandoned: false,
    },
    loadFromPlugin: mockLoadFromPlugin,
    $patch: vi.fn(),
  }),
}));

vi.mock('@/main', () => ({
  getCurrentPlugin: vi.fn(),
  usePlugin: () => ({ name: 'test-plugin' }),
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: mockShowMessage,
  showPomodoroTimerDialog: vi.fn(),
}));

vi.mock('@/utils/fileUtils', () => ({
  updateBlockContent: vi.fn(async () => true),
}));

vi.mock('@/utils/eventBus', () => ({
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
  Events: {
    DATA_REFRESH: 'DATA_REFRESH',
  },
  eventBus: {
    on: vi.fn(() => () => {}),
  },
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: vi.fn(() => ({
    dispose: vi.fn(),
  })),
}));

vi.mock('@/utils/viewDebug', () => ({
  buildViewDebugContext: vi.fn(() => ({})),
}));

vi.mock('@/utils/todoDateFilter', () => ({
  buildCompletedTodoDateRange: vi.fn(() => null),
  buildTodoDateRange: vi.fn(() => null),
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'common')
      return { dataRefreshed: 'Data refreshed' };
    if (key === 'mobile.filter.applied')
      return 'Filters applied';
    if (key === 'mobile.status.updated')
      return 'Status updated';
    if (key === 'mobile.create.success')
      return 'Create success';
    if (key === 'statusTag')
      return { completed: '✅' };
    if (key === 'todo')
      return { complete: 'Complete' };
    return key;
  }),
}));

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    format: () => '2026-05-01',
    add: () => ({
      format: () => '2026-05-08',
    }),
  }),
}));

function mountPanel() {
  const events: Array<{ name: string, payload: unknown }> = [];
  const container = document.createElement('div');
  document.body.appendChild(container);

  const Root = defineComponent({
    components: { MobileTodoPanel },
    setup() {
      return () =>
        h(MobileTodoPanel, {
          onOpenPomodoro: (payload: unknown) => {
            events.push({ name: 'open-pomodoro', payload });
          },
        });
    },
  });

  const app = createApp(Root);
  app.mount(container);

  return {
    container,
    events,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('MobileTodoPanel', () => {
  it('renders the todo shell without legacy habit or bottom nav placeholders', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="filter-bar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="todo-list"]')).not.toBeNull();
    expect(mounted.container.textContent).not.toContain('MobileBottomNav');
    expect(mounted.container.textContent).not.toContain('MobileHabitDock');
    expect(mounted.container.textContent).not.toContain('MobilePomodoroDrawer');

    mounted.unmount();
  });

  it('emits open-pomodoro with the item block id from the detail drawer path', async () => {
    const mounted = mountPanel();
    await nextTick();

    (mounted.container.querySelector('[data-testid="item-detail-pomodoro"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mounted.events).toEqual([
      {
        name: 'open-pomodoro',
        payload: { blockId: 'detail-item' },
      },
    ]);

    mounted.unmount();
  });
});
