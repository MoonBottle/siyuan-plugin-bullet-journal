/**
 * pomodoroStorage 单元测试
 * savePendingCompletion、loadPendingCompletion、removePendingCompletion
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePendingCompletion,
  loadPendingCompletion,
  removePendingCompletion,
  hasPendingCompletion
} from '@/utils/pomodoroStorage';
import type { PendingPomodoroCompletion } from '@/types/models';

const mockPending: PendingPomodoroCompletion = {
  blockId: 'block-1',
  itemId: 'item-1',
  itemContent: '测试事项',
  startTime: 1731234567890,
  endTime: 1731236067890,
  accumulatedSeconds: 1500,
  durationMinutes: 25,
  projectId: 'proj-1',
  projectName: '测试项目',
  taskId: 'task-1',
  taskName: '任务',
  timerMode: 'countdown'
};

function createMockPlugin() {
  let stored: string | null = null;
  return {
    saveData: async (key: string, content: string) => {
      if (key === 'pending-pomodoro-completion.json') {
        stored = content;
      }
    },
    loadData: async (key: string) => {
      if (key === 'pending-pomodoro-completion.json') {
        return stored;
      }
      return null;
    },
    removeData: async (key: string) => {
      if (key === 'pending-pomodoro-completion.json') {
        stored = null;
      }
    },
    _getStored: () => stored
  };
}

describe('pomodoroStorage 待完成记录', () => {
  it('savePendingCompletion 写入后 loadPendingCompletion 可读取', async () => {
    const plugin = createMockPlugin() as any;
    const saved = await savePendingCompletion(plugin, mockPending);
    expect(saved).toBe(true);

    const loaded = await loadPendingCompletion(plugin);
    expect(loaded).not.toBeNull();
    expect(loaded!.blockId).toBe(mockPending.blockId);
    expect(loaded!.itemContent).toBe(mockPending.itemContent);
    expect(loaded!.durationMinutes).toBe(mockPending.durationMinutes);
    expect(loaded!.startTime).toBe(mockPending.startTime);
    expect(loaded!.endTime).toBe(mockPending.endTime);
    expect(loaded!.timerMode).toBe('countdown');
  });

  it('removePendingCompletion 删除后 loadPendingCompletion 返回 null', async () => {
    const plugin = createMockPlugin() as any;
    await savePendingCompletion(plugin, mockPending);
    const removed = await removePendingCompletion(plugin);
    expect(removed).toBe(true);

    const loaded = await loadPendingCompletion(plugin);
    expect(loaded).toBeNull();
  });

  it('hasPendingCompletion 无数据返回 false', async () => {
    const plugin = createMockPlugin() as any;
    const has = await hasPendingCompletion(plugin);
    expect(has).toBe(false);
  });

  it('hasPendingCompletion 有数据返回 true', async () => {
    const plugin = createMockPlugin() as any;
    await savePendingCompletion(plugin, mockPending);
    const has = await hasPendingCompletion(plugin);
    expect(has).toBe(true);
  });

  it('plugin 为 null 时 save 返回 false', async () => {
    const saved = await savePendingCompletion(null as any, mockPending);
    expect(saved).toBe(false);
  });

  it('plugin 为 null 时 load 返回 null', async () => {
    const loaded = await loadPendingCompletion(null as any);
    expect(loaded).toBeNull();
  });
});
