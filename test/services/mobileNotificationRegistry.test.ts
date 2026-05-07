import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMobileNotificationRegistry,
  loadMobileNotificationRegistry,
  removeMobileNotificationRegistryEntry,
  saveMobileNotificationRegistryEntry,
} from '@/services/mobileNotificationRegistry';

describe('mobileNotificationRegistry', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
    localStorage.clear();
  });

  it('persists entries keyed by entryKey', () => {
    const saved = saveMobileNotificationRegistryEntry({
      entryKey: 'task-1|2026-05-06|1000',
      notificationId: 15,
      scheduledAt: 1000,
      delayInSeconds: 60,
      planKey: 'plan-a',
      kind: 'reminder',
      status: 'scheduled',
      updatedAt: '2026-05-06T10:00:00.000Z',
    });

    const registry = loadMobileNotificationRegistry();

    expect(saved).toBe(true);
    expect(registry['task-1|2026-05-06|1000']?.notificationId).toBe(15);
  });

  it('drops malformed entries during load', () => {
    localStorage.setItem('task-assistant-mobile-notification-registry', JSON.stringify({
      good: {
        entryKey: 'good',
        notificationId: 18,
        scheduledAt: 1000,
        delayInSeconds: 60,
        planKey: 'plan',
        kind: 'habit',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      bad: {
        entryKey: '',
        notificationId: 'x',
      },
      fractionalDelay: {
        entryKey: 'fractional-delay',
        notificationId: 20,
        scheduledAt: 1000,
        delayInSeconds: 1.5,
        planKey: 'plan-delay',
        kind: 'reminder',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      negativeNotificationId: {
        entryKey: 'negative-notification',
        notificationId: -1,
        scheduledAt: 1000,
        delayInSeconds: 60,
        planKey: 'plan-negative',
        kind: 'habit',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      negativeScheduledAt: {
        entryKey: 'negative-scheduled-at',
        notificationId: 22,
        scheduledAt: -5,
        delayInSeconds: 60,
        planKey: 'plan-scheduled',
        kind: 'habit',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
    }));

    const registry = loadMobileNotificationRegistry();

    expect(Object.keys(registry)).toEqual(['good']);
    expect(localStorage.getItem('task-assistant-mobile-notification-registry')).toBe(JSON.stringify({
      good: {
        entryKey: 'good',
        notificationId: 18,
        scheduledAt: 1000,
        delayInSeconds: 60,
        planKey: 'plan',
        kind: 'habit',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
    }));
  });

  it('invalid save returns failure and does not persist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const saved = saveMobileNotificationRegistryEntry({
      entryKey: 'bad-save',
      notificationId: 3.2,
      scheduledAt: 1000,
      delayInSeconds: 60,
      planKey: 'bad-plan',
      kind: 'reminder',
      status: 'scheduled',
      updatedAt: '2026-05-06T10:00:00.000Z',
    });

    expect(saved).toBe(false);
    expect(loadMobileNotificationRegistry()).toEqual({});
    expect(localStorage.getItem('task-assistant-mobile-notification-registry')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('removes a single entry without touching others', () => {
    saveMobileNotificationRegistryEntry({
      entryKey: 'a',
      notificationId: 1,
      scheduledAt: 1,
      delayInSeconds: 1,
      planKey: 'a',
      kind: 'reminder',
      status: 'scheduled',
      updatedAt: 'x',
    });
    saveMobileNotificationRegistryEntry({
      entryKey: 'b',
      notificationId: 2,
      scheduledAt: 2,
      delayInSeconds: 2,
      planKey: 'b',
      kind: 'habit',
      status: 'scheduled',
      updatedAt: 'y',
    });

    removeMobileNotificationRegistryEntry('a');

    const registry = loadMobileNotificationRegistry();

    expect(registry.a).toBeUndefined();
    expect(registry.b?.notificationId).toBe(2);
  });

  it('clears the registry', () => {
    saveMobileNotificationRegistryEntry({
      entryKey: 'a',
      notificationId: 1,
      scheduledAt: 1,
      delayInSeconds: 1,
      planKey: 'a',
      kind: 'pomodoro-focus-end',
      status: 'scheduled',
      updatedAt: 'x',
    });

    clearMobileNotificationRegistry();

    expect(loadMobileNotificationRegistry()).toEqual({});
  });
});
