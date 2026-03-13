/**
 * 思源原生弹框封装
 * 提供统一的弹框创建和管理
 */
import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import type { Item, CalendarEvent, PomodoroRecord, PendingPomodoroCompletion } from '@/types/models';
import PomodoroCompleteDialog from '@/components/pomodoro/PomodoroCompleteDialog.vue';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import SettingsDialog from '@/components/settings/SettingsDialog.vue';
import { getSharedPinia } from '@/utils/sharedPinia';
import { t } from '@/i18n';
import { formatDateLabel, formatTimeRange, calculateDuration } from './dateUtils';
import { getDateRangeStatus, getEffectiveDate, getTimeRangeStatus } from './dateRangeUtils';
import { openDocumentAtLine } from './fileUtils';
import { useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import dayjs from './dayjs';

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
    if (tipRect.right > window.innerWidth - margin) {
      tip!.style.left = `${window.innerWidth - tipRect.width / 2 - margin}px`;
    } else if (tipRect.left < margin) {
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
    if (tipRect.right > window.innerWidth - margin) {
      tip!.style.left = `${window.innerWidth - tipRect.width / 2 - margin}px`;
    } else if (tipRect.left < margin) {
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
function calculateTotalFocusMinutes(pomodoros?: PomodoroRecord[]): number {
  if (!pomodoros?.length) return 0;
  return pomodoros.reduce((sum, p) => sum + (p.actualDurationMinutes ?? p.durationMinutes), 0);
}

/**
 * 格式化专注时长为可读字符串（国际化）
 */
function formatFocusDuration(minutes: number): string {
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

  // 构建链接 HTML（链接名过长时截断，hover 显示全部，与复制按钮一致使用 b3-tooltips）
  const projectLinksHtml = projectLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');
  const taskLinksHtml = taskLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');

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
        <div class="sy-dialog-card-title">
          <span class="sy-dialog-card-title-text">${t('todo').task}</span>
          ${levelHtml}
        </div>
        <div class="sy-dialog-card-content">
          <span>${item.task.name}</span>
          <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${item.task.name}" aria-label="${t('common').copy}">${copyIconSvg}</span>
        </div>
        ${taskLinksHtml ? `<div class="sy-dialog-card-footer">${taskLinksHtml}</div>` : ''}
      </div>
    `;
  }

  // 事项卡片
  const dateLabel = formatDateLabel(item.date, t('todo').today, t('todo').tomorrow);
  const timeText = `${dateLabel}${timeDisplay ? ' · ' + timeDisplay : ''}`;

  // 事项状态标签（多日期用 getDateRangeStatus，单日用原逻辑）
  const todayStr = dayjs().format('YYYY-MM-DD');
  const statusMap: Record<string, { text: string; class: string }> = {
    'pending': { text: t('todo').pending, class: 'pending' },
    'in_progress': { text: t('todo').inProgress, class: 'in-progress' },
    'completed': { text: t('todo').completed, class: 'completed' },
    'abandoned': { text: t('todo').abandoned, class: 'abandoned' },
    'expired': { text: t('todo').expired, class: 'expired' }
  };
  let statusKey: string;
  if (item.status === 'completed' || item.status === 'abandoned') {
    statusKey = item.status;
  } else if (item.dateRangeStart && item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(item, todayStr);
    statusKey = rangeStatus ?? (getEffectiveDate(item) < todayStr ? 'expired' : 'pending');
  } else {
    const timeStatus = getTimeRangeStatus(item, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    if (timeStatus) {
      statusKey = timeStatus;
    } else {
      const effectiveDate = getEffectiveDate(item);
      statusKey = effectiveDate < todayStr ? 'expired' : item.status;
    }
  }
  const statusInfo = statusMap[statusKey] || statusMap['pending'];
  const statusHtml = `<span class="sy-dialog-status ${statusInfo.class}">${statusInfo.text}</span>`;

  // 事项链接
  const itemLinks = item.links || [];
  const itemLinksHtml = itemLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');

  // 专注总时间
  const totalFocusMinutes = calculateTotalFocusMinutes(item.pomodoros);
  const focusTotalTimeDisplay = totalFocusMinutes > 0 ? formatFocusDuration(totalFocusMinutes) : '';

  content += `
    <div class="sy-dialog-card sy-dialog-item-card">
      <div class="sy-dialog-card-title">
        <span class="sy-dialog-card-title-text">${t('todo').item}</span>
        ${statusHtml}
      </div>
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
          ${focusTotalTimeDisplay ? `
            <span class="sy-dialog-duration-text">
              <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').focusTotalTime}">🍅</span>
              ${focusTotalTimeDisplay}
              <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${focusTotalTimeDisplay}" aria-label="${t('common').copy}">${copyIconSvg}</span>
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
      ${itemLinksHtml ? `<div class="sy-dialog-card-footer">${itemLinksHtml}</div>` : ''}
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
    destroyCallback: () => {
      hideLinkTooltip();
    },
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
        console.warn('[Task Assistant] dialog open-calendar', item.date);
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

  bindLinkTooltips(element);

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
  const settingsStore = useSettingsStore();
  const props = event.extendedProps;

  const start = event.start;
  const end = event.end;
  const allDay = event.allDay;
  const rawDate = props.date
    || (typeof start === 'string' ? (start.includes('T') ? start.split('T')[0] : start.split(' ')[0]) : '')
    || (start ? dayjs(start).format('YYYY-MM-DD') : '');
  const dateLabel = formatDateLabel(rawDate || dayjs().format('YYYY-MM-DD'), t('todo').today, t('todo').tomorrow);
  // 优先使用 originalStartDateTime/originalEndDateTime（日历事件可能被转为 ISO，原格式更可靠）
  const startForTime = props.originalStartDateTime || (typeof start === 'string' ? start : (start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : ''));
  const endForTime = props.originalEndDateTime || (typeof end === 'string' ? end : (end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : ''));
  const timeRange = formatTimeRange(startForTime, endForTime);
  const timeDisplay = `${dateLabel}${timeRange ? ' · ' + timeRange : ''}`;

  let duration = '';
  if (!allDay && start && end) {
    duration = calculateDuration(
      start,
      end,
      settingsStore.lunchBreakStart,
      settingsStore.lunchBreakEnd
    );
  }

  const projectLinks = props.projectLinks || [];
  const taskLinks = props.taskLinks || [];
  const projectLinksHtml = projectLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');
  const taskLinksHtml = taskLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');

  const copyBtn = (text: string) =>
    preview ? '' : `<span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${text.replace(/"/g, '&quot;')}" aria-label="${t('common').copy}">${copyIconSvg}</span>`;

  let content = '<div class="sy-dialog-content">';
  content += '<div class="sy-dialog-cards">';

  if (props.project) {
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">${t('todo').project}</div>
        <div class="sy-dialog-card-content">
          <span>${props.project ?? ''}</span>
          ${copyBtn(props.project ?? '')}
        </div>
        ${projectLinksHtml ? `<div class="sy-dialog-card-footer">${projectLinksHtml}</div>` : ''}
      </div>
    `;
  }

  if (props.task) {
    const levelHtml = props.level
      ? `<span class="task-level level-${props.level.toLowerCase()}">${props.level}</span>`
      : '';
    content += `
      <div class="sy-dialog-card">
        <div class="sy-dialog-card-title">
          <span class="sy-dialog-card-title-text">${t('todo').task}</span>
          ${levelHtml}
        </div>
        <div class="sy-dialog-card-content">
          <span>${props.task ?? ''}</span>
          ${copyBtn(props.task ?? '')}
        </div>
        ${taskLinksHtml ? `<div class="sy-dialog-card-footer">${taskLinksHtml}</div>` : ''}
      </div>
    `;
  }

  const itemStatus = props.itemStatus || 'pending';
  const itemDate = props.date;
  const todayStr = dayjs().format('YYYY-MM-DD');
  const statusMap: Record<string, { text: string; class: string }> = {
    'pending': { text: t('todo').pending, class: 'pending' },
    'in_progress': { text: t('todo').inProgress, class: 'in-progress' },
    'completed': { text: t('todo').completed, class: 'completed' },
    'abandoned': { text: t('todo').abandoned, class: 'abandoned' },
    'expired': { text: t('todo').expired, class: 'expired' }
  };
  let statusKey: string;
  if (itemStatus === 'completed' || itemStatus === 'abandoned') {
    statusKey = itemStatus;
  } else if (props.dateRangeStart && props.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(
      { dateRangeStart: props.dateRangeStart, dateRangeEnd: props.dateRangeEnd, date: itemDate } as Item,
      todayStr
    );
    const effectiveDate = props.dateRangeEnd ?? itemDate;
    statusKey = rangeStatus ?? (effectiveDate && effectiveDate < todayStr ? 'expired' : 'pending');
  } else if (itemDate) {
    const timeStatus = getTimeRangeStatus(
      { date: itemDate, startDateTime: props.originalStartDateTime, endDateTime: props.originalEndDateTime },
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    );
    if (timeStatus) {
      statusKey = timeStatus;
    } else {
      const isExpired = itemDate < todayStr;
      statusKey = isExpired ? 'expired' : itemStatus;
    }
  } else {
    statusKey = itemStatus;
  }
  const statusInfo = statusMap[statusKey] || statusMap['pending'];
  const statusHtml = `<span class="sy-dialog-status ${statusInfo.class}">${statusInfo.text}</span>`;

  const itemLinks = props.itemLinks || [];
  const itemLinksHtml = itemLinks.map(link => {
    const { display, tooltipAttr } = formatLinkDisplay(link.name);
    return `<a href="${link.url}" target="_blank" class="sy-dialog-link-tag"${tooltipAttr}>${display}</a>`;
  }).join('');

  const totalFocusMinutes = calculateTotalFocusMinutes(props.pomodoros);
  const focusTotalTimeDisplay = totalFocusMinutes > 0 ? formatFocusDuration(totalFocusMinutes) : '';

  content += `
    <div class="sy-dialog-card sy-dialog-item-card">
      <div class="sy-dialog-card-title">
        <span class="sy-dialog-card-title-text">${t('todo').item}</span>
        ${statusHtml}
      </div>
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
              ${copyBtn(duration)}
            </span>
          ` : ''}
          ${focusTotalTimeDisplay ? `
            <span class="sy-dialog-duration-text">
              <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="${t('todo').focusTotalTime}">🍅</span>
              ${focusTotalTimeDisplay}
              ${copyBtn(focusTotalTimeDisplay)}
            </span>
          ` : ''}
        </div>
      </div>
      ${props.item ? `
        <div class="sy-dialog-item-content">
          <span>${props.item}</span>
          ${copyBtn(props.item)}
        </div>
      ` : ''}
      ${itemLinksHtml ? `<div class="sy-dialog-card-footer">${itemLinksHtml}</div>` : ''}
    </div>
  `;

  content += '</div>';

  if (!preview) {
    content += `
    <div class="sy-dialog-footer">
      ${createButtons([
        { text: t('common').cancel, class: 'b3-button--outline', action: 'close' },
        { text: t('todo').viewInCalendar, class: 'b3-button--outline', action: 'open-calendar' },
        { text: t('todo').openDoc, class: 'b3-button--text', action: 'open-doc' },
      ])}
    </div>
  `;
  }

  content += '</div>';
  return content;
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

  const content = buildEventDetailContent(event, { preview: false });

  // 单例守卫：关闭已存在的事项详情弹框，避免重复点击创建多个
  if (lastEventDetailDialog) {
    lastEventDetailDialog.destroy();
    lastEventDetailDialog = null;
  }

  const dialog = createDialog({
    title: t('todo').itemDetail,
    content,
    width: '520px',
    destroyCallback: () => {
      if (lastEventDetailDialog === dialog) {
        lastEventDetailDialog = null;
      }
      hideLinkTooltip();
    },
  });
  lastEventDetailDialog = dialog;

  // 绑定按钮事件
  const element = dialog.element;
  element.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;

      if (action === 'open-doc') {
        await openDocumentAtLine(props.docId, props.lineNumber, props.blockId);
        dialog.destroy();
      } else if (action === 'open-calendar') {
        if (plugin && (plugin as any).openCustomTab) {
          (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: dateStr });
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

  bindLinkTooltips(element);

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
    width: '400px',
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
    content: '<div id="settings-dialog-mount"></div>',
    width: '640px',
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
    const mountEl = dialog.element?.querySelector('#settings-dialog-mount');
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
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const todayStr = dayjs().format('YYYY-MM-DD');
  
  let html = '<div class="date-picker-calendar">';
  
  // 星期标题
  const weekDays = (t('calendar') as any).weekDays ?? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
