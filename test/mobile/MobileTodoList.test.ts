// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobileTodoList from '@/mobile/components/todo/MobileTodoList.vue';

const pendingItem = {
  id: 'item-1',
  blockId: 'block-1',
  content: '交行标',
  status: 'pending',
  date: '2026-05-01',
  startDateTime: null,
  endDateTime: null,
  priority: null,
  repeatRule: null,
  reminder: null,
  project: { name: '测试项目' },
};

const expiredItem = {
  ...pendingItem,
  id: 'item-expired',
  blockId: 'block-expired',
  date: '2026-04-30',
  startDateTime: '2026-04-30 09:00',
  endDateTime: '2026-04-30 10:30',
  siblingItems: [{ date: '2026-05-03' }],
};

const {
  mockWriteBlock,
  mockShowMessage,
  mockProjectStore,
} = vi.hoisted(() => ({
  mockWriteBlock: vi.fn(async () => true),
  mockShowMessage: vi.fn(),
  mockProjectStore: {
    loading: false,
    hideCompleted: false,
    hideAbandoned: false,
    getDisplayItems: vi.fn(() => []),
    getFilteredAndSortedItems: vi.fn(() => []),
    getFilteredCompletedItems: vi.fn(() => []),
    getFilteredAbandonedItems: vi.fn(() => []),
  },
}));

vi.mock('@/components/SiyuanTheme/SyLoading.vue', () => ({
  default: {
    name: 'SyLoadingStub',
    template: '<div data-testid="loading-stub"></div>',
  },
}));

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        today: '今天',
        tomorrow: '明天',
        yesterday: '昨天',
        allDay: '全天',
        expired: '已过期',
        priority: {
          high: '高',
          medium: '中',
          low: '低',
        },
      };
    }
    return key;
  }),
}));

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    format: () => '2026-05-01',
    add: () => ({
      format: () => '2026-05-02',
    }),
    diff: () => 0,
  }),
}));

vi.mock('@/utils/dateUtils', () => ({
  formatDateLabel: (date: string) => date,
}));

vi.mock('@/utils/dateRangeUtils', () => ({
  getEffectiveDate: (item: typeof pendingItem) => item.date,
}));

vi.mock('@/utils/exampleDocUtils', () => ({
  createExampleDocument: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: mockShowMessage,
}));

function mountList() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const events: Array<{ name: string, payload: unknown }> = [];

  const app = createApp(MobileTodoList, {
    onItemClick: (payload: unknown) => events.push({ name: 'itemClick', payload }),
    onItemComplete: (payload: unknown) => events.push({ name: 'itemComplete', payload }),
  });
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

beforeEach(() => {
  mockProjectStore.getDisplayItems.mockReturnValue([pendingItem]);
  mockProjectStore.getFilteredAndSortedItems.mockReturnValue([pendingItem]);
  mockProjectStore.getFilteredCompletedItems.mockReturnValue([]);
  mockProjectStore.getFilteredAbandonedItems.mockReturnValue([]);
  mockWriteBlock.mockResolvedValue(true);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  mockProjectStore.getDisplayItems.mockReturnValue([pendingItem]);
  mockProjectStore.getFilteredAndSortedItems.mockReturnValue([pendingItem]);
  mockProjectStore.getFilteredCompletedItems.mockReturnValue([]);
  mockProjectStore.getFilteredAbandonedItems.mockReturnValue([]);
  mockWriteBlock.mockResolvedValue(true);
});

describe('MobileTodoList', () => {
  it('emits itemComplete when the left checkbox is clicked', async () => {
    const mounted = mountList();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-item-complete-button"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mounted.events).toEqual([
      { name: 'itemComplete', payload: pendingItem },
    ]);

    mounted.unmount();
  });

  it('still emits itemClick when the content area is clicked', async () => {
    const mounted = mountList();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-item-content"]') as HTMLDivElement | null)?.click();
    await nextTick();

    expect(mounted.events).toEqual([
      { name: 'itemClick', payload: pendingItem },
    ]);

    mounted.unmount();
  });

  it('marks the list root as a Siyuan dialog guard without losing list layout', async () => {
    const mounted = mountList();
    await nextTick();

    const listRoot = mounted.container.querySelector('.mobile-todo-list') as HTMLElement | null;

    expect(listRoot?.classList.contains('b3-dialog')).toBe(true);
    expect(listRoot?.classList.contains('mobile-todo-list--gesture-guard')).toBe(true);

    mounted.unmount();
  });

  it('uses BlockWriter addDate when postponing expired items', async () => {
    mockProjectStore.getDisplayItems.mockReturnValue([expiredItem]);
    mockProjectStore.getFilteredAndSortedItems.mockReturnValue([expiredItem]);

    const mounted = mountList();
    await nextTick();

    (mounted.container.querySelector('.action-link') as HTMLButtonElement | null)?.click();
    await Promise.resolve();

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-expired' },
      {
        type: 'addDate',
        date: '2026-05-02',
        startTime: '09:00',
        endTime: '10:30',
        allDay: false,
        originalDate: '2026-04-30',
        siblingItems: [
          { date: '2026-05-03' },
          {
            date: '2026-04-30',
            startDateTime: '2026-04-30 09:00',
            endDateTime: '2026-04-30 10:30',
            timePrecision: undefined,
          },
        ],
        timePrecision: undefined,
      },
    );

    mounted.unmount();
  });
});
