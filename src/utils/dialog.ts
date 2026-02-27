/**
 * 思源原生弹框封装
 * 提供统一的弹框创建和管理
 */
import { Dialog } from 'siyuan';
import type { Item, CalendarEvent } from '@/types/models';
import { formatDateTime, formatDateLabel, formatTimeRange, calculateDuration } from './dateUtils';
import { openDocumentAtLine } from './fileUtils';
import { useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { eventBus, Events } from './eventBus';
import { TAB_TYPES } from '@/constants';

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

  const linksHtml = links.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link">${link.name}</a>`
  ).join('');

  return `
    <div class="sy-dialog-info-row">
      <span class="sy-dialog-label">${label}</span>
      <div class="sy-dialog-links">${linksHtml}</div>
    </div>
  `;
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
export function showItemDetailModal(item: Item): Dialog {
  const settingsStore = useSettingsStore();
  const plugin = usePlugin();

  // 时间显示
  const timeDisplay = formatTimeRange(item.startDateTime, item.endDateTime);

  // 时长计算
  let duration = '';
  if (item.startDateTime && item.endDateTime) {
    duration = calculateDuration(
      item.startDateTime,
      item.endDateTime,
      settingsStore.lunchBreakStart,
      settingsStore.lunchBreakEnd
    );
  }

  // 任务级别样式
  const levelClass = `level-${item.task?.level?.toLowerCase() || 'l1'}`;
  const levelHtml = item.task
    ? `<span class="task-level ${levelClass}">${item.task.level}</span> ${item.task.name}`
    : '';

  // 项目链接
  const projectLinks = item.project?.links || [];
  const taskLinks = item.task?.links || [];

  // 构建内容
  let content = '<div class="sy-dialog-content">';

  // 内容
  content += createInfoRow('内容:', item.content, 'content-value');

  // 日期
  content += createInfoRow('日期:', formatDateLabel(item.date, '今天', '明天'));

  // 时间
  if (timeDisplay) {
    content += createInfoRow('时间:', timeDisplay);
  }

  // 时长
  if (duration) {
    content += createInfoRow('时长:', duration);
  }

  // 项目
  if (item.project) {
    content += createInfoRow('项目:', item.project.name);
  }

  // 项目链接（紧跟项目名）
  content += createLinksRow('项目链接:', projectLinks);

  // 任务
  if (item.task) {
    content += createInfoRow('任务:', levelHtml);
  }

  // 任务链接（紧跟任务名）
  content += createLinksRow('任务链接:', taskLinks);

  // 按钮
  content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: '打开文档', class: 'b3-button--outline', action: 'open-doc' },
        { text: '在日历中查看', class: 'b3-button--outline', action: 'open-calendar' },
        { text: '关闭', class: '', action: 'close' },
      ])}
    </div>
  `;

  content += '</div>';

  const dialog = createDialog({
    title: '事项详情',
    content,
    width: '480px',
  });

  // 绑定按钮事件
  const element = dialog.element;
  element.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;

      if (action === 'open-doc') {
        await openDocumentAtLine(item.docId, item.lineNumber, item.blockId);
        dialog.destroy();
      } else if (action === 'open-calendar') {
        if (plugin && (plugin as any).openCustomTab) {
          (plugin as any).openCustomTab(TAB_TYPES.CALENDAR);
        }
        eventBus.emit(Events.CALENDAR_NAVIGATE, item.date);
        dialog.destroy();
      } else if (action === 'close') {
        dialog.destroy();
      }
    });
  });

  return dialog;
}

/**
 * 显示日历事件详情弹框
 */
export function showEventDetailModal(event: CalendarEvent): Dialog {
  const settingsStore = useSettingsStore();
  const props = event.extendedProps;

  // 格式化时间
  const start = event.start;
  const end = event.end;
  const allDay = event.allDay;
  let timeDisplay = '';
  if (end && start !== end) {
    timeDisplay = `${formatDateTime(start, allDay)} - ${formatDateTime(end, allDay)}`;
  } else {
    timeDisplay = formatDateTime(start, allDay);
  }

  // 时长计算
  let duration = '';
  if (!allDay && start && end) {
    duration = calculateDuration(
      start,
      end,
      settingsStore.lunchBreakStart,
      settingsStore.lunchBreakEnd
    );
  }

  // 项目链接
  const projectLinks = props.projectLinks || [];
  const taskLinks = props.taskLinks || [];

  // 构建内容
  let content = '<div class="sy-dialog-content">';

  // 时间
  content += createInfoRow('时间:', timeDisplay);

  // 时长
  if (duration) {
    content += createInfoRow('时长:', duration);
  }

  // 项目
  if (props.project) {
    content += createInfoRow('项目:', props.project);
  }

  // 项目链接（紧跟项目名）
  content += createLinksRow('项目链接:', projectLinks);

  // 任务
  if (props.task) {
    content += createInfoRow('任务:', props.task);
  }

  // 任务链接（紧跟任务名）
  content += createLinksRow('任务链接:', taskLinks);

  // 级别
  if (props.level) {
    const levelClass = `level-${props.level.toLowerCase()}`;
    content += createInfoRow('级别:', `<span class="task-level ${levelClass}">${props.level}</span>`);
  }

  // 事项内容
  if (props.item) {
    content += createInfoRow('事项:', props.item);
  }

  // 按钮
  content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: '打开文档', class: 'b3-button--outline', action: 'open-doc' },
        { text: '关闭', class: '', action: 'close' },
      ])}
    </div>
  `;

  content += '</div>';

  const dialog = createDialog({
    title: event.title || '事件详情',
    content,
    width: '480px',
  });

  // 绑定按钮事件
  const element = dialog.element;
  element.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;

      if (action === 'open-doc') {
        await openDocumentAtLine(props.docId, props.lineNumber, props.blockId);
        dialog.destroy();
      } else if (action === 'close') {
        dialog.destroy();
      }
    });
  });

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
        { text: '取消', class: 'b3-button--cancel', action: 'cancel' },
        { text: '确认', class: 'b3-button--text', action: 'confirm' },
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
 * 生成日历网格 HTML
 */
function generateCalendarGrid(year: number, month: number, selectedDate?: string): string {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  let html = '<div class="date-picker-calendar">';
  
  // 星期标题
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
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
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  let selectedDate = defaultDate || today.toISOString().split('T')[0];
  
  const generateContent = () => {
    let content = '<div class="sy-dialog-content date-picker-dialog">';
    
    // 月份导航
    content += `
      <div class="date-picker-nav">
        <button class="b3-button b3-button--outline" data-action="prev-year">«</button>
        <button class="b3-button b3-button--outline" data-action="prev-month">‹</button>
        <span class="date-picker-month-label">${currentYear}年${currentMonth + 1}月</span>
        <button class="b3-button b3-button--outline" data-action="next-month">›</button>
        <button class="b3-button b3-button--outline" data-action="next-year">»</button>
      </div>
    `;
    
    // 日历网格
    content += generateCalendarGrid(currentYear, currentMonth, selectedDate);
    
    // 按钮
    content += `
      <div class="sy-dialog-footer">
        <button class="b3-button b3-button--outline" data-action="today">今天</button>
        <button class="b3-button b3-button--cancel" data-action="cancel">取消</button>
        <button class="b3-button b3-button--text" data-action="confirm">确认</button>
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
            selectedDate = new Date().toISOString().split('T')[0];
            currentYear = new Date().getFullYear();
            currentMonth = new Date().getMonth();
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
