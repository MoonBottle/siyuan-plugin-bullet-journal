import type { WorkbenchSettings } from '@/types/workbench';

export const WORKBENCH_FILE = 'workbench.json';

type WorkbenchPlugin = {
  loadData: (path: string) => Promise<unknown>;
  saveData: (path: string, data: string) => Promise<void>;
};

export function createEmptyWorkbenchSettings(): WorkbenchSettings {
  return {
    entries: [],
    dashboards: [],
    activeEntryId: null,
  };
}

function normalizeWorkbenchSettings(value: unknown): WorkbenchSettings {
  if (!value || typeof value !== 'object') {
    return createEmptyWorkbenchSettings();
  }

  const raw = value as Partial<WorkbenchSettings>;

  return {
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    dashboards: Array.isArray(raw.dashboards) ? raw.dashboards : [],
    activeEntryId: typeof raw.activeEntryId === 'string' ? raw.activeEntryId : null,
  };
}

export async function loadWorkbenchSettings(
  plugin: WorkbenchPlugin | null | undefined,
): Promise<WorkbenchSettings> {
  try {
    if (!plugin) {
      return createEmptyWorkbenchSettings();
    }

    const content = await plugin.loadData(WORKBENCH_FILE);
    if (!content) {
      return createEmptyWorkbenchSettings();
    }

    if (typeof content === 'object') {
      return normalizeWorkbenchSettings(content);
    }

    return normalizeWorkbenchSettings(JSON.parse(content as string));
  }
  catch (error) {
    console.error('[WorkbenchStorage] Failed to load workbench settings:', error);
    return createEmptyWorkbenchSettings();
  }
}

export async function saveWorkbenchSettings(
  plugin: WorkbenchPlugin | null | undefined,
  settings: WorkbenchSettings,
): Promise<boolean> {
  try {
    if (!plugin) {
      return false;
    }

    await plugin.saveData(WORKBENCH_FILE, JSON.stringify(settings, null, 2));
    return true;
  }
  catch (error) {
    console.error('[WorkbenchStorage] Failed to save workbench settings:', error);
    return false;
  }
}
