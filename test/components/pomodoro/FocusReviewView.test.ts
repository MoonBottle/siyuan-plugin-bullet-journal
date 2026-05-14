// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockProjectStore = {
  getTodayFocusPlanEntries: vi.fn(() => mockEntries),
  getTodayFocusPlanSummary: vi.fn(() => ({
    total: 2,
    estimatedMinutes: 95,
    actualMinutes: 40,
    matched: 1,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 1,
  })),
  items: [
    { id: 'item-1', blockId: 'block-1', content: '整理日报', lineNumber: 1, docId: 'doc-1', date: '2026-05-14', status: 'pending' },
    { id: 'item-2', blockId: 'block-2', content: '整理会议结论', lineNumber: 2, docId: 'doc-1', date: '2026-05-14', status: 'completed' },
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
  });

  it('renders summary, list, and opens item detail from the right pane', async () => {
    const mounted = await mountComponent();

    expect(mounted.container.textContent).toContain('有预计事项');
    expect(mounted.container.textContent).toContain('整理日报');
    expect(mounted.container.textContent).toContain('10m / 1h 10m');

    (mounted.container.querySelector('[data-testid="focus-review-open-detail"]') as HTMLButtonElement).click();
    expect(mockShowItemDetailModal).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });
});
