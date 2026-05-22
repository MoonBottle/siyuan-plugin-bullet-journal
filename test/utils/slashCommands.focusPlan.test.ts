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

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn().mockResolvedValue(true),
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

import { createSlashCommands, getActionHandler } from '@/utils/slashCommands';
import { writeBlock } from '@/utils/blockWriter';
import { SLASH_COMMAND_FILTERS } from '@/constants';
import { showFocusPlanDialog } from '@/utils/dialog';
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
    const handler = getActionHandler('setFocusPlan', {
      pluginName: 'task-assistant',
      openCustomTab: vi.fn(),
      openPomodoroDock: vi.fn(),
      openTodoDock: vi.fn(),
      openHabitDock: vi.fn(),
    }, SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN);

    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    const textNode = document.createTextNode('整理资料 @2026-05-14 /focusplan');
    node.appendChild(textNode);
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const protyle = {};
    handler(protyle as any, node);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(writeBlock)).not.toHaveBeenCalled();
    expect(showFocusPlanDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-1',
        content: '整理资料',
      }),
      expect.objectContaining({
        leadingPatches: [{ type: 'removeSlashCommand' }],
        writeContext: expect.objectContaining({
          blockId: 'block-1',
          nodeElement: node,
          protyle,
          slashRange: expect.any(Range),
        }),
      }),
    );
  });

  it('当前块不是事项时不应打开预计编辑器，并提示错误', async () => {
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
    expect(vi.mocked(writeBlock)).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-non-item', nodeElement: node, protyle }),
      { type: 'removeSlashCommand' },
    );
    expect(messageSpy).toHaveBeenCalledWith('当前块不是有效的事项', 2000, 'error');
  });
});
