// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockShowItemDetailModal = vi.fn();
const mockRequestDataRefresh = vi.fn(() => Promise.resolve());

const mockEntries = [
  {
    itemId: 'item-1',
    blockId: 'block-1',
    date: '2026-05-14',
    estimatedMinutes: 70,
    actualMinutes: 10,
    itemStatus: 'pending',
    itemContent: '整理日报',
    reviewStatus: 'in-progress',
    deltaMinutes: -60,
  },
  {
    itemId: 'item-2',
    blockId: 'block-2',
    date: '2026-05-14',
    estimatedMinutes: 25,
    actualMinutes: 30,
    itemStatus: 'completed',
    itemContent: '整理会议结论',
    reviewStatus: 'matched',
    deltaMinutes: 5,
  },
];

const entriesByDate: Record<string, typeof mockEntries> = {
  '2026-05-14': mockEntries,
  '2026-05-15': [
    {
      itemId: 'item-3',
      blockId: 'block-3',
      date: '2026-05-15',
      estimatedMinutes: 25,
      actualMinutes: 0,
      itemStatus: 'pending',
      itemContent: '补材料',
      reviewStatus: 'not-started',
      deltaMinutes: -25,
    },
  ],
};

const summaryByDate = (date: string) => {
  const entries = entriesByDate[date] ?? [];
  return {
    total: entries.length,
    estimatedMinutes: entries.reduce((sum, entry) => sum + entry.estimatedMinutes, 0),
    actualMinutes: entries.reduce((sum, entry) => sum + entry.actualMinutes, 0),
    matched: entries.filter(entry => entry.reviewStatus === 'matched').length,
    overrun: entries.filter(entry => entry.reviewStatus === 'overrun').length,
    underrun: entries.filter(entry => entry.reviewStatus === 'underrun').length,
    notStarted: entries.filter(entry => entry.reviewStatus === 'not-started').length,
    inProgress: entries.filter(entry => entry.reviewStatus === 'in-progress').length,
  };
};

const mockProjectStore = {
  getFocusPlanEntriesByDate: vi.fn((date: string) => entriesByDate[date] ?? []),
  getFocusPlanSummaryByDate: vi.fn((date: string) => summaryByDate(date)),
  items: [
    { id: 'item-1', blockId: 'block-1', content: '整理日报', lineNumber: 1, docId: 'doc-1', date: '2026-05-14', status: 'pending' },
    { id: 'item-2', blockId: 'block-2', content: '整理会议结论', lineNumber: 2, docId: 'doc-1', date: '2026-05-14', status: 'completed' },
    { id: 'item-3', blockId: 'block-3', content: '补材料', lineNumber: 3, docId: 'doc-2', date: '2026-05-15', status: 'pending' },
  ],
  getItemByBlockId: vi.fn((blockId: string) => mockProjectStore.items.find(item => item.blockId === blockId)),
};

const mockSettingsStore = {
  loadFromPlugin: vi.fn(),
};

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
  useSettingsStore: () => mockSettingsStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({
    requestDataRefresh: mockRequestDataRefresh,
  }),
}));

vi.mock('@/utils/dialog', () => ({
  showItemDetailModal: mockShowItemDetailModal,
  showMessage: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'common') return { refresh: '刷新', dataRefreshed: '已刷新' };
    if (key === 'calendar') return { weekDays: ['一', '二', '三', '四', '五', '六', '日'] };
    if (key === 'focusPlan') return { estimatedShort: '预计' };
    if (key === 'focusReview') {
      return {
        title: '专注复盘',
        all: '全部',
        plannedItems: '有预计事项',
        actualTotal: '实际总专注',
        varianceTotal: '总偏差',
        plannedTotal: '预计总专注',
        todayList: '今日事项',
        detailTitle: '复盘详情',
        emptyTitle: '暂无',
        emptyDesc: '暂无',
        detailEmptyTitle: '请选择',
        detailEmptyDesc: '请选择',
        actualVsPlan: '实际 / 预计',
        variance: '偏差',
        openDetail: '打开事项详情',
        status: {
          matched: '匹配',
          overrun: '超支',
          underrun: '低于预计',
          'in-progress': '进行中',
          'not-started': '未开始',
        },
      };
    }
    return {};
  }),
}));

async function mountComponent() {
  const { default: FocusReviewView } = await import('@/components/pomodoro/review/FocusReviewView.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(FocusReviewView);
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

describe('FocusReviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders summary, list, switches date from mini calendar, and opens item detail', async () => {
    const mounted = await mountComponent();

    expect(mounted.container.textContent).toContain('有预计事项');
    expect(mounted.container.textContent).toContain('整理日报');
    expect(mounted.container.textContent).toContain('10m / 1h 10m');

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-15"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.textContent).toContain('补材料');
    expect(mounted.container.textContent).toContain('0m / 25m');

    (mounted.container.querySelector('[data-testid="focus-review-open-detail"]') as HTMLButtonElement).click();
    expect(mockShowItemDetailModal).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });
});
