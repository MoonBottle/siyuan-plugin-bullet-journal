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
import { updateBlockContent } from '@/utils/fileUtils';
import { LineParser } from '@/parser/lineParser';
import { getBlockKramdown } from '@/api';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { TAB_TYPES, DOCK_TYPES } from '@/constants';
import type { Item } from '@/types/models';

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
      callback: () => {
        config.openTodoDock();
      }
    }
  ];
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
 * 从块内容中提取所有日期标记
 * 复用 LineParser.parseItemLine 的日期提取逻辑
 */
async function extractDatesFromBlock(blockId: string): Promise<string[]> {
  const result = await getBlockKramdown(blockId);
  if (!result?.kramdown) return [];

  const blockContent = result.kramdown;

  // 使用 LineParser 解析事项行，提取所有日期
  const items = LineParser.parseItemLine(blockContent, 0);
  if (!items || items.length === 0) {
    // 如果无法解析为事项，尝试直接匹配日期模式
    const datePattern = /@(\d{4}-\d{2}-\d{2})/g;
    const dates: string[] = [];
    let match;
    while ((match = datePattern.exec(blockContent)) !== null) {
      dates.push(match[1]);
    }
    return [...new Set(dates)];
  }

  // 从解析出的 items 中提取所有日期（包括 siblingItems）
  const allDates = new Set<string>();
  items.forEach(item => {
    allDates.add(item.date);
    if (item.siblingItems) {
      item.siblingItems.forEach(sibling => {
        allDates.add(sibling.date);
      });
    }
  });

  return Array.from(allDates);
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
 */
async function extractItemFromBlock(blockId: string): Promise<Item | null> {
  const result = await getBlockKramdown(blockId);
  if (!result?.kramdown) return null;

  const items = LineParser.parseItemLine(result.kramdown, 0);
  if (!items || items.length === 0) return null;

  // 使用第一个解析出的事项
  const item = items[0];

  // 补充 blockId 和 docId
  return {
    ...item,
    blockId: blockId,
    docId: blockId
  };
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
