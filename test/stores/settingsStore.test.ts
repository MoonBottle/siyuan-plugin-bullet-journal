import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '@/stores/settingsStore';

const {
  getSettings,
  updateSettings,
} = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({
    getSettings,
    updateSettings,
  })),
}));

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loadFromPlugin loads habitCheckInTimePrecision from plugin settings', () => {
    getSettings.mockReturnValue({
      habitCheckInTimePrecision: 'second',
    });

    const store = useSettingsStore();
    store.loadFromPlugin();

    expect(store.habitCheckInTimePrecision).toBe('second');
  });

  it('loadFromPlugin falls back to day when persisted habitCheckInTimePrecision is invalid', () => {
    getSettings.mockReturnValue({
      habitCheckInTimePrecision: 'hour',
    });

    const store = useSettingsStore();
    store.loadFromPlugin();

    expect(store.habitCheckInTimePrecision).toBe('day');
  });

  it('saveToPlugin persists habitCheckInTimePrecision through updateSettings', () => {
    getSettings.mockReturnValue({});

    const store = useSettingsStore();
    store.habitCheckInTimePrecision = 'minute';
    store.saveToPlugin();

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      habitCheckInTimePrecision: 'minute',
    }));
  });
});
