/**
 * 提醒服务测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderService } from '@/services/reminderService';
import type { Item } from '@/types/models';

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
  });

  describe('start / stop lifecycle', () => {
    it('启动时应该请求通知权限', () => {
      const projectStore = { projects: [] } as any;
      service.start({} as any, projectStore);
      expect(mockNotificationRequestPermission).toHaveBeenCalled();
    });

    it('启动和停止后应清理所有 job', () => {
      const projectStore = { projects: [] } as any;
      service.start({} as any, projectStore);
      service.stop();
      expect((service as any).scheduledJobs.size).toBe(0);
    });
  });

  describe('rebuildSchedule', () => {
    /** 创建一个带单事项的 projectStore */
    function makeStore(items: Item | Item[]) {
      return {
        projects: [{ tasks: [{ items: Array.isArray(items) ? items : [items] }] }],
      };
    }

    it('到达提醒时间应该触发通知', () => {
      mockReminderTime = Date.now() - 5000; // 5 秒前，已过期

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
        project: { name: '项目A' }, task: { name: '任务A' },
      };

      service.start({} as any, makeStore(item));

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

      service.start({} as any, makeStore(item));
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

      service.start({} as any, makeStore(item));

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

      service.start({} as any, makeStore(item));
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

      service.start({} as any, makeStore([item1, item2]));
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(2);
    });

    it('删除的事项应停止对应的 Cron job', () => {
      mockReminderTime = Date.now() + 60 * 60 * 1000;

      const item: Item = {
        id: '1', content: '周会', date: '2026-03-17', status: 'pending',
        lineNumber: 1, docId: 'doc1', blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '10:00' },
      };

      const store = makeStore(item);
      service.start({} as any, store);
      expect((service as any).scheduledJobs.size).toBe(1);

      const job = (service as any).scheduledJobs.get('block-123-2026-03-17');
      expect(job).toBeDefined();

      // 清空事项列表，rebuild 后旧 job 应被停止
      store.projects[0].tasks[0].items = [];
      (service as any).rebuildSchedule();

      expect(job.stop).toHaveBeenCalled();
      expect((service as any).scheduledJobs.size).toBe(0);
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
      vi.useFakeTimers();
      const projectStore = { projects: [] } as any;
      service.start({} as any, projectStore);

      const spy = vi.spyOn(service as any, 'rebuildSchedule');
      spy.mockClear(); // 清除 start 内部调用的记录

      service.scheduleRebuild();
      service.scheduleRebuild();
      service.scheduleRebuild();

      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(spy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
