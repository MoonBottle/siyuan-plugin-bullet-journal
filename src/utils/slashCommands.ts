/**
 * 斜杠命令管理器
 * 注册和管理所有斜杠命令
 */

import { showMessage } from 'siyuan';
import { createApp } from 'vue';
import { t } from '@/i18n';
import { getSharedPinia } from '@/utils/sharedPinia';
import { usePomodoroStore, useSettingsStore } from '@/stores';
import { showDatePickerDialog, showItemDetailModal, createDialog } from '@/utils/dialog';
import { updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
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
import type { Item, ProjectDirectory } from '@/types/models';
import type { CustomSlashCommand } from '@/settings/types';
import { getHPathByID } from '@/api';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';

/**
 * 获取编辑器 range，参考思源官方实现 selection.ts#getEditorRange
 * @param element 编辑器元素
 */
function getEditorRange(element: Element): Range | null {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (element === range.startContainer || element.contains(range.startContainer)) {
      return range;
    }
  }
  return null;
}



/**
 * 删除斜杠命令触发的内容
 * 简化逻辑：删除整行中所有出现的斜杠命令（包括子集），保留其他内容
 * @param protyle Protyle 编辑器实例
 * @param filters 可能的斜杠命令前缀数组
 * @param suffix 可选的要追加的标记（如 '#任务'），在删除斜杠命令后追加
 */
export function deleteSlashCommandContent(protyle: any, filters: string[], suffix?: string): void {
  // 获取编辑器元素
  const wysiwygElement = protyle.wysiwyg?.element || protyle.protyle?.wysiwyg?.element;
  if (!wysiwygElement) return;

  // 获取选中的 range 来确定当前位置
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const startContainer = range.startContainer;
  if (startContainer.nodeType !== Node.TEXT_NODE) return;

  const textNode = startContainer as Text;
  const textContent = textNode.textContent || '';
  const currentOffset = range.startOffset;

  // 找到当前行的起始和结束位置
  let lineStart = currentOffset;
  while (lineStart > 0 && textContent[lineStart - 1] !== '\n' && textContent[lineStart - 1] !== '\r') {
    lineStart--;
  }

  let lineEnd = currentOffset;
  while (lineEnd < textContent.length && textContent[lineEnd] !== '\n' && textContent[lineEnd] !== '\r') {
    lineEnd++;
  }

  // 提取当前行
  const lineText = textContent.substring(lineStart, lineEnd);

  // 处理行文本
  let newLineText = processLineText(lineText, filters);

  // 如果有 suffix，处理标记追加
  if (suffix) {
    // 如果是任务标记，先移除所有可能的任务标记（支持语言切换场景）
    if (suffix === '#任务' || suffix === '#task') {
      newLineText = newLineText.replace(/#任务#?/g, '').replace(/#task#?/gi, '');
    }
    // 追加新标记（如果不存在）
    if (!newLineText.includes(suffix)) {
      newLineText = newLineText.trimEnd() + ' ' + suffix;
    }
  }

  // 如果有修改，更新文本并提交事务
  if (newLineText !== lineText) {
    // 找到包含当前文本节点的块元素
    let blockElement = startContainer.parentElement;
    while (blockElement && !blockElement.getAttribute('data-node-id')) {
      blockElement = blockElement.parentElement;
    }

    if (!blockElement) return;

    const blockId = blockElement.getAttribute('data-node-id');
    const oldHTML = blockElement.outerHTML;

    // 更新文本
    const newText = textContent.substring(0, lineStart) + newLineText + textContent.substring(lineEnd);
    textNode.textContent = newText;

    // 更新块的 updated 属性
    const now = new Date();
    const updated = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    blockElement.setAttribute('updated', updated);

    // 提交事务以持久化修改
    const newHTML = blockElement.outerHTML;
    if (newHTML !== oldHTML) {
      protyle.toolbar?.setInlineMark?.(protyle, '', 'clear', {});
      updateTransaction(protyle, blockId, newHTML, oldHTML);
    }
  }
}

/**
 * 更新事务 - 参考思源官方实现
 * @param protyle Protyle 编辑器实例
 * @param id 块 ID
 * @param newHTML 新 HTML
 * @param html 旧 HTML
 */
function updateTransaction(protyle: any, id: string, newHTML: string, html: string): void {
  if (newHTML === html) {
    return;
  }

  const doOperations = [{
    id,
    data: newHTML,
    action: 'update'
  }];

  const undoOperations = [{
    id,
    data: html,
    action: 'update'
  }];

  // 调用思源的 transaction 方法
  if (protyle.transaction) {
    protyle.transaction(doOperations, undoOperations);
  } else if (window.siyuan?.transactions) {
    // 备用方案：直接添加到 transactions 队列
    window.siyuan.transactions.push({
      protyle,
      doOperations,
      undoOperations
    });
  }
}

/**
 * 斜杠命令配置接口
 */
export interface SlashCommandConfig {
  pluginName: string;
  openCustomTab: (tabType: string, options?: { initialDate?: string; initialView?: string }) => void;
  openPomodoroDock: () => void;
  openTodoDock: () => void;
  customSlashCommands?: CustomSlashCommand[];
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
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.TODAY);
        markAsTodayItem(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.TOMORROW,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTomorrowItem}</span>
          <span class="b3-list-item__meta">@${dayjs().add(1, 'day').format('YYYY-MM-DD')}</span>
      </div>`,
      id: 'bullet-journal-mark-tomorrow',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.TOMORROW);
        markAsTomorrowItem(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.DATE,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsDateItem}</span>
          <span class="b3-list-item__meta">Date</span>
      </div>`,
      id: 'bullet-journal-mark-date',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.DATE);
        markAsDateItem(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.DONE,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsDone}</span>
          <span class="b3-list-item__meta">✓</span>
      </div>`,
      id: 'bullet-journal-mark-done',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.DONE);
        markAsDone(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.ABANDON,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsAbandoned}</span>
          <span class="b3-list-item__meta">✗</span>
      </div>`,
      id: 'bullet-journal-mark-abandon',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.ABANDON);
        markAsAbandoned(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendar}</span>
          <span class="b3-list-item__meta">Calendar</span>
      </div>`,
      id: 'bullet-journal-open-calendar',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.CALENDAR);
        openCalendarForBlock(nodeElement, config.openCustomTab);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_DAY,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarDay}</span>
          <span class="b3-list-item__meta">Calendar Day</span>
      </div>`,
      id: 'bullet-journal-open-calendar-day',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.CALENDAR_DAY);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'day');
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_WEEK,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarWeek}</span>
          <span class="b3-list-item__meta">Calendar Week</span>
      </div>`,
      id: 'bullet-journal-open-calendar-week',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.CALENDAR_WEEK);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'week');
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_MONTH,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarMonth}</span>
          <span class="b3-list-item__meta">Calendar Month</span>
      </div>`,
      id: 'bullet-journal-open-calendar-month',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.CALENDAR_MONTH);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'month');
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.CALENDAR_LIST,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendarList}</span>
          <span class="b3-list-item__meta">Calendar List</span>
      </div>`,
      id: 'bullet-journal-open-calendar-list',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.CALENDAR_LIST);
        openCalendarForBlock(nodeElement, config.openCustomTab, 'list');
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.GANTT,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openGantt}</span>
          <span class="b3-list-item__meta">Gantt</span>
      </div>`,
      id: 'bullet-journal-open-gantt',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.GANTT);
        openGanttForBlock(nodeElement, config.openCustomTab);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.FOCUS,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').startFocus}</span>
          <span class="b3-list-item__meta">🍅</span>
      </div>`,
      id: 'bullet-journal-start-focus',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.FOCUS);
        startFocusFromSlash(nodeElement, config.openPomodoroDock);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.TODO,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openTodoDock}</span>
          <span class="b3-list-item__meta">Todo</span>
      </div>`,
      id: 'bullet-journal-open-todo-dock',
      callback: (protyle: any) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.TODO);
        config.openTodoDock();
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.SET_PROJECT_DIR,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').setAsProjectDir}</span>
          <span class="b3-list-item__meta">Dir</span>
      </div>`,
      id: 'bullet-journal-set-project-dir',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.SET_PROJECT_DIR);
        setAsProjectDir(nodeElement);
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.MARK_AS_TASK,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTask}</span>
          <span class="b3-list-item__meta">Task</span>
      </div>`,
      id: 'bullet-journal-mark-task',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        const taskTag = t('taskTag');
        const blockContent = nodeElement.textContent || '';
        if (blockContent.includes(taskTag)) {
          deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.MARK_AS_TASK);
          showMessage(t('slash').alreadyMarkedTask, 2000, 'info');
          return;
        }
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.MARK_AS_TASK, taskTag);
        showMessage(t('slash').markTaskSuccess, 2000, 'info');
      }
    },
    {
      filter: SLASH_COMMAND_FILTERS.VIEW_DETAIL,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').viewDetail}</span>
          <span class="b3-list-item__meta">Detail</span>
      </div>`,
      id: 'bullet-journal-view-detail',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, SLASH_COMMAND_FILTERS.VIEW_DETAIL);
        viewDetail(nodeElement);
      }
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
  return customCommands.map(cmd => {
    const actionHandler = getActionHandler(cmd.action, config);
    const actionLabel = getActionLabel(cmd.action);

    return {
      filter: cmd.commands,
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${cmd.name}</span>
          <span class="b3-list-item__meta">${actionLabel}</span>
      </div>`,
      id: `bullet-journal-custom-${cmd.id}`,
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, cmd.commands);
        actionHandler(protyle, nodeElement);
      }
    };
  });
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

    // 触发数据刷新
    eventBus.emit(Events.DATA_REFRESH);
    broadcastDataRefresh(settingsStore.$state as object);

    showMessage(t('slash').setProjectDirSuccess, 3000, 'info');
  } catch (error) {
    console.error('[Task Assistant] Failed to set project dir:', error);
    showMessage('设置项目目录失败', 3000, 'error');
  }
}

/**
 * 标记为任务
 * 在块内容中添加任务标记
 */
async function markAsTask(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  // 检查是否已标记为任务
  const blockContent = nodeElement.textContent || '';
  const taskTag = t('taskTag');
  if (blockContent.includes(taskTag)) {
    showMessage(t('slash').alreadyMarkedTask, 2000, 'info');
    return;
  }

  const success = await updateBlockContent(blockId, taskTag);

  if (success) {
    showMessage(t('slash').markTaskSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 查看详情
 * 打开事项详情弹框
 */
async function viewDetail(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  // 从块内容提取事项信息
  const item = await extractItemFromBlock(blockId);
  if (!item) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  // 打开详情弹框 - 斜杠命令展示所有日期
  showItemDetailModal(item, { showAllDates: true });
}

/**
 * 获取动作处理器
 */
function getActionHandler(
  action: CustomSlashCommand['action'],
  config: SlashCommandConfig
): (protyle: any, nodeElement: HTMLElement) => void {
  switch (action) {
    case 'today':
      return (_protyle, nodeElement) => markAsTodayItem(nodeElement);
    case 'tomorrow':
      return (_protyle, nodeElement) => markAsTomorrowItem(nodeElement);
    case 'date':
      return (_protyle, nodeElement) => markAsDateItem(nodeElement);
    case 'done':
      return (_protyle, nodeElement) => markAsDone(nodeElement);
    case 'abandon':
      return (_protyle, nodeElement) => markAsAbandoned(nodeElement);
    case 'calendar':
      return (_protyle, nodeElement) => openCalendarForBlock(nodeElement, config.openCustomTab);
    case 'calendarDay':
      return (_protyle, nodeElement) => openCalendarForBlock(nodeElement, config.openCustomTab, 'day');
    case 'calendarWeek':
      return (_protyle, nodeElement) => openCalendarForBlock(nodeElement, config.openCustomTab, 'week');
    case 'calendarMonth':
      return (_protyle, nodeElement) => openCalendarForBlock(nodeElement, config.openCustomTab, 'month');
    case 'calendarList':
      return (_protyle, nodeElement) => openCalendarForBlock(nodeElement, config.openCustomTab, 'list');
    case 'gantt':
      return (_protyle, nodeElement) => openGanttForBlock(nodeElement, config.openCustomTab);
    case 'focus':
      return (_protyle, nodeElement) => startFocusFromSlash(nodeElement, config.openPomodoroDock);
    case 'todo':
      return () => config.openTodoDock();
    case 'setProjectDir':
      return (_protyle, nodeElement) => setAsProjectDir(nodeElement);
    case 'markAsTask':
      return (_protyle, nodeElement) => markAsTask(nodeElement);
    case 'viewDetail':
      return (_protyle, nodeElement) => viewDetail(nodeElement);
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
    viewDetail: 'Detail'
  };
  return labels[action] || action;
}

/**
 * 标记为今日事项
 */
async function markAsTodayItem(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const today = formatDate(new Date());

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查今天是否已存在
  const todayItem = existingItems.find(item => item.date === today);
  if (todayItem) {
    // 今天已存在，不需要重复添加
    showMessage(t('slash').alreadyMarkedToday || '今天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加今日日期
  const success = await updateBlockDateTime(
    blockId,
    today,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined  // status
  );

  if (success) {
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 标记为明天事项
 */
async function markAsTomorrowItem(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) return;

  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // 从 pinia 中获取已有日期时间信息
  const existingItems = await extractDatesFromBlock(blockId);

  // 检查明天是否已存在
  const tomorrowItem = existingItems.find(item => item.date === tomorrow);
  if (tomorrowItem) {
    showMessage(t('slash').alreadyMarkedTomorrow || '明天已标记', 2000, 'info');
    return;
  }

  // 使用 updateBlockDateTime 添加明天日期
  const success = await updateBlockDateTime(
    blockId,
    tomorrow,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    existingItems.length > 0 ? existingItems : undefined,
    undefined  // status
  );

  if (success) {
    showMessage(t('slash').markTomorrowSuccess || '已标记为明天事项', 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 标记为指定日期事项
 */
async function markAsDateItem(nodeElement: HTMLElement) {
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
        showMessage(t('slash').alreadyMarkedDate || '该日期已标记', 2000, 'info');
        return;
      }

      // 使用 updateBlockDateTime 添加日期
      const success = await updateBlockDateTime(
        blockId,
        selectedDate,
        undefined, // newStartTime
        undefined, // newEndTime
        true,      // allDay
        undefined, // originalDate - undefined 表示添加新日期
        existingItems.length > 0 ? existingItems : undefined,
        undefined  // status
      );

      if (success) {
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

  const tag = getStatusTag('completed');
  const success = await updateBlockContent(blockId, tag);

  if (success) {
    showMessage(t('slash').markDoneSuccess || '已标记为已完成', 2000, 'info');
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
function openPomodoroDialogWithItem(item: Item, openPomodoroDock: () => void) {
  const dialog = createDialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto'
  });

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount');
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => dialog.destroy(),
      preselectedItem: item,
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
  openPomodoroDock: () => void
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

  // 从块内容提取事项信息
  const preselectedItem = await extractItemFromBlock(blockId);
  if (!preselectedItem) {
    showMessage('当前块不是有效的事项', 2000, 'error');
    return;
  }

  // 打开预选弹框（无左侧列表）
  openPomodoroDialogWithItem(preselectedItem, openPomodoroDock);
}
