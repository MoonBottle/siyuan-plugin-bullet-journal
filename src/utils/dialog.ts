/**
 * 思源原生弹框封装
 * 提供统一的弹框创建和管理
 */
import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import type { Item, CalendarEvent, PomodoroRecord, PendingPomodoroCompletion, ReminderConfig, RepeatRule, EndCondition } from '@/types/models';
import PomodoroCompleteDialog from '@/components/pomodoro/PomodoroCompleteDialog.vue';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import SettingsDialog from '@/components/settings/SettingsDialog.vue';
import ItemDetailDialog from '@/components/dialog/ItemDetailDialog.vue';
import EventDetailTooltip from '@/components/dialog/EventDetailTooltip.vue';
import ReminderSettingDialog from '@/components/dialog/ReminderSettingDialog.vue';
import RecurringSettingDialog from '@/components/dialog/RecurringSettingDialog.vue';
import { getSharedPinia } from '@/utils/sharedPinia';
import { t } from '@/i18n';
import { formatDateLabel, formatTimeRange, calculateDuration } from './dateUtils';
import { getDateRangeStatus, getEffectiveDate, getTimeRangeStatus } from './dateRangeUtils';
import { openDocumentAtLine } from './fileUtils';
import { useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import dayjs from './dayjs';
import { generateReminderMarker, stripReminderMarker } from '@/parser/reminderParser';
import { generateRepeatRuleMarker, generateEndConditionMarker, stripRecurringMarkers } from '@/parser/recurringParser';
import { skipCurrentOccurrence } from '@/services/recurringService';
import * as siyuanAPI from '@/api';

// 复制图标 SVG (使用 fill 而不是 stroke)
const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

/** 链接名称最大显示长度，超出则截断并 hover 显示全部 */
const LINK_NAME_MAX_LEN = 12;

/** 自定义 tooltip 挂载到 body，不受弹框 overflow 影响 */
export const SY_LINK_TOOLTIP_ID = 'sy-dialog-link-tooltip';
export const SY_ICON_TOOLTIP_ID = 'sy-icon-tooltip';

/** 供 Vue 等组件使用：格式化链接显示，返回截断后的 display 和可选的 fullText（用于 tooltip） */
export function formatLinkForDisplay(name: string): { display: string; fullText?: string } {
  if (!name || name.length <= LINK_NAME_MAX_LEN) {
    return { display: name };
  }
  return { display: name.slice(0, LINK_NAME_MAX_LEN) + '...', fullText: name };
}

/** 供 Vue 等组件使用：显示链接 tooltip */
export function showLinkTooltip(el: HTMLElement, fullText: string): void {
  let tip = document.getElementById(SY_LINK_TOOLTIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = SY_LINK_TOOLTIP_ID;
    tip.className = 'sy-dialog-link-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = fullText;
  const rect = el.getBoundingClientRect();
  const margin = 8;
  const left = rect.left + rect.width / 2;
  tip.style.left = `${left}px`;
  tip.style.top = `${rect.top - 4}px`;
  tip.style.transform = 'translate(-50%, -100%)';
  tip.classList.add('visible');
  requestAnimationFrame(() => {
    const tipRect = tip!.getBoundingClientRect();
    // 确保 tooltip 不会超出视口右边界
    if (tipRect.right > window.innerWidth - margin) {
      tip!.style.left = `${window.innerWidth - tipRect.width / 2 - margin}px`;
    }
    // 确保 tooltip 不会超出视口左边界
    if (tipRect.left < margin) {
      tip!.style.left = `${tipRect.width / 2 + margin}px`;
    }
  });
}

/** 供 Vue 等组件使用：隐藏链接 tooltip */
export function hideLinkTooltip(): void {
  const tip = document.getElementById(SY_LINK_TOOLTIP_ID);
  if (tip) tip.classList.remove('visible');
}

/** 供 SyButton 等图标按钮使用：显示 tooltip（挂载 body，不被 overflow 裁剪） */
export function showIconTooltip(el: HTMLElement, text: string): void {
  if (!text) return;
  let tip = document.getElementById(SY_ICON_TOOLTIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = SY_ICON_TOOLTIP_ID;
    tip.className = 'sy-icon-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  const rect = el.getBoundingClientRect();
  const margin = 8;
  const left = rect.left + rect.width / 2;
  tip.style.left = `${left}px`;
  tip.style.top = `${rect.top - 4}px`;
  tip.style.transform = 'translate(-50%, -100%)';
  tip.classList.add('visible');
  requestAnimationFrame(() => {
    const tipRect = tip!.getBoundingClientRect();
    // 确保 tooltip 不会超出视口右边界
    if (tipRect.right > window.innerWidth - margin) {
      tip!.style.left = `${window.innerWidth - tipRect.width / 2 - margin}px`;
    }
    // 确保 tooltip 不会超出视口左边界
    if (tipRect.left < margin) {
      tip!.style.left = `${tipRect.width / 2 + margin}px`;
    }
  });
}

/** 供 SyButton 等图标按钮使用：隐藏 tooltip */
export function hideIconTooltip(): void {
  const tip = document.getElementById(SY_ICON_TOOLTIP_ID);
  if (tip) tip.classList.remove('visible');
}

function formatLinkDisplay(name: string): { display: string; tooltipAttr: string } {
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  if (!name || name.length <= LINK_NAME_MAX_LEN) {
    return { display: escapeHtml(name), tooltipAttr: '' };
  }
  const escaped = escapeHtml(name);
  return {
    display: escapeHtml(name.slice(0, LINK_NAME_MAX_LEN)) + '...',
    tooltipAttr: ` data-sy-tooltip="${escaped}"`
  };
}

function bindLinkTooltips(element: HTMLElement): void {
  element.querySelectorAll('[data-sy-tooltip]').forEach(el => {
    const fullText = (el as HTMLElement).dataset.syTooltip;
    if (!fullText) return;

    const showTooltip = () => {
      let tip = document.getElementById(SY_LINK_TOOLTIP_ID);
      if (!tip) {
        tip = document.createElement('div');
        tip.id = SY_LINK_TOOLTIP_ID;
        tip.className = 'sy-dialog-link-tooltip';
        document.body.appendChild(tip);
      }
      tip.textContent = fullText;
      const rect = (el as HTMLElement).getBoundingClientRect();
      const margin = 8;
      let left = rect.left + rect.width / 2;
      tip.style.left = `${left}px`;
      tip.style.top = `${rect.top - 4}px`;
      tip.style.transform = 'translate(-50%, -100%)';
      tip.classList.add('visible');
      // 显示后根据实际宽度调整位置，避免超出视口（tip 使用 translate(-50%) 居中）
      requestAnimationFrame(() => {
        const tipRect = tip.getBoundingClientRect();
        if (tipRect.right > window.innerWidth - margin) {
          tip.style.left = `${window.innerWidth - tipRect.width / 2 - margin}px`;
        } else if (tipRect.left < margin) {
          tip.style.left = `${tipRect.width / 2 + margin}px`;
        }
      });
    };

    const hideTooltip = () => {
      const tip = document.getElementById(SY_LINK_TOOLTIP_ID);
      if (tip) tip.classList.remove('visible');
    };

    el.addEventListener('mouseenter', showTooltip);
    el.addEventListener('mouseleave', hideTooltip);
  });
}

// 对勾图标 SVG
const checkIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

/**
 * 弹框配置
 */
export interface DialogOptions {
  title?: string;
  width?: string;
  height?: string;
  content: string;
  destroyCallback?: () => void;
}

/**
 * 创建基础弹框
 */
export function createDialog(options: DialogOptions): Dialog {
  const dialog = new Dialog({
    title: options.title || '',
    content: options.content,
    width: options.width || '520px',
    height: options.height || 'auto',
    destroyCallback: options.destroyCallback,
  });

  return dialog;
}

/**
 * 关闭弹框
 */
export function closeDialog(dialog: Dialog): void {
  dialog.destroy();
}

/**
 * 生成信息行 HTML
 */
function createInfoRow(label: string, value: string, valueClass: string = ''): string {
  return `
    <div class="sy-dialog-info-row">
      <span class="sy-dialog-label">${label}</span>
      <span class="sy-dialog-value ${valueClass}">${value}</span>
    </div>
  `;
}

/**
 * 生成链接列表 HTML
 */
function createLinksRow(label: string, links: Array<{ name: string; url: string }>): string {
  if (!links || links.length === 0) return '';

  const linksHtml = links.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link"${tooltipAttr}>${display}</a>`;
  }).join('');

  return `
    <div class="sy-dialog-info-row">
      <span class="sy-dialog-label">${label}</span>
      <div class="sy-dialog-links">${linksHtml}</div>
    </div>
  `;
}

/**
 * 计算专注总时长（分钟）
 */
export function calculateTotalFocusMinutes(pomodoros?: PomodoroRecord[]): number {
  console.log('[calculateTotalFocusMinutes] pomodoros:', pomodoros);
  if (!pomodoros?.length) return 0;
  return pomodoros.reduce((sum, p) => sum + (p.actualDurationMinutes ?? p.durationMinutes), 0);
}

/**
 * 格式化专注时长为可读字符串（国际化）
 */
export function formatFocusDuration(minutes: number): string {
  const mins = t('common').minutes ?? 'min';
  const hrs = t('common').hours ?? 'h';
  if (minutes < 60) return `${minutes}${mins}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}${hrs} ${m}${mins}` : `${h}${hrs}`;
}

/**
 * 生成按钮 HTML
 */
function createButtons(buttons: Array<{ text: string; class: string; action: string }>): string {
  return buttons.map(btn =>
    `<button class="b3-button ${btn.class}" data-action="${btn.action}">${btn.text}</button>`
  ).join('');
}

/**
 * 显示事项详情弹框
 */
export function showItemDetailModal(item: Item, options?: { showAllDates?: boolean }): Dialog {
  const plugin = usePlugin();
  const showAllDates = options?.showAllDates ?? false;

  // 创建容器元素
  const container = document.createElement('div');

  // 创建 Vue 应用
  const app = createApp(ItemDetailDialog, {
    item,
    showAllDates,
    onClose: () => {
      dialog.destroy();
    },
    onOpenDoc: async () => {
      await openDocumentAtLine(item.docId, item.lineNumber, item.blockId);
      dialog.destroy();
    },
    onOpenCalendar: (date: string) => {
      console.warn('[Task Assistant] dialog open-calendar', date);
      if (plugin && (plugin as any).openCustomTab) {
        (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: date });
      }
      dialog.destroy();
    },
    onSetReminder: () => {
      dialog.destroy();
      showReminderSettingDialog(item);
    },
    onSetRecurring: () => {
      dialog.destroy();
      showRecurringSettingDialog(item);
    },
    onSkipOccurrence: () => {
      dialog.destroy();
      void skipCurrentOccurrence(plugin, item);
    }
  });

  // 挂载应用
  app.use(getSharedPinia());
  app.mount(container);

  const dialog = createDialog({
    title: t('todo').itemDetail,
    content: '',
    width: '520px',
    destroyCallback: () => {
      app.unmount();
      hideLinkTooltip();
    },
  });

  const bodyEl = dialog.element.querySelector('.b3-dialog__body');
  if (bodyEl) {
    bodyEl.appendChild(container);
  }

  return dialog;
}

/**
 * 生成链接分组 HTML
 */
function createLinkGroup(title: string, links: Array<{ name: string; url: string }>): string {
  if (!links || links.length === 0) return '';

  const linksHtml = links.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');

  return `
    <div class="sy-dialog-link-group">
      <div class="sy-dialog-link-group-title">${title}</div>
      <div class="sy-dialog-link-group-items">
        ${linksHtml}
      </div>
    </div>
  `;
}

/** 当前打开的事项详情弹框，用于单例守卫（防止重复点击创建多个） */
let lastEventDetailDialog: Dialog | null = null;

/**
 * 构建日历事件详情内容 HTML（供弹框与悬浮预览复用）
 * @param event 日历事件
 * @param options.preview 为 true 时去掉复制按钮与底部操作按钮，仅保留纯展示内容
 */
export function buildEventDetailContent(
  event: CalendarEvent,
  options?: { preview?: boolean }
): string {
  const preview = options?.preview ?? false;
  const props = event.extendedProps;

  const start = event.start;
  const end = event.end;
  const allDay = event.allDay;
  const rawDate = props.date
    || (typeof start === 'string' ? (start.includes('T') ? start.split('T')[0] : start.split(' ')[0]) : '')
    || (start ? dayjs(start).format('YYYY-MM-DD') : '');

  // 优先使用 originalStartDateTime/originalEndDateTime（日历事件可能被转为 ISO，原格式更可靠）
  const startForTime = props.originalStartDateTime || (typeof start === 'string' ? start : (start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : ''));
  const endForTime = props.originalEndDateTime || (typeof end === 'string' ? end : (end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : ''));

  // 创建容器元素
  const container = document.createElement('div');

  // 创建 Vue 应用
  const app = createApp(EventDetailTooltip, {
    project: props.project,
    projectLinks: props.projectLinks || [],
    task: props.task,
    level: props.level,
    taskLinks: props.taskLinks || [],
    item: props.item,
    itemContent: props.item,
    itemStatus: props.itemStatus || 'pending',
    itemLinks: props.itemLinks || [],
    date: rawDate,
    startDateTime: startForTime,
    endDateTime: endForTime,
    allDay: allDay,
    dateRangeStart: props.dateRangeStart,
    dateRangeEnd: props.dateRangeEnd,
    pomodoros: props.pomodoros || [],
    preview: preview
  });

  // 挂载应用
  app.use(getSharedPinia());
  app.mount(container);

  // 获取渲染后的 HTML
  const html = container.innerHTML;

  // 卸载应用（因为这只是获取 HTML，实际事件处理由调用方负责）
  app.unmount();

  return html;
}

/**
 * 显示日历事件详情弹框
 */
export function showEventDetailModal(event: CalendarEvent): Dialog {
  const plugin = usePlugin();
  const props = event.extendedProps;
  const rawDate = props.date
    || (typeof event.start === 'string' ? (event.start.includes('T') ? event.start.split('T')[0] : event.start.split(' ')[0]) : '')
    || (event.start ? dayjs(event.start).format('YYYY-MM-DD') : '');
  const dateStr = rawDate || dayjs().format('YYYY-MM-DD');

  // 单例守卫：关闭已存在的事项详情弹框，避免重复点击创建多个
  if (lastEventDetailDialog) {
    lastEventDetailDialog.destroy();
    lastEventDetailDialog = null;
  }

  // 创建容器元素
  const container = document.createElement('div');

  // 构建 Item 对象
  const item: Item = {
    id: props.itemId || '',
    content: props.item || '',
    date: rawDate,
    status: props.itemStatus || 'pending',
    docId: props.docId,
    lineNumber: props.lineNumber,
    blockId: props.blockId,
    project: props.project ? { name: props.project, links: props.projectLinks || [] } : undefined,
    task: props.task ? { name: props.task, level: props.level, links: props.taskLinks || [] } : undefined,
    links: props.itemLinks || [],
    pomodoros: props.pomodoros || [],
    startDateTime: props.originalStartDateTime,
    endDateTime: props.originalEndDateTime,
    siblingItems: props.siblingItems,
    dateRangeStart: props.dateRangeStart,
    dateRangeEnd: props.dateRangeEnd,
  };

  // 创建 Vue 应用
  const app = createApp(ItemDetailDialog, {
    item,
    onClose: () => {
      dialog.destroy();
    },
    onOpenDoc: async () => {
      await openDocumentAtLine(props.docId, props.lineNumber, props.blockId);
      dialog.destroy();
    },
    onOpenCalendar: () => {
      if (plugin && (plugin as any).openCustomTab) {
        (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: dateStr });
      }
      dialog.destroy();
    }
  });

  // 挂载应用
  app.use(getSharedPinia());
  app.mount(container);

  const dialog = createDialog({
    title: t('todo').itemDetail,
    content: '',
    width: '520px',
    destroyCallback: () => {
      if (lastEventDetailDialog === dialog) {
        lastEventDetailDialog = null;
      }
      app.unmount();
      hideLinkTooltip();
    },
  });
  lastEventDetailDialog = dialog;

  const bodyEl = dialog.element.querySelector('.b3-dialog__body');
  if (bodyEl) {
    bodyEl.appendChild(container);
  }

  return dialog;
}

/**
 * 确认弹框
 */
export function showConfirmDialog(
  title: string,
  message: string,
  onConfirm?: () => void,
  onCancel?: () => void
): Dialog {
  let content = '<div class="sy-dialog-content">';
  content += `<div class="sy-dialog-message">${message}</div>`;
  content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: t('common').cancel, class: 'b3-button--cancel', action: 'cancel' },
        { text: t('common').confirm, class: 'b3-button--text', action: 'confirm' },
      ])}
    </div>
  `;
  content += '</div>';

  const dialog = createDialog({
    title,
    content,
    width: '400px',
  });

  // 绑定按钮事件
  const element = dialog.element;
  element.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;

      if (action === 'confirm') {
        onConfirm?.();
        dialog.destroy();
      } else if (action === 'cancel') {
        onCancel?.();
        dialog.destroy();
      }
    });
  });

  return dialog;
}

/**
 * 显示提示消息
 */
export function showMessage(text: string, type: 'info' | 'error' = 'info'): void {
  const { showMessage: siyuanShowMessage } = require('siyuan');
  siyuanShowMessage(text, 3000, type);
}

/**
 * 显示专注完成弹窗（补填说明）
 * 用于启动恢复或从非 Dock 上下文触发时
 * @param pending 待完成记录
 * @param pinia 可选的 Pinia 实例，用于 store；若不传则组件内 useStore 可能不可用
 */
export function showPomodoroCompleteDialog(
  pending: PendingPomodoroCompletion,
  pinia?: ReturnType<typeof import('pinia').createPinia>
): Dialog {
  let dialogApp: any = null;
  const dialog = new Dialog({
    title: t('settings').pomodoro.completeTitle,
    content: '<div id="pomodoro-complete-dialog-mount"></div>',
    width: '600px',
    destroyCallback: () => {
      if (dialogApp) {
        dialogApp.unmount();
        dialogApp = null;
      }
    }
  });

  const closeDialog = () => {
    dialog.destroy();
  };

  setTimeout(() => {
    const mountEl = dialog.element?.querySelector('#pomodoro-complete-dialog-mount');
    if (mountEl) {
      dialogApp = createApp(PomodoroCompleteDialog, {
        pending,
        closeDialog
      });
      if (pinia) {
        dialogApp.use(pinia);
      }
      dialogApp.mount(mountEl);
    }
  }, 0);

  return dialog;
}

/**
 * 显示开始专注弹框
 * 供底栏、Dock 等任意上下文调用，不依赖 PomodoroDock 是否已挂载
 */
export function showPomodoroTimerDialog(): Dialog {
  const dialog = new Dialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '600px',
    destroyCallback: () => {
      if (timerDialogApp) {
        timerDialogApp.unmount();
        timerDialogApp = null;
      }
    }
  });

  let timerDialogApp: any = null;
  const closeDialog = () => {
    dialog.destroy();
  };

  setTimeout(() => {
    const mountEl = dialog.element?.querySelector('#pomodoro-timer-dialog-mount');
    if (mountEl) {
      timerDialogApp = createApp(PomodoroTimerDialog, { closeDialog });
      timerDialogApp.mount(mountEl);
    }
  }, 0);

  return dialog;
}

/**
 * 显示设置弹框（Vue 重构版）
 */
export function showSettingsDialog(plugin: any): Dialog {
  let settingsDialogApp: any = null;
  const dialog = new Dialog({
    title: t('settings').title,
    content: '<div id="bullet-journal-settings-mount"></div>',
    width: '960px',
    height: '70vh',
    destroyCallback: () => {
      if (settingsDialogApp) {
        settingsDialogApp.unmount();
        settingsDialogApp = null;
      }
      void plugin.loadSettings();
    }
  });

  const closeDialog = () => {
    dialog.destroy();
  };

  setTimeout(() => {
    const mountEl = dialog.element?.querySelector('#bullet-journal-settings-mount');
    if (mountEl) {
      settingsDialogApp = createApp(SettingsDialog, { plugin, closeDialog });
      const pinia = getSharedPinia();
      if (pinia) {
        settingsDialogApp.use(pinia);
      }
      settingsDialogApp.mount(mountEl);
    }
  }, 0);

  return dialog;
}

/**
 * 生成日历网格 HTML
 */
function generateCalendarGrid(year: number, month: number, selectedDate?: string): string {
  const firstDay = dayjs().year(year).month(month).date(1);
  const daysInMonth = firstDay.daysInMonth();

  // 周一开始：dayjs.day() 返回 0-6（周日开始），转换为周一开始
  const startDayOfWeek = firstDay.day() === 0 ? 6 : firstDay.day() - 1;

  const todayStr = dayjs().format('YYYY-MM-DD');

  let html = '<div class="date-picker-calendar">';

  // 星期标题（周一开始）
  const weekDays = (t('calendar') as any).weekDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  html += '<div class="date-picker-header">';
  weekDays.forEach(day => {
    html += `<span class="date-picker-weekday">${day}</span>`;
  });
  html += '</div>';

  // 日期网格
  html += '<div class="date-picker-grid">';

  // 填充前面的空白
  for (let i = 0; i < startDayOfWeek; i++) {
    html += '<span class="date-picker-day empty"></span>';
  }

  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = firstDay.date(day).format('YYYY-MM-DD');
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';

    html += `<span class="${classes}" data-date="${dateStr}">${day}</span>`;
  }

  html += '</div></div>';

  return html;
}

/**
 * 显示日期选择器对话框
 */
export function showDatePickerDialog(
  title: string,
  defaultDate: string,
  onConfirm: (date: string) => void
): Dialog {
  const today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth();
  let selectedDate = defaultDate || dayjs().format('YYYY-MM-DD');
  
  const generateContent = () => {
    let content = '<div class="sy-dialog-content date-picker-dialog">';
    
    // 月份导航
    content += `
      <div class="date-picker-nav">
        <button class="b3-button b3-button--outline" data-action="prev-year">«</button>
        <button class="b3-button b3-button--outline" data-action="prev-month">‹</button>
        <span class="date-picker-month-label">${((t('calendar') as any).yearMonthFormat ?? '{year}/{month}').replace('{year}', String(currentYear)).replace('{month}', String(currentMonth + 1))}</span>
        <button class="b3-button b3-button--outline" data-action="next-month">›</button>
        <button class="b3-button b3-button--outline" data-action="next-year">»</button>
      </div>
    `;
    
    // 日历网格
    content += generateCalendarGrid(currentYear, currentMonth, selectedDate);
    
    // 按钮
    content += `
      <div class="sy-dialog-footer">
        <button class="b3-button b3-button--outline" data-action="today">${t('todo').today}</button>
        <button class="b3-button b3-button--cancel" data-action="cancel">${t('common').cancel}</button>
        <button class="b3-button b3-button--text" data-action="confirm">${t('common').confirm}</button>
      </div>
    `;
    
    content += '</div>';
    return content;
  };
  
  const dialog = createDialog({
    title,
    content: generateContent(),
    width: '360px',
  });
  
  const updateContent = () => {
    const contentEl = dialog.element.querySelector('.sy-dialog-content');
    if (contentEl) {
      contentEl.outerHTML = generateContent();
      bindEvents();
    }
  };
  
  const bindEvents = () => {
    const element = dialog.element;
    
    // 导航按钮
    element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        
        switch (action) {
          case 'prev-year':
            currentYear--;
            updateContent();
            break;
          case 'prev-month':
            currentMonth--;
            if (currentMonth < 0) {
              currentMonth = 11;
              currentYear--;
            }
            updateContent();
            break;
          case 'next-month':
            currentMonth++;
            if (currentMonth > 11) {
              currentMonth = 0;
              currentYear++;
            }
            updateContent();
            break;
          case 'next-year':
            currentYear++;
            updateContent();
            break;
          case 'today':
            selectedDate = dayjs().format('YYYY-MM-DD');
            currentYear = dayjs().year();
            currentMonth = dayjs().month();
            updateContent();
            break;
          case 'confirm':
            onConfirm(selectedDate);
            dialog.destroy();
            break;
          case 'cancel':
            dialog.destroy();
            break;
        }
      });
    });
    
    // 日期选择
    element.querySelectorAll('.date-picker-day:not(.empty)').forEach(dayEl => {
      dayEl.addEventListener('click', (e) => {
        const date = (e.currentTarget as HTMLElement).dataset.date;
        if (date) {
          selectedDate = date;
          // 更新选中状态
          element.querySelectorAll('.date-picker-day').forEach(el => {
            el.classList.remove('selected');
          });
          (e.currentTarget as HTMLElement).classList.add('selected');
        }
      });
    });
  };
  
  bindEvents();
  
  return dialog;
}


/**
 * 显示提醒设置弹框
 */
export function showReminderSettingDialog(item: Item): Dialog {
  const container = document.createElement('div');

  const app = createApp(ReminderSettingDialog, {
    blockId: item.blockId!,
    initialConfig: item.reminder,
    onSave: async (config: ReminderConfig) => {
      await updateItemWithReminder(item, config);
      dialog.destroy();
    },
    onCancel: () => {
      dialog.destroy();
    }
  });

  app.use(getSharedPinia());
  app.mount(container);

  const dialog = new Dialog({
    title: t('reminder').settingTitle,
    content: '',
    width: '380px',
    destroyCallback: () => {
      app.unmount();
    }
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

  return dialog;
}

/**
 * 显示重复设置弹框
 */
export function showRecurringSettingDialog(item: Item): Dialog {
  const container = document.createElement('div');

  const app = createApp(RecurringSettingDialog, {
    blockId: item.blockId!,
    initialRepeatRule: item.repeatRule,
    initialEndCondition: item.endCondition,
    onSave: async (repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined) => {
      await updateItemWithRecurring(item, repeatRule, endCondition);
      dialog.destroy();
    },
    onCancel: () => {
      dialog.destroy();
    }
  });

  app.use(getSharedPinia());
  app.mount(container);

  const dialog = new Dialog({
    title: t('recurring').settingTitle,
    content: '',
    width: '380px',
    destroyCallback: () => {
      app.unmount();
    }
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

  return dialog;
}

/**
 * 更新事项的提醒设置
 */
async function updateItemWithReminder(item: Item, config: ReminderConfig): Promise<void> {
  if (!item.blockId) return;

  // 获取当前 block 内容
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) return;

  // 构建新的内容
  let content = block.content || block.markdown || '';
  
  // 移除旧的提醒标记
  content = stripReminderMarker(content);
  
  // 添加新的提醒标记
  if (config.enabled) {
    const marker = generateReminderMarker(config);
    if (marker) {
      content += ` ${marker}`;
    }
  }

  // 更新 block
  await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
}

/**
 * 更新事项的重复设置
 */
async function updateItemWithRecurring(
  item: Item, 
  repeatRule: RepeatRule | undefined, 
  endCondition: EndCondition | undefined
): Promise<void> {
  if (!item.blockId) return;

  // 获取当前 block 内容
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) return;

  // 构建新的内容
  let content = block.content || block.markdown || '';
  
  // 移除旧的重复和结束条件标记（支持新旧格式）
  content = stripRecurringMarkers(content);
  
  // 添加新的标记
  if (repeatRule) {
    content += ` ${generateRepeatRuleMarker(repeatRule)}`;
    
    if (endCondition) {
      const endMarker = generateEndConditionMarker(endCondition);
      if (endMarker) {
        content += ` ${endMarker}`;
      }
    }
  }

  // 更新 block
  await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
}

