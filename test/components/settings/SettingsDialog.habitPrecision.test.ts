// @vitest-environment happy-dom

import { createPinia } from 'pinia'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { defaultSettings } from '@/settings/types'

import { useSettingsStore } from '@/stores/settingsStore'

vi.mock('siyuan', () => ({
  showMessage: vi.fn(),
}))

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
  Events: {
    SETTINGS_CHANGED: 'settings:changed',
    REFRESH_REQUEST_SUBMITTED: 'refresh:request-submitted',
  },
}))

vi.mock('@/utils/refreshRequests', () => ({
  RefreshReasons: {
    SETTINGS_DIALOG_SAVE: 'settings-dialog:save',
  },
  createFullRefreshRequest: vi.fn((reason: string, payload?: Record<string, unknown>) => (
    payload === undefined
      ? {
          type: 'full',
          reason,
        }
      : {
          type: 'full',
          reason,
          payload,
        }
  )),
  submitRefreshRequest: vi.fn(),
}))

vi.mock('@/components/settings/DirectoryConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/GroupConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/PomodoroConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/CalendarConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/AiConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/McpConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/LunchBreakConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/SlashCommandConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/HabitConfigSection.vue', () => ({
  default: {
    name: 'HabitSectionStub',
    props: ['habitCheckInTimePrecision'],
    emits: ['update:habitCheckInTimePrecision'],
    template: '<div class="habit-stub" @click="$emit(\'update:habitCheckInTimePrecision\', \'minute\')"></div>',
  },
}))
vi.mock('@/components/settings/AiSkillConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))
vi.mock('@/components/settings/WebhookConfigSection.vue', () => ({
  default: {
    name: 'SectionStub',
    render: () => null,
  },
}))

function mountSettingsDialog() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const pinia = createPinia()
  const pluginSettings = {
    ...defaultSettings,
    habitCheckInTimePrecision: 'day' as const,
  }
  const plugin = {
    getSettings: vi.fn(() => pluginSettings),
    updateSettings: vi.fn((nextSettings) => {
      Object.assign(pluginSettings, nextSettings)
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  }
  const closeDialog = vi.fn()
  const app = createApp(SettingsDialog, {
    plugin,
    closeDialog,
  })
  app.use(pinia)
  app.mount(container)

  return {
    app,
    closeDialog,
    container,
    pinia,
    plugin,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('settingsDialog habit precision persistence', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('syncs saved habit precision back into the shared settings store', async () => {
    const mounted = mountSettingsDialog()
    const settingsStore = useSettingsStore(mounted.pinia)
    settingsStore.habitCheckInTimePrecision = 'day'

    const habitMenu = mounted.container.querySelectorAll('.sy-settings-menu-item')[4]
    habitMenu?.dispatchEvent(new Event('click'))
    await nextTick()

    const habitStub = mounted.container.querySelector('.habit-stub')
    habitStub?.dispatchEvent(new Event('click'))
    await nextTick()

    await new Promise((r) => setTimeout(r, 600))

    expect(settingsStore.habitCheckInTimePrecision).toBe('minute')
    expect(mounted.plugin.updateSettings).toHaveBeenCalled()

    mounted.unmount()
  })
})
