// @vitest-environment happy-dom

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { showMessage } from 'siyuan';

const { mockEventBusEmit, mockEventBusOn } = vi.hoisted(() => ({
  mockEventBusEmit: vi.fn(),
  mockEventBusOn: vi.fn(),
}));

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
  useProjectStore: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => null),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn().mockResolvedValue(true),
  insertBlockAfter: vi.fn().mockResolvedValue(true),
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
  eventBus: { emit: mockEventBusEmit, on: mockEventBusOn },
  Events: {
    REFRESH_REQUEST_SUBMITTED: 'refresh:request-submitted',
  },
}));

vi.mock('@/utils/refreshRequests', () => ({
  RefreshReasons: {
    SLASH_COMMAND_HABIT_DATA: 'slash-command:habit-data',
    SLASH_COMMAND_SET_PROJECT_DIR: 'slash-command:set-project-dir',
  },
  createFullRefreshRequest: vi.fn((reason: string, payload?: Record<string, unknown>) => (
    payload === undefined ? { type: 'full', reason } : { type: 'full', reason, payload }
  )),
  submitRefreshRequest: vi.fn((request: unknown) => mockEventBusEmit('refresh:request-submitted', request)),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  findFirstProtyleVisibleTextNode: vi.fn(),
  isProtyleBlockSafeForWriterFastPath: vi.fn(() => false),
  renderMarkdownIntoBlockEditable: vi.fn(() => false),
  blockElementToMarkdownContent: vi.fn(() => null),
}));

import { showHabitCreateDialog } from '@/utils/dialog';
import { checkIn, checkInCount } from '@/services/habitService';
import { processLineText, extractDatesFromBlock } from '@/utils/slashCommandUtils';
import { useProjectStore, useSettingsStore } from '@/stores';
import { getActionHandler } from '@/utils/slashCommands';
import { eventBus, Events } from '@/utils/eventBus';
import { insertBlockAfter, writeBlock } from '@/utils/blockWriter';

const projectStoreMock = {
  getHabits: vi.fn(() => []),
};

describe('habit slash commands', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-30T09:00:00'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processLineText).mockImplementation((text: string) => text);
    vi.mocked(useProjectStore).mockReturnValue(projectStoreMock as any);
    vi.mocked(useSettingsStore).mockReturnValue({
      habitCheckInTimePrecision: 'day',
    } as any);
    projectStoreMock.getHabits.mockReturnValue([]);
  });

  it('/xg 在习惯行上应进入编辑模式，并在保存后走习惯定义 patch 更新', async () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    showSpy.mockImplementation((onSave: (markdown: string) => void) => {
      onSave('喝水 🎯2026-04-01 10杯 ⏰09:00 🔄每天');
      return {} as any;
    });
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天';

    handler({} as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      name: '喝水',
      target: 8,
      unit: '杯',
    }));
    expect(writeBlock).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-1' }),
      {
        type: 'setHabitDefinition',
        habit: expect.objectContaining({
          name: '喝水',
          target: 10,
          unit: '杯',
        }),
      },
    );
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

    expect(writeBlock).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-zwsp',
      nodeElement: node,
      protyle,
    }), {
      type: 'removeSlashCommand',
    });
    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      name: '喝水',
      target: 8,
      unit: '杯',
    }));
  });

  it('/xg 即使编辑器事务尚未回写 DOM 也应进入编辑模式', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    vi.mocked(processLineText).mockImplementation((text: string) => text.replace('/xg', ''));
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-stale-dom');
    node.textContent = '喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天/xg​';

    handler({} as any, node);

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
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-1',
        habitId: 'habit-1',
        currentValue: 3,
        targetValue: 8,
        unit: '杯',
      }],
    }]);

    handler({} as any, node);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('/xg 在无 ✅ 的二元 record 行上也不应打开习惯编辑', () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-binary');
    node.textContent = '早起 📅2026-04-30';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-binary',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [{
        content: '早起',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-binary',
        habitId: 'habit-binary',
      }],
    }]);

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

  it('/xg 在普通事项行保存后应通过 blockWriter 插入新的习惯定义块', async () => {
    const showSpy = vi.mocked(showHabitCreateDialog);
    showSpy.mockImplementation((onSave: (markdown: string) => void) => {
      onSave('早起 🎯2026-04-01 🔄每天');
      return {} as any;
    });
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'task-create');
    node.textContent = 'Buy milk @2026-04-30';

    handler({} as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(insertBlockAfter).toHaveBeenCalledWith(
      'task-create',
      {
        type: 'setHabitDefinition',
        habit: expect.objectContaining({
          name: '早起',
          type: 'binary',
          frequency: expect.objectContaining({ type: 'daily' }),
        }),
      },
    );
  });

  it('、jt 成功后应通过一次 blockWriter 批量写入删除斜杠命令并写入日期', async () => {
    vi.mocked(extractDatesFromBlock).mockResolvedValue([{ date: '2026-04-29' }] as any);
    vi.mocked(processLineText).mockImplementation((text: string) => text.replace('、jt', '').trimEnd());

    const handler = getActionHandler('today', {} as any, ['/jt']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-today');
    const textNode = document.createTextNode('测试独立事项 📅2026-04-29 、jt');
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
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(writeBlock).toHaveBeenCalledTimes(1);
    expect(writeBlock).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-today',
      nodeElement: node,
      protyle,
    }), [
      {
        type: 'removeSlashCommand',
      },
      {
        type: 'addDate',
        date: '2026-04-30',
        allDay: true,
        siblingItems: [{ date: '2026-04-29' }],
      },
    ]);
    expect(protyle.transaction).not.toHaveBeenCalled();
  });

  it('/mt 成功后应通过一次 blockWriter 批量写入删除斜杠命令并写入明天日期', async () => {
    vi.mocked(extractDatesFromBlock).mockResolvedValue([] as any);

    const handler = getActionHandler('tomorrow', {} as any, ['/mt']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-tomorrow');
    const textNode = document.createTextNode('测试独立事项 /mt');
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
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(writeBlock).toHaveBeenCalledTimes(1);
    expect(writeBlock).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-tomorrow',
      nodeElement: node,
      protyle,
    }), [
      {
        type: 'removeSlashCommand',
      },
      {
        type: 'addDate',
        date: '2026-05-01',
        allDay: true,
        siblingItems: undefined,
      },
    ]);
  });

  it('/dk 应调用真实打卡逻辑而不是 placeholder', async () => {
    const checkInSpy = vi.mocked(checkIn);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '早起 🎯2026-04-01 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'block-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [],
    }]);

    await handler({} as any, node);

    expect(checkInSpy).toHaveBeenCalled();
  });

  it('/dk 应把设置中的习惯打卡时间精度传给二元型打卡服务', async () => {
    vi.mocked(useSettingsStore).mockReturnValue({
      habitCheckInTimePrecision: 'minute',
    } as any);
    const checkInSpy = vi.mocked(checkIn);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-precision');
    node.textContent = '早起 🎯2026-04-01 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'block-precision',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [],
    }]);

    await handler({} as any, node);

    expect(checkInSpy).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-precision',
      type: 'binary',
    }), '2026-04-30', expect.any(Object), 'minute');
  });

  it('/dk 在计数型习惯定义行上应走 checkInCount(1)', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-2');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'block-2',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [],
    }]);

    await handler({} as any, node);

    expect(checkInCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-2',
      type: 'count',
    }), '2026-04-30', 1, expect.any(Object), 'day');
  });

  it('/dk 成功打卡后应立即触发数据刷新，避免定义行连续打卡产生重复 record', async () => {
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-2');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'block-2',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [],
    }]);

    await handler({} as any, node);

    expect(vi.mocked(eventBus.emit)).toHaveBeenCalledWith(Events.REFRESH_REQUEST_SUBMITTED, {
      type: 'full',
      reason: 'slash-command:habit-data',
    });
  });

  it('/dk 在计数型习惯定义行上应基于 store 中同 habit 当日 record 做 +1，而不是创建重复 record', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-3');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'block-3',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-today-3',
        habitId: 'block-3',
        currentValue: 1,
        targetValue: 8,
        unit: '杯',
      }],
    }]);

    await handler({} as any, node);

    expect(checkInCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-3',
      records: [expect.objectContaining({
        blockId: 'record-today-3',
        currentValue: 1,
      })],
    }), '2026-04-30', 1, expect.any(Object), 'day');
  });

  it('/dk 在定义行命中今日 count record 时，writer.update 应回退到 API 写目标 record 块', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    checkInCountSpy.mockImplementation(async (_habit, _date, _incrementBy, writer) => {
      await writer?.update('record-today-3', {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-30',
          value: 2,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      });
      return true;
    });

    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-3');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';
    const protyle = { transaction: vi.fn() };
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'block-3',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-today-3',
        habitId: 'block-3',
        currentValue: 1,
        targetValue: 8,
        unit: '杯',
      }],
    }]);

    await handler(protyle as any, node);

    expect(writeBlock).toHaveBeenLastCalledWith(
      { blockId: 'record-today-3' },
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-30',
          value: 2,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
    );
  });

  it('/dk 在定义行未命中 store 中的 habit 时不应直接写 record', async () => {
    const messageSpy = vi.mocked(showMessage);
    const checkInSpy = vi.mocked(checkIn);
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'missing-habit');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天';

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalled();
    expect(checkInSpy).not.toHaveBeenCalled();
    expect(checkInCountSpy).not.toHaveBeenCalled();
  });

  it('/dk 在已归档的习惯定义行上应提示已归档并停止打卡', async () => {
    const messageSpy = vi.mocked(showMessage);
    const checkInSpy = vi.mocked(checkIn);
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'habit-archived');
    node.textContent = '喝水 🎯2026-04-01 8杯 🔄每天 📦2026-04-30';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-archived',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      archivedAt: '2026-04-30',
      frequency: { type: 'daily' },
      records: [],
    }]);

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalledWith('习惯已归档', 2000, 'info');
    expect(checkInSpy).not.toHaveBeenCalled();
    expect(checkInCountSpy).not.toHaveBeenCalled();
  });

  it('/dk 在今天的二元打卡记录上应提示已打卡', async () => {
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-2');
    node.textContent = '早起 📅2026-04-30';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [{
        content: '早起',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-2',
        habitId: 'habit-1',
      }],
    }]);

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalled();
  });

  it('/dk 在今天的计数打卡记录上应走 checkInCount(1)', async () => {
    const checkInCountSpy = vi.mocked(checkInCount);
    checkInCountSpy.mockImplementation(async (_habit, _date, _incrementBy, writer) => {
      await writer?.update('record-4', {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-30',
          value: 4,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      });
      return true;
    });
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-4');
    node.textContent = '喝水 3/8杯 📅2026-04-30';
    const protyle = { transaction: vi.fn() };

    await handler(protyle as any, node);

    expect(checkInCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'count',
      records: [expect.objectContaining({
        currentValue: 3,
        targetValue: 8,
      })],
    }), '2026-04-30', 1, expect.any(Object), 'day');
    expect(writeBlock).toHaveBeenLastCalledWith(
      {
        blockId: 'record-4',
        nodeElement: node,
        protyle,
      },
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-30',
          value: 4,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
    );
  });

  it('/dk 在已打卡的习惯定义行上应提示已打卡而不是重复创建 record', async () => {
    const messageSpy = vi.mocked(showMessage);
    const checkInSpy = vi.mocked(checkIn);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'habit-1');
    node.textContent = '早起 🎯2026-04-01 🔄每天';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [{
        content: '早起',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-today-1',
        habitId: 'habit-1',
      }],
    }]);

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalled();
    expect(checkInSpy).not.toHaveBeenCalled();
  });

  it('/dk 在已达标的今日计数 record 上应提示已达标而不是继续 +1', async () => {
    const messageSpy = vi.mocked(showMessage);
    const checkInCountSpy = vi.mocked(checkInCount);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-5');
    node.textContent = '喝水 8/8杯 📅2026-04-30';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-2',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-30',
        docId: 'doc-1',
        blockId: 'record-5',
        habitId: 'habit-2',
        currentValue: 8,
        targetValue: 8,
        unit: '杯',
      }],
    }]);

    await handler({} as any, node);

    expect(messageSpy).toHaveBeenCalled();
    expect(checkInCountSpy).not.toHaveBeenCalled();
  });

  it('/dk 在历史记录上应打开 HabitDock', async () => {
    const openHabitDock = vi.fn();
    const handler = getActionHandler('checkIn', { openHabitDock } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'record-3');
    node.textContent = '早起 📅2026-04-29';
    projectStoreMock.getHabits.mockReturnValue([{
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [{
        content: '早起',
        date: '2026-04-29',
        docId: 'doc-1',
        blockId: 'record-3',
        habitId: 'habit-1',
      }],
    }]);

    await handler({} as any, node);

    expect(openHabitDock).toHaveBeenCalledWith({
      habitId: 'habit-1',
      date: '2026-04-29',
      recordBlockId: 'record-3',
    });
  });
});

afterAll(() => {
  vi.useRealTimers();
});
