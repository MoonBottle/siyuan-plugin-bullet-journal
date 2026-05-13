// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { defaultSettings } from '@/settings/types';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('siyuan', () => ({
  showMessage: vi.fn(),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
  Events: {
    SETTINGS_CHANGED: 'settings:changed',
    REFRESH_REQUEST_SUBMITTED: 'refresh:request-submitted',
  },
  createFullRefreshRequest: vi.fn((reason: string, payload?: Record<string, unknown>) => (
    payload === undefined ? { type: 'full', reason } : { type: 'full', reason, payload }
  )),
  submitRefreshRequest: vi.fn(),
}));

vi.mock('@/components/settings/DirectoryConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/GroupConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/PomodoroConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/CalendarConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/AiConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/McpConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/LunchBreakConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));
vi.mock('@/components/settings/SlashCommandConfigSection.vue', () => ({ default: { name: 'SectionStub', render: () => null } }));

import SettingsDialog from '@/components/settings/SettingsDialog.vue';

function mountSettingsDialog() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();
  const pluginSettings = {
    ...defaultSettings,
    habitCheckInTimePrecision: 'day' as const,
  };
  const plugin = {
    getSettings: vi.fn(() => pluginSettings),
    updateSettings: vi.fn((nextSettings) => {
      Object.assign(pluginSettings, nextSettings);
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  };
  const closeDialog = vi.fn();
  const app = createApp(SettingsDialog, {
    plugin,
    closeDialog,
  });
  app.use(pinia);
  app.mount(container);

  return {
    app,
    closeDialog,
    container,
    pinia,
    plugin,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('SettingsDialog habit precision persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', vi.fn(function () {
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('syncs saved habit precision back into the shared settings store', async () => {
    const mounted = mountSettingsDialog();
    const settingsStore = useSettingsStore(mounted.pinia);
    settingsStore.habitCheckInTimePrecision = 'day';

    mounted.container.querySelector<HTMLButtonElement>('.sy-select__trigger')?.click();
    await nextTick();
    document.querySelectorAll<HTMLElement>('.sy-select__option')[1]?.click();
    await nextTick();
    mounted.container.querySelector<HTMLButtonElement>('.b3-button--text')?.click();
    await nextTick();

    expect(mounted.plugin.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      habitCheckInTimePrecision: 'minute',
    }));
    expect(settingsStore.habitCheckInTimePrecision).toBe('minute');

    mounted.unmount();
  });
});
