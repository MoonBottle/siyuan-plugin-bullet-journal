import {
  computed,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import {
  archiveHabit,
  checkIn,
  checkInCount,
  unarchiveHabit,
} from '@/services/habitService';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit, HabitStats } from '@/types/models';
import { showMessage } from '@/utils/dialog';
import { broadcastDataRefresh, eventBus, Events } from '@/utils/eventBus';
import { openDocumentAtLine } from '@/utils/fileUtils';
import dayjs from '@/utils/dayjs';
import {
  calculateAllHabitStats,
  calculateHabitStats,
} from '@/utils/habitStatsUtils';

type UseHabitWorkspaceOptions = {
  groupId?: MaybeRefOrGetter<string | undefined>;
  defaultListMode?: MaybeRefOrGetter<'active' | 'archived' | undefined>;
};

type HabitListMode = 'active' | 'archived';

export function useHabitWorkspace(options: UseHabitWorkspaceOptions = {}) {
  const plugin = usePlugin();
  const projectStore = useProjectStore();
  const settingsStore = useSettingsStore();

  const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
  const selectedViewMonth = ref(dayjs().format('YYYY-MM'));
  const selectedHabitId = ref<string | null>(null);
  const selectedStatsCache = ref<HabitStats | null>(null);
  const listMode = ref<HabitListMode>('active');

  const currentDate = computed(() => projectStore.currentDate);
  const groupId = computed(() => toValue(options.groupId) ?? '');
  const resolvedDefaultListMode = computed<HabitListMode>(() => toValue(options.defaultListMode) ?? 'active');
  const allHabits = computed(() => projectStore.getHabits(groupId.value));
  const habits = computed(() => {
    if (listMode.value === 'archived') {
      return allHabits.value.filter(habit => Boolean(habit.archivedAt));
    }

    return allHabits.value.filter(habit => !habit.archivedAt);
  });

  const habitStatsMap = computed(() => {
    return calculateAllHabitStats(habits.value, currentDate.value);
  });

  const habitDayStateMap = computed(() => {
    return new Map(habits.value.map(habit => [habit.blockId, getHabitDayState(habit, selectedDate.value)]));
  });

  const habitPeriodStateMap = computed(() => {
    return new Map(habits.value.map(habit => [habit.blockId, getHabitPeriodState(habit, selectedDate.value)]));
  });

  const selectedHabit = computed(() => {
    if (!selectedHabitId.value) {
      return null;
    }

    return allHabits.value.find(habit => habit.blockId === selectedHabitId.value) ?? null;
  });

  const selectedStats = computed(() => {
    if (!selectedHabit.value) {
      return null;
    }
    return calculateHabitStats(selectedHabit.value, currentDate.value, selectedViewMonth.value);
  });

  const displaySelectedStats = computed(() => selectedStats.value ?? selectedStatsCache.value);

  watch(selectedStats, (value) => {
    if (value) {
      selectedStatsCache.value = value;
    }
  }, { immediate: true });

  watch(resolvedDefaultListMode, (value) => {
    listMode.value = value;
  }, { immediate: true });

  function syncSelectedHabit() {
    if (!selectedHabitId.value) {
      return;
    }

    if (!allHabits.value.some(habit => habit.blockId === selectedHabitId.value)) {
      selectedHabitId.value = null;
    }
  }

  function selectHabit(habit: Habit, date: string = currentDate.value) {
    selectedDate.value = date;
    selectedViewMonth.value = date.substring(0, 7);
    selectedHabitId.value = habit.blockId;
    selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
  }

  function selectHabitById(habitId: string, date: string = currentDate.value): boolean {
    const habit = allHabits.value.find(item => item.blockId === habitId);
    if (!habit) {
      return false;
    }
    selectHabit(habit, date);
    return true;
  }

  function clearSelectedHabit() {
    selectedHabitId.value = null;
  }

  function showArchivedHabits() {
    listMode.value = 'archived';
  }

  function showActiveHabits() {
    listMode.value = 'active';
  }

  function resetListMode() {
    listMode.value = resolvedDefaultListMode.value;
  }

  async function refreshHabits() {
    if (!plugin) {
      return;
    }
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    syncSelectedHabit();
  }

  function isHabitArchived(habit: Habit) {
    return Boolean(habit.archivedAt);
  }

  async function checkInHabit(habit: Habit) {
    if (isHabitArchived(habit)) {
      showMessage(t('habit.archivedCannotCheckIn'));
      return false;
    }

    const success = await checkIn(habit, selectedDate.value);
    if (!success) {
      return false;
    }

    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }

    return true;
  }

  async function incrementHabit(habit: Habit) {
    if (isHabitArchived(habit)) {
      showMessage(t('habit.archivedCannotCheckIn'));
      return false;
    }

    const success = await checkInCount(habit, selectedDate.value, 1);
    if (!success) {
      return false;
    }

    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }

    return true;
  }

  async function openHabitDoc(habit: Habit) {
    if (!habit.docId) {
      return;
    }
    await openDocumentAtLine(habit.docId, undefined, habit.blockId);
  }

  async function openSelectedHabitDoc() {
    if (!selectedHabit.value) {
      return;
    }
    await openHabitDoc(selectedHabit.value);
  }

  async function archiveSelectedHabit() {
    if (!selectedHabit.value || selectedHabit.value.archivedAt) {
      return false;
    }

    const success = await archiveHabit(selectedHabit.value, dayjs().format('YYYY-MM-DD'));
    if (success) {
      eventBus.emit(Events.DATA_REFRESH);
      broadcastDataRefresh();
    }
    return success;
  }

  async function unarchiveSelectedHabit() {
    if (!selectedHabit.value || !selectedHabit.value.archivedAt) {
      return false;
    }

    const success = await unarchiveHabit(selectedHabit.value);
    if (success) {
      eventBus.emit(Events.DATA_REFRESH);
      broadcastDataRefresh();
    }
    return success;
  }

  return {
    selectedDate,
    selectedViewMonth,
    listMode,
    selectedHabit,
    currentDate,
    habits,
    habitStatsMap,
    habitDayStateMap,
    habitPeriodStateMap,
    selectedStats,
    displaySelectedStats,
    refreshHabits,
    syncSelectedHabit,
    selectHabit,
    selectHabitById,
    clearSelectedHabit,
    showArchivedHabits,
    showActiveHabits,
    resetListMode,
    checkInHabit,
    incrementHabit,
    openHabitDoc,
    openSelectedHabitDoc,
    archiveSelectedHabit,
    unarchiveSelectedHabit,
  };
}
