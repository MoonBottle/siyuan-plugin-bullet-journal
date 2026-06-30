import type { WorkbenchSettings } from '@/types/workbench'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  createEmptyWorkbenchSettings,
  loadWorkbenchSettings,
  saveWorkbenchSettings,
  WORKBENCH_FILE,
} from '@/utils/workbenchStorage'

function createMockPlugin(initialStored: string | object | null = null) {
  let stored = initialStored

  return {
    saveData: async (key: string, content: string) => {
      if (key === WORKBENCH_FILE) {
        stored = content
      }
    },
    loadData: async (key: string) => {
      if (key === WORKBENCH_FILE) {
        return stored
      }
      return null
    },
    _getStored: () => stored,
  }
}

describe('workbenchStorage', () => {
  it('loadWorkbenchSettings returns default settings when workbench.json is missing', async () => {
    const plugin = createMockPlugin(null) as any

    const settings = await loadWorkbenchSettings(plugin)

    expect(settings).toEqual(createEmptyWorkbenchSettings())
  })

  it('loadWorkbenchSettings normalizes invalid top-level fields', async () => {
    const plugin = createMockPlugin({
      entries: { broken: true },
      dashboards: 'invalid',
      activeEntryId: 123,
    }) as any

    const settings = await loadWorkbenchSettings(plugin)

    expect(settings).toEqual({
      entries: [],
      dashboards: [],
      activeEntryId: null,
      sidebarCollapsed: false,
    })
  })

  it('saveWorkbenchSettings writes to workbench.json', async () => {
    const plugin = createMockPlugin(null) as any
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
    }

    const saved = await saveWorkbenchSettings(plugin, settings)

    expect(saved).toBe(true)
    expect(plugin._getStored()).toBe(JSON.stringify(settings, null, 2))
  })

  it('loadWorkbenchSettings normalizes sidebarCollapsed field', async () => {
    const plugin = createMockPlugin({
      entries: [],
      dashboards: [],
      activeEntryId: null,
      sidebarCollapsed: true,
    }) as any

    const settings = await loadWorkbenchSettings(plugin)

    expect(settings.sidebarCollapsed).toBe(true)
  })

  it('loadWorkbenchSettings defaults sidebarCollapsed to false when missing', async () => {
    const plugin = createMockPlugin({
      entries: [],
      dashboards: [],
      activeEntryId: null,
    }) as any

    const settings = await loadWorkbenchSettings(plugin)

    expect(settings.sidebarCollapsed).toBe(false)
  })

  it('loadWorkbenchSettings defaults sidebarCollapsed to false for invalid type', async () => {
    const plugin = createMockPlugin({
      entries: [],
      dashboards: [],
      activeEntryId: null,
      sidebarCollapsed: 'yes',
    }) as any

    const settings = await loadWorkbenchSettings(plugin)

    expect(settings.sidebarCollapsed).toBe(false)
  })
})
