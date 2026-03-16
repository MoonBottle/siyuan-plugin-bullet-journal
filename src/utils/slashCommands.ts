/**
 * 斜杠命令管理器
 * 注册和管理所有斜杠命令
 */

import { showMessage } from 'siyuan';
import { createApp } from 'vue';
import { t } from '@/i18n';
import { getSharedPinia } from '@/utils/sharedPinia';
import { usePomodoroStore } from '@/stores';
import { createDialog } from '@/utils/dialog';
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
import type { Item } from '@/types/models';

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
 */
export function deleteSlashCommandContent(protyle: any, filters: string[]): void {
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
}

/**
 * 创建斜杠命令
 */
export function createSlashCommands(config: SlashCommandConfig) {
  const today = formatDate(new Date());

  return [
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
    }
  ];
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
