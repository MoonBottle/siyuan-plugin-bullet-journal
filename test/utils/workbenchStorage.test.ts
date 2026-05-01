import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_FILE,
  createEmptyWorkbenchSettings,
  loadWorkbenchSettings,
  saveWorkbenchSettings,
} from '@/utils/workbenchStorage';
import type { WorkbenchSettings } from '@/types/workbench';

function createMockPlugin(initialStored: string | object | null = null) {
  let stored = initialStored;

  return {
    saveData: async (key: string, content: string) => {
      if (key === WORKBENCH_FILE) {
        stored = content;
      }
    },
    loadData: async (key: string) => {
      if (key === WORKBENCH_FILE) {
        return stored;
      }
      return null;
    },
    _getStored: () => stored,
  };
}

describe('workbenchStorage', () => {
  it('loadWorkbenchSettings returns default settings when workbench.json is missing', async () => {
    const plugin = createMockPlugin(null) as any;

    const settings = await loadWorkbenchSettings(plugin);

    expect(settings).toEqual(createEmptyWorkbenchSettings());
  });

  it('saveWorkbenchSettings writes to workbench.json', async () => {
    const plugin = createMockPlugin(null) as any;
    const settings: WorkbenchSettings = {
      entries: [
        {
          id: 'view-calendar',
          type: 'view',
          title: 'Calendar',
          icon: 'iconCalendar',
          order: 1,
          viewType: 'calendar',
        },
      ],
      dashboards: [
        {
          id: 'dashboard-main',
          title: 'Main',
          widgets: [],
        },
      ],
      activeEntryId: 'view-calendar',
    };

    const saved = await saveWorkbenchSettings(plugin, settings);

    expect(saved).toBe(true);
    expect(plugin._getStored()).toBe(JSON.stringify(settings, null, 2));
  });
});
