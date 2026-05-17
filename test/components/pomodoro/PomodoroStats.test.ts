// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOpenCustomTab = vi.fn();
const mockProjectStore = {
  getTodayPomodoros: vi.fn(() => [{ id: '1' }]),
  getTodayFocusMinutes: vi.fn(() => 10),
  getTotalPomodoros: vi.fn(() => [{ id: '1' }, { id: '2' }]),
  getTotalFocusMinutes: vi.fn(() => 70),
  getTodayFocusPlanSummary: vi.fn(() => ({
    estimatedMinutes: 145,
    actualMinutes: 10,
  })),
};

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({
    openCustomTab: mockOpenCustomTab,
  }),
}));

vi.mock('@/constants', () => ({
  TAB_TYPES: {
    FOCUS_REVIEW: 'bullet-journal-focus-review',
  },
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'pomodoroStats') {
      return {
        todayPomodoros: '当日专注次数',
        todayFocusDuration: '今日专注总时长',
        totalPomodoros: '历史专注总次数',
        totalFocusDuration: '累计专注总时长',
      };
    }
    if (key === 'focusPlan') {
      return {
        estimatedShort: '预计',
        variance: '偏差',
      };
    }
    if (key === 'focusReview') {
      return {
        openReview: '打开专注工作台',
      };
    }
    return {};
  }),
}));

async function mountComponent() {
  const { default: PomodoroStats } = await import('@/components/pomodoro/PomodoroStats.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(PomodoroStats);
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

describe('PomodoroStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking estimated or variance card opens focus review tab', async () => {
    const mounted = await mountComponent();

    expect(mounted.container.querySelector('[aria-label="打开专注工作台"]')).toBeTruthy();

    (mounted.container.querySelector('[data-testid="focus-review-entry-estimated"]') as HTMLButtonElement).click();
    (mounted.container.querySelector('[data-testid="focus-review-entry-variance"]') as HTMLButtonElement).click();

    expect(mockOpenCustomTab).toHaveBeenCalledTimes(2);
    expect(mockOpenCustomTab).toHaveBeenNthCalledWith(1, 'bullet-journal-focus-review');
    expect(mockOpenCustomTab).toHaveBeenNthCalledWith(2, 'bullet-journal-focus-review');

    mounted.unmount();
  });
});
