// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dialog', () => ({
  showDatePickerDialog: vi.fn(),
  showItemDetailModal: vi.fn(),
  createDialog: vi.fn(),
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
  usePomodoroStore: vi.fn(() => ({})),
  useSettingsStore: vi.fn(() => ({})),
  useProjectStore: vi.fn(() => ({ getHabits: vi.fn(() => []) })),
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
  processLineText: vi.fn((text: string, filters?: string[]) => {
    let result = text;
    for (const filter of filters ?? []) {
      result = result.replace(filter, '');
    }
    return result.trim();
  }),
  formatDate: vi.fn(() => '2026-05-13'),
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
}));

vi.mock('@/services/habitService', () => ({
  checkIn: vi.fn(),
  checkInCount: vi.fn(),
}));

import { createSlashCommands, getActionHandler } from '@/utils/slashCommands';
import { SLASH_COMMAND_FILTERS } from '@/constants';
import { showFocusPlanDialog } from '@/utils/dialog';
import { extractItemFromBlock } from '@/utils/slashCommandUtils';
import { showMessage } from 'siyuan';

describe('focus plan slash commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('注册 /focusplan 内置命令', () => {
    const commands = createSlashCommands({
      pluginName: 'task-assistant',
      openCustomTab: vi.fn(),
      openPomodoroDock: vi.fn(),
      openTodoDock: vi.fn(),
      openHabitDock: vi.fn(),
    });

    expect(commands.some(cmd => cmd.id === 'bullet-journal-set-focus-plan')).toBe(true);
  });

  it('触发 setFocusPlan 时打开当前事项的预计编辑器', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue({
      blockId: 'block-1',
      content: '整理资料',
      date: '2026-05-14',
      lineNumber: 1,
      docId: 'doc-1',
      status: 'pending',
    } as any);

    const handler = getActionHandler('setFocusPlan', {
      pluginName: 'task-assistant',
      openCustomTab: vi.fn(),
      openPomodoroDock: vi.fn(),
      openTodoDock: vi.fn(),
      openHabitDock: vi.fn(),
    }, SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN);

    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '整理资料 @2026-05-14 /focusplan';

    handler({} as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(extractItemFromBlock).toHaveBeenCalledWith('block-1');
    expect(showFocusPlanDialog).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'block-1',
      content: '整理资料',
    }));
  });

  it('当前块不是事项时不应打开预计编辑器，并提示错误', async () => {
    vi.mocked(extractItemFromBlock).mockResolvedValue(null);
    const messageSpy = vi.mocked(showMessage);

    const handler = getActionHandler('setFocusPlan', {
      pluginName: 'task-assistant',
      openCustomTab: vi.fn(),
      openPomodoroDock: vi.fn(),
      openTodoDock: vi.fn(),
      openHabitDock: vi.fn(),
    }, SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN);

    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-non-item');
    const textNode = document.createTextNode('普通文本 /focusplan');
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

    expect(showFocusPlanDialog).not.toHaveBeenCalled();
    expect(textNode.textContent).toBe('普通文本');
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });
});
