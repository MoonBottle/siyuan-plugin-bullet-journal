import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit } from '@/types/models';

const {
  checkIn,
  checkInCount,
  openDocumentAtLine,
  calculateAllHabitStats,
  calculateHabitStats,
} = vi.hoisted(() => ({
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
  openDocumentAtLine: vi.fn(),
  calculateAllHabitStats: vi.fn((habits: Array<{ blockId: string }>) => {
    return new Map(habits.map(habit => [habit.blockId, {
      habitId: habit.blockId,
      monthlyCheckins: 1,
      totalCheckins: 2,
      weeklyCompletionRate: 1,
      monthlyCompletionRate: 1,
      currentStreak: 2,
      longestStreak: 3,
      isEnded: false,
    }]));
  }),
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

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({ debugInstanceId: 'plugin-1' })),
}));

vi.mock('@/services/habitService', () => ({
  checkIn,
  checkInCount,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine,
}));

vi.mock('@/utils/habitStatsUtils', () => ({
  calculateAllHabitStats,
  calculateHabitStats,
}));

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: 'Habit',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  };
}

describe('useHabitWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    checkIn.mockResolvedValue(false);
    checkInCount.mockResolvedValue(false);
  });

  it('filters habits by groupId and exposes computed habit state maps', async () => {
    const projectStore = useProjectStore();
    const settingsStore = useSettingsStore();
    settingsStore.scanMode = 'folder';
    settingsStore.directories = [];
    projectStore.currentDate = '2026-05-02';
    projectStore.projects = [
      {
        id: 'project-a',
        name: 'Project A',
        items: [],
        tasks: [],
        habits: [createHabit({ blockId: 'habit-a' })],
        links: [],
        groupId: 'group-a',
      } as any,
      {
        id: 'project-b',
        name: 'Project B',
        items: [],
        tasks: [],
        habits: [createHabit({ blockId: 'habit-b', docId: 'doc-2' })],
        links: [],
        groupId: 'group-b',
      } as any,
    ];

    const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
    const workspace = useHabitWorkspace({ groupId: 'group-a' });

    expect(workspace.currentDate.value).toBe('2026-05-02');
    expect(workspace.habits.value.map(habit => habit.blockId)).toEqual(['habit-a']);
    expect(workspace.habitStatsMap.value.get('habit-a')?.habitId).toBe('habit-a');
    expect(workspace.habitDayStateMap.value.get('habit-a')?.date).toBe(workspace.selectedDate.value);
    expect(workspace.habitPeriodStateMap.value.get('habit-a')).toBeDefined();
    expect(calculateAllHabitStats).toHaveBeenCalled();
  });

  it('filters archived habits out of the default workspace list', async () => {
    const projectStore = useProjectStore();
    const settingsStore = useSettingsStore();
    settingsStore.scanMode = 'folder';
    settingsStore.directories = [];
    projectStore.currentDate = '2026-05-04';
    projectStore.projects = [{
      id: 'project-a',
      name: 'Project A',
      items: [],
      tasks: [],
      habits: [
        createHabit({ blockId: 'active-1' }),
        createHabit({ blockId: 'archived-1', archivedAt: '2026-05-04' }),
      ],
      links: [],
      groupId: 'group-a',
    } as any];

    const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
    const workspace = useHabitWorkspace();

    expect(workspace.habits.value.map(habit => habit.blockId)).toEqual(['active-1']);
    expect(projectStore.habits.map(habit => habit.blockId)).toEqual(['active-1', 'archived-1']);
  });

  it('derives the selected habit from the latest store instance after refresh', async () => {
    const projectStore = useProjectStore();
    const settingsStore = useSettingsStore();
    settingsStore.scanMode = 'folder';
    settingsStore.directories = [];
    projectStore.currentDate = '2026-05-02';
    projectStore.refresh = vi.fn().mockResolvedValue(undefined) as any;
    projectStore.projects = [{
      id: 'project-a',
      name: 'Project A',
      items: [],
      tasks: [],
      habits: [createHabit({ blockId: 'habit-a', name: 'Before Refresh' })],
      links: [],
      groupId: 'group-a',
    } as any];

    const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
    const workspace = useHabitWorkspace();
    const originalHabit = workspace.habits.value[0];

    workspace.selectHabit(originalHabit);
    projectStore.projects = [{
      id: 'project-a',
      name: 'Project A',
      items: [],
      tasks: [],
      habits: [createHabit({ blockId: 'habit-a', name: 'After Refresh' })],
      links: [],
      groupId: 'group-a',
    } as any];

    await workspace.refreshHabits();

    expect(projectStore.refresh).toHaveBeenCalled();
    expect(workspace.selectedHabit.value).not.toBe(originalHabit);
    expect(workspace.selectedHabit.value?.name).toBe('After Refresh');
  });

  it('routes check-in, increment, and document-open actions through the shared helpers', async () => {
    const projectStore = useProjectStore();
    const settingsStore = useSettingsStore();
    settingsStore.scanMode = 'folder';
    settingsStore.directories = [];
    projectStore.currentDate = '2026-05-02';
    projectStore.projects = [{
      id: 'project-a',
      name: 'Project A',
      items: [],
      tasks: [],
      habits: [createHabit({ blockId: 'habit-a', type: 'count', target: 8, unit: 'cups' })],
      links: [],
      groupId: 'group-a',
    } as any];

    checkIn.mockResolvedValue(true);
    checkInCount.mockResolvedValue(true);

    const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
    const workspace = useHabitWorkspace();
    const habit = workspace.habits.value[0];
    const initialSelectedDate = workspace.selectedDate.value;

    await workspace.openHabitDoc(habit);
    await workspace.checkInHabit(habit);
    await workspace.incrementHabit(habit);

    workspace.selectHabit(habit);
    await workspace.openSelectedHabitDoc();

    expect(openDocumentAtLine).toHaveBeenNthCalledWith(1, 'doc-1', undefined, 'habit-a');
    expect(checkIn).toHaveBeenCalledWith(habit, initialSelectedDate);
    expect(checkInCount).toHaveBeenCalledWith(habit, initialSelectedDate, 1);
    expect(openDocumentAtLine).toHaveBeenNthCalledWith(2, 'doc-1', undefined, 'habit-a');
    expect(calculateHabitStats).toHaveBeenCalled();
  });
});
