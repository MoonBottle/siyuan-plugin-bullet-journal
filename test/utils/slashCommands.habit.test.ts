// @vitest-environment happy-dom

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { showMessage } from 'siyuan';

vi.mock('@/utils/dialog', () => ({
  showDatePickerDialog: vi.fn(),
  showItemDetailModal: vi.fn(),
  createDialog: vi.fn(),
  showReminderSettingDialog: vi.fn(),
  showRecurringSettingDialog: vi.fn(),
  showPrioritySettingDialog: vi.fn(),
  showHabitCreateDialog: vi.fn(),
}));

vi.mock('@/services/habitService', () => ({
  checkIn: vi.fn().mockResolvedValue(true),
  checkInCount: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/api', () => ({
  insertBlock: vi.fn(),
  updateBlock: vi.fn(),
  getHPathByID: vi.fn(),
  getBlockByID: vi.fn(),
  renameDocByID: vi.fn(),
}));

vi.mock('@/stores', () => ({
  usePomodoroStore: vi.fn(() => ({})),
  useSettingsStore: vi.fn(() => ({})),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => null),
}));

vi.mock('@/utils/fileUtils', () => ({
  updateBlockContent: vi.fn(),
  updateBlockDateTime: vi.fn(),
  updateBlockPriority: vi.fn(),
}));

vi.mock('@/utils/slashCommandUtils', () => ({
  generateSlashPatterns: vi.fn(),
  processLineText: vi.fn((text: string) => text),
  formatDate: vi.fn(() => '2026-04-30'),
  extractDatesFromBlock: vi.fn(),
  findNearestDate: vi.fn(),
  extractItemFromBlock: vi.fn(),
}));

vi.mock('@/parser/priorityParser', () => ({
  parsePriorityFromLine: vi.fn(),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: {},
  broadcastDataRefresh: vi.fn(),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  findFirstProtyleVisibleTextNode: vi.fn(),
  isProtyleBlockSafeForWriterFastPath: vi.fn(() => false),
}));

import { showHabitCreateDialog } from '@/utils/dialog';
import { checkIn, checkInCount } from '@/services/habitService';
import { processLineText } from '@/utils/slashCommandUtils';
import { getActionHandler } from '@/utils/slashCommands';

describe('habit slash commands', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-30T09:00:00'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processLineText).mockImplementation((text: string) => text);
  });

  it('/xg 在习惯行上应进入编辑模式', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    showSpy.mockImplementation((onSave: (markdown: string) => void) => {
      onSave('已更新的习惯');
      return {} as any;
    });
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天';

    handler({} as any, node);

    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      name: '喝水',
      target: 8,
      unit: '杯',
    }));
  });

  it('/xg 删除命令后即使残留零宽字符也应进入编辑模式', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    vi.mocked(processLineText).mockImplementation((text: string) => text.replace('/xg', ''));
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-zwsp');
    const textNode = document.createTextNode('喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天/xg​');
    node.appendChild(textNode);
    document.body.appendChild(node);

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const protyle = {
      wysiwyg: { element: node },
      toolbar: { setInlineMark: vi.fn() },
      transaction: vi.fn(),
    };

    handler(protyle as any, node);

    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      name: '喝水',
      target: 8,
      unit: '杯',
    }));
  });

  it('/xg 在 record 行上不应打开习惯编辑', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-1');
    node.textContent = '喝水 3/8杯 📅2026-04-30';

    handler({} as any, node);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('/xg 在普通日期事项行上仍应保留创建习惯入口', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'task-1');
    node.textContent = 'Buy milk @2026-04-30';

    handler({} as any, node);

    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('/dk 应调用真实打卡逻辑而不是 placeholder', async () => {
    const checkInSpy = vi.mocked(checkIn);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '早起 🎯2026-04-01 🔄每天';

    await handler({} as any, node);

    expect(checkInSpy).toHaveBeenCalled();
  });

  it('/dk 在计数型习惯定义行上应走 checkInCount(1)', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-2');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';

    await handler({} as any, node);

    expect(checkInCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-2',
      type: 'count',
    }), '2026-04-30', 1);
  });

  it('/dk 在今天的二元打卡记录上应提示已打卡', async () => {
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-2');
    node.textContent = '早起 📅2026-04-30 ✅';

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalled();
  });

  it('/dk 在今天的计数打卡记录上应走 checkInCount(1)', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-4');
    node.textContent = '喝水 3/8杯 📅2026-04-30';

    await handler({} as any, node);

    expect(checkInCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'count',
      records: [expect.objectContaining({
        currentValue: 3,
        targetValue: 8,
      })],
    }), '2026-04-30', 1);
  });

  it('/dk 在历史记录上应打开 HabitDock', async () => {
    const openHabitDock = vi.fn();
    const handler = getActionHandler('checkIn', { openHabitDock } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-3');
    node.textContent = '早起 📅2026-04-29 ✅';

    await handler({} as any, node);

    expect(openHabitDock).toHaveBeenCalled();
  });
});

afterAll(() => {
  vi.useRealTimers();
});
