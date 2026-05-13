// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
    template: '<div data-testid="habit-week-bar-stub"></div>',
  }),
}));

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['currentDate', 'habit'],
    setup(props) {
      return () => h('div', {
        'data-testid': `habit-list-item-stub-${props.habit.blockId}`,
        'data-current-date': props.currentDate,
      });
    },
  }),
}));

function mountPane() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const habit: Habit = {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
  };

  const habitStatsMap = new Map<string, HabitStats>([[
    'habit-1',
    {
      totalCheckins: 3,
      currentStreak: 1,
      bestStreak: 2,
      thisMonthCheckins: 2,
      completionRate: 50,
    },
  ]]);

  const habitDayStateMap = new Map<string, HabitDayState>([[
    'habit-1',
    {
      date: '2026-05-10',
      hasRecord: true,
      isCompleted: true,
    },
  ]]);

  const habitPeriodStateMap = new Map<string, HabitPeriodState>([[
    'habit-1',
    {
      periodType: 'day',
      periodStart: '2026-05-10',
      periodEnd: '2026-05-10',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    },
  ]]);

  const app = createApp(HabitWorkspaceListPane, {
    selectedDate: '2026-05-10',
    currentDate: '2026-05-12',
    habits: [habit],
    habitStatsMap,
    habitDayStateMap,
    habitPeriodStateMap,
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

describe('HabitWorkspaceListPane', () => {
  it('passes the selected week-bar date to habit list items instead of today', async () => {
    const mounted = mountPane();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-stub-habit-1"]') as HTMLElement | null;
    expect(item).not.toBeNull();
    expect(item?.getAttribute('data-current-date')).toBe('2026-05-10');

    mounted.unmount();
  });
});
