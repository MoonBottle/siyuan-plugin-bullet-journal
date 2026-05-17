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

function mountPane(selectedHabit?: Habit | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const habit: Habit | null = selectedHabit ?? {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
  };

  const stats: HabitStats = {
    habitId: habit?.blockId || 'habit-1',
    totalCheckins: 3,
    monthlyCheckins: 2,
    currentStreak: 1,
    longestStreak: 2,
    completionRate: 0.5,
    monthlyCompletionRate: 0.5,
    weeklyCompletionRate: 0.5,
  };

  const app = createApp(HabitWorkspaceDetailPane, {
    selectedHabit: habit,
    stats: habit ? stats : null,
    currentDate: '2026-05-18',
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

  it('shows stage and next due date for ebbinghaus habits', async () => {
    const mounted = mountPane({
      name: '英语单词',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-05-14',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
      records: [{
        content: '英语单词',
        date: '2026-05-14',
        docId: 'doc-1',
        blockId: 'record-1',
        habitId: 'habit-1',
      }],
    });

    await nextTick();

    expect(mounted.container.textContent).toContain('第 1 阶段');
    expect(mounted.container.textContent).toContain('下次打卡 2026-05-15');

    mounted.unmount();
  });
});
