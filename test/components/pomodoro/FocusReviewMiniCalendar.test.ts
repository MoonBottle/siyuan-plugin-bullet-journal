// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const summaryByDate: Record<string, any> = {
  '2026-05-13': {
    date: '2026-05-13',
    total: 1,
    estimatedMinutes: 0,
    actualMinutes: 20,
    matched: 0,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 0,
    unplanned: 1,
  },
  '2026-05-14': {
    date: '2026-05-14',
    total: 2,
    estimatedMinutes: 95,
    actualMinutes: 40,
    matched: 1,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 1,
    unplanned: 0,
  },
  '2026-05-15': {
    date: '2026-05-15',
    total: 1,
    estimatedMinutes: 25,
    actualMinutes: 0,
    matched: 0,
    overrun: 0,
    underrun: 0,
    notStarted: 1,
    inProgress: 0,
    unplanned: 0,
  },
};

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'calendar') return { weekDays: ['一', '二', '三', '四', '五', '六', '日'] };
    return {};
  }),
}));

async function mountComponent() {
  const { default: FocusReviewMiniCalendar } = await import('@/components/pomodoro/review/FocusReviewMiniCalendar.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(FocusReviewMiniCalendar, {
    modelValue: '2026-05-14',
    getSummaryByDate: (date: string) => summaryByDate[date],
  });
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

describe('FocusReviewMiniCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows distinct marker states for planned-only, focused-only, and hybrid days', async () => {
    const mounted = await mountComponent();

    const focusedOnly = mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-13"]') as HTMLElement;
    const hybrid = mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-14"]') as HTMLElement;
    const plannedOnly = mounted.container.querySelector('[data-testid="focus-review-calendar-cell-2026-05-15"]') as HTMLElement;

    expect(focusedOnly.className).toContain('focus-review-mini-calendar__cell--focused');
    expect(focusedOnly.className).toContain('focus-review-mini-calendar__cell--unplanned-focus');
    expect(focusedOnly.className).not.toContain('focus-review-mini-calendar__cell--planned');
    expect(focusedOnly.querySelector('.focus-review-mini-calendar__dot--focused')).toBeTruthy();

    expect(hybrid.className).toContain('focus-review-mini-calendar__cell--planned');
    expect(hybrid.className).toContain('focus-review-mini-calendar__cell--focused');
    expect(hybrid.querySelector('.focus-review-mini-calendar__dot--hybrid')).toBeTruthy();

    expect(plannedOnly.className).toContain('focus-review-mini-calendar__cell--planned');
    expect(plannedOnly.className).not.toContain('focus-review-mini-calendar__cell--focused');
    expect(plannedOnly.querySelector('.focus-review-mini-calendar__dot--planned')).toBeTruthy();

    mounted.unmount();
  });
});
