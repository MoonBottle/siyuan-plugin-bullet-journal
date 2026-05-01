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
  dayStateByHabitId,
  checkIn,
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
    checkIn: vi.fn(),
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
  checkIn,
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
      isMobile: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['click', 'open-detail'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-testid': `habit-list-item-${(props.habit as { blockId: string }).blockId}`,
            'data-mobile': String((props as { isMobile: boolean }).isMobile),
            onClick: () => emit('open-detail', props.habit),
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
    emits: ['close', 'update:viewMonth'],
    setup(props, { emit, slots }) {
      return () => props.open
        ? h('div', { 'data-testid': 'habit-detail-sheet-stub' }, [
            h('div', { 'data-testid': 'habit-detail-sheet-name' }, (props.habit as { name?: string } | null)?.name ?? ''),
            h('div', { 'data-testid': 'habit-detail-sheet-date' }, props.selectedDate),
            h('div', { 'data-testid': 'habit-detail-sheet-month' }, props.viewMonth),
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
}

afterEach(() => {
  document.body.innerHTML = '';
  resetDayState();
  vi.clearAllMocks();
  projectStore.currentDate = '2026-05-01';
  consumePendingHabitDockTarget.mockReturnValue(null);
});

describe('MobileHabitPanel', () => {
  it('renders the habit list path without shell navigation artifacts', async () => {
    const mounted = mountPanel();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).not.toBeNull();
    const weekBarWrap = mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]');
    expect(weekBarWrap).not.toBeNull();
    expect(weekBarWrap?.querySelector('[data-testid="habit-week-bar"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')?.textContent).toContain('Read');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-2"]')?.textContent).toContain('Water');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')?.getAttribute('data-mobile')).toBe('true');
    expect(mounted.container.querySelector('.mobile-bottom-nav')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();
    expect(eventBusOn).toHaveBeenCalledTimes(2);
    expect(consumePendingHabitDockTarget).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('opens the sheet while keeping the list rendered when a habit item is selected', async () => {
    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]') as HTMLButtonElement | null;
    expect(item).not.toBeNull();

    item?.click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-week-bar-wrap"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-stub"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-name"]')?.textContent).toBe('Read');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-05');

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

    const item = mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]') as HTMLButtonElement | null;
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
    expect(mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')).not.toBeNull();

    mounted.unmount();
  });

  it('disables the binary detail action once completed and does not re-trigger check-in', async () => {
    dayStateByHabitId['habit-1'] = {
      hasRecord: true,
      isCompleted: true,
      currentValue: 1,
    };

    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    const detailButton = document.body.querySelector('.mobile-check-btn') as HTMLButtonElement | null;
    expect(detailButton).not.toBeNull();
    expect(detailButton?.disabled).toBe(true);

    detailButton?.click();
    await nextTick();

    expect(checkIn).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('initializes selected date from projectStore.currentDate when store date differs from local today', async () => {
    projectStore.currentDate = '2026-04-20';

    const mounted = mountPanel();
    await nextTick();

    const item = mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]') as HTMLButtonElement | null;
    item?.click();
    await nextTick();

    expect(document.body.querySelector('[data-testid="habit-detail-sheet-date"]')?.textContent).toBe('2026-04-20');
    expect(document.body.querySelector('[data-testid="habit-detail-sheet-month"]')?.textContent).toBe('2026-04');

    mounted.unmount();
  });
});
