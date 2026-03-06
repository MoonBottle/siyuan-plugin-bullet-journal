/**
 * 思源原生弹框封装
 * 提供统一的弹框创建和管理
 */
import { Dialog } from 'siyuan';
import type { Item, CalendarEvent } from '@/types/models';
import { t } from '@/i18n';
import { formatDateTime, formatDateLabel, formatTimeRange, calculateDuration } from './dateUtils';
import { openDocumentAtLine } from './fileUtils';
import { useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import dayjs from './dayjs';

// 复制图标 SVG (使用 fill 而不是 stroke)
const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

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

  // 项目链接和任务链接
  const projectLinks = item.project?.links || [];
  const taskLinks = item.task?.links || [];

  // 构建链接 HTML
  const projectLinksHtml = projectLinks.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag">${link.name}</a>`
  ).join('');
  const taskLinksHtml = taskLinks.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag">${link.name}</a>`
  ).join('');

  // 构建内容 - 垂直卡片布局
  let content = '<div class="sy-dialog-content">';
  content += '<div class="sy-dialog-cards">';

  // 项目卡片
  if (item.project) {
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">${t('todo').project}</div>
        <div class="sy-dialog-card-content">
          <span>${item.project.name}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${item.project.name}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
        ${projectLinksHtml ? `<div class="sy-dialog-card-footer">${projectLinksHtml}</div>` : ''}
      </div>
    `;
  }

  // 任务卡片
  if (item.task) {
    const levelHtml = item.task.level
      ? `<span class="task-level level-${item.task.level.toLowerCase()}">${item.task.level}</span>`
      : '';
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">${t('todo').task}</div>
        <div class="sy-dialog-card-content">
          <span>${item.task.name}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${item.task.name}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
        <div class="sy-dialog-card-footer">
          ${levelHtml}
          ${taskLinksHtml}
        </div>
      </div>
    `;
  }

  // 事项卡片
  const dateLabel = formatDateLabel(item.date, t('todo').today, t('todo').tomorrow);
  const timeText = `${dateLabel}${timeDisplay ? ' · ' + timeDisplay : ''}`;
  content += `
    <div class="sy-dialog-card sy-dialog-item-card">
      <div class="sy-dialog-card-title">${t('todo').item}</div>
      <div class="sy-dialog-item-meta">
        <div class="sy-dialog-item-time-row">
          <span class="sy-dialog-time-text">
            <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').time}">📅</span>
            ${timeText}
          </span>
          ${duration ? `
            <span class="sy-dialog-duration-text">
              <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').duration}">⏱️</span>
              ${duration}
              <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${duration}" aria-label="${t('common').copy}">${copyIconSvg}</span>
            </span>
          ` : ''}
        </div>
      </div>
      ${item.content ? `
        <div class="sy-dialog-item-content">
          <span>${item.content}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${item.content}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
      ` : ''}
    </div>
  `;

  content += '</div>'; // 结束 cards

  // 按钮
  content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: t('common').cancel, class: 'b3-button--outline', action: 'close' },
        { text: t('todo').viewInCalendar, class: 'b3-button--outline', action: 'open-calendar' },
        { text: t('todo').openDoc, class: 'b3-button--text', action: 'open-doc' },
      ])}
    </div>
  `;

  content += '</div>';

  const dialog = createDialog({
    title: t('todo').itemDetail,
    content,
    width: '520px',
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
        console.warn('[Bullet Journal] dialog open-calendar', item.date);
        if (plugin && (plugin as any).openCustomTab) {
          (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date });
        }
        dialog.destroy();
      } else if (action === 'close') {
        dialog.destroy();
      }
    });
  });

  // 绑定链接点击事件
  element.querySelectorAll('.sy-dialog-link-tag').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (e.currentTarget as HTMLAnchorElement).href;
      if (url) {
        window.open(url, '_blank');
      }
    });
  });

  // 绑定复制按钮事件
  element.querySelectorAll('.sy-dialog-copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const btnEl = e.currentTarget as HTMLElement;
      if (!btnEl) return;
      const text = btnEl.dataset.copy;
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          btnEl.innerHTML = checkIconSvg;
          btnEl.classList.add('copied');
          setTimeout(() => {
            if (btnEl) {
              btnEl.innerHTML = copyIconSvg;
              btnEl.classList.remove('copied');
            }
          }, 2000);
        } catch (err) {
          console.error('复制失败:', err);
        }
      }
    });
  });

  return dialog;
}

/**
 * 生成链接分组 HTML
 */
function createLinkGroup(title: string, links: Array<{ name: string; url: string }>): string {
  if (!links || links.length === 0) return '';

  const linksHtml = links.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag">${link.name}</a>`
  ).join('');

  return `
    <div class="sy-dialog-link-group">
      <div class="sy-dialog-link-group-title">${title}</div>
      <div class="sy-dialog-link-group-items">
        ${linksHtml}
      </div>
    </div>
  `;
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

  // 项目链接和任务链接
  const projectLinks = props.projectLinks || [];
  const taskLinks = props.taskLinks || [];

  // 构建链接 HTML
  const projectLinksHtml = projectLinks.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag">${link.name}</a>`
  ).join('');
  const taskLinksHtml = taskLinks.map(link =>
    `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag">${link.name}</a>`
  ).join('');

  // 构建内容 - 垂直卡片布局
  let content = '<div class="sy-dialog-content">';
  content += '<div class="sy-dialog-cards">';

  // 项目卡片
  if (props.project) {
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">${t('todo').project}</div>
        <div class="sy-dialog-card-content">
          <span>${props.project}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${props.project}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
        ${projectLinksHtml ? `<div class="sy-dialog-card-footer">${projectLinksHtml}</div>` : ''}
      </div>
    `;
  }

  // 任务卡片
  if (props.task) {
    const levelHtml = props.level
      ? `<span class="task-level level-${props.level.toLowerCase()}">${props.level}</span>`
      : '';
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">${t('todo').task}</div>
        <div class="sy-dialog-card-content">
          <span>${props.task}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${props.task}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
        <div class="sy-dialog-card-footer">
          ${levelHtml}
          ${taskLinksHtml}
        </div>
      </div>
    `;
  }

  // 事项卡片
  content += `
    <div class="sy-dialog-card sy-dialog-item-card">
      <div class="sy-dialog-card-title">${t('todo').item}</div>
      <div class="sy-dialog-item-meta">
        <div class="sy-dialog-item-time-row">
          <span class="sy-dialog-time-text">
            <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').time}">📅</span>
            ${timeDisplay}
          </span>
          ${duration ? `
            <span class="sy-dialog-duration-text">
              <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').duration}">⏱️</span>
              ${duration}
              <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${duration}" aria-label="${t('common').copy}">${copyIconSvg}</span>
            </span>
          ` : ''}
        </div>
      </div>
      ${props.item ? `
        <div class="sy-dialog-item-content">
          <span>${props.item}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${props.item}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
      ` : ''}
    </div>
  `;

  content += '</div>'; // 结束 cards

  // 按钮
  content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: t('common').cancel, class: 'b3-button--outline', action: 'close' },
        { text: t('todo').openDoc, class: 'b3-button--text', action: 'open-doc' },
      ])}
    </div>
  `;

  content += '</div>';

  const dialog = createDialog({
    title: t('todo').itemDetail,
    content,
    width: '520px',
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

  // 绑定链接点击事件
  element.querySelectorAll('.sy-dialog-link-tag').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (e.currentTarget as HTMLAnchorElement).href;
      if (url) {
        window.open(url, '_blank');
      }
    });
  });

  // 绑定复制按钮事件
  element.querySelectorAll('.sy-dialog-copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const btnEl = e.currentTarget as HTMLElement;
      if (!btnEl) return;
      const text = btnEl.dataset.copy;
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          btnEl.innerHTML = checkIconSvg;
          btnEl.classList.add('copied');
          setTimeout(() => {
            if (btnEl) {
              btnEl.innerHTML = copyIconSvg;
              btnEl.classList.remove('copied');
            }
          }, 2000);
        } catch (err) {
          console.error('复制失败:', err);
        }
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
 * 生成日历网格 HTML
 */
function generateCalendarGrid(year: number, month: number, selectedDate?: string): string {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const todayStr = dayjs().format('YYYY-MM-DD');
  
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
  let selectedDate = defaultDate || dayjs().format('YYYY-MM-DD');
  
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
