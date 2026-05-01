import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  WorkbenchDashboard,
  WorkbenchEntry,
  WorkbenchSettings,
  WorkbenchViewType,
} from '@/types/workbench';
import {
  loadWorkbenchSettings,
  saveWorkbenchSettings,
} from '@/utils/workbenchStorage';

type WorkbenchPlugin = Parameters<typeof loadWorkbenchSettings>[0];

type ViewEntryDefinition = {
  title: string;
  icon: string;
};

const DASHBOARD_ICON = 'iconLayout';

const VIEW_ENTRY_DEFINITIONS: Record<WorkbenchViewType, ViewEntryDefinition> = {
  calendar: {
    title: 'Calendar',
    icon: 'iconCalendar',
  },
  gantt: {
    title: 'Gantt',
    icon: 'iconAlignCenter',
  },
  quadrant: {
    title: 'Quadrant',
    icon: 'iconGrid',
  },
  project: {
    title: 'Project',
    icon: 'iconFiles',
  },
  todo: {
    title: 'Todo',
    icon: 'iconList',
  },
  habit: {
    title: 'Habit',
    icon: 'iconCheck',
  },
  pomodoroStats: {
    title: 'Pomodoro Stats',
    icon: 'iconClock',
  },
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOrders(entries: WorkbenchEntry[]): WorkbenchEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    order: index,
  }));
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const entries = ref<WorkbenchEntry[]>([]);
  const dashboards = ref<WorkbenchDashboard[]>([]);
  const activeEntryId = ref<string | null>(null);
  const boundPlugin = ref<WorkbenchPlugin>(null);
  const saveState = ref<'idle' | 'saved' | 'error'>('idle');
  const saveError = ref<string | null>(null);

  const activeEntry = computed(() => {
    return entries.value.find(entry => entry.id === activeEntryId.value) ?? null;
  });

  function getSettingsSnapshot(): WorkbenchSettings {
    return {
      entries: entries.value,
      dashboards: dashboards.value,
      activeEntryId: activeEntryId.value,
    };
  }

  async function persist(): Promise<void> {
    if (!boundPlugin.value) {
      return;
    }

    try {
      const success = await saveWorkbenchSettings(boundPlugin.value, getSettingsSnapshot());
      if (!success) {
        saveState.value = 'error';
        saveError.value = 'Failed to save workbench settings';
        return;
      }

      saveState.value = 'saved';
      saveError.value = null;
    }
    catch (error) {
      saveState.value = 'error';
      saveError.value = error instanceof Error
        ? error.message
        : 'Failed to save workbench settings';
    }
  }

  function bindPlugin(plugin: WorkbenchPlugin): void {
    boundPlugin.value = plugin;
  }

  async function load(plugin: WorkbenchPlugin): Promise<void> {
    bindPlugin(plugin);
    const settings = await loadWorkbenchSettings(plugin);
    entries.value = normalizeOrders(settings.entries ?? []);
    dashboards.value = settings.dashboards ?? [];

    const hasActiveEntry = entries.value.some(entry => entry.id === settings.activeEntryId);
    activeEntryId.value = hasActiveEntry
      ? settings.activeEntryId
      : (entries.value[0]?.id ?? null);
  }

  async function createDashboardEntry(title: string): Promise<WorkbenchEntry> {
    const dashboardId = createId('dashboard');
    const dashboard: WorkbenchDashboard = {
      id: dashboardId,
      title,
      widgets: [],
    };
    const entry: WorkbenchEntry = {
      id: createId('entry'),
      type: 'dashboard',
      title,
      icon: DASHBOARD_ICON,
      order: entries.value.length,
      dashboardId,
    };

    dashboards.value = [...dashboards.value, dashboard];
    entries.value = [...entries.value, entry];
    activeEntryId.value = entry.id;
    await persist();
    return entry;
  }

  async function createViewEntry(viewType: WorkbenchViewType): Promise<WorkbenchEntry> {
    const definition = VIEW_ENTRY_DEFINITIONS[viewType];
    const entry: WorkbenchEntry = {
      id: createId('entry'),
      type: 'view',
      title: definition.title,
      icon: definition.icon,
      order: entries.value.length,
      viewType,
    };

    entries.value = [...entries.value, entry];
    activeEntryId.value = entry.id;
    await persist();
    return entry;
  }

  async function renameEntry(id: string, title: string): Promise<void> {
    const targetEntry = entries.value.find(entry => entry.id === id);
    if (!targetEntry) {
      return;
    }

    entries.value = entries.value.map(entry => (
      entry.id === id
        ? { ...entry, title }
        : entry
    ));

    if (targetEntry.type === 'dashboard' && targetEntry.dashboardId) {
      dashboards.value = dashboards.value.map(dashboard => (
        dashboard.id === targetEntry.dashboardId
          ? { ...dashboard, title }
          : dashboard
      ));
    }

    await persist();
  }

  async function deleteEntry(id: string): Promise<void> {
    const targetEntry = entries.value.find(entry => entry.id === id);
    if (!targetEntry) {
      return;
    }

    entries.value = normalizeOrders(entries.value.filter(entry => entry.id !== id));

    if (targetEntry.type === 'dashboard' && targetEntry.dashboardId) {
      dashboards.value = dashboards.value.filter(dashboard => dashboard.id !== targetEntry.dashboardId);
    }

    if (activeEntryId.value === id) {
      activeEntryId.value = entries.value[0]?.id ?? null;
    }
    else if (!entries.value.some(entry => entry.id === activeEntryId.value)) {
      activeEntryId.value = entries.value[0]?.id ?? null;
    }

    await persist();
  }

  async function setActiveEntry(id: string | null): Promise<void> {
    if (id !== null && !entries.value.some(entry => entry.id === id)) {
      return;
    }

    activeEntryId.value = id;
    await persist();
  }

  return {
    entries,
    dashboards,
    activeEntryId,
    activeEntry,
    saveState,
    saveError,
    bindPlugin,
    load,
    createDashboardEntry,
    createViewEntry,
    renameEntry,
    deleteEntry,
    setActiveEntry,
  };
});
