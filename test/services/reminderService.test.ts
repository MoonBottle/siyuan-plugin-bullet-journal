/**
 * 提醒服务测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderService } from '@/services/reminderService';
import type { Habit, Item } from '@/types/models';

// Mock notification utils
const mockShowSystemNotification = vi.fn();
vi.mock('@/utils/notification', () => ({
  showSystemNotification: (...args: unknown[]) => mockShowSystemNotification(...args),
}));

// Mock calculateReminderTime to return controlled values
let mockReminderTime = 0;
vi.mock('@/parser/reminderParser', () => ({
  calculateReminderTime: () => mockReminderTime,
}));

// Mock croner - 必须用 class 才能用 new
vi.mock('croner', () => {
  return {
    Cron: class MockCron {
      stop = vi.fn();
      _callback: any;
      constructor(_date: any, callback: any) {
        this._callback = callback;
      }
    },
  };
});

// Mock window.Notification
const mockNotificationRequestPermission = vi.fn();

beforeEach(() => {
  (globalThis as any).window = globalThis;
  vi.stubGlobal('Notification', vi.fn().mockImplementation(() => ({})));
  (globalThis.Notification as any).permission = 'default';
  (globalThis.Notification as any).requestPermission = mockNotificationRequestPermission;
  mockReminderTime = 0;
  vi.useFakeTimers();
});

describe('ReminderService', () => {
  let service: ReminderService;

  beforeEach(() => {
    service = new ReminderService();
    mockShowSystemNotification.mockClear();
    mockNotificationRequestPermission.mockClear();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  function mkHabit(overrides: Partial<Habit> & { name: string }): Habit {
    return {
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      records: [],
      frequency: { type: 'daily' },
      ...overrides,
    };
  }

  function makeStore(items: Item | Item[] = [], habits: Habit[] = []) {
    return {
      currentDate: '2026-04-07',
      getHabits: () => habits,
      projects: [{ tasks: [{ items: Array.isArray(items) ? items : [items] }] }],
    };
  }

  describe('start / stop lifecycle', () => {
    it('启动时应该请求通知权限', () => {
      const projectStore = makeStore([], []);
      service.start({} as any, projectStore as any);
      expect(mockNotificationRequestPermission).toHaveBeenCalled();
    });

    it('启动和停止后应清理所有 job', () => {
      vi.setSystemTime(new Date('2026-04-07T06:00:00'));
      const projectStore = makeStore([], [
        mkHabit({ name: '冥想', reminder: { type: 'absolute', time: '07:00' } }),
      ]);
      service.start({} as any, projectStore as any);
      service.stop();
      expect((service as any).scheduledJobs.size).toBe(0);
      expect((service as any).habitScheduledJobs.size).toBe(0);
    });
  });

  describe('rebuildSchedule', () => {
    it('到达提醒时间应该触发通知', () => {
      mockReminderTime = Date.now() - 5000; // 5 秒前，已过期

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
        project: { name: '项目A' }, task: { name: '任务A' },
      };

      service.start({} as any, makeStore(item) as any);

      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1);
      const [title, body] = mockShowSystemNotification.mock.calls[0];
      expect(title).toContain('⏰');
      expect(body).toContain('周会');
    });

    it('同一事项不应重复通知', () => {
      mockReminderTime = Date.now() - 5000;

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      service.start({} as any, makeStore(item) as any);
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1);

      // 第二次 rebuild（同一 blockId + date，已被 notifiedKeys 覆盖）
      (service as any).rebuildSchedule();
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1); // 不增加
    });

    it('未到提醒时间不应触发通知', () => {
      mockReminderTime = Date.now() + 60 * 60 * 1000; // 未来 1 小时

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '10:00' },
      };

      service.start({} as any, makeStore(item) as any);

      expect(mockShowSystemNotification).not.toHaveBeenCalled();
      // 但应创建一个 scheduled job
      expect((service as any).scheduledJobs.size).toBe(1);
    });

    it('已完成/已放弃的事项不应触发通知', () => {
      mockReminderTime = Date.now() - 5000;

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'completed',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      service.start({} as any, makeStore(item) as any);
      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('无 projectStore 时不应崩溃', () => {
      service.start({} as any, null as any);
      (service as any).rebuildSchedule();
      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('不同日期的同一事项应该分别通知', () => {
      mockReminderTime = Date.now() - 5000;

      const item1: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      const item2: Item = {
        id: '1', content: '周会', date: '2026-03-18', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      service.start({} as any, makeStore([item1, item2]) as any);
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(2);
    });

    it('超过宽容窗口（5分钟）的过期提醒不应触发通知', () => {
      mockReminderTime = Date.now() - 10 * 60 * 1000; // 10 分钟前，超过宽容窗口

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      service.start({} as any, makeStore(item) as any);

      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('在宽容窗口内（5分钟）的过期提醒应触发通知', () => {
      mockReminderTime = Date.now() - 3 * 60 * 1000; // 3 分钟前，在宽容窗口内

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      service.start({} as any, makeStore(item) as any);

      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1);
    });

    it('删除的事项应停止对应的 Cron job', () => {
      mockReminderTime = Date.now() + 60 * 60 * 1000;

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '10:00' },
      };

      const store = makeStore(item);
      service.start({} as any, store as any);
      expect((service as any).scheduledJobs.size).toBe(1);

      // key format: blockId-date-reminderTime
      const expectedKey = `block-123-2026-03-17-${mockReminderTime}`;
      const job = (service as any).scheduledJobs.get(expectedKey);
      expect(job).toBeDefined();

      // 清空事项列表，rebuild 后旧 job 应被停止
      store.projects[0].tasks[0].items = [];
      (service as any).rebuildSchedule();

      expect(job.stop).toHaveBeenCalled();
      expect((service as any).scheduledJobs.size).toBe(0);
    });

    it('未来习惯提醒应创建独立的 Cron job', () => {
      vi.setSystemTime(new Date('2026-04-07T06:00:00'));
      const habit = mkHabit({
        name: '冥想',
        reminder: { type: 'absolute', time: '07:00' },
      });

      service.start({} as any, makeStore([], [habit]) as any);

      expect((service as any).habitScheduledJobs.size).toBe(1);
    });

    it('习惯提醒在宽容窗口内应立即补发', () => {
      vi.setSystemTime(new Date('2026-04-07T07:03:00'));
      const habit = mkHabit({
        name: '冥想',
        reminder: { type: 'absolute', time: '07:00' },
      });

      service.start({} as any, makeStore([], [habit]) as any);

      expect(mockShowSystemNotification).toHaveBeenCalledWith(
        expect.stringContaining('🎯'),
        expect.stringContaining('冥想'),
        expect.objectContaining({ tag: 'habit-reminder-habit-1' }),
      );
    });

    it('超出宽容窗口的习惯提醒不应补发', () => {
      vi.setSystemTime(new Date('2026-04-07T07:10:00'));
      const habit = mkHabit({
        name: '冥想',
        reminder: { type: 'absolute', time: '07:00' },
      });

      service.start({} as any, makeStore([], [habit]) as any);

      expect(mockShowSystemNotification).not.toHaveBeenCalled();
      expect((service as any).habitScheduledJobs.size).toBe(0);
    });

    it('习惯提醒时间变化后应删除旧 job 并创建新 job', () => {
      vi.setSystemTime(new Date('2026-04-07T06:00:00'));
      const store = makeStore([], [mkHabit({
        name: '冥想',
        reminder: { type: 'absolute', time: '07:00' },
      })]) as any;

      service.start({} as any, store);
      const oldJobs = new Map((service as any).habitScheduledJobs);

      store.getHabits = () => [mkHabit({
        name: '冥想',
        reminder: { type: 'absolute', time: '08:00' },
      })];
      (service as any).rebuildSchedule();

      const oldJob = Array.from(oldJobs.values())[0] as any;
      expect(oldJob.stop).toHaveBeenCalled();
      expect((service as any).habitScheduledJobs.size).toBe(1);
    });
  });

  describe('notification click handler', () => {
    it('通知应包含点击跳转到块的回调', () => {
      mockReminderTime = Date.now() - 5000;

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-456',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };

      const store = {
        projects: [{ tasks: [{ items: [item] }] }],
        getHabits: () => [],
        currentDate: '2026-04-07',
      } as any;

      service.start({} as any, store);

      expect(mockShowSystemNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          tag: 'reminder-block-456',
          onClick: expect.any(Function),
        }),
      );
    });
  });

  describe('scheduleRebuild', () => {
    it('应防抖调用（短时间内多次调用只执行一次）', () => {
      const projectStore = makeStore([], []);
      service.start({} as any, projectStore as any);

      const spy = vi.spyOn(service as any, 'rebuildSchedule');
      spy.mockClear(); // 清除 start 内部调用的记录

      service.scheduleRebuild();
      service.scheduleRebuild();
      service.scheduleRebuild();

      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
