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
import { updateBlockContent } from '@/utils/fileUtils';
import { findItemByBlockId } from '@/utils/itemBlockUtils';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { TAB_TYPES } from '@/constants';
import type { Item } from '@/types/models';

/**
 * 删除斜杠命令触发的内容
 * 参考思源官方实现：通过 range.deleteContents() 删除斜杠及其后续内容
 * @param protyle Protyle 编辑器实例
 * @param slashChar 斜杠字符，默认为 '/'
 */
export function deleteSlashCommandContent(protyle: any, slashChar: string = '/'): void {
  console.log('[deleteSlashCommandContent] 开始执行删除斜杠命令');

  // 获取当前选区
  const selection = window.getSelection();
  console.log('[deleteSlashCommandContent] selection:', selection);
  console.log('[deleteSlashCommandContent] rangeCount:', selection?.rangeCount);

  if (!selection || selection.rangeCount === 0) {
    console.log('[deleteSlashCommandContent] 没有选区，直接返回');
    return;
  }

  const range = selection.getRangeAt(0);
  console.log('[deleteSlashCommandContent] range:', range);
  console.log('[deleteSlashCommandContent] startContainer:', range.startContainer);
  console.log('[deleteSlashCommandContent] startContainer.nodeType:', range.startContainer.nodeType);
  console.log('[deleteSlashCommandContent] Node.TEXT_NODE:', Node.TEXT_NODE);

  const startContainer = range.startContainer;

  // 只在文本节点中处理
  if (startContainer.nodeType !== Node.TEXT_NODE) {
    console.log('[deleteSlashCommandContent] 不是文本节点，直接返回');
    return;
  }

  const textNode = startContainer as Text;
  const textContent = textNode.textContent || '';
  const currentOffset = range.startOffset;

  console.log('[deleteSlashCommandContent] textContent:', JSON.stringify(textContent));
  console.log('[deleteSlashCommandContent] currentOffset:', currentOffset);

  // 查找斜杠字符 - 斜杠可能在光标前或后
  // 斜杠命令格式如：/zz /sx /db 等
  let slashIndex = -1;
  let endIndex = currentOffset;

  // 先从当前位置向后查找斜杠（斜杠可能在光标之后）
  for (let i = currentOffset; i < textContent.length; i++) {
    console.log(`[deleteSlashCommandContent] 向后检查位置 ${i}: 字符='${textContent[i]}'`);
    if (textContent[i] === slashChar) {
      slashIndex = i;
      console.log(`[deleteSlashCommandContent] 向后找到斜杠位置: ${slashIndex}`);
      // 继续找命令结束位置（空格或行尾）
      for (let j = i + 1; j <= textContent.length; j++) {
        if (j === textContent.length || textContent[j] === ' ' || textContent[j] === '\n' || textContent[j] === '\r') {
          endIndex = j;
          console.log(`[deleteSlashCommandContent] 找到命令结束位置: ${endIndex}`);
          break;
        }
      }
      break;
    }
    // 如果遇到换行，停止向后查找
    if (textContent[i] === '\n' || textContent[i] === '\r') {
      console.log(`[deleteSlashCommandContent] 向后查找遇到换行，停止`);
      break;
    }
  }

  // 如果向后没找到，再向前查找（斜杠在光标之前的情况）
  if (slashIndex === -1) {
    for (let i = currentOffset - 1; i >= 0; i--) {
      console.log(`[deleteSlashCommandContent] 向前检查位置 ${i}: 字符='${textContent[i]}'`);
      if (textContent[i] === slashChar) {
        slashIndex = i;
        console.log(`[deleteSlashCommandContent] 向前找到斜杠位置: ${slashIndex}`);
        break;
      }
      // 如果遇到换行，停止向前查找
      if (textContent[i] === '\n' || textContent[i] === '\r') {
        console.log(`[deleteSlashCommandContent] 向前查找遇到换行，停止`);
        break;
      }
    }
  }

  // 没有找到斜杠，不处理
  if (slashIndex === -1) {
    console.log('[deleteSlashCommandContent] 没有找到斜杠，直接返回');
    return;
  }

  console.log(`[deleteSlashCommandContent] 设置 range: start=${slashIndex}, end=${endIndex}`);

  // 设置 range 从斜杠位置到命令结束位置
  range.setStart(textNode, slashIndex);
  range.setEnd(textNode, endIndex);

  console.log('[deleteSlashCommandContent] 准备删除内容');

  // 删除斜杠命令内容
  range.deleteContents();

  console.log('[deleteSlashCommandContent] 删除完成，更新选区');

  // 更新选区
  selection.removeAllRanges();
  selection.addRange(range);

  console.log('[deleteSlashCommandContent] 执行完成');
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
        deleteSlashCommandContent(protyle);
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
        deleteSlashCommandContent(protyle);
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
        deleteSlashCommandContent(protyle);
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
        deleteSlashCommandContent(protyle);
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
        deleteSlashCommandContent(protyle);
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
  const dateSuffix = `@${today}`;

  const success = await updateBlockContent(blockId, dateSuffix);

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
 */
async function extractDatesFromBlock(blockId: string): Promise<string[]> {
  const pinia = getSharedPinia();
  if (!pinia) return [];

  const projectStore = useProjectStore(pinia);
  const item = findItemByBlockId(blockId, projectStore.items);

  if (item) {
    return [item.date];
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
