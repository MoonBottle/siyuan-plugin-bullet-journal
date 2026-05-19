// @vitest-environment happy-dom

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { showMessage } from 'siyuan';

const { createDialogMock, usePomodoroStoreMock } = vi.hoisted(() => ({
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
  useProjectStore: vi.fn(() => ({ getHabits: vi.fn(() => []) })),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}));

vi.mock('@/utils/fileUtils', () => ({
  updateBlockContent: vi.fn(),
  updateBlockDateTime: vi.fn(),
  updateBlockPriority: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn().mockResolvedValue(true),
  createProtyleMarkdownWriter: vi.fn(),
}));

vi.mock('@/utils/slashCommandUtils', () => ({
  generateSlashPatterns: vi.fn(),
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

vi.mock('@/parser/priorityParser', () => ({
  parsePriorityFromLine: vi.fn(),
}));

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

import { updateBlockContent } from '@/utils/fileUtils';
import { writeBlock } from '@/utils/blockWriter';
import { showDatePickerDialog, showPrioritySettingDialog, showReminderSettingDialog, showRecurringSettingDialog } from '@/utils/dialog';
import { extractDatesFromBlock, extractItemFromBlock } from '@/utils/slashCommandUtils';
import { getActionHandler } from '@/utils/slashCommands';

describe('item-only slash command validation', () => {
  vi.useFakeTimers();

  beforeEach(() => {
    vi.clearAllMocks();
    usePomodoroStoreMock.mockReturnValue({
      isFocusing: false,
      isBreakActive: false,
    });
  });

  it('/wc 在非事项块上不应更新内容，并提示错误', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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

    expect(vi.mocked(updateBlockContent)).not.toHaveBeenCalled();
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/fq 在非事项块上不应修改内容，并提示错误', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/zz 在非事项块上不应打开番茄钟，但仍应通过 BlockWriter 清理 slash 命令', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/tx 在非事项块上不应打开提醒弹框', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/cf 在非事项块上不应打开重复弹框', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/yxj 在非事项块上不应打开优先级弹框', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
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
      { blockId: 'block-non-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });

  it('/wc 在事项块上通过 BlockWriter 先删 slash 再写入 completed 状态', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue({
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
    } as any);
    const handler = getActionHandler('done', {} as any, ['/wc']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 @2026-05-14 /wc';

    handler({ transaction: vi.fn() } as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(vi.mocked(writeBlock)).toHaveBeenNthCalledWith(
      1,
      { blockId: 'block-item', nodeElement: node, protyle: expect.any(Object) },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(writeBlock)).toHaveBeenNthCalledWith(
      2,
      { blockId: 'block-item', nodeElement: node, protyle: expect.any(Object) },
      { type: 'setStatus', status: 'completed' },
    );
  });

  it('/tx 在事项块上沿用现有提醒弹框逻辑', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('setReminder', {} as any, ['/tx']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 @2026-05-14 /tx';

    const protyle = {};
    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showReminderSettingDialog)).toHaveBeenCalledWith(expect.objectContaining(item));
    expect(vi.mocked(writeBlock).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(showReminderSettingDialog).mock.invocationCallOrder[0],
    );
  });

  it('/cf 在事项块上沿用现有重复弹框逻辑', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('setRecurring', {} as any, ['/cf']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 @2026-05-14 /cf';

    const protyle = {};
    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showRecurringSettingDialog)).toHaveBeenCalledWith(expect.objectContaining(item));
    expect(vi.mocked(writeBlock).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(showRecurringSettingDialog).mock.invocationCallOrder[0],
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
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('setPriority', {} as any, ['/yxj']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 🔥 @2026-05-14 /yxj';

    handler({} as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(showPrioritySettingDialog)).toHaveBeenCalled();
  });

  it('/rq 打开日期弹框前应先通过 BlockWriter 删除 slash 命令', async () => {
    vi.mocked(extractDatesFromBlock).mockResolvedValue([]);
    const handler = getActionHandler('date', {} as any, ['/rq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 @2026-05-14 /rq';
    const protyle = {
      transaction: vi.fn(),
      wysiwyg: { element: node },
      toolbar: { setInlineMark: vi.fn() },
    };

    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showDatePickerDialog)).toHaveBeenCalled();
    expect(vi.mocked(writeBlock).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(showDatePickerDialog).mock.invocationCallOrder[0],
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
      { blockId: 'block-item', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(openTodoDock).toHaveBeenCalled();
    expect(vi.mocked(writeBlock).mock.invocationCallOrder[0]).toBeLessThan(
      openTodoDock.mock.invocationCallOrder[0],
    );
  });

  it('/fq 在未标记已放弃时通过 BlockWriter 先删 slash 再写入 abandoned 状态', async () => {
    const item = {
      blockId: 'block-item',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    };
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 /fq';

    handler({ transaction: vi.fn() } as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(vi.mocked(writeBlock)).toHaveBeenNthCalledWith(
      1,
      { blockId: 'block-item', nodeElement: node, protyle: expect.any(Object) },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(writeBlock)).toHaveBeenNthCalledWith(
      2,
      { blockId: 'block-item', nodeElement: node, protyle: expect.any(Object) },
      { type: 'setStatus', status: 'abandoned' },
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
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const listItem = document.createElement('div');
    listItem.setAttribute('data-type', 'NodeListItem');
    listItem.setAttribute('data-subtype', 't');
    listItem.setAttribute('data-node-id', 'block-list-item');
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-paragraph');
    node.textContent = '整理资料 /fq';
    listItem.appendChild(node);

    handler({ transaction: vi.fn() } as any, node);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-paragraph', listItemBlockId: 'block-list-item', nodeElement: node, protyle: expect.any(Object) },
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
    vi.mocked(extractItemFromBlock).mockResolvedValue(item as any);
    const handler = getActionHandler('abandon', {} as any, ['/fq']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-item');
    node.textContent = '整理资料 ❌ /fq';

    handler({ transaction: vi.fn() } as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      { blockId: 'block-item', nodeElement: node, protyle: expect.any(Object) },
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
      { blockId: 'block-task', nodeElement: node, protyle },
      { type: 'removeSlashCommand', suffix: '📋' },
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
      { blockId: 'block-task', nodeElement: node, protyle },
      { type: 'removeSlashCommand' },
    );
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith('已经标记为任务', 2000, 'info');
  });
});

afterAll(() => {
  vi.useRealTimers();
});
