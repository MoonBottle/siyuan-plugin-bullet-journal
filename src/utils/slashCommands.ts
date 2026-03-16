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
 * 删除斜杠命令触发的内容
 * 参考思源官方实现 insertHTML.ts#L272：通过 range.deleteContents() 删除斜杠及其后续内容
 * @param protyle Protyle 编辑器实例
 */
export function deleteSlashCommandContent(protyle: any): void {
  console.log('[deleteSlashCommandContent] 开始执行，protyle:', protyle);
  console.log('[deleteSlashCommandContent] protyle.protyle:', protyle.protyle);
  console.log('[deleteSlashCommandContent] protyle.wysiwyg:', protyle.wysiwyg);
  console.log('[deleteSlashCommandContent] protyle.toolbar:', protyle.toolbar);

  // 优先使用 protyle.toolbar.range，如果不存在则使用 getEditorRange
  let range = protyle.toolbar?.range;
  console.log('[deleteSlashCommandContent] protyle.toolbar.range:', range);

  // 尝试从 protyle.protyle.wysiwyg.element 获取（因为传入的 protyle 可能是 wrapper）
  const wysiwygElement = protyle.wysiwyg?.element || protyle.protyle?.wysiwyg?.element;
  console.log('[deleteSlashCommandContent] wysiwygElement:', wysiwygElement);

  if (!range && wysiwygElement) {
    range = getEditorRange(wysiwygElement);
    console.log('[deleteSlashCommandContent] 使用 getEditorRange 获取的 range:', range);
  }

  // 如果还是没有 range，直接使用 window.getSelection()
  if (!range) {
    const selection = window.getSelection();
    console.log('[deleteSlashCommandContent] window.getSelection():', selection, 'rangeCount:', selection?.rangeCount);
    if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
      console.log('[deleteSlashCommandContent] 使用 window.getSelection() 获取的 range:', range);
    }
  }

  if (!range) {
    console.log('[deleteSlashCommandContent] 无 range，直接返回');
    return;
  }

  const startContainer = range.startContainer;
  console.log('[deleteSlashCommandContent] startContainer:', startContainer, 'nodeType:', startContainer?.nodeType);

  // 只在文本节点中处理
  if (startContainer.nodeType !== Node.TEXT_NODE) {
    console.log('[deleteSlashCommandContent] 不是文本节点，直接返回');
    return;
  }

  const textNode = startContainer as Text;
  const textContent = textNode.textContent || '';
  const currentOffset = range.startOffset;
  console.log('[deleteSlashCommandContent] textContent:', textContent, 'currentOffset:', currentOffset);

  // 从当前光标位置向前查找斜杠字符
  let slashIndex = -1;
  for (let i = currentOffset - 1; i >= 0; i--) {
    if (textContent[i] === '/') {
      slashIndex = i;
      break;
    }
    // 如果遇到换行，停止查找
    if (textContent[i] === '\n' || textContent[i] === '\r') {
      break;
    }
  }

  console.log('[deleteSlashCommandContent] 向前查找 slashIndex:', slashIndex);

  // 如果向前没找到，尝试从光标位置向后查找（斜杠可能在光标之后）
  if (slashIndex === -1) {
    for (let i = currentOffset; i < textContent.length; i++) {
      if (textContent[i] === '/') {
        slashIndex = i;
        break;
      }
      // 如果遇到换行，停止查找
      if (textContent[i] === '\n' || textContent[i] === '\r') {
        break;
      }
    }
    console.log('[deleteSlashCommandContent] 向后查找 slashIndex:', slashIndex);
  }

  // 还是没有找到斜杠，不处理
  if (slashIndex === -1) {
    console.log('[deleteSlashCommandContent] 未找到斜杠，直接返回');
    return;
  }

  // 找到斜杠命令的结束位置（到文本末尾或空格/换行）
  let endIndex = textContent.length;
  for (let i = slashIndex + 1; i < textContent.length; i++) {
    // 遇到换行，认为是命令结束
    if (textContent[i] === '\n' || textContent[i] === '\r') {
      endIndex = i;
      break;
    }
    // 遇到空格，继续向后查找，跳过连续的空格
    if (textContent[i] === ' ') {
      endIndex = i;
      // 跳过所有连续的空格
      while (endIndex < textContent.length && textContent[endIndex] === ' ') {
        endIndex++;
      }
      break;
    }
    // 遇到 @，说明是日期标记，命令在这里结束（不包含 @ 及其后的内容）
    if (textContent[i] === '@') {
      endIndex = i;
      // 向后跳过空格
      while (endIndex < textContent.length && textContent[endIndex] === ' ') {
        endIndex++;
      }
      break;
    }
  }

  console.log('[deleteSlashCommandContent] slashIndex:', slashIndex, 'endIndex:', endIndex);

  // 设置 range 从斜杠位置到命令结束位置
  range.setStart(textNode, slashIndex);
  range.setEnd(textNode, endIndex);
  console.log('[deleteSlashCommandContent] range 已设置，准备删除内容');

  // 删除斜杠命令内容
  range.deleteContents();
  console.log('[deleteSlashCommandContent] 删除完成，删除内容: "' + textContent.substring(slashIndex, endIndex) + '"');
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
