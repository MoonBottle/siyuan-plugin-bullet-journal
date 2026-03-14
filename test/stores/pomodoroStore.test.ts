/**
 * pomodoroStore 单元测试
 * TICK 事件发射、Getters、恢复逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// 提供 window 和 document（Node 环境无此全局，vitest fake timers 会替换 setInterval）
beforeAll(() => {
  if (typeof (global as any).window === 'undefined') {
    (global as any).window = global;
  }
  if (typeof (global as any).document === 'undefined') {
    (global as any).document = { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' };
  }
});
import { createPinia, setActivePinia } from 'pinia';
import { eventBus, Events } from '@/utils/eventBus';
import { loadActivePomodoro } from '@/utils/pomodoroStorage';
import { usePomodoroStore } from '@/stores/pomodoroStore';

// Mock dependencies
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({}))
}));

vi.mock('@/api', () => ({
  appendBlock: vi.fn(),
  setBlockAttrs: vi.fn(),
  getBlockAttrs: vi.fn()
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
  showConfirmDialog: vi.fn((_title, _msg, cb) => cb?.())
}));

vi.mock('@/utils/notification', () => ({
  showPomodoroCompleteNotification: vi.fn()
}));

vi.mock('@/utils/pomodoroStorage', () => ({
  saveActivePomodoro: vi.fn().mockResolvedValue(true),
  loadActivePomodoro: vi.fn().mockResolvedValue(null),
  removeActivePomodoro: vi.fn().mockResolvedValue(true),
  savePendingCompletion: vi.fn().mockResolvedValue(true),
  removePendingCompletion: vi.fn().mockResolvedValue(true),
  saveActiveBreak: vi.fn().mockResolvedValue(undefined),
  removeActiveBreak: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'settings') return { pomodoro: { breakEndMessage: '休息结束', breakLabel: '休息' } };
    return key;
  })
}));

vi.mock('@/settings', () => ({
  defaultPomodoroSettings: { recordMode: 'block', attrPrefix: 'custom-pomodoro' }
}));

const mockLoadActivePomodoro = vi.mocked(loadActivePomodoro);

describe('pomodoroStore Getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('remainingTime 倒计时模式返回 remainingSeconds', () => {
    const store = usePomodoroStore();
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 0,
        timerMode: 'countdown',
        targetDurationMinutes: 25
      } as any
    });
    expect(store.remainingTime).toBe(600);
  });

  it('elapsedSeconds 正计时模式返回 accumulatedSeconds', () => {
    const store = usePomodoroStore();
    store.$patch({
      activePomodoro: {
        remainingSeconds: 0,
        accumulatedSeconds: 300,
        timerMode: 'stopwatch',
        targetDurationMinutes: 25
      } as any
    });
    expect(store.elapsedSeconds).toBe(300);
  });

  it('isStopwatch timerMode=stopwatch 时 true', () => {
    const store = usePomodoroStore();
    store.$patch({
      activePomodoro: { timerMode: 'stopwatch' } as any
    });
    expect(store.isStopwatch).toBe(true);
  });

  it('isStopwatch timerMode=countdown 时 false', () => {
    const store = usePomodoroStore();
    store.$patch({
      activePomodoro: { timerMode: 'countdown' } as any
    });
    expect(store.isStopwatch).toBe(false);
  });

  it('remainingTime 无 activePomodoro 时返回 0', () => {
    const store = usePomodoroStore();
    store.$patch({ activePomodoro: null });
    expect(store.remainingTime).toBe(0);
  });

  it('elapsedSeconds 无 activePomodoro 时返回 0', () => {
    const store = usePomodoroStore();
    store.$patch({ activePomodoro: null });
    expect(store.elapsedSeconds).toBe(0);
  });
});

describe('pomodoroStore POMODORO_TICK', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    emitSpy = vi.spyOn(eventBus, 'emit');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updateTimer 在专注进行中时 emit POMODORO_TICK', () => {
    const store = usePomodoroStore();
    const now = Date.now();
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 900,
        isPaused: false,
        timerMode: 'countdown',
        targetDurationMinutes: 25
      } as any,
      timerStartTimestamp: now - 5000,
      lastAccumulatedSeconds: 895
    });

    store.updateTimer();

    expect(emitSpy).toHaveBeenCalledWith(
      Events.POMODORO_TICK,
      expect.objectContaining({
        remainingSeconds: expect.any(Number),
        accumulatedSeconds: expect.any(Number),
        isPaused: false,
        isStopwatch: false,
        targetDurationMinutes: 25
      })
    );
  });

  it('updateTimer 在暂停时不 emit POMODORO_TICK', () => {
    const store = usePomodoroStore();
    store.$patch({
      activePomodoro: {
        remainingSeconds: 600,
        accumulatedSeconds: 900,
        isPaused: true,
        timerMode: 'countdown',
        targetDurationMinutes: 25
      } as any,
      timerStartTimestamp: Date.now(),
      lastAccumulatedSeconds: 900
    });

    emitSpy.mockClear();
    store.updateTimer();

    expect(emitSpy).not.toHaveBeenCalledWith(Events.POMODORO_TICK, expect.anything());
  });
});

describe('pomodoroStore BREAK_TICK', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    emitSpy = vi.spyOn(eventBus, 'emit');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('startBreak 的 breakInterval 每秒 emit BREAK_TICK', async () => {
    const store = usePomodoroStore();
    await store.startBreak(5);

    emitSpy.mockClear();
    vi.advanceTimersByTime(1000);

    expect(emitSpy).toHaveBeenCalledWith(
      Events.BREAK_TICK,
      expect.objectContaining({
        remainingSeconds: expect.any(Number),
        totalSeconds: 300
      })
    );
  });

  it('restoreBreak 的 breakInterval 每秒 emit BREAK_TICK', () => {
    const store = usePomodoroStore();
    const mockPlugin = {};
    store.restoreBreak(mockPlugin as any, 120, 300);

    emitSpy.mockClear();
    vi.advanceTimersByTime(1000);

    expect(emitSpy).toHaveBeenCalledWith(
      Events.BREAK_TICK,
      expect.objectContaining({
        remainingSeconds: 119,
        totalSeconds: 300
      })
    );
  });
});

describe('pomodoroStore restorePomodoro', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restorePomodoro 未暂停时 startTimer', async () => {
    const store = usePomodoroStore();
    const now = Date.now();
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: now - 60000,
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: false,
      pauseCount: 0,
      totalPausedSeconds: 0,
      timerMode: 'countdown'
    } as any);

    await store.restorePomodoro({} as any);

    expect(store.timerInterval).not.toBeNull();
  });

  it('restorePomodoro 已暂停时不 startTimer', async () => {
    const store = usePomodoroStore();
    const now = Date.now();
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: now - 60000,
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: true,
      pauseCount: 1,
      totalPausedSeconds: 0,
      timerMode: 'countdown'
    } as any);

    await store.restorePomodoro({} as any);

    expect(store.timerInterval).toBeNull();
  });

  it('restorePomodoro 正确重算 accumulatedSeconds', async () => {
    const store = usePomodoroStore();
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    mockLoadActivePomodoro.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试',
      startTime: twoMinutesAgo,
      targetDurationMinutes: 25,
      accumulatedSeconds: 60,
      isPaused: false,
      pauseCount: 0,
      totalPausedSeconds: 0,
      timerMode: 'countdown'
    } as any);

    await store.restorePomodoro({} as any);

    expect(store.activePomodoro).not.toBeNull();
    expect(store.activePomodoro!.accumulatedSeconds).toBeGreaterThanOrEqual(170);
    expect(store.activePomodoro!.accumulatedSeconds).toBeLessThanOrEqual(185);
  });
});

describe('pomodoroStore restoreBreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restoreBreak 启动 breakInterval，breakRemainingSeconds 递减', () => {
    const store = usePomodoroStore();
    const mockPlugin = {};
    store.restoreBreak(mockPlugin as any, 120, 300);

    expect(store.breakInterval).not.toBeNull();
    expect(store.breakRemainingSeconds).toBe(120);

    vi.advanceTimersByTime(1000);
    expect(store.breakRemainingSeconds).toBe(119);

    vi.advanceTimersByTime(2000);
    expect(store.breakRemainingSeconds).toBe(117);
  });
});
