// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import { initI18n } from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { eventBus, Events } from '@/utils/eventBus';

const {
  archiveHabit,
  checkIn,
  checkInCount,
  unarchiveHabit,
} = vi.hoisted(() => ({
  archiveHabit: vi.fn(),
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
  unarchiveHabit: vi.fn(),
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
}));

vi.mock('@/services/habitService', () => ({
  archiveHabit,
  checkIn,
  checkInCount,
  unarchiveHabit,
}));

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-week-bar-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitStatsCards.vue', () => ({
  default: defineComponent({
    name: 'HabitStatsCardsStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-stats-stub' });
    },
  }),
}));

vi.mock('@/utils/habitStatsUtils', () => ({
  calculateAllHabitStats: vi.fn(() => new Map([
    ['habit-1', {
      habitId: 'habit-1',
      monthlyCheckins: 1,
      totalCheckins: 1,
      completionRate: 1,
      weeklyCompletionRate: 1,
      monthlyCompletionRate: 1,
      currentStreak: 1,
      longestStreak: 1,
      isEnded: false,
    }],
  ])),
  calculateHabitStats: vi.fn((habit: { blockId: string }) => ({
    habitId: habit.blockId,
    monthlyCheckins: 1,
    totalCheckins: 1,
    completionRate: 1,
    weeklyCompletionRate: 1,
    monthlyCompletionRate: 1,
    currentStreak: 1,
    longestStreak: 1,
    isEnded: false,
  })),
}));

vi.mock('@/components/habit/HabitMonthCalendar.vue', () => ({
  default: defineComponent({
    name: 'HabitMonthCalendarStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-month-calendar-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitRecordLog.vue', () => ({
  default: defineComponent({
    name: 'HabitRecordLogStub',
    emits: ['edit-record', 'delete-record'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-record-log-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitCountInput.vue', () => ({
  default: defineComponent({
    name: 'HabitCountInputStub',
    emits: ['change'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-count-input-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['habit', 'readonlyActions'],
    emits: ['open-doc', 'open-detail', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': `habit-list-item-${props.habit.blockId}` }, [
        h('button', {
          'data-testid': 'habit-list-item-main',
          onClick: () => emit('open-detail', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-open-doc',
          onClick: () => emit('open-doc', props.habit),
        }),
        ...(props.readonlyActions
          ? []
          : [
              h('button', {
                'data-testid': 'habit-list-item-check-in',
                onClick: () => emit('check-in', props.habit),
              }),
              h('button', {
                'data-testid': 'habit-list-item-increment',
                onClick: () => emit('increment', props.habit),
              }),
            ]),
      ]);
    },
  }),
}));

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '喝水',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  };
}

function mountDock() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  projectStore.projects = [{
    id: 'project-1',
    name: 'Project 1',
    items: [],
    habits: [createHabit()],
    links: [],
    groupId: '',
  } as any];
  projectStore.currentDate = '2026-04-30';
  projectStore.refresh = vi.fn().mockResolvedValue(undefined) as any;
  settingsStore.scanMode = 'folder';
  settingsStore.directories = [];

  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(DesktopHabitDock);
  app.use(pinia);
  app.mount(container);

  return {
    container,
    projectStore,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('DesktopHabitDock', () => {
  beforeEach(() => {
    initI18n('en_US');
    vi.clearAllMocks();
    document.body.innerHTML = '';
    archiveHabit.mockResolvedValue(false);
    checkIn.mockResolvedValue(false);
    checkInCount.mockResolvedValue(false);
    unarchiveHabit.mockResolvedValue(false);
  });

  it('opening a list item main action enters detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')?.textContent).toContain('喝水');
    mounted.unmount();
  });

  it('desktop document action opens the habit document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
    mounted.unmount();
  });

  it('back button returns detail mode to the list mode shell', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-back-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-week-bar-stub"]')).not.toBeNull();
    mounted.unmount();
  });

  it('detail header open-doc action opens the selected habit document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-open-doc"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
    mounted.unmount();
  });

  it('renders an archive action for active habits in detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-archive"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')).toBeNull();
    mounted.unmount();
  });

  it('renders an unarchive action and archived notice for archived habits in detail mode', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [createHabit({
      archivedAt: '2026-05-04',
    })];
    await nextTick();

    eventBus.emit(Events.HABIT_DOCK_NAVIGATE, {
      habitId: 'habit-1',
      date: '2026-04-30',
    });
    await nextTick();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-detail-archive"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-detail-archived-tip"]')?.textContent).toContain('Archived');
    expect(mounted.container.querySelector('.habit-detail__today')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-count-input-stub"]')).toBeNull();
    mounted.unmount();
  });

  it('refresh button calls projectStore.refresh', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-dock-refresh-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.projectStore.refresh).toHaveBeenCalled();
    mounted.unmount();
  });

  it('shows an archived-list entry in active list mode and opens archived list mode on click', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [
      createHabit({ blockId: 'active-1' }),
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-archived-header"]')?.textContent).toContain('Archived');
    expect(mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-active-1"]')).toBeNull();
    mounted.unmount();
  });

  it('returns from archived detail to archived list context', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [
      createHabit({ blockId: 'active-1' }),
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-back-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-archived-header"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-archived-1"]')).not.toBeNull();
    mounted.unmount();
  });

  it('renders the archived empty state when there are no archived habits', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.textContent).toContain('No archived habits');
    mounted.unmount();
  });

  it('archive action routes through the habit service', async () => {
    archiveHabit.mockResolvedValue(true);
    const mounted = mountDock();
    vi.mocked(mounted.projectStore.refresh).mockClear();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-archive"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(archiveHabit).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'habit-1' }),
      dayjs().format('YYYY-MM-DD'),
    );
    expect(mounted.projectStore.refresh).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });

  it('unarchive action routes through the habit service', async () => {
    unarchiveHabit.mockResolvedValue(true);
    const mounted = mountDock();
    vi.mocked(mounted.projectStore.refresh).mockClear();
    mounted.projectStore.projects[0].habits = [createHabit({
      archivedAt: '2026-05-04',
    })];
    await nextTick();

    eventBus.emit(Events.HABIT_DOCK_NAVIGATE, {
      habitId: 'habit-1',
      date: '2026-04-30',
    });
    await nextTick();
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(unarchiveHabit).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'habit-1', archivedAt: '2026-05-04' }),
    );
    expect(mounted.projectStore.refresh).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });

  it('binary check-in action does not open the document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it('does not manually refresh the store after binary check-in succeeds', async () => {
    checkIn.mockResolvedValue(true);
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'habit-1' }),
      dayjs().format('YYYY-MM-DD'),
    );
    expect(mounted.projectStore.refresh).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('increment action does not enter detail mode', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [createHabit({ type: 'count', target: 8, unit: '杯' })];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')).toBeNull();
    mounted.unmount();
  });

  it('does not manually refresh the store after count increment succeeds', async () => {
    checkInCount.mockResolvedValue(true);
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [createHabit({ type: 'count', target: 8, unit: '杯' })];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(checkInCount).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'habit-1' }),
      dayjs().format('YYYY-MM-DD'),
      1,
    );
    expect(mounted.projectStore.refresh).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not render archived list check-in controls', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-increment"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')).not.toBeNull();
    mounted.unmount();
  });

  it('removes a habit from the archived list after unarchive and returning to the archived list shell', async () => {
    unarchiveHabit.mockResolvedValue(true);
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [
      createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
    ];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-dock-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.projectStore.projects[0].habits = [
      createHabit({ blockId: 'archived-1' }),
    ];
    mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-back-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.textContent).toContain('No archived habits');
    mounted.unmount();
  });

  it('reacts to data refresh events automatically', async () => {
    const mounted = mountDock();
    vi.mocked(mounted.projectStore.refresh).mockClear();

    eventBus.emit(Events.DATA_REFRESH);
    await nextTick();
    await nextTick();

    expect(mounted.projectStore.refresh).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });

  it('keeps the detail header outside the scrollable content region', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const detail = mounted.container.querySelector('.habit-detail');
    const header = mounted.container.querySelector('.habit-detail__header');
    const pane = mounted.container.querySelector('.habit-workspace-detail-pane');
    const content = mounted.container.querySelector('[data-testid="habit-detail-content"]');

    expect(detail).not.toBeNull();
    expect(header).not.toBeNull();
    expect(pane).not.toBeNull();
    expect(content).not.toBeNull();
    expect(pane?.parentElement).toBe(detail);
    expect(content?.parentElement).toBe(pane);
    expect(header?.parentElement).toBe(detail);
    mounted.unmount();
  });

  it('renders month calendar above stats cards and removes the today progress block in detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const content = mounted.container.querySelector('[data-testid="habit-detail-content"]');
    const calendar = mounted.container.querySelector('[data-testid="habit-month-calendar-stub"]');
    const stats = mounted.container.querySelector('[data-testid="habit-stats-stub"]');

    expect(mounted.container.querySelector('.habit-detail__today')).toBeNull();
    expect(content?.firstElementChild).toBe(calendar);
    expect(content?.children[1]).toBe(stats);

    mounted.unmount();
  });
});
