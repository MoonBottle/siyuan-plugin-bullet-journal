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

// Mock window.Notification
const mockNotificationRequestPermission = vi.fn();

beforeEach(() => {
  // reminderService 使用 'Notification' in window 和 window.Notification
  (globalThis as any).window = globalThis;
  vi.stubGlobal('Notification', vi.fn().mockImplementation(() => ({})));
  (globalThis.Notification as any).permission = 'default';
  (globalThis.Notification as any).requestPermission = mockNotificationRequestPermission;
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
      const projectStore = {
        itemsNeedingReminder: [],
      } as any;

      service.start({} as any, projectStore);
      expect(mockNotificationRequestPermission).toHaveBeenCalled();
    });

    it('启动和停止后不应再检查提醒', () => {
      const projectStore = {
        itemsNeedingReminder: [],
      } as any;

      service.start({} as any, projectStore);
      service.stop();
      // stop 后 checkInterval 应为 null
      expect((service as any).checkInterval).toBeNull();
    });
  });

  describe('checkReminders', () => {
    it('到达提醒时间应该触发通知', async () => {
      const now = Date.now();
      // 提醒时间设为"刚刚"（过去 5 秒，在 10s 窗口内）
      const reminderTime = now - 5000;

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
        project: { name: '项目A' },
        task: { name: '任务A' },
      };
      (item as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item],
      } as any;

      service.start({} as any, projectStore);

      // 手动触发一次检查
      await (service as any).checkReminders({} as any);

      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1);
      const [title, body] = mockShowSystemNotification.mock.calls[0];
      expect(title).toContain('⏰');
      expect(body).toContain('周会');
    });

    it('同一事项不应重复通知', async () => {
      const now = Date.now();
      const reminderTime = now - 5000;

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      (item as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item],
      } as any;

      service.start({} as any, projectStore);

      // 第一次检查
      await (service as any).checkReminders({} as any);
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1);

      // 第二次检查（同一 blockId + date）
      await (service as any).checkReminders({} as any);
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(1); // 不增加
    });

    it('未到提醒时间不应触发通知', async () => {
      const now = Date.now();
      // 提醒时间在未来 1 小时
      const reminderTime = now + 60 * 60 * 1000;

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '10:00' },
      };
      (item as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item],
      } as any;

      service.start({} as any, projectStore);
      await (service as any).checkReminders({} as any);

      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('超过 10 秒窗口的过期提醒不应触发', async () => {
      const now = Date.now();
      // 提醒时间在 30 秒前（超过 10s 窗口）
      const reminderTime = now - 30000;

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      (item as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item],
      } as any;

      service.start({} as any, projectStore);
      await (service as any).checkReminders({} as any);

      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('无 projectStore 时不应崩溃', async () => {
      service.start({} as any, null as any);
      // 不应抛异常
      await (service as any).checkReminders({} as any);
      expect(mockShowSystemNotification).not.toHaveBeenCalled();
    });

    it('不同日期的同一事项应该分别通知', async () => {
      const now = Date.now();
      const reminderTime = now - 5000;

      const item1: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      (item1 as any)._reminderTime = reminderTime;

      const item2: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-18',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-123',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      (item2 as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item1, item2],
      } as any;

      service.start({} as any, projectStore);
      await (service as any).checkReminders({} as any);

      // 两个不同日期应分别触发
      expect(mockShowSystemNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('notification click handler', () => {
    it('通知应包含点击跳转到块的回调', async () => {
      const now = Date.now();
      const reminderTime = now - 5000;

      const item: Item = {
        id: '1',
        content: '周会',
        date: '2026-03-17',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block-456',
        reminder: { enabled: true, type: 'absolute', time: '09:00' },
      };
      (item as any)._reminderTime = reminderTime;

      const projectStore = {
        itemsNeedingReminder: [item],
      } as any;

      service.start({} as any, projectStore);
      await (service as any).checkReminders({} as any);

      // 验证通知选项包含 onClick
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
});
