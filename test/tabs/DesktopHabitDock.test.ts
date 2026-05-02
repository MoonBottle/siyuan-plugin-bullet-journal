// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { eventBus, Events } from '@/utils/eventBus';

const {
  checkIn,
  checkInCount,
} = vi.hoisted(() => ({
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
}));

vi.mock('@/services/habitService', () => ({
  checkIn,
  checkInCount,
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
    props: ['habit'],
    emits: ['open-doc', 'open-calendar', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': `habit-list-item-${props.habit.blockId}` }, [
        h('button', {
          'data-testid': 'habit-list-item-main',
          onClick: () => emit('open-doc', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-calendar',
          onClick: () => emit('open-calendar', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-check-in',
          onClick: () => emit('check-in', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-increment',
          onClick: () => emit('increment', props.habit),
        }),
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
    vi.clearAllMocks();
    document.body.innerHTML = '';
    checkIn.mockResolvedValue(false);
    checkInCount.mockResolvedValue(false);
  });

  it('opening a list item document uses openDocumentAtLine', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
    mounted.unmount();
  });

  it('clicking the calendar action enters detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')?.textContent).toContain('喝水');
    mounted.unmount();
  });

  it('detail header open-doc action opens the selected habit document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-open-doc"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
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

    expect(checkIn).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'habit-1' }), '2026-05-02');
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

    expect(checkInCount).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'habit-1' }), '2026-05-02', 1);
    expect(mounted.projectStore.refresh).not.toHaveBeenCalled();

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

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const detail = mounted.container.querySelector('.habit-detail');
    const header = mounted.container.querySelector('.habit-detail__header');
    const content = mounted.container.querySelector('[data-testid="habit-detail-content"]');

    expect(detail).not.toBeNull();
    expect(header).not.toBeNull();
    expect(content).not.toBeNull();
    expect(content?.parentElement).toBe(detail);
    expect(header?.parentElement).toBe(detail);
    mounted.unmount();
  });

  it('renders month calendar above stats cards and removes the today progress block in detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
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
