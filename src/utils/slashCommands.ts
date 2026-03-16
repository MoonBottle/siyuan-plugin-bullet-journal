/**
 * 斜杠命令管理器
 * 注册和管理所有斜杠命令
 */

import { showMessage } from 'siyuan';
import { createApp } from 'vue';
import { t } from '@/i18n';
import { getSharedPinia } from '@/utils/sharedPinia';
import { usePomodoroStore, useProjectStore } from '@/stores';
import { createDialog } from '@/utils/dialog';
import { updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import { findItemByBlockId } from '@/utils/itemBlockUtils';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { TAB_TYPES } from '@/constants';
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
 * 生成所有可能的子集命令（如 /sx -> /s）
 * @param filters 可能的斜杠命令前缀数组
 * @returns 所有子集命令的集合
 */
export function generateSlashPatterns(filters: string[]): Set<string> {
  const allPatterns = new Set<string>();
  for (const filter of filters) {
    // 添加完整 filter
    allPatterns.add(filter);
    // 添加所有前缀（从 / 后开始，至少保留 / 和一个字符）
    for (let i = 2; i < filter.length; i++) {
      allPatterns.add(filter.substring(0, i));
    }
  }
  return allPatterns;
}

/**
 * 处理行文本，删除所有匹配的斜杠命令
 * @param lineText 行文本
 * @param filters 可能的斜杠命令前缀数组
 * @returns 处理后的行文本
 */
export function processLineText(lineText: string, filters: string[]): string {
  const allPatterns = generateSlashPatterns(filters);

  // 删除行中所有匹配的 pattern
  let result = lineText;
  for (const pattern of allPatterns) {
    if (result.includes(pattern)) {
      // 使用正则全局替换，删除所有出现的 pattern
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      result = result.replace(regex, '');
    }
  }

  return result;
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
  const newLineText = processLineText(lineText, filters);

  // 如果有修改，更新文本
  if (newLineText !== lineText) {
    const newText = textContent.substring(0, lineStart) + newLineText + textContent.substring(lineEnd);
    textNode.textContent = newText;
  }
}

/**
 * 斜杠命令配置接口
 */
export interface SlashCommandConfig {
  pluginName: string;
  openCustomTab: (tabType: string, options?: { initialDate?: string }) => void;
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
      filter: ['/sx', '/事项', '/today'],
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').markAsTodayItem}</span>
          <span class="b3-list-item__meta">@${today}</span>
      </div>`,
      id: 'bullet-journal-mark-today',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, ['/sx', '/事项', '/today']);
        markAsTodayItem(nodeElement);
      }
    },
    {
      filter: ['/rl', '/日历', '/calendar'],
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openCalendar}</span>
          <span class="b3-list-item__meta">Calendar</span>
      </div>`,
      id: 'bullet-journal-open-calendar',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, ['/rl', '/日历', '/calendar']);
        openCalendarForBlock(nodeElement, config.openCustomTab);
      }
    },
    {
      filter: ['/gtt', '/甘特图', '/gantt'],
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openGantt}</span>
          <span class="b3-list-item__meta">Gantt</span>
      </div>`,
      id: 'bullet-journal-open-gantt',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, ['/gtt', '/甘特图', '/gantt']);
        openGanttForBlock(nodeElement, config.openCustomTab);
      }
    },
    {
      filter: ['/zz', '/专注', '/focus'],
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').startFocus}</span>
          <span class="b3-list-item__meta">🍅</span>
      </div>`,
      id: 'bullet-journal-start-focus',
      callback: (protyle: any, nodeElement: HTMLElement) => {
        deleteSlashCommandContent(protyle, ['/zz', '/专注', '/focus']);
        startFocusFromSlash(nodeElement, config.openPomodoroDock);
      }
    },
    {
      filter: ['/db', '/待办', '/todo'],
      html: `<div class="b3-list-item__first">
          <span class="b3-list-item__text">${t('slash').openTodoDock}</span>
          <span class="b3-list-item__meta">Todo</span>
      </div>`,
      id: 'bullet-journal-open-todo-dock',
      callback: (protyle: any) => {
        deleteSlashCommandContent(protyle, ['/db', '/待办', '/todo']);
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

  // 从 pinia 中获取已有日期
  const existingDates = await extractDatesFromBlock(blockId);

  // 构建 siblingItems
  const siblingItems = existingDates.map(date => ({ date }));

  // 使用 updateBlockDateTime 添加今日日期
  const success = await updateBlockDateTime(
    blockId,
    today,
    undefined, // newStartTime
    undefined, // newEndTime
    true,      // allDay
    undefined, // originalDate - undefined 表示添加新日期
    siblingItems.length > 0 ? siblingItems : undefined,
    undefined  // status
  );

  if (success) {
    showMessage(t('slash').markSuccess, 2000, 'info');
  } else {
    showMessage(t('slash').markFailed, 2000, 'error');
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 从块内容中提取所有日期标记
 * 直接从 pinia store 中获取，避免重新解析
 * 包括 siblingItems 中的日期
 */
async function extractDatesFromBlock(blockId: string): Promise<string[]> {
  const pinia = getSharedPinia();
  if (!pinia) return [];

  const projectStore = useProjectStore(pinia);
  const item = findItemByBlockId(blockId, projectStore.items);

  if (item) {
    const dates = [item.date];
    // 添加 siblingItems 中的日期
    if (item.siblingItems) {
      dates.push(...item.siblingItems.map(s => s.date));
    }
    return dates;
  }

  return [];
}

/**
 * 找到离今天最近的日期
 * 规则：
 * 1. 如果有多个日期，找离今天最近的一天
 * 2. 间隔相同（今天前后各有一天），取今天之后的日期
 */
function findNearestDate(dates: string[]): string {
  if (dates.length === 0) {
    return formatDate(new Date()); // 今天
  }
  if (dates.length === 1) {
    return dates[0];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  let nearestDate = dates[0];
  let minDiff = Math.abs(new Date(dates[0]).getTime() - todayTime);
  let isAfterToday = new Date(dates[0]).getTime() >= todayTime;

  for (let i = 1; i < dates.length; i++) {
    const dateTime = new Date(dates[i]).getTime();
    const diff = Math.abs(dateTime - todayTime);
    const afterToday = dateTime >= todayTime;

    // 如果间隔更小，更新最近日期
    if (diff < minDiff) {
      minDiff = diff;
      nearestDate = dates[i];
      isAfterToday = afterToday;
    }
    // 如果间隔相同，优先取今天之后的日期
    else if (diff === minDiff && afterToday && !isAfterToday) {
      nearestDate = dates[i];
      isAfterToday = true;
    }
  }

  return nearestDate;
}

/**
 * 打开日历（跳转到事项所在日期）
 */
async function openCalendarForBlock(
  nodeElement: HTMLElement,
  openCustomTab: (tabType: string, options?: { initialDate?: string }) => void
) {
  const blockId = nodeElement.getAttribute('data-node-id');

  let targetDate: string;
  if (!blockId) {
    targetDate = formatDate(new Date());
  } else {
    const dates = await extractDatesFromBlock(blockId);
    targetDate = findNearestDate(dates);
  }

  openCustomTab(TAB_TYPES.CALENDAR, { initialDate: targetDate });
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
    const dates = await extractDatesFromBlock(blockId);
    targetDate = findNearestDate(dates);
  }

  openCustomTab(TAB_TYPES.GANTT, { initialDate: targetDate });
}

/**
 * 从块内容提取事项信息
 * 直接从 pinia store 中获取，避免重新解析
 */
async function extractItemFromBlock(blockId: string): Promise<Item | null> {
  const pinia = getSharedPinia();
  if (!pinia) return null;

  const projectStore = useProjectStore(pinia);
  const item = findItemByBlockId(blockId, projectStore.items);

  return item || null;
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
