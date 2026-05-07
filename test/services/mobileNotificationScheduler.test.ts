import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileNotificationScheduler } from '@/services/mobileNotificationScheduler';
import type { Habit, Item } from '@/types/models';

const mockScheduleNativeNotification = vi.fn();
const mockCancelNativeNotification = vi.fn();

vi.mock('@/utils/notification', () => ({
  scheduleNativeNotification: (...args: unknown[]) => mockScheduleNativeNotification(...args),
  scheduleNativeNotificationWithDebug: async (...args: unknown[]) => {
    const result = await mockScheduleNativeNotification(...args);
    if (result === null || result === undefined) {
      return {
        notificationId: null,
        rawNotificationId: null,
        failureReason: 'exception',
      };
    }
    if (!Number.isInteger(result) || result < 0) {
      return {
        notificationId: null,
        rawNotificationId: Number(result),
        failureReason: 'invalid-id',
      };
    }
    return {
      notificationId: result,
      rawNotificationId: result,
      failureReason: null,
    };
  },
  cancelNativeNotification: (...args: unknown[]) => mockCancelNativeNotification(...args),
}));

let mockReminderTime = 0;
vi.mock('@/parser/reminderParser', () => ({
  calculateReminderTime: () => mockReminderTime,
}));

type RegistryEntry = {
  entryKey: string;
  notificationId: number;
  scheduledAt: number;
  delayInSeconds: number;
  planKey: string;
  kind: 'reminder' | 'habit' | 'pomodoro-focus-end' | 'pomodoro-break-end';
  status: 'scheduled' | 'canceled' | 'stale';
  updatedAt: string;
};

let registryState: Record<string, RegistryEntry> = {};
const mockSaveRegistryEntry = vi.fn((entry: RegistryEntry) => {
  registryState[entry.entryKey] = entry;
  return true;
});
const mockRemoveRegistryEntry = vi.fn((entryKey: string) => {
  delete registryState[entryKey];
});

vi.mock('@/services/mobileNotificationRegistry', () => ({
  loadMobileNotificationRegistry: () => ({ ...registryState }),
  saveMobileNotificationRegistryEntry: (entry: RegistryEntry) => mockSaveRegistryEntry(entry),
  removeMobileNotificationRegistryEntry: (entryKey: string) => mockRemoveRegistryEntry(entryKey),
}));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    content: 'Call client',
    date: '2026-05-07',
    status: 'pending',
    lineNumber: 1,
    docId: 'doc-1',
    blockId: 'block-1',
    reminder: {
      enabled: true,
      type: 'absolute',
      time: '10:00',
    },
    project: { id: 'project-1', name: 'Project A', path: '/', tasks: [] },
    task: { id: 'task-1', name: 'Task A', level: 'L1', items: [], lineNumber: 1 },
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    name: overrides.name,
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-01',
    records: [],
    frequency: { type: 'daily' },
    reminder: { enabled: true, type: 'absolute', time: '07:00' },
    ...overrides,
  };
}

function makeStore(items: Item[] = [], habits: Habit[] = []) {
  return {
    currentDate: '2026-05-07',
    projects: [{ tasks: [{ items }] }],
    getHabits: () => habits,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('MobileNotificationScheduler', () => {
  let scheduler: MobileNotificationScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T06:00:00'));
    scheduler = new MobileNotificationScheduler();
    registryState = {};
    mockReminderTime = 0;
    mockScheduleNativeNotification.mockReset();
    mockCancelNativeNotification.mockReset();
    mockSaveRegistryEntry.mockClear();
    mockRemoveRegistryEntry.mockClear();
    vi.unstubAllGlobals();
  });

  it('creates reservations for future item reminders', async () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    mockScheduleNativeNotification.mockResolvedValueOnce(101);

    await scheduler.scheduleSync(makeStore([makeItem()]) as any);

    expect(mockScheduleNativeNotification).toHaveBeenCalledWith(
      expect.stringContaining('⏰'),
      expect.stringContaining('Call client'),
      20 * 60,
      expect.objectContaining({ tag: expect.stringContaining('reminder-block-1') }),
    );
    expect(mockSaveRegistryEntry).toHaveBeenCalledWith(expect.objectContaining({
      notificationId: 101,
      kind: 'reminder',
      status: 'scheduled',
    }));
  });

  it('skips unchanged plans even after time advances', async () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    mockScheduleNativeNotification.mockResolvedValueOnce(101);
    const store = makeStore([makeItem()]) as any;

    await scheduler.scheduleSync(store);

    expect(mockSaveRegistryEntry).toHaveBeenLastCalledWith(expect.objectContaining({
      planKey: JSON.stringify({
        kind: 'reminder',
        scheduledAt: mockReminderTime,
        title: '⏰ Project A',
        body: 'Task A: Call client',
        tag: 'reminder-block-1',
      }),
      delayInSeconds: 20 * 60,
    }));

    mockScheduleNativeNotification.mockClear();
    vi.setSystemTime(new Date('2026-05-07T06:05:00'));

    await scheduler.scheduleSync(store);

    expect(mockScheduleNativeNotification).not.toHaveBeenCalled();
    expect(mockCancelNativeNotification).not.toHaveBeenCalled();
  });

  it('cancels stale reservations when source item disappears', async () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    registryState = {
      'reminder:block-1:2026-05-07': {
        entryKey: 'reminder:block-1:2026-05-07',
        notificationId: 101,
        scheduledAt: mockReminderTime,
        delayInSeconds: 20 * 60,
        planKey: JSON.stringify({
          kind: 'reminder',
          scheduledAt: mockReminderTime,
          title: '⏰ Project A',
          body: 'Task A: Call client',
          tag: 'reminder-block-1',
        }),
        kind: 'reminder',
        status: 'scheduled',
        updatedAt: '2026-05-07T06:00:00.000Z',
      },
    };

    await scheduler.scheduleSync(makeStore([]) as any);

    expect(mockCancelNativeNotification).toHaveBeenCalledWith(101);
    expect(mockRemoveRegistryEntry).toHaveBeenCalledWith('reminder:block-1:2026-05-07');
  });

  it('schedules habit reminders', async () => {
    mockScheduleNativeNotification.mockResolvedValueOnce(301);

    await scheduler.syncFromProjects(makeStore([], [
      makeHabit({ name: 'Meditate' }),
    ]) as any);

    expect(mockScheduleNativeNotification).toHaveBeenCalledWith(
      expect.stringContaining('🎯'),
      expect.stringContaining('Meditate'),
      expect.any(Number),
      expect.objectContaining({ tag: 'habit-reminder-habit-1' }),
    );
    expect(mockSaveRegistryEntry).toHaveBeenCalledWith(expect.objectContaining({
      notificationId: 301,
      kind: 'habit',
    }));
  });

  it('preserves existing pomodoro registry entries during reminder sync cleanup', async () => {
    registryState = {
      'pomodoro:focus-end': {
        entryKey: 'pomodoro:focus-end',
        notificationId: 777,
        scheduledAt: new Date('2026-05-07T06:25:00').getTime(),
        delayInSeconds: 25 * 60,
        planKey: JSON.stringify({
          kind: 'pomodoro-focus-end',
          scheduledAt: new Date('2026-05-07T06:25:00').getTime(),
          title: '🍅 专注结束',
          body: '「Write tests」专注时间已结束',
          tag: 'pomodoro-focus-end',
        }),
        kind: 'pomodoro-focus-end',
        status: 'scheduled',
        updatedAt: '2026-05-07T06:00:00.000Z',
      },
    };

    await scheduler.scheduleSync(makeStore([]) as any);

    expect(mockCancelNativeNotification).not.toHaveBeenCalledWith(777);
    expect(mockRemoveRegistryEntry).not.toHaveBeenCalledWith('pomodoro:focus-end');
    expect(registryState['pomodoro:focus-end']?.notificationId).toBe(777);
  });

  it('serializes repeated sync requests while scheduling is still in flight', async () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    const deferred = createDeferred<number | null>();
    mockScheduleNativeNotification.mockReturnValue(deferred.promise);
    const store = makeStore([makeItem()]) as any;

    const first = scheduler.scheduleSync(store);
    const second = scheduler.scheduleSync(store);
    const third = scheduler.scheduleSync(store);

    expect(mockScheduleNativeNotification).toHaveBeenCalledTimes(1);

    deferred.resolve(101);
    await Promise.all([first, second, third]);

    expect(mockScheduleNativeNotification).toHaveBeenCalledTimes(1);
  });

  it('reconciles currentDate on mobile day rollover before scheduling habits', async () => {
    mockScheduleNativeNotification.mockResolvedValueOnce(301);
    const store = makeStore([], [
      makeHabit({ name: 'Meditate' }),
    ]) as any;
    store.currentDate = '2026-05-06';

    await scheduler.scheduleSync(store);

    expect(store.currentDate).toBe('2026-05-07');
    expect(mockScheduleNativeNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      60 * 60,
      expect.objectContaining({ tag: 'habit-reminder-habit-1' }),
    );
  });

  it('reschedules on visibility change when the page becomes visible', async () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    mockScheduleNativeNotification.mockResolvedValueOnce(101);
    const store = makeStore([makeItem()]) as any;
    let visibilityHandler: (() => void) | null = null;

    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'visibilitychange') {
          visibilityHandler = handler;
        }
      }),
      removeEventListener: vi.fn(),
    });

    scheduler.attachRuntime(store);
    expect(visibilityHandler).toBeTypeOf('function');

    (document as any).visibilityState = 'visible';
    visibilityHandler?.();
    await Promise.resolve();

    expect(mockScheduleNativeNotification).toHaveBeenCalledTimes(1);
  });

  it('keeps the old reservation when replacement scheduling fails', async () => {
    mockReminderTime = new Date('2026-05-07T06:30:00').getTime();
    registryState = {
      'reminder:block-1:2026-05-07': {
        entryKey: 'reminder:block-1:2026-05-07',
        notificationId: 101,
        scheduledAt: new Date('2026-05-07T06:20:00').getTime(),
        delayInSeconds: 20 * 60,
        planKey: JSON.stringify({
          kind: 'reminder',
          scheduledAt: new Date('2026-05-07T06:20:00').getTime(),
          title: '⏰ Project A',
          body: 'Task A: Call client',
          tag: 'reminder-block-1',
        }),
        kind: 'reminder',
        status: 'scheduled',
        updatedAt: '2026-05-07T06:00:00.000Z',
      },
    };
    mockScheduleNativeNotification.mockResolvedValueOnce(null);

    await scheduler.scheduleSync(makeStore([makeItem()]) as any);

    expect(mockCancelNativeNotification).not.toHaveBeenCalled();
    expect(mockRemoveRegistryEntry).not.toHaveBeenCalled();
    expect(registryState['reminder:block-1:2026-05-07']?.notificationId).toBe(101);
  });

  it('records debug failure details when native scheduling returns an invalid id', async () => {
    mockReminderTime = new Date('2026-05-07T06:00:32').getTime();
    mockScheduleNativeNotification.mockResolvedValueOnce(-1);
    const store = makeStore([makeItem()]) as any;

    await scheduler.scheduleSync(store);

    const snapshot = scheduler.getDebugSnapshot(store);
    expect(snapshot.computedEntries).toEqual([
      expect.objectContaining({
        entryKey: 'reminder:block-1:2026-05-07',
        registryNotificationId: null,
        registryStatus: null,
        lastScheduleResult: 'invalid-id',
        lastNativeNotificationId: -1,
      }),
    ]);
  });

  it('reschedules focus-end when the expected end time changes', async () => {
    const firstEnd = new Date('2026-05-07T06:25:00').getTime();
    const secondEnd = new Date('2026-05-07T06:30:00').getTime();
    mockScheduleNativeNotification
      .mockResolvedValueOnce(501)
      .mockResolvedValueOnce(502);

    await scheduler.schedulePomodoroFocusEnd({
      expectedEndAt: firstEnd,
      itemContent: 'Write tests',
      plugin: { isMobile: true },
    });

    mockCancelNativeNotification.mockClear();
    mockRemoveRegistryEntry.mockClear();

    await scheduler.schedulePomodoroFocusEnd({
      expectedEndAt: secondEnd,
      itemContent: 'Write tests',
      plugin: { isMobile: true },
    });

    expect(mockScheduleNativeNotification).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringContaining('Write tests'),
      30 * 60,
      expect.objectContaining({ tag: 'pomodoro-focus-end' }),
    );
    expect(mockCancelNativeNotification).toHaveBeenCalledWith(501);
    expect(mockRemoveRegistryEntry).toHaveBeenCalledWith('pomodoro:focus-end');
    expect(registryState['pomodoro:focus-end']).toEqual(expect.objectContaining({
      notificationId: 502,
      scheduledAt: secondEnd,
      kind: 'pomodoro-focus-end',
    }));
  });

  it('cancels and cleans up break-end reservations', async () => {
    const breakEndAt = new Date('2026-05-07T06:10:00').getTime();
    mockScheduleNativeNotification.mockResolvedValueOnce(601);

    await scheduler.schedulePomodoroBreakEnd({
      expectedEndAt: breakEndAt,
      breakLabel: '休息',
      plugin: { isMobile: true },
    });

    expect(registryState['pomodoro:break-end']).toEqual(expect.objectContaining({
      notificationId: 601,
      kind: 'pomodoro-break-end',
    }));

    scheduler.cancelPomodoroBreakEnd();

    expect(mockCancelNativeNotification).toHaveBeenCalledWith(601);
    expect(mockRemoveRegistryEntry).toHaveBeenCalledWith('pomodoro:break-end');
    expect(registryState['pomodoro:break-end']).toBeUndefined();
  });

  it('builds a debug snapshot with computed plans and registry metadata', () => {
    mockReminderTime = new Date('2026-05-07T06:20:00').getTime();
    registryState = {
      'reminder:block-1:2026-05-07': {
        entryKey: 'reminder:block-1:2026-05-07',
        notificationId: 101,
        scheduledAt: mockReminderTime,
        delayInSeconds: 20 * 60,
        planKey: 'plan-1',
        kind: 'reminder',
        status: 'scheduled',
        updatedAt: '2026-05-07T06:00:00.000Z',
      },
      'pomodoro:focus-end': {
        entryKey: 'pomodoro:focus-end',
        notificationId: 777,
        scheduledAt: new Date('2026-05-07T06:25:00').getTime(),
        delayInSeconds: 25 * 60,
        planKey: 'pomodoro-plan',
        kind: 'pomodoro-focus-end',
        status: 'scheduled',
        updatedAt: '2026-05-07T06:00:00.000Z',
      },
    };

    const snapshot = scheduler.getDebugSnapshot(makeStore([makeItem()]) as any);

    expect(snapshot.currentDate).toBe('2026-05-07');
    expect(snapshot.computedEntries).toEqual([
      expect.objectContaining({
        entryKey: 'reminder:block-1:2026-05-07',
        kind: 'reminder',
        title: '⏰ Project A',
        body: 'Task A: Call client',
        registryNotificationId: 101,
        registryStatus: 'scheduled',
        lastScheduleResult: 'scheduled',
        lastNativeNotificationId: 101,
      }),
    ]);
    expect(snapshot.registryEntries).toEqual([
      expect.objectContaining({
        entryKey: 'pomodoro:focus-end',
        kind: 'pomodoro-focus-end',
        notificationId: 777,
      }),
    ]);
  });
});
