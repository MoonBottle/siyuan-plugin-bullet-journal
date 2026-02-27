/**
 * 日期工具函数
 * 从 obsidian-hk-work-plugin 移植
 */

// 模块级正则表达式，避免每次调用重新创建
// 日期时间范围模式: @2026-02-04 10:06:04~11:06:04
export const DATE_TIME_RANGE_PATTERN = /@\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}~\d{2}:\d{2}:\d{2}/;
// 单个日期时间模式: @2026-02-04 10:06:04
export const SINGLE_DATE_TIME_PATTERN = /@\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/;
// 仅日期模式: @2026-02-04
export const DATE_ONLY_PATTERN = /@\d{4}-\d{2}-\d{2}/;

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export const getTodayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
export const toISODateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * 格��化日期为 Markdown 格式: YYYY-MM-DD HH:mm:ss
 */
export const formatDateTimeForMarkdown = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 格式化日期时间用于显示
 * 如果是纯日期格式或标记为全天，只显示日期
 */
export const formatDateTime = (dateStr: string, isAllDay?: boolean): string => {
  if (!dateStr) return '';

  if (isAllDay || /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * 格式化时间范围
 */
export const formatTimeRange = (startDateTime?: string, endDateTime?: string): string => {
  if (startDateTime && endDateTime) {
    const startTime = startDateTime.includes(' ')
      ? startDateTime.split(' ')[1].substring(0, 5)
      : '';
    const endTime = endDateTime.includes(' ')
      ? endDateTime.split(' ')[1].substring(0, 5)
      : '';
    if (startTime && endTime) {
      return `${startTime}~${endTime}`;
    }
    return startTime || endTime;
  }
  if (startDateTime && startDateTime.includes(' ')) {
    return startDateTime.split(' ')[1].substring(0, 5);
  }
  return '';
};

/**
 * 格式化日期标签 (今天/明天/日期)
 */
export const formatDateLabel = (
  dateStr: string,
  todayLabel: string,
  tomorrowLabel: string
): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return todayLabel;
  } else if (diffDays === 1) {
    return tomorrowLabel;
  } else {
    return dateStr;
  }
};

/**
 * 计算两个日期字符串之间的时长
 */
export const calculateDuration = (
  startStr: string,
  endStr: string,
  lunchBreakStart?: string,
  lunchBreakEnd?: string
): string => {
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return '';
  }

  let diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    return '';
  }

  // 扣除午休时间
  if (lunchBreakStart && lunchBreakEnd) {
    const lunchStartParts = lunchBreakStart.split(':').map(Number);
    const lunchEndParts = lunchBreakEnd.split(':').map(Number);

    if (lunchStartParts.length === 2 && lunchEndParts.length === 2) {
      const lunchStartMinutes = lunchStartParts[0] * 60 + lunchStartParts[1];
      const lunchEndMinutes = lunchEndParts[0] * 60 + lunchEndParts[1];

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();

      if (startMinutes < lunchEndMinutes && endMinutes > lunchStartMinutes) {
        const overlapStart = Math.max(startMinutes, lunchStartMinutes);
        const overlapEnd = Math.min(endMinutes, lunchEndMinutes);
        const overlapMinutes = overlapEnd - overlapStart;

        if (overlapMinutes > 0) {
          diffMs -= overlapMinutes * 60 * 1000;
        }
      }
    }
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${diffHours}:${diffMinutes.toString().padStart(2, '0')}`;
};
