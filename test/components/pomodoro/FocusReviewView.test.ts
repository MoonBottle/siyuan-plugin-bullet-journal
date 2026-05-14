// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestDataRefresh = vi.fn(() => Promise.resolve());
const mockShowFocusPlanItemPickerDialog = vi.fn();

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

const historicalFocusedEntries = [
  {
    itemId: 'item-history-1',
    blockId: 'block-history-1',
    date: '2026-05-13',
    estimatedMinutes: 0,
    actualMinutes: 20,
    itemStatus: 'completed',
    itemContent: '历史专注记录',
    reviewStatus: 'unplanned',
    deltaMinutes: 20,
  },
];

const entriesByDate: Record<string, typeof mockEntries> = {
  '2026-05-13': historicalFocusedEntries,
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
    unplanned: entries.filter(entry => entry.reviewStatus === 'unplanned').length,
  };
};

const mockProjectStore = {
  getFocusPlanEntriesByDate: vi.fn((date: string) => entriesByDate[date] ?? []),
  getFocusPlanSummaryByDate: vi.fn((date: string) => summaryByDate(date)),
  items: [
    { id: 'item-1', blockId: 'block-1', content: '整理日报', lineNumber: 1, docId: 'doc-1', date: '2026-05-14', status: 'pending', project: { name: '项目A' }, task: { name: '任务A' }, pomodoros: [{ id: 'p1', date: '2026-05-14', startTime: '08:25:00', endTime: '08:35:00', durationMinutes: 10, itemId: 'item-1', itemContent: '整理日报', blockId: 'abcdefghijklmnopqrstuv' }] },
    { id: 'item-2', blockId: 'block-2', content: '整理会议结论', lineNumber: 2, docId: 'doc-1', date: '2026-05-14', status: 'completed', pomodoros: [] },
    { id: 'item-3', blockId: 'block-3', content: '补材料', lineNumber: 3, docId: 'doc-2', date: '2026-05-15', status: 'pending', pomodoros: [] },
    { id: 'item-history-1', blockId: 'block-history-1', content: '历史专注记录', lineNumber: 4, docId: 'doc-3', date: '2026-05-13', status: 'completed', pomodoros: [{ id: 'ph1', date: '2026-05-13', startTime: '09:00:00', endTime: '09:20:00', durationMinutes: 20, itemId: 'item-history-1', itemContent: '历史专注记录', blockId: 'block-history-1' }] },
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
  showMessage: vi.fn(),
  showFocusPlanItemPickerDialog: mockShowFocusPlanItemPickerDialog,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/components/todo/TodoTypedLinks.vue', () => ({
  default: {
    template: '<div data-testid="todo-typed-links"></div>',
  },
}));

vi.mock('@/components/dialog/ItemDetailContent.vue', () => ({
  default: {
    props: ['item'],
    template: '<div data-testid="item-detail-content">{{ item?.content }}</div>',
  },
}));

vi.mock('@/components/todo/ItemActionBar.vue', () => ({
  default: {
    props: ['item'],
    template: '<div data-testid="item-action-bar">{{ item?.content }}</div>',
  },
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'common') return { refresh: '刷新', dataRefreshed: '已刷新' };
    if (key === 'calendar') return { weekDays: ['一', '二', '三', '四', '五', '六', '日'] };
    if (key === 'todo') return { detail: '事项详情', project: '项目', task: '任务', time: '时间', today: '今天', tomorrow: '明天' };
    if (key === 'focusPlan') return { estimatedShort: '预计' };
    if (key === 'pomodoroStats') return { focusRecords: '专注记录', noData: '暂无记录', today: '今天', formatMonthDay: 'M月D日' };
    if (key === 'focusReview') {
      return {
        title: '专注工作台',
        openReview: '打开专注工作台',
        addPlan: '添加预计',
        all: '全部',
        plannedItems: '有预计事项',
        actualTotal: '实际总专注',
        varianceTotal: '总偏差',
        plannedTotal: '预计总专注',
        todayList: '今日事项',
        historyList: '历史事项',
        futureList: '计划事项',
        expiredItems: '过期事项',
        detailTitle: '复盘详情',
        emptyTitle: '还没有预计事项',
        emptyDesc: '为过期事项或当前日期事项设置预计后，这里会显示专注复盘。',
        emptyAction: '为事项设置预计',
        pickerEmpty: '没有可设置预计的事项',
        detailEmptyTitle: '请选择',
        detailEmptyDesc: '请选择',
        detailEmptyDescToday: '今日说明',
        detailEmptyDescHistory: '历史说明',
        detailEmptyDescFuture: '未来说明',
        actualVsPlan: '实际 / 预计',
        variance: '偏差',
        status: {
          matched: '匹配',
          overrun: '超支',
          underrun: '低于预计',
          'in-progress': '进行中',
          'not-started': '未开始',
          unplanned: '未预计',
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

  it('renders summary, list, and detail panes that switch with the calendar date', async () => {
    const mounted = await mountComponent();

    expect(mounted.container.textContent).toContain('预计总专注');
    expect(mounted.container.textContent).toContain('实际总专注');
    expect(mounted.container.textContent).toContain('整理日报');
    expect(mounted.container.textContent).toContain('1h 35m');
    expect(mounted.container.textContent).toContain('40m');
    expect(mounted.container.textContent).toContain('今日事项');
    expect(mounted.container.textContent).toContain('事项详情');
    expect(mounted.container.textContent).toContain('专注记录');
    expect(mounted.container.querySelector('[data-testid="item-detail-content"]')?.textContent).toContain('整理日报');
    expect(mounted.container.querySelector('[data-testid="item-action-bar"]')?.textContent).toContain('整理日报');

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-15"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.textContent).toContain('补材料');
    expect(mounted.container.textContent).toContain('0m / 25m');
    expect(mounted.container.textContent).toContain('计划事项');
    expect(mounted.container.textContent).toContain('暂无记录');

    mounted.unmount();
  });

  it('shows add-focus-plan entry and opens candidate picker from the sidebar', async () => {
    const mounted = await mountComponent();

    expect(mounted.container.textContent).toContain('添加预计');

    (mounted.container.querySelector('[data-testid="focus-review-add-plan"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mockShowFocusPlanItemPickerDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDate: '2026-05-14',
      }),
    );

    mounted.unmount();
  });

  it('shows empty-state action and reuses the picker when the selected date has no planned items', async () => {
    const mounted = await mountComponent();

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-16"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.textContent).toContain('还没有预计事项');
    expect(mounted.container.textContent).toContain('为事项设置预计');

    (mounted.container.querySelector('.focus-review-view__empty-action') as HTMLButtonElement).click();
    await nextTick();

    expect(mockShowFocusPlanItemPickerDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDate: '2026-05-16',
      }),
    );

    mounted.unmount();
  });

  it('hides add-plan actions on historical dates and still shows unplanned focused entries', async () => {
    const mounted = await mountComponent();

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-13"]') as HTMLButtonElement).click();
    await nextTick();

    expect(mounted.container.textContent).toContain('历史专注记录');
    expect(mounted.container.textContent).toContain('未预计');
    expect(mounted.container.textContent).toContain('历史事项');
    expect(mounted.container.querySelector('[data-testid="focus-review-add-plan"]')).toBeNull();
    expect(mounted.container.querySelector('.focus-review-view__empty-action')).toBeNull();

    mounted.unmount();
  });

  it('switches detail empty description with selected date context', async () => {
    const mounted = await mountComponent();

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-16"]') as HTMLButtonElement).click();
    await nextTick();
    expect(mounted.container.textContent).toContain('未来说明');

    const originalItems = [...mockProjectStore.items];
    mockProjectStore.items = mockProjectStore.items.filter(item => item.id !== 'item-history-1');

    (mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-13"]') as HTMLButtonElement).click();
    await nextTick();
    expect(mounted.container.textContent).toContain('历史说明');

    mockProjectStore.items = originalItems;
    mounted.unmount();
  });
});
