// @vitest-environment happy-dom

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { showMessage } from 'siyuan';

const { createDialogMock, usePomodoroStoreMock, projectStoreGetItemByBlockIdMock } = vi.hoisted(() => ({
  createDialogMock: vi.fn(() => {
    const element = document.createElement('div');
    element.innerHTML = '<div id="pomodoro-timer-dialog-mount"></div>';
    return {
      element,
      destroy: vi.fn(),
    };
  }),
  usePomodoroStoreMock: vi.fn(() => ({
    isFocusing: false,
    isBreakActive: false,
  })),
  projectStoreGetItemByBlockIdMock: vi.fn(),
}));

vi.mock('@/components/pomodoro/PomodoroTimerDialog.vue', () => ({
  default: {
    template: '<div data-testid="pomodoro-dialog-stub"></div>',
  },
}));

vi.mock('@/utils/dialog', () => ({
  showDatePickerDialog: vi.fn(),
  showItemDetailModal: vi.fn(),
  createDialog: createDialogMock,
  showReminderSettingDialog: vi.fn(),
  showRecurringSettingDialog: vi.fn(),
  showPrioritySettingDialog: vi.fn(),
  showHabitCreateDialog: vi.fn(),
  showFocusPlanDialog: vi.fn(),
}));

vi.mock('@/api', () => ({
  insertBlock: vi.fn(),
  updateBlock: vi.fn(),
  getHPathByID: vi.fn(),
  getBlockByID: vi.fn(),
  renameDocByID: vi.fn(),
  getBlockKramdown: vi.fn(),
}));

vi.mock('@/stores', () => ({
  usePomodoroStore: usePomodoroStoreMock,
  useSettingsStore: vi.fn(() => ({})),
  useProjectStore: vi.fn(() => ({
    getHabits: vi.fn(() => []),
    getItemByBlockId: projectStoreGetItemByBlockIdMock,
  })),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn().mockResolvedValue(true),
  createProtyleMarkdownWriter: vi.fn(),
}));

vi.mock('@/utils/slashCommandUtils', () => ({
  processLineText: vi.fn((text: string, filters?: string[]) => {
    let result = text;
    for (const filter of filters ?? []) {
      result = result.replace(filter, '');
    }
    return result.trim();
  }),
  formatDate: vi.fn(() => '2026-05-14'),
  extractDatesFromBlock: vi.fn(),
  findNearestDate: vi.fn(),
  extractItemFromBlock: vi.fn(),
}));

vi.mock('@/parser/priorityParser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/parser/priorityParser')>();
  return {
    ...actual,
    parsePriorityFromLine: vi.fn(),
  };
});

vi.mock('@/utils/refreshRequests', () => ({
  RefreshReasons: {
    SLASH_COMMAND_HABIT_DATA: 'slash-command:habit-data',
    SLASH_COMMAND_SET_PROJECT_DIR: 'slash-command:set-project-dir',
  },
  createFullRefreshRequest: vi.fn(),
  submitRefreshRequest: vi.fn(),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  findFirstProtyleVisibleTextNode: vi.fn(),
  isProtyleBlockSafeForWriterFastPath: vi.fn(() => false),
  renderMarkdownIntoBlockEditable: vi.fn(() => false),
  blockElementToMarkdownContent: vi.fn(() => null),
}));

vi.mock('@/services/habitService', () => ({
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
}));

import { writeBlock } from '@/utils/blockWriter';
import { showDatePickerDialog, showPrioritySettingDialog, showReminderSettingDialog, showRecurringSettingDialog } from '@/utils/dialog';
import { extractDatesFromBlock } from '@/utils/slashCommandUtils';
import { getActionHandler } from '@/utils/slashCommands';

describe('item-only slash command validation', () => {
  vi.useFakeTimers();

  function setCaretToCommandEnd(node: HTMLElement, command: string): number {
    const textNode = node.firstChild as Text;
    const offset = textNode.textContent!.indexOf(command) + command.length;
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return offset - command.length;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(showDatePickerDialog).mockImplementation(() => undefined as any);
    vi.mocked(showPrioritySettingDialog).mockImplementation(() => undefined as any);
    vi.mocked(showReminderSettingDialog).mockImplementation(() => undefined as any);
    vi.mocked(showRecurringSettingDialog).mockImplementation(() => undefined as any);
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    usePomodoroStoreMock.mockReturnValue({
      isFocusing: false,
      isBreakActive: false,
    });
  });

  it('/wc 在非事项块上不应更新内容，并提示错误', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('done', {} as any, ['/wc']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /wc');
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

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/fq 在非事项块上不应修改内容，并提示错误', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /fq');
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

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/zz 在非事项块上不应打开番茄钟，但仍应通过 BlockWriter 清理 slash 命令', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('focus', { openPomodoroDock: vi.fn() } as any, ['/zz']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /zz');
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
    vi.advanceTimersByTime(500);

    expect(createDialogMock).not.toHaveBeenCalled();
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/tx 在非事项块上不应打开提醒弹框', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('setReminder', {} as any, ['/tx']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /tx');
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

    expect(vi.mocked(showReminderSettingDialog)).not.toHaveBeenCalled();
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/cf 在非事项块上不应打开重复弹框', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('setRecurring', {} as any, ['/cf']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /cf');
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

    expect(vi.mocked(showRecurringSettingDialog)).not.toHaveBeenCalled();
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/yxj 在非事项块上不应打开优先级弹框', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue(null);
    const messageSpy = vi.mocked(showMessage);
    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /yxj');
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

    expect(vi.mocked(showPrioritySettingDialog)).not.toHaveBeenCalled();
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/yxj 在日期 marker 中缀触发时仍应打开优先级弹框', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue({
      id: 'item-1',
      blockId: 'block-item',
      content: '评审视觉稿',
      date: '2026-05-15',
      status: 'pending',
      lineNumber: 1,
      docId: 'doc-1',
      siblingItems: [{ date: '2026-05-20' }],
    } as any);

    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    const textNode = document.createTextNode('评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00');
    node.appendChild(textNode);
    document.body.appendChild(node);

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.indexOf('/yxj') + '/yxj'.length);
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
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalledOnce();
    expect(vi.mocked(showMessage)).not.toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/yxj 在时间 marker 中缀触发时仍应打开优先级弹框', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue({
      id: 'item-1',
      blockId: 'block-item',
      content: '评审视觉稿',
      date: '2026-05-15',
      status: 'pending',
      lineNumber: 1,
      docId: 'doc-1',
      reminder: { enabled: true, type: 'absolute', time: '14:00' },
      siblingItems: [{ date: '2026-05-20' }],
    } as any);

    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    const textNode = document.createTextNode('评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0');
    node.appendChild(textNode);
    document.body.appendChild(node);

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.indexOf('/yxj') + '/yxj'.length);
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
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalledOnce();
    expect(vi.mocked(showMessage)).not.toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/wc 在事项块上通过 BlockWriter 先删 slash 再写入 completed 状态', async () => {
    projectStoreGetItemByBlockIdMock.mockReturnValue({
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
    } as any);
    const handler = getActionHandler('done', {} as any, ['/wc']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 @2026-05-14 /wc';
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-item', nodeElement: node, protyle }),
      [
        { type: 'removeSlashCommand' },
        { type: 'setStatus', status: 'completed' },
      ],
    );
  });

  it('/tx 在事项块上弹框前先删除 slash 命令', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('setReminder', {} as any, ['/tx']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 @2026-05-14 /tx'));
    setCaretToCommandEnd(node, '/tx');

    const protyle = {};
    handler(protyle as any, node);
    await vi.waitFor(() => {
      expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'block-item',
          slashRange: expect.any(Range),
        }),
        { type: 'removeSlashCommand' },
      );
    });
    expect(vi.mocked(showReminderSettingDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        content: '整理资料',
        date: '2026-05-14',
        status: 'pending',
      }),
    );
  });

  it('/cf 在事项块上弹框前先删除 slash 命令', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('setRecurring', {} as any, ['/cf']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 @2026-05-14 /cf'));
    setCaretToCommandEnd(node, '/cf');

    const protyle = {};
    handler(protyle as any, node);
    await vi.waitFor(() => {
      expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'block-item',
          slashRange: expect.any(Range),
        }),
        { type: 'removeSlashCommand' },
      );
    });
    expect(vi.mocked(showRecurringSettingDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        content: '整理资料',
        date: '2026-05-14',
        status: 'pending',
      }),
    );
  });

  it('/yxj 在事项块上沿用现有优先级弹框逻辑', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 🔥 @2026-05-14 /yxj'));
    setCaretToCommandEnd(node, '/yxj');

    handler({} as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalled();
  });

  it('/yxj 在确认优先级后通过 BlockWriter 写入 setPriority（slash 已在弹框前删除）', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    vi.mocked(showPrioritySettingDialog).mockImplementation((_, onConfirm) => {
      void onConfirm('high');
    });
    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 @2026-05-14 /yxj'));
    setCaretToCommandEnd(node, '/yxj');
    const protyle = {};

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item' },
      { type: 'setPriority', priority: 'high' },
    );
  });

  it('/rq 打开日期弹框前应先删除 slash 命令', async () => {
    vi.mocked(extractDatesFromBlock).mockResolvedValue([]);
    const handler = getActionHandler('date', {} as any, ['/rq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 @2026-05-14 /rq'));
    setCaretToCommandEnd(node, '/rq');
    const protyle = {
      transaction: vi.fn(),
      wysiwyg: { element: node },
      toolbar: { setInlineMark: vi.fn() },
    };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        slashRange: expect.any(Range),
      }),
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showDatePickerDialog)).toHaveBeenCalled();
  });

  it('/rq 在确认日期后通过 BlockWriter 写入 addDate（slash 已在弹框前删除）', async () => {
    vi.mocked(extractDatesFromBlock).mockResolvedValue([]);
    vi.mocked(showDatePickerDialog).mockImplementation((_, __, onSelect) => {
      void onSelect('2026-05-20');
    });
    const handler = getActionHandler('date', {} as any, ['/rq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 @2026-05-14 /rq'));
    setCaretToCommandEnd(node, '/rq');
    const protyle = {
      transaction: vi.fn(),
      wysiwyg: { element: node },
      toolbar: { setInlineMark: vi.fn() },
    };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        nodeElement: node,
        protyle,
        slashRange: expect.any(Range),
      }),
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item' },
      { type: 'addDate', date: '2026-05-20', allDay: true, siblingItems: undefined },
    );
  });

  it('/db 打开待办面板前应先通过 BlockWriter 删除 slash 命令', async () => {
    const openTodoDock = vi.fn();
    const handler = getActionHandler('todo', { openTodoDock } as any, ['/db']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 /db';
    const protyle = {
      transaction: vi.fn(),
      wysiwyg: { element: node },
      toolbar: { setInlineMark: vi.fn() },
    };

    handler(protyle as any, node);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(openTodoDock).toHaveBeenCalled();
    expect(vi.mocked(writeBlock).mock.invocationCallOrder[0]).toBeLessThan(
      openTodoDock.mock.invocationCallOrder[0],
    );
  });

  it('/fq 在未标记已放弃时通过一次批量 BlockWriter 写入删除 slash 与 abandoned 状态', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 /fq'));
    const slashStartOffset = setCaretToCommandEnd(node, '/fq');
    const slashEndOffset = slashStartOffset + '/fq'.length;
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        nodeElement: node,
        protyle,
        slashStartOffset,
        slashEndOffset,
        slashRange: expect.any(Range),
      }),
      [
        { type: 'removeSlashCommand' },
        { type: 'setStatus', status: 'abandoned' },
      ],
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已标记为已放弃', 2000, 'info');
  });

  it('/fq 在任务列表事项上通过一次批量 BlockWriter 写入删除 slash 与 abandoned 状态', async () => {
    const item = {
      blockId: 'block-paragraph',
      listItemBlockId: 'block-list-item',
      isTaskList: true,
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const listItem = document.createElement('div');
    listItem.setAttribute('data-type', 'NodeListItem');
    listItem.setAttribute('data-subtype', 't');
    listItem.setAttribute('data-node-id', 'block-list-item');
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-paragraph');
    node.appendChild(document.createTextNode('整理资料 /fq'));
    const slashStartOffset = setCaretToCommandEnd(node, '/fq');
    const slashEndOffset = slashStartOffset + '/fq'.length;
    const protyle = { transaction: vi.fn() };
    listItem.appendChild(node);
    document.body.appendChild(listItem);

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-paragraph',
        listItemBlockId: 'block-list-item',
        nodeElement: node,
        protyle,
        slashStartOffset,
        slashEndOffset,
        slashRange: expect.any(Range),
      }),
      [
        { type: 'removeSlashCommand' },
        { type: 'setStatus', status: 'abandoned' },
      ],
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已标记为已放弃', 2000, 'info');
  });

  it('/fq 在已标记已放弃时通过 BlockWriter 仅删除 slash 命令', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'abandoned',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 ❌ /fq'));
    const slashStartOffset = setCaretToCommandEnd(node, '/fq');
    const slashEndOffset = slashStartOffset + '/fq'.length;
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        nodeElement: node,
        protyle,
        slashStartOffset,
        slashEndOffset,
        slashRange: expect.any(Range),
      }),
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已经标记为已放弃', 2000, 'info');
  });

  it('/fq 在 slash 位于已放弃标记前时仍应仅删除 slash 命令', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'abandoned',
    };
    projectStoreGetItemByBlockIdMock.mockReturnValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.appendChild(document.createTextNode('整理资料 /fq ❌'));
    const slashStartOffset = setCaretToCommandEnd(node, '/fq');
    const slashEndOffset = slashStartOffset + '/fq'.length;
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-item',
        nodeElement: node,
        protyle,
        slashStartOffset,
        slashEndOffset,
        slashRange: expect.any(Range),
      }),
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已经标记为已放弃', 2000, 'info');
  });

  it('/rw 在未标记任务时通过 BlockWriter 删除 slash 并追加任务标记', async () => {
    const handler = getActionHandler('markAsTask', {} as any, ['/rw']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-task');
    node.textContent = '整理资料 /rw';
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-task', nodeElement: node, protyle }),
      [
        { type: 'removeSlashCommand' },
        { type: 'setTaskTag', tag: '📋' },
      ],
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已标记为任务', 2000, 'info');
  });

  it('/rw 在已标记任务时通过 BlockWriter 仅删除 slash 命令', async () => {
    const handler = getActionHandler('markAsTask', {} as any, ['/rw']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-task');
    node.textContent = '整理资料 📋 /rw';
    const protyle = { transaction: vi.fn() };

    handler(protyle as any, node);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-task', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已经标记为任务', 2000, 'info');
  });
});

afterAll(() => {
  vi.useRealTimers();
});
