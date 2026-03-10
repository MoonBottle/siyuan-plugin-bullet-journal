/**
 * 日期范围工具函数
 * 多日期事项（连续范围 @07~09 或离散 @07,09）的代表项选择与状态判断
 */
import type { Item } from '@/types/models';

/** 日期范围状态（用于状态 emoji 判断） */
export type DateRangeStatus = 'in_progress' | 'pending' | 'expired';

/**
 * 获取用于分组/状态判断的有效日期（多日期取结束日）
 */
export function getEffectiveDate(item: Item): string {
  return item.dateRangeEnd ?? item.date;
}

/**
 * 多日期事项仅保留「代表项」（今天或今天之后最近的日期）
 * - 今天 < 开始日：代表项 = dateRangeStart
 * - 开始日 ≤ 今天 ≤ 结束日：代表项 = today（有则用）或 min(日期 ≥ today)
 * - 今天 > 结束日：代表项 = dateRangeEnd
 */
export function filterDateRangeRepresentative(
  items: Item[],
  currentDate: string
): Item[] {
  return items.filter(item => {
    if (!item.dateRangeEnd) return true;
    const start = item.dateRangeStart!;
    const end = item.dateRangeEnd;
    const groupKey = item.blockId ?? `${item.docId}-${item.lineNumber}`;
    const groupItems = items.filter(
      i =>
        (i.blockId ?? `${i.docId}-${i.lineNumber}`) === groupKey &&
        i.dateRangeEnd === end
    );
    const allDates = groupItems.map(i => i.date);
    if (currentDate < start) return item.date === start;
    if (currentDate > end) return item.date === end;
    const hasToday = allDates.includes(currentDate);
    const nextDate = hasToday
      ? currentDate
      : allDates.filter(d => d >= currentDate).sort()[0];
    return item.date === nextDate;
  });
}

/**
 * 获取日期范围事项的状态（用于状态 emoji）
 * - 进行中：开始日 ≤ 今天 ≤ 结束日（含结束日当天）
 * - 待办：今天 < 开始日
 * - 过期：今天 > 结束日
 * @returns 有 dateRangeStart/End 时返回状态，否则返回 undefined（调用方用原逻辑）
 */
export function getDateRangeStatus(
  item: Item,
  currentDate: string
): DateRangeStatus | undefined {
  const start = item.dateRangeStart;
  const end = item.dateRangeEnd ?? item.date;
  if (!start || !item.dateRangeEnd) return undefined;
  if (currentDate < start) return 'pending';
  if (currentDate > end) return 'expired';
  return 'in_progress';
}

/**
 * 单日事项的状态判断（含全天、带时间范围、仅开始时间）
 * @param item 含 date、startDateTime、endDateTime
 * @param currentDateTime 当前时间 "YYYY-MM-DD HH:mm:ss"
 * @returns 单日事项返回状态，无 date 返回 undefined
 */
export function getTimeRangeStatus(
  item: { date?: string; startDateTime?: string; endDateTime?: string },
  currentDateTime: string
): DateRangeStatus | undefined {
  const todayStr = currentDateTime.slice(0, 10);
  if (!item.date) return undefined;

  const date = item.date;
  const start = item.startDateTime;
  const end = item.endDateTime;

  if (date < todayStr) return 'expired';
  if (date > todayStr) return 'pending';

  // date === today
  if (!start && !end) {
    return 'in_progress';
  }
  if (start && end) {
    if (currentDateTime < start) return 'pending';
    if (currentDateTime > end) return 'expired';
    return 'in_progress';
  }
  if (start && !end) {
    if (currentDateTime < start) return 'pending';
    if (currentDateTime > start) return 'expired';
    return 'in_progress';
  }
  return 'in_progress';
}

/**
 * 根据 DateRangeStatus 返回状态 emoji
 */
export function dateRangeStatusToEmoji(status: DateRangeStatus): string {
  switch (status) {
    case 'in_progress':
      return '🔄 ';
    case 'pending':
      return '⏳ ';
    case 'expired':
      return '⚠️ ';
    default:
      return '⏳ ';
  }
}
