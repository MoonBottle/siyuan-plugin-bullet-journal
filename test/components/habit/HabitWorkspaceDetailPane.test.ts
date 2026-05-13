// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import HabitWorkspaceDetailPane from '@/components/habit/HabitWorkspaceDetailPane.vue';
import type { Habit, HabitStats } from '@/types/models';

vi.mock('@/components/habit/HabitMonthCalendar.vue', () => ({
  default: defineComponent({
    name: 'HabitMonthCalendarStub',
    template: '<div data-testid="habit-month-calendar-stub">calendar</div>',
  }),
}));

vi.mock('@/components/habit/HabitStatsCards.vue', () => ({
  default: defineComponent({
    name: 'HabitStatsCardsStub',
    template: '<div data-testid="habit-stats-stub">stats</div>',
  }),
}));

vi.mock('@/components/habit/HabitRecordLog.vue', () => ({
  default: defineComponent({
    name: 'HabitRecordLogStub',
    template: '<div data-testid="habit-record-log-stub">log</div>',
  }),
}));

function mountPane() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const selectedHabit: Habit = {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
  };

  const stats: HabitStats = {
    totalCheckins: 3,
    currentStreak: 1,
    bestStreak: 2,
    thisMonthCheckins: 2,
    completionRate: 50,
  };

  const app = createApp(HabitWorkspaceDetailPane, {
    selectedHabit,
    stats,
    currentDate: '2026-05-12',
    viewMonth: '2026-05',
    emptyTitle: 'empty',
    emptyDesc: 'empty desc',
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
});

describe('HabitWorkspaceDetailPane', () => {
  it('keeps calendar and stats sections from shrinking when record log grows', async () => {
    const mounted = mountPane();
    await nextTick();

    const calendarSection = mounted.container.querySelector('[data-testid="habit-detail-calendar-section"]') as HTMLElement | null;
    const statsSection = mounted.container.querySelector('[data-testid="habit-detail-stats-section"]') as HTMLElement | null;
    const logSection = mounted.container.querySelector('[data-testid="habit-detail-log-section"]') as HTMLElement | null;

    expect(calendarSection).not.toBeNull();
    expect(statsSection).not.toBeNull();
    expect(logSection).not.toBeNull();
    expect(calendarSection?.classList.contains('habit-workspace-detail-pane__section--calendar')).toBe(true);
    expect(statsSection?.classList.contains('habit-workspace-detail-pane__section--stats')).toBe(true);
    expect(logSection?.classList.contains('habit-workspace-detail-pane__section--log')).toBe(true);

    mounted.unmount();
  });
});
