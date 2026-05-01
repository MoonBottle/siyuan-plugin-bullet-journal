// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import type { Item } from '@/types/models';

const pendingItem: Item = {
  id: 'item-1',
  content: '处理优先级',
  date: '2026-05-01',
  lineNumber: 1,
  docId: 'doc-1',
  blockId: 'block-1',
  status: 'pending',
  priority: 'high',
  project: { id: 'project-1', name: '项目A', tasks: [], links: [] },
};

const mockProjectStore = {
  currentDate: '2026-05-01',
  loading: false,
  hideCompleted: false,
  hideAbandoned: false,
  getDisplayItems: vi.fn(() => [pendingItem]),
  getFilteredAndSortedItems: vi.fn(() => [pendingItem]),
  getFilteredCompletedItems: vi.fn(() => []),
  getFilteredAbandonedItems: vi.fn(() => []),
};

const mockPomodoroStore = {
  isFocusing: false,
  activePomodoro: null,
  restorePomodoro: vi.fn(() => Promise.resolve(false)),
};

vi.mock('@/stores', () => ({
  useSettingsStore: () => ({}),
  useProjectStore: () => mockProjectStore,
  usePomodoroStore: () => mockPomodoroStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => null,
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        loading: '加载中',
        expired: '已过期',
        today: '今天',
        tomorrow: '明天',
        future: '未来',
        completed: '已完成',
        abandoned: '已放弃',
        allDay: '全天',
        detail: '详情',
        calendar: '日历',
        complete: '完成',
        abandon: '放弃',
        startFocusAria: '开始专注',
        migrateToToday: '迁移到今天',
        migrateToTomorrow: '迁移到明天',
        emptyGuideTitle: '空',
        emptyGuideDesc: '空',
        createExampleDoc: '创建',
      };
    }
    if (key === 'common') {
      return {
        loading: '加载中',
      };
    }
    if (key === 'statusTag') {
      return {
        completed: '#done',
        abandoned: '#abandoned',
      };
    }
    if (key === 'pomodoro') {
      return {
        startFocusTitle: '开始专注',
      };
    }
    return {};
  }),
}));

vi.mock('@/components/SiyuanTheme/SyLoading.vue', () => ({
  default: {
    name: 'SyLoadingStub',
    template: '<div data-testid="todo-loading-stub"></div>',
  },
}));

vi.mock('@/components/todo/TodoItemMeta.vue', () => ({
  default: {
    name: 'TodoItemMetaStub',
    props: ['item'],
    template: '<div data-testid="todo-item-meta-stub"></div>',
  },
}));

vi.mock('@/components/pomodoro/PomodoroTimerDialog.vue', () => ({
  default: {
    name: 'PomodoroTimerDialogStub',
    template: '<div></div>',
  },
}));

vi.mock('@/utils/dateUtils', () => ({
  formatDateLabel: (date: string) => date,
  formatTimeRange: () => '',
}));

vi.mock('@/utils/dateRangeUtils', () => ({
  getDateRangeStatus: vi.fn(() => ''),
  getTimeRangeStatus: vi.fn(() => ''),
  dateRangeStatusToEmoji: vi.fn(() => ''),
  getEffectiveDate: (item: Item) => item.date,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
  updateBlockContent: vi.fn(),
  updateBlockDateTime: vi.fn(),
  updateBlockPriority: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  showItemDetailModal: vi.fn(),
  showDatePickerDialog: vi.fn(),
  createDialog: vi.fn(),
}));

vi.mock('@/utils/contextMenu', () => ({
  showContextMenu: vi.fn(),
  createItemMenu: vi.fn(() => ({})),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    on: vi.fn(() => () => {}),
  },
  Events: {
    POMODORO_RESTORE: 'pomodoro:restore',
  },
}));

vi.mock('@/utils/exampleDocUtils', () => ({
  createExampleDocument: vi.fn(),
}));

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    format: () => '2026-05-01',
    add: () => ({
      format: () => '2026-05-02',
    }),
  }),
}));

function mountSidebar(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp({
    render() {
      return h(TodoSidebar, props);
    },
  });

  app.mount(container);

  return {
    container,
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

describe('TodoSidebar', () => {
  it('emits drag-start payload for embedded cards when drag support is enabled', async () => {
    const onItemDragStart = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();
    expect(card?.getAttribute('draggable')).toBe('true');

    const setData = vi.fn();
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        setData,
        effectAllowed: 'none',
      },
      configurable: true,
    });
    card?.dispatchEvent(dragStartEvent);

    expect(onItemDragStart).toHaveBeenCalledTimes(1);
    expect(onItemDragStart).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    }, dragStartEvent);
    expect(setData).toHaveBeenCalledWith('application/json', JSON.stringify({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    }));
    expect(setData).toHaveBeenCalledWith('text/plain', 'block-1');
    expect((dragStartEvent.dataTransfer as DataTransfer).effectAllowed).toBe('move');

    mounted.unmount();
  });
});
