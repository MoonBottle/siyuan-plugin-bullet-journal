/**
 * 斜杠命令管理器
 * 注册和管理所有斜杠命令
 */

import { showMessage } from 'siyuan';
import { createApp } from 'vue';
import { t } from '@/i18n';
import { getSharedPinia } from '@/utils/sharedPinia';
import { usePomodoroStore, useProjectStore, useSettingsStore } from '@/stores';
import { showDatePickerDialog, showItemDetailModal, createDialog, showReminderSettingDialog, showRecurringSettingDialog, showPrioritySettingDialog, showHabitCreateDialog, showFocusPlanDialog } from '@/utils/dialog';
import { insertBlock } from '@/api';
import { usePlugin } from '@/main';
import { updateBlockContent } from '@/utils/fileUtils';
import {
  generateSlashPatterns,
  processLineText,
  formatDate,
  extractDatesFromBlock,
  findNearestDate,
  extractItemFromBlock
} from '@/utils/slashCommandUtils';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { TAB_TYPES, SLASH_COMMAND_FILTERS } from '@/constants';
import dayjs from 'dayjs';
import type { Habit, Item, ProjectDirectory, PriorityLevel } from '@/types/models';
import { parseHabitRecordLine, parseHabitLine } from '@/parser/habitParser';
import { parsePriorityFromLine } from '@/parser/priorityParser';
import type { CustomSlashCommand } from '@/settings/types';
import { getHPathByID, getBlockByID, renameDocByID, updateBlock } from '@/api';
import { writeBlock, type DatePatch } from '@/utils/blockWriter';
import {
  RefreshReasons,
  createFullRefreshRequest,
  submitRefreshRequest,
} from '@/utils/refreshRequests';
import { checkIn, checkInCount } from '@/services/habitService';
import type { CheckInRecord } from '@/types/models';
import type { HabitDockNavigationTarget } from '@/utils/habitDockNavigation';

function removeSlashCommandViaWriter(
  protyle: any,
  nodeElement: HTMLElement | null | undefined,
  options?: {
    blockId?: string;
    suffix?: string;
  },
): Promise<boolean> {
  const blockId = options?.blockId || nodeElement?.getAttribute('data-node-id');
  if (!nodeElement || !blockId) {
    return Promise.resolve(false);
  }
  return writeBlock(
    { blockId, nodeElement, protyle },
    options?.suffix
      ? { type: 'removeSlashCommand', suffix: options.suffix }
      : { type: 'removeSlashCommand' },
  );
}

function cleanupActiveSlashCommandLocally(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const textNode = range.startContainer as Text;
  const textContent = textNode.textContent || '';
  const currentOffset = range.startOffset;
  const slashIndex = textContent.lastIndexOf('/', currentOffset);
  if (slashIndex === -1) {
    return;
  }

  let deleteStart = slashIndex;
  if (deleteStart > 0 && /\s/.test(textContent[deleteStart - 1])) {
    deleteStart -= 1;
  }

  const newText = textContent.slice(0, deleteStart) + textContent.slice(currentOffset);
  textNode.textContent = newText;

  const blockElement = textNode.parentElement?.closest('[data-node-id]') as HTMLElement | null;
  if (blockElement) {
    const now = new Date();
    const updated = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    blockElement.setAttribute('updated', updated);
  }

  const nextRange = document.createRange();
  nextRange.setStart(textNode, Math.min(deleteStart, newText.length));
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

/**
 * 斜杠命令配置接口
 */
export interface SlashCommandConfig {
  pluginName: string;
  openCustomTab: (tabType: string, options?: { initialDate?: string; initialView?: string }) => void;
  openPomodoroDock: () => void;
  openTodoDock: () => void;
  openHabitDock: (target?: HabitDockNavigationTarget) => void;
  customSlashCommands?: CustomSlashCommand[];
}

function getAllHabits(): Habit[] {
  try {
    const pinia = getSharedPinia() || undefined;
    const projectStore = useProjectStore(pinia as any);
    return projectStore.getHabits('');
  } catch {
    return [];
  }
}

function findHabitByDefinitionBlockId(blockId?: string): Habit | null {
  if (!blockId) return null;
  return getAllHabits().find(habit => habit.blockId === blockId) ?? null;
}

function findHabitAndRecordByRecordBlockId(blockId?: string): { habit: Habit; record: CheckInRecord } | null {
  if (!blockId) return null;
  for (const habit of getAllHabits()) {
    const record = habit.records.find(item => item.blockId === blockId);
    if (record) {
      return { habit, record };
    }
  }
  return null;
}

function notifyHabitDataRefresh(): void {
  submitRefreshRequest(createFullRefreshRequest(RefreshReasons.SLASH_COMMAND_HABIT_DATA));
}

/**
 * 创建斜杠命令
 */
export function createSlashCommands(config: SlashCommandConfig) {
  const today = formatDate(new Date());

  const builtinCommands = [
    {
      filter: SLASH_COMMAND_FILTERS.TODAY,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTodayItem}</span>
          <span class="b3-list-item__meta">@${today}</span>
      </div>`,
      id: 'bullet-journal-mark-today',
      callback: getActionHandler('today', config, SLASH_COMMAND_FILTERS.TODAY)
    },
    {
      filter: SLASH_COMMAND_FILTERS.TOMORROW,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTomorrowItem}</span>
          <span class="b3-list-item__meta">@${dayjs().add(1, 'day').format('YYYY-MM-DD')}</span>
      </div>`,
      id: 'bullet-journal-mark-tomorrow',
      callback: getActionHandler('tomorrow', config, SLASH_COMMAND_FILTERS.TOMORROW)
    },
    {
      filter: SLASH_COMMAND_FILTERS.DATE,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsDateItem}</span>
          <span class="b3-list-item__meta">Date</span>
      </div>`,
      id: 'bullet-journal-mark-date',
      callback: getActionHandler('date', config, SLASH_COMMAND_FILTERS.DATE)
    },
    {
      filter: SLASH_COMMAND_FILTERS.DONE,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsDone}</span>
          <span class="b3-list-item__meta">✓</span>
      </div>`,
      id: 'bullet-journal-mark-done',
      callback: getActionHandler('done', config, SLASH_COMMAND_FILTERS.DONE)
    },
    {
      filter: SLASH_COMMAND_FILTERS.ABANDON,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsAbandoned}</span>
          <span class="b3-list-item__meta">✗</span>
      </div>`,
      id: 'bullet-journal-mark-abandon',
      callback: getActionHandler('abandon', config, SLASH_COMMAND_FILTERS.ABANDON)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendar}</span>
          <span class="b3-list-item__meta">Calendar</span>
      </div>`,
      id: 'bullet-journal-open-calendar',
      callback: getActionHandler('calendar', config, SLASH_COMMAND_FILTERS.CALENDAR)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_DAY,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarDay}</span>
          <span class="b3-list-item__meta">Calendar Day</span>
      </div>`,
      id: 'bullet-journal-open-calendar-day',
      callback: getActionHandler('calendarDay', config, SLASH_COMMAND_FILTERS.CALENDAR_DAY)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_WEEK,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarWeek}</span>
          <span class="b3-list-item__meta">Calendar Week</span>
      </div>`,
      id: 'bullet-journal-open-calendar-week',
      callback: getActionHandler('calendarWeek', config, SLASH_COMMAND_FILTERS.CALENDAR_WEEK)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_MONTH,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarMonth}</span>
          <span class="b3-list-item__meta">Calendar Month</span>
      </div>`,
      id: 'bullet-journal-open-calendar-month',
      callback: getActionHandler('calendarMonth', config, SLASH_COMMAND_FILTERS.CALENDAR_MONTH)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_LIST,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarList}</span>
          <span class="b3-list-item__meta">Calendar List</span>
      </div>`,
      id: 'bullet-journal-open-calendar-list',
      callback: getActionHandler('calendarList', config, SLASH_COMMAND_FILTERS.CALENDAR_LIST)
    },
    {
      filter: SLASH_COMMAND_FILTERS.GANTT,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openGantt}</span>
          <span class="b3-list-item__meta">Gantt</span>
      </div>`,
      id: 'bullet-journal-open-gantt',
      callback: getActionHandler('gantt', config, SLASH_COMMAND_FILTERS.GANTT)
    },
    {
      filter: SLASH_COMMAND_FILTERS.FOCUS,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').startFocus}</span>
          <span class="b3-list-item__meta">🍅</span>
      </div>`,
      id: 'bullet-journal-start-focus',
      callback: getActionHandler('focus', config, SLASH_COMMAND_FILTERS.FOCUS)
    },
    {
      filter: SLASH_COMMAND_FILTERS.TODO,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openTodoDock}</span>
          <span class="b3-list-item__meta">Todo</span>
      </div>`,
      id: 'bullet-journal-open-todo-dock',
      callback: getActionHandler('todo', config, SLASH_COMMAND_FILTERS.TODO)
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_PROJECT_DIR,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setAsProjectDir}</span>
          <span class="b3-list-item__meta">Dir</span>
      </div>`,
      id: 'bullet-journal-set-project-dir',
      callback: getActionHandler('setProjectDir', config, SLASH_COMMAND_FILTERS.SET_PROJECT_DIR)
    },
    {
      filter: SLASH_COMMAND_FILTERS.MARK_AS_TASK,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTask}</span>
          <span class="b3-list-item__meta">Task</span>
      </div>`,
      id: 'bullet-journal-mark-task',
      callback: getActionHandler('markAsTask', config, SLASH_COMMAND_FILTERS.MARK_AS_TASK)
    },
    {
      filter: SLASH_COMMAND_FILTERS.VIEW_DETAIL,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').viewDetail}</span>
          <span class="b3-list-item__meta">Detail</span>
      </div>`,
      id: 'bullet-journal-view-detail',
      callback: getActionHandler('viewDetail', config, SLASH_COMMAND_FILTERS.VIEW_DETAIL)
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setFocusPlan}</span>
          <span class="b3-list-item__meta">🍅 ⏳</span>
      </div>`,
      id: 'bullet-journal-set-focus-plan',
      callback: getActionHandler('setFocusPlan', config, SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN)
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_REMINDER,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setReminder}</span>
          <span class="b3-list-item__meta">⏰</span>
      </div>`,
      id: 'bullet-journal-set-reminder',
      callback: getActionHandler('setReminder', config, SLASH_COMMAND_FILTERS.SET_REMINDER)
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_RECURRING,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setRecurring}</span>
          <span class="b3-list-item__meta">🔁</span>
      </div>`,
      id: 'bullet-journal-set-recurring',
      callback: getActionHandler('setRecurring', config, SLASH_COMMAND_FILTERS.SET_RECURRING)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CREATE_SKILL,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').createSkill}</span>
          <span class="b3-list-item__meta">AI Skill</span>
      </div>`,
      id: 'bullet-journal-create-skill',
      callback: getActionHandler('createSkill', config, SLASH_COMMAND_FILTERS.CREATE_SKILL)
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_PRIORITY,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setPriority}</span>
          <span class="b3-list-item__meta">🔥🌱🍃</span>
      </div>`,
      id: 'bullet-journal-set-priority',
      callback: getActionHandler('setPriority', config, SLASH_COMMAND_FILTERS.SET_PRIORITY)
    },
    {
      filter: SLASH_COMMAND_FILTERS.HABIT,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').createHabit || '创建习惯'}</span>
          <span class="b3-list-item__meta">🎯</span>
      </div>`,
      id: 'bullet-journal-create-habit',
      callback: getActionHandler('createHabit', config, SLASH_COMMAND_FILTERS.HABIT)
    },
    {
      filter: SLASH_COMMAND_FILTERS.CHECK_IN,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').checkIn || '打卡'}</span>
          <span class="b3-list-item__meta">✅</span>
      </div>`,
      id: 'bullet-journal-check-in',
      callback: getActionHandler('checkIn', config, SLASH_COMMAND_FILTERS.CHECK_IN)
    },
    {
      filter: SLASH_COMMAND_FILTERS.HABIT_DOCK,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').habitDock || '习惯面板'}</span>
          <span class="b3-list-item__meta">📋</span>
      </div>`,
      id: 'bullet-journal-habit-dock',
      callback: () => { config.openHabitDock(); }
    }
  ];

  // 创建自定义命令
  const customCommands = createCustomSlashCommands(config.customSlashCommands || [], config);

  // 合并所有命令并去重（自定义命令优先）
  const allCommands = [...builtinCommands, ...customCommands];
  const commandMap = new Map<string, typeof allCommands[0]>();

  for (const cmd of allCommands) {
    // 使用命令的 id 作为唯一标识
    commandMap.set(cmd.id, cmd);
  }

  return Array.from(commandMap.values());
}

/**
 * 创建自定义斜杠命令
 */
function createCustomSlashCommands(
  customCommands: CustomSlashCommand[],
  config: SlashCommandConfig
): Array<{ filter: string[]; html: string; id: string; callback: Function }> {
  return customCommands.map(cmd => ({
    filter: cmd.commands,
    html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${cmd.name}</span>
          <span class="b3-list-item__meta">${getActionLabel(cmd.action)}</span>
      </div>`,
    id: `bullet-journal-custom-${cmd.id}`,
    callback: getActionHandler(cmd.action, config, cmd.commands)
  }));
}

/**
 * 设置为项目目录
 * 根据块 ID 找到所在文档，将文档路径添加到项目目录
 */
async function setAsProjectDir(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  try {
    // 获取文档路径
    const hPath = await getHPathByID(blockId);
    if (!hPath) {
      showMessage('无法获取文档路径', 2000, 'error');
      return;
    }

    // 获取设置 store
    const pinia = getSharedPinia();
    if (!pinia) {
      showMessage('无法获取设置', 2000, 'error');
      return;
    }

    const settingsStore = useSettingsStore(pinia);
    const existingPaths = settingsStore.directories.map(d => d.path);

    // 检查是否已存在
    if (existingPaths.includes(hPath)) {
      showMessage(t('common').dirsExist, 3000, 'info');
      return;
    }

    // 添加新目录
    const newDir: ProjectDirectory = {
      id: 'dir-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      path: hPath,
      enabled: true,
      groupId: settingsStore.defaultGroup || undefined
    };

    settingsStore.directories.push(newDir);
    settingsStore.saveToPlugin();

    submitRefreshRequest(
      createFullRefreshRequest(
        RefreshReasons.SLASH_COMMAND_SET_PROJECT_DIR,
        settingsStore.$state as Record<string, unknown>,
      ),
    );

    showMessage(t('slash').setProjectDirSuccess, 3000, 'info');
  } catch (error) {
    console.error('[Task Assistant] Failed to set project dir:', error);
    showMessage('设置项目目录失败', 3000, 'error');
  }
}

/**
 * 查看详情
 * 打开事项详情弹框
 */
async function viewDetail(nodeElement: HTMLElement, protyle?: any) {
  const item = await getValidatedItemFromNode(nodeElement, protyle);
  if (!item) {
    return;
  }

  // 打开详情弹框 - 斜杠命令展示所有日期
  showItemDetailModal(item, { showAllDates: true });
}

async function getValidatedItemFromNode(
  nodeElement: HTMLElement,
  protyle?: any,
): Promise<Item | null> {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return null;
  }

  const item = await extractItemFromBlock(blockId);
  if (!item) {
    if (protyle) {
      void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
    }
    showMessage('当前块不是有效的事项', 2000, 'error');
    return null;
  }

  return item;
}

/**
 * 获取动作处理器
 * 每个 handler 内部封装 delete + 业务逻辑（需要时）
 */
export function getActionHandler(
  action: CustomSlashCommand['action'],
  config: SlashCommandConfig,
  filter: string[]
): (protyle: any, nodeElement: HTMLElement) => void {
  switch (action) {
    case 'today':
      return (protyle, nodeElement) => {
        const innerParagraph = nodeElement.querySelector('[data-type="NodeParagraph"][data-node-id]') as HTMLElement | null;
        console.log('[SlashCommand] today handler target', {
          nodeTag: nodeElement.tagName,
          nodeType: nodeElement.getAttribute('data-type'),
          nodeBlockId: nodeElement.getAttribute('data-node-id'),
          nodeClass: nodeElement.className,
          innerParagraphBlockId: innerParagraph?.getAttribute('data-node-id'),
          innerParagraphType: innerParagraph?.getAttribute('data-type'),
          textPreview: (nodeElement.textContent || '').slice(0, 120),
        });
        console.log('[JTDBG][slash.today] target', {
          nodeTag: nodeElement.tagName,
          nodeType: nodeElement.getAttribute('data-type'),
          nodeBlockId: nodeElement.getAttribute('data-node-id'),
          nodeClass: nodeElement.className,
          innerParagraphBlockId: innerParagraph?.getAttribute('data-node-id'),
          innerParagraphType: innerParagraph?.getAttribute('data-type'),
          outerHTML: nodeElement.outerHTML.slice(0, 500),
          textPreview: (nodeElement.textContent || '').slice(0, 200),
        });
        markAsTodayItem(protyle, nodeElement);
      };
    case 'tomorrow':
      return (protyle, nodeElement) => {
        const innerParagraph = nodeElement.querySelector('[data-type="NodeParagraph"][data-node-id]') as HTMLElement | null;
        console.log('[SlashCommand] tomorrow handler target', {
          nodeTag: nodeElement.tagName,
          nodeType: nodeElement.getAttribute('data-type'),
          nodeBlockId: nodeElement.getAttribute('data-node-id'),
          nodeClass: nodeElement.className,
          innerParagraphBlockId: innerParagraph?.getAttribute('data-node-id'),
          innerParagraphType: innerParagraph?.getAttribute('data-type'),
          textPreview: (nodeElement.textContent || '').slice(0, 120),
        });
        markAsTomorrowItem(protyle, nodeElement);
      };
    case 'date':
      return (protyle, nodeElement) => {
        const innerParagraph = nodeElement.querySelector('[data-type="NodeParagraph"][data-node-id]') as HTMLElement | null;
        console.log('[SlashCommand] date handler target', {
          nodeTag: nodeElement.tagName,
          nodeType: nodeElement.getAttribute('data-type'),
          nodeBlockId: nodeElement.getAttribute('data-node-id'),
          nodeClass: nodeElement.className,
          innerParagraphBlockId: innerParagraph?.getAttribute('data-node-id'),
          innerParagraphType: innerParagraph?.getAttribute('data-type'),
          textPreview: (nodeElement.textContent || '').slice(0, 120),
        });
        void removeSlashCommandViaWriter(protyle, nodeElement);
        markAsDateItem(protyle, nodeElement);
      };
    case 'done':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          const completedTag = getStatusTag('completed');
          const blockContent = nodeElement.textContent || '';
          // 检查是否已完成（任务列表格式检查 [x]，标签格式检查 tag）
          const isTaskListDone = /\[\s*x\s*\]/i.test(blockContent);
          const blockId = item.blockId || nodeElement.getAttribute('data-node-id');
          if (!blockId) {
            return;
          }
          if ((completedTag && blockContent.includes(completedTag)) || isTaskListDone) {
            void writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand' });
            showMessage(t('slash').alreadyMarkedDone || '已经标记为已完成', 2000, 'info');
            return;
          }

          await writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand' });
          const isTaskListBlock = !!nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]');
          if (!isTaskListBlock) {
            await waitForProtyleTransactionsFlush();
          }
          void writeBlock({ blockId, nodeElement, protyle }, { type: 'setStatus', status: 'completed' });
          showMessage(t('slash').markDoneSuccess || '已标记为已完成', 2000, 'info');
        })();
      };
    case 'abandon':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          const blockId = item.blockId || nodeElement.getAttribute('data-node-id');
          if (!blockId) {
            return;
          }

          const abandonedTag = getStatusTag('abandoned');
          const blockContent = nodeElement.textContent || '';
          if (abandonedTag && blockContent.includes(abandonedTag)) {
            void writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand' });
            showMessage(t('slash').alreadyMarkedAbandoned || '已经标记为已放弃', 2000, 'info');
            return;
          }

          await writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand' });
          const isTaskListBlock = !!nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]');
          if (!isTaskListBlock) {
            await waitForProtyleTransactionsFlush();
          }
          void writeBlock({ blockId, nodeElement, protyle }, { type: 'setStatus', status: 'abandoned' });
          showMessage(t('slash').markAbandonSuccess || '已标记为已放弃', 2000, 'info');
        })();
      };
    case 'calendar':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openCalendarForBlock(nodeElement, config.openCustomTab);
      };
    case 'calendarDay':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'day');
      };
    case 'calendarWeek':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'week');
      };
    case 'calendarMonth':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'month');
      };
    case 'calendarList':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'list');
      };
    case 'gantt':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        openGanttForBlock(nodeElement, config.openCustomTab);
      };
    case 'focus':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          startFocusFromSlash(nodeElement, config.openPomodoroDock, item);
          setTimeout(() => {
            void removeSlashCommandViaWriter(protyle, nodeElement);
          }, 300);
        })();
      };
    case 'todo':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        config.openTodoDock();
      };
    case 'setProjectDir':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        setAsProjectDir(nodeElement);
      };
    case 'markAsTask':
      return (protyle, nodeElement) => {
        const blockId = nodeElement.getAttribute('data-node-id');
        if (!blockId) {
          return;
        }
        const taskTag = t('taskTag');
        const blockContent = nodeElement.textContent || '';
        if (blockContent.includes(taskTag)) {
          void writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand' });
          showMessage(t('slash').alreadyMarkedTask, 2000, 'info');
          return;
        }
        void writeBlock({ blockId, nodeElement, protyle }, { type: 'removeSlashCommand', suffix: taskTag });
        showMessage(t('slash').markTaskSuccess, 2000, 'info');
      };
    case 'viewDetail':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        viewDetail(nodeElement, protyle);
      };
    case 'setFocusPlan':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          void removeSlashCommandViaWriter(protyle, nodeElement, { blockId: item.blockId });
          setFocusPlanForBlock(nodeElement, item);
        })();
      };
    case 'setReminder':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          void removeSlashCommandViaWriter(protyle, nodeElement, { blockId: item.blockId });
          setReminderForBlock(nodeElement, item);
        })();
      };
    case 'setRecurring':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          void removeSlashCommandViaWriter(protyle, nodeElement, { blockId: item.blockId });
          setRecurringForBlock(nodeElement, item);
        })();
      };
    case 'createSkill':
      return (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        createSkillFromSlash(nodeElement);
      };
    case 'setPriority':
      return (protyle, nodeElement) => {
        void (async () => {
          const item = await getValidatedItemFromNode(nodeElement, protyle);
          if (!item) {
            return;
          }

          void removeSlashCommandViaWriter(protyle, nodeElement, { blockId: item.blockId });
          setPriorityForBlock(nodeElement, item);
        })();
      };
    case 'createHabit':
      return (protyle, nodeElement) => {
        const blockText = nodeElement?.textContent || '';
        const text = processLineText(blockText, filter).trim();
        const blockId = nodeElement?.getAttribute?.('data-node-id') || '';
        const parsedHabit = parseHabitLine(text);
        const matchedRecord = findHabitAndRecordByRecordBlockId(blockId);
        const parsedRecord = parseHabitRecordLine(text, blockId);

        void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });

        if (matchedRecord || parsedRecord) {
          showMessage(t('slash').checkIn || '打卡', 2000, 'info');
          return;
        }

        showHabitCreateDialog((markdown) => {
          if (!blockId) {
            return;
          }

          if (parsedHabit) {
            updateBlock('markdown', markdown, blockId);
          } else {
            insertBlock('markdown', markdown, undefined, blockId);
          }
        }, parsedHabit || undefined);
      };
    case 'checkIn':
      return async (protyle, nodeElement) => {
        void removeSlashCommandViaWriter(protyle, nodeElement);
        const text = nodeElement?.textContent?.trim() || '';
        const blockId = nodeElement?.getAttribute?.('data-node-id');
        const parsedHabit = parseHabitLine(text);
        const matchedRecord = findHabitAndRecordByRecordBlockId(blockId);
        const parsedRecord = parseHabitRecordLine(text, blockId || '');
        const currentDate = dayjs().format('YYYY-MM-DD');
        const sharedPinia = getSharedPinia();
        const settingsStore = sharedPinia ? useSettingsStore(sharedPinia) : useSettingsStore();
        const habitCheckInTimePrecision = settingsStore.habitCheckInTimePrecision || 'day';
        const matchedHabit = parsedHabit ? findHabitByDefinitionBlockId(blockId) : null;
        const activeRecordMatch = matchedRecord ?? (parsedRecord ? findHabitAndRecordByRecordBlockId(blockId) : null);
        const isRecordContext = Boolean(activeRecordMatch || parsedRecord);

        if (!parsedHabit || !blockId) {
          if (!isRecordContext) {
            config.openHabitDock();
            return;
          }

          if (activeRecordMatch && activeRecordMatch.record.date !== currentDate) {
            config.openHabitDock({
              habitId: activeRecordMatch.habit.blockId,
              date: activeRecordMatch.record.date,
              recordBlockId: activeRecordMatch.record.blockId,
            });
            return;
          }

          if (activeRecordMatch?.habit.type === 'count') {
            const targetValue = activeRecordMatch.record.targetValue ?? activeRecordMatch.habit.target ?? 0;
            const currentValue = activeRecordMatch.record.currentValue ?? 0;
            if (currentValue >= targetValue) {
              showMessage(t('habit').targetReached || '已达标', 2000, 'info');
              return;
            }
            const success = await checkInCount(activeRecordMatch.habit, currentDate, 1, undefined, habitCheckInTimePrecision);
            if (success) {
              notifyHabitDataRefresh();
            }
            return;
          }

          if (parsedRecord?.currentValue !== undefined) {
            const habit: Habit = {
              name: parsedRecord.content || text,
              docId: parsedRecord.docId || '',
              blockId: parsedRecord.habitId || blockId || '',
              type: 'count',
              startDate: parsedRecord.date,
              target: parsedRecord.targetValue,
              unit: parsedRecord.unit,
              frequency: { type: 'daily' },
              records: [{
                content: parsedRecord.content || text,
                date: parsedRecord.date,
                docId: parsedRecord.docId || '',
                blockId: blockId || '',
                habitId: parsedRecord.habitId || blockId || '',
                currentValue: parsedRecord.currentValue,
                targetValue: parsedRecord.targetValue,
                unit: parsedRecord.unit,
              }],
            };
            const success = await checkInCount(habit, currentDate, 1, undefined, habitCheckInTimePrecision);
            if (success) {
              notifyHabitDataRefresh();
            }
            return;
          }

          showMessage(t('habit').todayChecked || '今天已打卡', 2000, 'info');
          return;
        }

        if (!matchedHabit) {
          showMessage('习惯数据未就绪，请稍后重试', 2000, 'info');
          return;
        }

        const habit: Habit = matchedHabit;
        if (habit.archivedAt) {
          showMessage(t('habit').archivedCannotCheckIn || '习惯已归档', 2000, 'info');
          return;
        }

        const todayRecord = habit.records.find(record => record.date === currentDate);
        if (todayRecord) {
          if (habit.type === 'count') {
            const targetValue = todayRecord.targetValue ?? habit.target ?? 0;
            const currentValue = todayRecord.currentValue ?? 0;
            if (currentValue >= targetValue) {
              showMessage(t('habit').targetReached || '已达标', 2000, 'info');
              return;
            }
            const success = await checkInCount(habit, currentDate, 1, undefined, habitCheckInTimePrecision);
            if (success) {
              notifyHabitDataRefresh();
            }
            return;
          }
          showMessage(t('habit').todayChecked || '今天已打卡', 2000, 'info');
          return;
        }

        if (habit.type === 'count') {
          const success = await checkInCount(habit, currentDate, 1, undefined, habitCheckInTimePrecision);
          if (success) {
            notifyHabitDataRefresh();
          }
        } else {
          const success = await checkIn(habit, currentDate, undefined, habitCheckInTimePrecision);
          if (success) {
            notifyHabitDataRefresh();
          }
        }
      };
    default:
      return () => {};
  }
}

/**
 * 获取动作标签
 */
function getActionLabel(action: CustomSlashCommand['action']): string {
  const labels: Record<string, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    date: 'Date',
    done: 'Done',
    abandon: 'Abandon',
    calendar: 'Calendar',
    calendarDay: 'Calendar Day',
    calendarWeek: 'Calendar Week',
    calendarMonth: 'Calendar Month',
    calendarList: 'Calendar List',
    gantt: 'Gantt',
    focus: 'Focus',
    todo: 'Todo',
    setProjectDir: 'Project Dir',
    markAsTask: 'Task',
    viewDetail: 'Detail',
    setFocusPlan: 'Focus Plan',
    setReminder: 'Reminder',
    setRecurring: 'Recurring',
    createSkill: 'AI Skill',
    setPriority: 'Priority'
  };
  return labels[action] || action;
}

async function writeDatePatchForSlashCommand(
  protyle: any,
  nodeElement: HTMLElement,
  patch: Omit<DatePatch, 'type'>,
): Promise<boolean> {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    return false;
  }
  return writeBlock(
    { blockId, nodeElement, protyle },
    { type: 'addDate', ...patch },
  );
}

/**
 * 标记为今日事项
 * @param protyle 编辑器实例，日期已存在时用于删除斜杠命令
 */
async function markAsTodayItem(
  protyle: any,
  nodeElement: HTMLElement,
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  console.log('[SlashCommand] markAsTodayItem called', { blockId });

  if (!blockId) {
    console.log('[SlashCommand] markAsTodayItem: no blockId');
    return;
  }

  const today = formatDate(new Date());
  console.log('[SlashCommand] markAsTodayItem: today date', today);

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);
  console.log('[SlashCommand] markAsTodayItem: existing items', existingItems);
  console.log('[JTDBG][slash.today] existingItems', {
    blockId,
    existingItems,
  });

  // 检查今天是否已存在
  const todayItem = existingItems.find(item => item.date === today);
  if (todayItem) {
    console.log('[SlashCommand] markAsTodayItem: today already exists');
    // 日期已存在，删除斜杠命令并提示
    void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
    showMessage(t('slash').alreadyMarkedToday || '今天已标记', 2000, 'info');
    return;
  }

  console.log('[SlashCommand] markAsTodayItem: calling writeBlock addDate', {
    blockId,
    today,
    existingItemsCount: existingItems.length,
    hasProtyle: !!protyle,
  });
  console.log('[JTDBG][slash.today] call writeBlock.addDate', {
    blockId,
    today,
    existingItems,
    hasProtyle: !!protyle,
  });

  const success = await writeDatePatchForSlashCommand(protyle, nodeElement, {
    date: today,
    allDay: true,
    siblingItems: existingItems.length > 0 ? existingItems : undefined,
  });

  console.log('[SlashCommand] markAsTodayItem: writeBlock addDate result', success);
  console.log('[JTDBG][slash.today] writeBlock.addDate result', {
    blockId,
    success,
  });

  if (success) {
    cleanupActiveSlashCommandLocally();
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 标记为明天事项
 * @param protyle 编辑器实例，日期已存在时用于删除斜杠命令
 */
async function markAsTomorrowItem(
  protyle: any,
  nodeElement: HTMLElement,
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查明天是否已存在
  const tomorrowItem = existingItems.find(item => item.date === tomorrow);
  if (tomorrowItem) {
    void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
    showMessage(t('slash').alreadyMarkedTomorrow || '明天已标记', 2000, 'info');
    return;
  }

  const success = await writeDatePatchForSlashCommand(protyle, nodeElement, {
    date: tomorrow,
    allDay: true,
    siblingItems: existingItems.length > 0 ? existingItems : undefined,
  });

  if (success) {
    cleanupActiveSlashCommandLocally();
    showMessage(t('slash').markTomorrowSuccess || '已标记为明天事项', 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 标记为指定日期事项
 * @param protyle 编辑器实例，日期已存在时用于删除斜杠命令
 */
async function markAsDateItem(
  protyle: any,
  nodeElement: HTMLElement,
) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 使用 showDatePickerDialog 选择日期
  showDatePickerDialog(
    t('slash').selectDateTitle || '选择日期',
    dayjs().format('YYYY-MM-DD'),
    async (selectedDate) => {
      // 检查日期是否已存在
      const existingItem = existingItems.find(item => item.date === selectedDate);
      if (existingItem) {
        void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
        showMessage(t('slash').alreadyMarkedDate || '该日期已标记', 2000, 'info');
        return;
      }

      const success = await writeDatePatchForSlashCommand(protyle, nodeElement, {
        date: selectedDate,
        allDay: true,
        siblingItems: existingItems.length > 0 ? existingItems : undefined,
      });

      if (success) {
        cleanupActiveSlashCommandLocally();
        showMessage(t('slash').markDateSuccess || '已标记日期', 2000, 'info');
      } else {
        showMessage(t('slash').markFailed, 2000, 'error');
      }
    }
  );
}

/**
 * 根据状态获取标签
 */
function getStatusTag(status: 'completed' | 'abandoned'): string {
  return t('statusTag')[status] || '';
}

/**
 * 等待 protyle 事务队列清空
 */
async function waitForProtyleTransactionsFlush(timeout = 3000): Promise<void> {
  const start = Date.now();
  const siyuanWin = window as any;
  while (siyuanWin.siyuan?.transactions?.length > 0 && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 200));
}

/**
 * 标记为已完成
 */
async function markAsDone(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  // 检查是否已完成
  const blockContent = nodeElement.textContent || '';
  const completedTag = getStatusTag('completed');
  if (completedTag && blockContent.includes(completedTag)) {
    showMessage(t('slash').alreadyMarkedDone || '已经标记为已完成', 2000, 'info');
    return;
  }

  // 标记事项完成
  const tag = getStatusTag('completed');
  const success = await updateBlockContent(blockId, tag);

  if (success) {
    showMessage(t('slash').markDoneSuccess || '已标记为已完成', 2000, 'info');
    
    // 注意：重复事项的自动创建由 WebSocket 处理器处理
    // 避免重复调用 createNextOccurrence
    
    // 数据刷新会触发统一检测逻辑
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 标记为已放弃
 */
async function markAsAbandoned(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  // 检查是否已放弃
  const blockContent = nodeElement.textContent || '';
  const abandonedTag = getStatusTag('abandoned');
  if (abandonedTag && blockContent.includes(abandonedTag)) {
    showMessage(t('slash').alreadyMarkedAbandoned || '已经标记为已放弃', 2000, 'info');
    return;
  }

  const tag = getStatusTag('abandoned');
  const success = await updateBlockContent(blockId, tag);

  if (success) {
    showMessage(t('slash').markAbandonSuccess || '已标记为已放弃', 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}



/**
 * 打开日历（跳转到事项所在日期）
 */
async function openCalendarForBlock(
  nodeElement: HTMLElement,
  openCustomTab: (tabType: string, options?: { initialDate?: string; initialView?: string }) => void,
  initialView?: string
) {
  const blockId = nodeElement.getAttribute('data-node-id');

  let targetDate: string;
  if (!blockId) {
    targetDate = formatDate(new Date());
  } else {
    const items = await extractDatesFromBlock(blockId);
    targetDate = findNearestDate(items);
  }

  openCustomTab(TAB_TYPES.CALENDAR, { initialDate: targetDate, initialView });
}

/**
 * 打开甘特图（跳转到事项所在日期）
 */
async function openGanttForBlock(
  nodeElement: HTMLElement,
  openCustomTab: (tabType: string, options?: { initialDate?: string }) => void
) {
  const blockId = nodeElement.getAttribute('data-node-id');

  let targetDate: string;
  if (!blockId) {
    targetDate = formatDate(new Date());
  } else {
    const items = await extractDatesFromBlock(blockId);
    targetDate = findNearestDate(items);
  }

  openCustomTab(TAB_TYPES.GANTT, { initialDate: targetDate });
}



/**
 * 打开专注弹框（预选模式，无左侧列表）
 */
function openPomodoroDialogWithItem(blockId: string, openPomodoroDock: () => void) {
  const dialog = createDialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto'
  });

  // 自动聚焦到弹框内，使 ESC 键立即生效
  requestAnimationFrame(() => {
    const focusableEl = dialog.element.querySelector('button, input, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    if (focusableEl) {
      focusableEl.focus();
    }
  });

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount');
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => dialog.destroy(),
      preselectedBlockId: blockId,
      hideItemList: true,
      onStartFocus: () => {
        // 开始专注后打开番茄钟 Dock
        openPomodoroDock();
      }
    });
    app.mount(mountEl);
  }
}

/**
 * 从斜杠命令开始专注
 */
async function startFocusFromSlash(
  nodeElement: HTMLElement,
  openPomodoroDock: () => void,
  item?: Item,
) {
  const pinia = getSharedPinia();
  if (!pinia) return;

  const pomodoroStore = usePomodoroStore(pinia);
  if (pomodoroStore.isFocusing || pomodoroStore.isBreakActive) {
    showMessage(t('slash').alreadyFocusing, 2000, 'info');
    return;
  }

  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const preselectedItem = item || await extractItemFromBlock(blockId);
  if (!preselectedItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  // 打开预选弹框（无左侧列表），传递 blockId 而非 item 引用
  // 这样弹框内部可以实时从 store 获取最新的 item 数据
  openPomodoroDialogWithItem(blockId, openPomodoroDock);
}


/**
 * 为块设置提醒
 */
async function setReminderForBlock(nodeElement: HTMLElement, item?: Item) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const targetItem = item || await extractItemFromBlock(blockId);
  if (!targetItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  // 打开提醒设置弹框
  showReminderSettingDialog(targetItem);
}

async function setFocusPlanForBlock(nodeElement: HTMLElement, item?: Item) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const targetItem = item || await extractItemFromBlock(blockId);
  if (!targetItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  showFocusPlanDialog(targetItem);
}

/**
 * 为块设置重复
 */
async function setRecurringForBlock(nodeElement: HTMLElement, item?: Item) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const targetItem = item || await extractItemFromBlock(blockId);
  if (!targetItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  // 打开重复设置弹框
  showRecurringSettingDialog(targetItem);
}

/**
 * 导入 CreateSkillDialog 组件
 */
import CreateSkillDialog from '@/components/dialog/CreateSkillDialog.vue';

/**
 * 从斜杠命令创建技能
 * 将当前文档转换为技能文档
 */
async function createSkillFromSlash(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }
  
  // 获取当前文档信息
  let docId: string;
  let notebook: string;
  let docPath: string;
  
  try {
    const block = await getBlockByID(blockId);
    if (!block) {
      showMessage('无法获取文档信息', 2000, 'error');
      return;
    }
    
    // 获取文档根块
    docId = block.root_id;
    notebook = block.box;
    docPath = block.hpath || '';
  } catch (error) {
    console.error('[SlashCommand] Failed to get document info:', error);
    showMessage('无法获取文档信息', 2000, 'error');
    return;
  }
  
  // 创建容器元素
  const container = document.createElement('div');
  
  // 创建 Vue 应用
  const app = createApp(CreateSkillDialog, {
    mode: 'existing',
    docId,
    notebook,
    docPath,
    onClose: () => {
      dialog.destroy();
    },
    onCreated: async (_docId: string, skillName?: string) => {
      console.log('[SlashCommand] onCreated called:', { _docId, skillName });
      showMessage('技能创建成功！', 3000, 'info');
      // 使用 ID 重命名文档为技能名称
      if (skillName && _docId) {
        console.log('[SlashCommand] Renaming document by ID:', { docId: _docId, newName: skillName });
        try {
          const result = await renameDocByID(_docId, skillName);
          console.log('[SlashCommand] renameDocByID result:', result);
          if (result === null) {
            console.log('[SlashCommand] Rename successful');
          } else {
            console.error('[SlashCommand] Rename failed: API returned unexpected result');
          }
        } catch (error) {
          console.error('[SlashCommand] Failed to rename document:', error);
        }
      } else {
        console.log('[SlashCommand] Skip rename: missing params', { skillName, docId: _docId });
      }
    }
  });
  
  app.use(getSharedPinia());
  app.mount(container);
  
  // 打开创建技能对话框
  const dialog = createDialog({
    title: t('slash').createSkillTitle,
    content: '',
    width: '480px',
    height: 'auto'
  });
  
  const bodyEl = dialog.element.querySelector('.b3-dialog__body');
  if (bodyEl) {
    bodyEl.appendChild(container);
  }
  
  // 自动聚焦到弹框内，使 ESC 键立即生效
  requestAnimationFrame(() => {
    const focusableEl = dialog.element.querySelector('button, input, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    if (focusableEl) {
      focusableEl.focus();
    }
  });
}

/**
 * 为块设置优先级
 */
async function setPriorityForBlock(nodeElement: HTMLElement, item?: Item) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const targetItem = item || await extractItemFromBlock(blockId);
  if (!targetItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  const blockContent = nodeElement.textContent || targetItem.content || '';
  const currentPriority = parsePriorityFromLine(blockContent);

  showPrioritySettingDialog(currentPriority, async (priority) => {
    const success = await writeBlock(
      { blockId },
      { type: 'setPriority', priority },
    );
    if (success) {
      showMessage(priority ? '优先级已设置' : '优先级已清除', 2000, 'info');
    } else {
      showMessage('设置优先级失败', 2000, 'error');
    }
  });
}
