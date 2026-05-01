// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileHabitPanel from '@/mobile/panels/MobileHabitPanel.vue';

const {
  habits,
  projectStore,
  settingsStore,
  eventBusOn,
  consumePendingHabitDockTarget,
} = vi.hoisted(() => {
  const habits = [
    {
      blockId: 'habit-1',
      docId: 'doc-1',
      name: 'Read',
      type: 'binary',
      startDate: '2026-05-01',
      records: [],
    },
    {
      blockId: 'habit-2',
      docId: 'doc-2',
      name: 'Water',
      type: 'count',
      startDate: '2026-05-01',
      target: 8,
      unit: 'cups',
      records: [],
    },
  ];

  return {
    habits,
    projectStore: {
      currentDate: '2026-05-01',
      getHabits: vi.fn(() => habits),
      refresh: vi.fn(),
    },
    settingsStore: {
      scanMode: 'all',
      directories: [],
    },
    eventBusOn: vi.fn(() => vi.fn()),
    consumePendingHabitDockTarget: vi.fn(() => null),
  };
});

vi.mock('@/stores', () => ({
  useProjectStore: () => projectStore,
  useSettingsStore: () => settingsStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => null,
}));

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    if (key === 'habit') {
      return {
        title: 'Habits',
        noHabits: 'No habits',
        noHabitsDesc: 'Create one',
        todayProgress: 'Today',
        todayChecked: 'Checked',
        checkIn: 'Check in',
        target: 'Target {target}{unit}',
        monthlyCheckins: 'Monthly',
        totalCheckins: 'Total',
        monthlyCompletionRate: 'Monthly completion',
        currentStreak: 'Current streak',
        longestStreak: 'Longest streak',
        noMonthlyCheckinLog: 'No log',
        monthlyCheckinLog: '{month} log',
      };
    }

    return {};
  },
}));

vi.mock('@/utils/habitStatsUtils', () => ({
  calculateAllHabitStats: vi.fn(() => new Map(habits.map(habit => [
    habit.blockId,
    {
      habitId: habit.blockId,
      monthlyCheckins: 1,
      totalCheckins: 2,
      monthlyCompletionRate: 0.5,
      currentStreak: 1,
      longestStreak: 3,
    },
  ]))),
}));

vi.mock('@/domain/habit/habitCompletion', () => ({
  getHabitDayState: vi.fn(() => ({
    hasRecord: false,
    isCompleted: false,
    currentValue: 0,
  })),
  getHabitPeriodState: vi.fn(() => ({
    isCompleted: false,
    completedCount: 0,
    remainingCount: 1,
    requiredCount: 1,
    eligibleToday: true,
    periodType: 'day',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-01',
  })),
}));

vi.mock('@/services/habitService', () => ({
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
  setCheckInValue: vi.fn(),
}));

vi.mock('@/utils/eventBus', () => ({
  DATA_REFRESH_CHANNEL: 'habit-refresh-test',
  Events: {
    DATA_REFRESH: 'data:refresh',
    HABIT_DOCK_NAVIGATE: 'habit-dock:navigate',
  },
  eventBus: {
    on: eventBusOn,
  },
}));

vi.mock('@/utils/habitDockNavigation', () => ({
  consumePendingHabitDockTarget,
}));

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-week-bar' }, 'week');
    },
  }),
}));

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: {
      habit: {
        type: Object,
        required: true,
      },
    },
    emits: ['click'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-testid': `habit-list-item-${(props.habit as { blockId: string }).blockId}`,
            onClick: () => emit('click', props.habit),
          },
          (props.habit as { name: string }).name,
        );
    },
  }),
}));

vi.mock('@/components/habit/HabitStatsCards.vue', () => ({
  default: defineComponent({
    name: 'HabitStatsCardsStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-stats-cards' }, 'stats');
    },
  }),
}));

vi.mock('@/components/habit/HabitMonthCalendar.vue', () => ({
  default: defineComponent({
    name: 'HabitMonthCalendarStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-month-calendar' }, 'calendar');
    },
  }),
}));

vi.mock('@/components/habit/HabitRecordLog.vue', () => ({
  default: defineComponent({
    name: 'HabitRecordLogStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-record-log' }, 'log');
    },
  }),
}));

vi.mock('@/components/habit/HabitCountInput.vue', () => ({
  default: defineComponent({
    name: 'HabitCountInputStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-count-input' }, 'count');
    },
  }),
}));

function mountPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileHabitPanel);
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
  vi.clearAllMocks();
});

describe('MobileHabitPanel', () => {
  it('renders the habit list path without shell navigation artifacts', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-week-bar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')?.textContent).toContain('Read');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-2"]')?.textContent).toContain('Water');
    expect(mounted.container.querySelector('.mobile-bottom-nav')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();
    expect(eventBusOn).toHaveBeenCalledTimes(2);
    expect(consumePendingHabitDockTarget).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });
});
