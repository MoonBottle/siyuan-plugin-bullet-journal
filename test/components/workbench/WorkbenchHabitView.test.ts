// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit } from '@/types/models';

const habitRecordLogProps = vi.fn();

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
  useApp: vi.fn(() => ({})),
}));

vi.mock('@/services/habitService', () => ({
  archiveHabit: vi.fn().mockResolvedValue(false),
  checkIn: vi.fn().mockResolvedValue(false),
  checkInCount: vi.fn().mockResolvedValue(false),
  unarchiveHabit: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/utils/habitStatsUtils', () => ({
  calculateAllHabitStats: vi.fn(() => new Map([
    ['habit-1', {
      habitId: 'habit-1',
      monthlyCheckins: 1,
      totalCheckins: 2,
      weeklyCompletionRate: 1,
      monthlyCompletionRate: 1,
      currentStreak: 2,
      longestStreak: 3,
      isEnded: false,
    }],
  ])),
  calculateHabitStats: vi.fn((habit: { blockId: string }) => ({
    habitId: habit.blockId,
    monthlyCheckins: 1,
    totalCheckins: 2,
    weeklyCompletionRate: 1,
    monthlyCompletionRate: 1,
    currentStreak: 2,
    longestStreak: 3,
    isEnded: false,
  })),
}));

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
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
    props: ['previewTriggerMode', 'onRecordPreviewClick'],
    setup(props) {
      habitRecordLogProps({
        previewTriggerMode: props.previewTriggerMode,
        onRecordPreviewClick: props.onRecordPreviewClick,
      });
      return () => h('div', { 'data-testid': 'habit-record-log-stub' });
    },
  }),
}));

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: vi.fn(),
    close: vi.fn(),
    containsTarget: vi.fn(() => false),
    isOpen: vi.fn(() => false),
  }),
}));

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['habit'],
    emits: ['open-detail', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('button', {
        'data-testid': `habit-list-item-${props.habit.blockId}`,
        onClick: () => emit('open-detail', props.habit),
      }, props.habit.name);
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

async function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  initI18n('en_US');

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
  projectStore.currentDate = '2026-05-02';
  projectStore.refresh = vi.fn().mockResolvedValue(undefined) as any;
  settingsStore.scanMode = 'folder';
  settingsStore.directories = [];

  const { default: WorkbenchHabitView } = await import('@/components/workbench/view/WorkbenchHabitView.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(WorkbenchHabitView);
  app.use(pinia);
  app.mount(container);
  await nextTick();

  return {
    container,
    projectStore,
    app,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('WorkbenchHabitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders empty detail state initially', async () => {
    const mounted = await mountView();

    expect(mounted.container.querySelector('[data-testid="workbench-habit-empty-detail"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-habit-detail-header"]')).toBeNull();

    mounted.unmount();
  });

  it('shows habit detail after selecting a habit from the left list', async () => {
    const mounted = await mountView();

    mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-habit-detail-header"]')?.textContent).toContain('喝水');
    expect(mounted.container.querySelector('[data-testid="habit-month-calendar-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-stats-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-record-log-stub"]')).not.toBeNull();
    expect(habitRecordLogProps).toHaveBeenCalledWith(expect.objectContaining({
      previewTriggerMode: 'preview',
      onRecordPreviewClick: expect.any(Function),
    }));

    mounted.unmount();
  });

  it('keeps the workbench habit layout in a two-column shell', async () => {
    const mounted = await mountView();
    const root = mounted.container.querySelector('[data-testid="workbench-habit-view"]');

    expect(root?.querySelector('.workbench-habit-view__sidebar')).not.toBeNull();
    expect(root?.querySelector('.workbench-habit-view__detail')).not.toBeNull();

    mounted.unmount();
  });

  it('enters the archived list from the sidebar header action', async () => {
    const mounted = await mountView();
    mounted.projectStore.projects = [{
      id: 'project-1',
      name: 'Project 1',
      items: [],
      habits: [
        createHabit({ blockId: 'habit-active', name: 'Active Habit' }),
        createHabit({ blockId: 'habit-archived', name: 'Archived Habit', archivedAt: '2026-05-01' }),
      ],
      links: [],
      groupId: '',
    } as any];
    await nextTick();

    mounted.container.querySelector('[data-testid="workbench-habit-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-habit-archived-header"]')).not.toBeNull();
    expect(mounted.container.textContent).toContain('Archived Habit');
    expect(mounted.container.textContent).not.toContain('Active Habit');

    mounted.unmount();
  });

  it('returns archived detail back to the archived list context', async () => {
    const mounted = await mountView();
    mounted.projectStore.projects = [{
      id: 'project-1',
      name: 'Project 1',
      items: [],
      habits: [
        createHabit({ blockId: 'habit-active', name: 'Active Habit' }),
        createHabit({ blockId: 'habit-archived', name: 'Archived Habit', archivedAt: '2026-05-01' }),
      ],
      links: [],
      groupId: '',
    } as any];
    await nextTick();

    mounted.container.querySelector('[data-testid="workbench-habit-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-habit-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-habit-selected-header"]')?.textContent).toContain('Archived Habit');

    mounted.container.querySelector('[data-testid="workbench-habit-back-to-list"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-habit-archived-header"]')).not.toBeNull();
    expect(mounted.container.textContent).toContain('Archived Habit');
    expect(mounted.container.textContent).not.toContain('Active Habit');
    expect(mounted.container.querySelector('[data-testid="workbench-habit-detail-header"]')).toBeNull();

    mounted.unmount();
  });

  it('renders archive action with tooltip in active habit detail', async () => {
    const mounted = await mountView();

    mounted.container.querySelector('[data-testid="habit-list-item-habit-1"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const archiveButton = mounted.container.querySelector('[data-testid="workbench-habit-detail-archive"]');
    const openDocButton = mounted.container.querySelector('[data-testid="workbench-habit-open-doc"]');
    const refreshButton = mounted.container.querySelector('[data-testid="workbench-habit-refresh-button"]');

    expect(archiveButton).not.toBeNull();
    expect(archiveButton?.className).toContain('b3-tooltips');
    expect(archiveButton?.getAttribute('aria-label')).toBe('Archive');
    expect(openDocButton?.className).toContain('b3-tooltips');
    expect(refreshButton?.className).toContain('b3-tooltips');

    mounted.unmount();
  });

  it('renders unarchive action with tooltip in archived habit detail', async () => {
    const mounted = await mountView();
    mounted.projectStore.projects = [{
      id: 'project-1',
      name: 'Project 1',
      items: [],
      habits: [
        createHabit({ blockId: 'habit-archived', name: 'Archived Habit', archivedAt: '2026-05-01' }),
      ],
      links: [],
      groupId: '',
    } as any];
    await nextTick();

    mounted.container.querySelector('[data-testid="workbench-habit-open-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-habit-archived"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const unarchiveButton = mounted.container.querySelector('[data-testid="workbench-habit-detail-unarchive"]');
    expect(unarchiveButton).not.toBeNull();
    expect(unarchiveButton?.className).toContain('b3-tooltips');
    expect(unarchiveButton?.getAttribute('aria-label')).toBe('Unarchive');

    mounted.unmount();
  });
});
