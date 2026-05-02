import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore, useSettingsStore } from '@/stores';

describe('useTodoViewState', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('applies widget preset as initial todo filter state', async () => {
    const settingsStore = useSettingsStore();
    const projectStore = useProjectStore();
    settingsStore.todoDock.selectedGroup = '';
    projectStore.currentDate = '2026-05-02';

    const { useTodoViewState } = await import('@/composables/useTodoViewState');
    const state = useTodoViewState({
      preset: {
        groupId: 'group-a',
        dateFilterType: 'today',
        priorities: ['high'],
      },
      persistToSettings: false,
    });

    expect(state.selectedGroup.value).toBe('group-a');
    expect(state.dateFilterType.value).toBe('today');
    expect(state.selectedPriorities.value).toEqual(['high']);
    expect(state.dateRange.value).toEqual({ start: '1970-01-01', end: '2026-05-02' });
  });

  it('does not overwrite widget preset when current state changes later', async () => {
    const projectStore = useProjectStore();
    projectStore.currentDate = '2026-05-02';

    const { useTodoViewState } = await import('@/composables/useTodoViewState');
    const preset = {
      groupId: 'group-a',
      dateFilterType: 'today' as const,
      priorities: ['high'] as const,
    };
    const state = useTodoViewState({
      preset,
      persistToSettings: false,
    });

    state.selectedGroup.value = 'group-b';
    state.selectedPriorities.value = ['low'];

    expect(preset).toEqual({
      groupId: 'group-a',
      dateFilterType: 'today',
      priorities: ['high'],
    });
  });
});
