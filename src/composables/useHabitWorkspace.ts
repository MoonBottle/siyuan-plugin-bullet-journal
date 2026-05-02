import {
  computed,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { getHabitDayState, getHabitPeriodState } from '@/domain/habit/habitCompletion';
import { usePlugin } from '@/main';
import {
  checkIn,
  checkInCount,
} from '@/services/habitService';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit, HabitStats } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';
import dayjs from '@/utils/dayjs';
import {
  calculateAllHabitStats,
  calculateHabitStats,
} from '@/utils/habitStatsUtils';

type UseHabitWorkspaceOptions = {
  groupId?: MaybeRefOrGetter<string | undefined>;
};

export function useHabitWorkspace(options: UseHabitWorkspaceOptions = {}) {
  const plugin = usePlugin();
  const projectStore = useProjectStore();
  const settingsStore = useSettingsStore();

  const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
  const selectedViewMonth = ref(dayjs().format('YYYY-MM'));
  const selectedHabitId = ref<string | null>(null);
  const selectedStatsCache = ref<HabitStats | null>(null);

  const currentDate = computed(() => projectStore.currentDate);
  const groupId = computed(() => toValue(options.groupId) ?? '');
  const habits = computed(() => projectStore.getHabits(groupId.value));

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

    return habits.value.find(habit => habit.blockId === selectedHabitId.value) ?? null;
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

  function syncSelectedHabit() {
    if (!selectedHabitId.value) {
      return;
    }

    if (!habits.value.some(habit => habit.blockId === selectedHabitId.value)) {
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
    const habit = habits.value.find(item => item.blockId === habitId);
    if (!habit) {
      return false;
    }
    selectHabit(habit, date);
    return true;
  }

  function clearSelectedHabit() {
    selectedHabitId.value = null;
  }

  async function refreshHabits() {
    if (!plugin) {
      return;
    }
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    syncSelectedHabit();
  }

  async function checkInHabit(habit: Habit) {
    const success = await checkIn(habit, selectedDate.value);
    if (!success) {
      return;
    }

    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }
  }

  async function incrementHabit(habit: Habit) {
    const success = await checkInCount(habit, selectedDate.value, 1);
    if (!success) {
      return;
    }

    if (selectedHabit.value?.blockId === habit.blockId) {
      selectedStatsCache.value = calculateHabitStats(habit, currentDate.value, selectedViewMonth.value);
      syncSelectedHabit();
    }
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

  return {
    selectedDate,
    selectedViewMonth,
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
    checkInHabit,
    incrementHabit,
    openHabitDoc,
    openSelectedHabitDoc,
  };
}
