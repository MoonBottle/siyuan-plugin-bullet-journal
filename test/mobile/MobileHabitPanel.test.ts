// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileHabitPanel from '@/mobile/panels/MobileHabitPanel.vue';
import dayjs from '@/utils/dayjs';

const {
  archiveHabit,
  broadcastDataRefresh,
  habits,
  projectStore,
  settingsStore,
  eventBusEmit,
  eventBusOn,
  consumePendingHabitDockTarget,
  dayStateByHabitId,
  checkIn,
  checkInCount,
  unarchiveHabit,
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
    dayStateByHabitId: {
      'habit-1': {
        hasRecord: false,
        isCompleted: false,
        currentValue: 0,
      },
      'habit-2': {
        hasRecord: false,
        isCompleted: false,
        currentValue: 0,
      },
    },
    archiveHabit: vi.fn(),
    broadcastDataRefresh: vi.fn(),
    checkIn: vi.fn(),
    checkInCount: vi.fn(),
    eventBusEmit: vi.fn(),
    unarchiveHabit: vi.fn(),
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
        archive: 'Archive',
        archived: 'Archived',
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
        unarchive: 'Unarchive',
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
  calculateHabitStats: vi.fn((habit: { blockId: string }) => ({
    habitId: habit.blockId,
    monthlyCheckins: 1,
    totalCheckins: 2,
    monthlyCompletionRate: 0.5,
    currentStreak: 1,
    longestStreak: 3,
  })),
}));

vi.mock('@/domain/habit/habitCompletion', () => ({
  getHabitDayState: vi.fn((habit: { blockId: string }) => dayStateByHabitId[habit.blockId]),
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
  archiveHabit,
  checkIn,
  checkInCount,
  setCheckInValue: vi.fn(),
  unarchiveHabit,
}));

vi.mock('@/utils/eventBus', () => ({
  DATA_REFRESH_CHANNEL: 'habit-refresh-test',
  Events: {
    DATA_REFRESH: 'data:refresh',
    HABIT_DOCK_NAVIGATE: 'habit-dock:navigate',
  },
  broadcastDataRefresh,
  eventBus: {
    emit: eventBusEmit,
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
      isMobile: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['click', 'open-detail', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': `habit-list-item-${(props.habit as { blockId: string }).blockId}` }, [
        h(
          'button',
          {
            'data-testid': `habit-list-item-open-${(props.habit as { blockId: string }).blockId}`,
            'data-mobile': String((props as { isMobile: boolean }).isMobile),
            onClick: () => emit('open-detail', props.habit),
          },
          (props.habit as { name: string }).name,
        ),
        h('button', {
          'data-testid': `habit-list-item-check-in-${(props.habit as { blockId: string }).blockId}`,
          onClick: () => emit('check-in', props.habit),
        }, 'check-in'),
        h('button', {
          'data-testid': `habit-list-item-increment-${(props.habit as { blockId: string }).blockId}`,
          onClick: () => emit('increment', props.habit),
        }, 'increment'),
      ]);
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
    props: {
      viewMonth: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'habit-month-calendar' }, props.viewMonth);
    },
  }),
}));

vi.mock('@/components/habit/HabitRecordLog.vue', () => ({
  default: defineComponent({
    name: 'HabitRecordLogStub',
    props: {
      viewMonth: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'habit-record-log' }, props.viewMonth);
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

vi.mock('@/mobile/components/habit/MobileHabitDetailSheet.vue', () => ({
  default: defineComponent({
    name: 'MobileHabitDetailSheetStub',
    props: {
      open: {
        type: Boolean,
        default: false,
      },
      habit: {
        type: Object,
        default: null,
      },
      selectedDate: {
        type: String,
        default: '',
      },
      viewMonth: {
        type: String,
        default: '',
      },
    },
    emits: ['archive', 'close', 'unarchive', 'update:viewMonth'],
    setup(props, { emit, slots }) {
      return () => props.open
        ? h('div', { 'data-testid': 'habit-detail-sheet-stub' }, [
            h('div', { 'data-testid': 'habit-detail-sheet-name' }, (props.habit as { name?: string } | null)?.name ?? ''),
            h('div', { 'data-testid': 'habit-detail-sheet-date' }, props.selectedDate),
            h('div', { 'data-testid': 'habit-detail-sheet-month' }, props.viewMonth),
            h('button', {
              'data-testid': (props.habit as { archivedAt?: string } | null)?.archivedAt ? 'mobile-habit-unarchive' : 'mobile-habit-archive',
              onClick: () => emit((props.habit as { archivedAt?: string } | null)?.archivedAt ? 'unarchive' : 'archive'),
            }, 'archive-toggle'),
            h('button', {
              'data-testid': 'habit-detail-sheet-close',
              onClick: () => emit('close'),
            }, 'close'),
            h('button', {
              'data-testid': 'habit-detail-sheet-update-month',
              onClick: () => emit('update:viewMonth', '2026-06'),
            }, 'month'),
            slots.default?.(),
          ])
        : null;
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

function resetDayState() {
  dayStateByHabitId['habit-1'] = {
    hasRecord: false,
    isCompleted: false,
    currentValue: 0,
  };
  dayStateByHabitId['habit-2'] = {
    hasRecord: false,
    isCompleted: false,
    currentValue: 0,
  };
  habits[0].archivedAt = undefined;
  habits[1].archivedAt = undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-05T00:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  resetDayState();
  vi.clearAllMocks();
  projectStore.currentDate = '2026-05-01';
  consumePendingHabitDockTarget.mockReturnValue(null);
  checkIn.mockResolvedValue(false);
  checkInCount.mockResolvedValue(false);
  archiveHabit.mockResolvedValue(false);
  broadcastDataRefresh.mockReset();
  unarchiveHabit.mockResolvedValue(false);
});

describe('MobileHabitPanel', () => {
  it('renders the habit list path without shell navigation artifacts', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).not.toBeNull();
    const weekBarWrap = mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]');
    expect(weekBarWrap).not.toBeNull();
    expect(weekBarWrap?.querySelector('[data-testid="habit-week-bar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]')?.textContent).toContain('Read');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-2"]')?.textContent).toContain('Water');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]')?.getAttribute('data-mobile')).toBe('true');
    expect(mounted.container.querySelector('.mobile-bottom-nav')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();
    expect(eventBusOn).toHaveBeenCalledTimes(2);
    expect(consumePendingHabitDockTarget).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('opens the sheet while keeping the list rendered when a habit item is selected', async () => {
    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    expect(item).not.toBeNull();

    item?.click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-stub"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-name"]')?.textContent).toBe('Read');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-05');

    mounted.unmount();
  });

  it('filters archived habits out of the mobile list while still allowing archived detail navigation', async () => {
    habits[1].archivedAt = '2026-05-04';
    consumePendingHabitDockTarget.mockReturnValue({
      habitId: 'habit-2',
      date: '2026-04-15',
    });

    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-2"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-name"]')?.textContent).toBe('Water');

    mounted.unmount();
  });

  it('opens the pending target habit in the sheet with the target month/date', async () => {
    consumePendingHabitDockTarget.mockReturnValue({
      habitId: 'habit-2',
      date: '2026-04-15',
    });

    const mounted = mountPanel();
    await nextTick();

    expect(document.body.querySelector('[data-testid="habit-detail-sheet-stub"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-name"]')?.textContent).toBe('Water');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-date"]')?.textContent).toBe('2026-04-15');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-04');
    expect(mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]')).not.toBeNull();

    mounted.unmount();
  });

  it('closes the sheet and accepts view-month updates from the sheet host', async () => {
    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    const updateMonth = document.body.querySelector('[data-testid="habit-detail-sheet-update-month"]') as HTMLButtonElement | null;
    updateMonth?.click();
    await nextTick();

    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-06');
    expect(mounted.container.querySelector('[data-testid="habit-month-calendar"]')?.textContent).toBe('2026-06');
    expect(mounted.container.querySelector('[data-testid="habit-record-log"]')?.textContent).toBe('2026-06');

    const closeButton = document.body.querySelector('[data-testid="habit-detail-sheet-close"]') as HTMLButtonElement | null;
    closeButton?.click();
    await nextTick();

    expect(document.body.querySelector('[data-testid="habit-detail-sheet-stub"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]')).not.toBeNull();

    mounted.unmount();
  });

  it('archives the selected habit from the mobile detail sheet and refreshes the panel', async () => {
    archiveHabit.mockResolvedValue(true);
    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    const button = document.body.querySelector('[data-testid="mobile-habit-archive"]') as HTMLButtonElement | null;
    button?.click();
    await nextTick();

    expect(archiveHabit).toHaveBeenCalledWith(habits[0], dayjs().format('YYYY-MM-DD'));
    expect(eventBusEmit).toHaveBeenCalledWith('data:refresh');
    expect(broadcastDataRefresh).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('unarchives the selected habit from the mobile detail sheet and refreshes the panel', async () => {
    habits[0].archivedAt = '2026-05-04';
    unarchiveHabit.mockResolvedValue(true);
    consumePendingHabitDockTarget.mockReturnValue({
      habitId: 'habit-1',
      date: '2026-05-01',
    });

    const mounted = mountPanel();
    await nextTick();

    const button = document.body.querySelector('[data-testid="mobile-habit-unarchive"]') as HTMLButtonElement | null;
    button?.click();
    await nextTick();

    expect(unarchiveHabit).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'habit-1',
      archivedAt: '2026-05-04',
    }));
    expect(eventBusEmit).toHaveBeenCalledWith('data:refresh');
    expect(broadcastDataRefresh).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('renders month calendar above stats cards and removes the today progress block in detail sheet', async () => {
    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    const detailBody = mounted.container.querySelector('.mobile-habit-detail__body');
    const calendar = mounted.container.querySelector('[data-testid="habit-month-calendar"]');
    const stats = mounted.container.querySelector('[data-testid="habit-stats-cards"]');

    expect(mounted.container.querySelector('.mobile-habit-detail__today')).toBeNull();
    expect(detailBody?.firstElementChild).toBe(calendar);
    expect(detailBody?.children[1]).toBe(stats);

    mounted.unmount();
  });

  it('does not render the old today-progress action in detail sheet or re-trigger check-in', async () => {
    dayStateByHabitId['habit-1'] = {
      hasRecord: true,
      isCompleted: true,
      currentValue: 1,
    };

    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    const detailButton = document.body.querySelector('.mobile-check-btn') as HTMLButtonElement | null;
    expect(detailButton).toBeNull();
    await nextTick();

    expect(checkIn).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('initializes selected date from projectStore.currentDate when store date differs from local today', async () => {
    projectStore.currentDate = '2026-04-20';

    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-open-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    expect(document.body.querySelector('[data-testid="habit-detail-sheet-date"]')?.textContent).toBe('2026-04-20');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-04');

    mounted.unmount();
  });

  it('does not manually refresh the store after binary check-in succeeds', async () => {
    checkIn.mockResolvedValue(true);
    const mounted = mountPanel();
    await nextTick();

    const button = mounted.container.querySelector('[data-testid="habit-list-item-check-in-habit-1"]') as HTMLButtonElement | null;
    button?.click();
    await nextTick();

    expect(checkIn).toHaveBeenCalledWith(habits[0], '2026-05-01');
    expect(projectStore.refresh).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not manually refresh the store after count increment succeeds', async () => {
    checkInCount.mockResolvedValue(true);
    const mounted = mountPanel();
    await nextTick();

    const button = mounted.container.querySelector('[data-testid="habit-list-item-increment-habit-2"]') as HTMLButtonElement | null;
    button?.click();
    await nextTick();

    expect(checkInCount).toHaveBeenCalledWith(habits[1], '2026-05-01', 1);
    expect(projectStore.refresh).not.toHaveBeenCalled();

    mounted.unmount();
  });
});
