// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/components/SiyuanTheme/SyLoading.vue', () => ({
  default: {
    name: 'SyLoadingStub',
    template: '<div data-testid="loading-stub"></div>',
  },
}));

vi.mock('@/stores', () => ({
  useProjectStore: () => ({
    loading: false,
    hideCompleted: false,
    hideAbandoned: false,
    getDisplayItems: vi.fn(() => [pendingItem]),
    getFilteredAndSortedItems: vi.fn(() => [pendingItem]),
    getFilteredCompletedItems: vi.fn(() => []),
    getFilteredAbandonedItems: vi.fn(() => []),
  }),
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

vi.mock('@/utils/fileUtils', () => ({
  updateBlockDateTime: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
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

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
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
});
