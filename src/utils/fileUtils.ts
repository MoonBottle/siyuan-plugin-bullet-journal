/**
 * 文件操作工具函数
 */
import { openTab } from 'siyuan';
import { usePlugin } from '@/main';
import { sql, getBlockKramdown, updateBlock } from '@/api';
import type { ItemStatus } from '@/types/models';
import { t } from '@/i18n';

/**
 * 时间加一小时
 */
function addOneHour(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  let minutes = match[2];
  let seconds = match[3] || '00';

  hours = (hours + 1) % 24;
  const hoursStr = hours.toString().padStart(2, '0');

  return `${hoursStr}:${minutes}:${seconds}`;
}

/**
 * 格式化时间为 HH:mm:ss
 */
function formatTimeToSeconds(timeStr: string): string {
  // 可能是 HH:mm 或 HH:mm:ss
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeStr;

  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  const seconds = match[3] || '00';

  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 构建日期时间标记
 */
function buildDateTimeMark(
  date: string,
  timeKey?: string
): string {
  if (!timeKey) {
    return `@${date}`;
  }

  // timeKey 格式: "09:00:00~10:00:00" 或 "09:00:00"
  return `@${date} ${timeKey}`;
}

/**
 * 构建日期范围标记
 */
function buildDateRangeMark(
  startDate: string,
  endDate: string,
  timeKey?: string
): string {
  // 检查是否同年同月，可以简写
  const startParts = startDate.split('-');
  const endParts = endDate.split('-');

  let datePart: string;
  if (startParts[0] === endParts[0] && startParts[1] === endParts[1]) {
    // 同年同月，简写为 YYYY-MM-DD~MM-DD（保留月份）
    datePart = `${startDate}~${endParts[1]}-${endParts[2]}`;
  } else {
    // 不同月或不同年，完整格式
    datePart = `${startDate}~${endDate}`;
  }

  if (timeKey) {
    return `@${datePart} ${timeKey}`;
  }

  return `@${datePart}`;
}

/**
 * 构建状态标签（使用 i18n）
 */
function buildStatusTag(status?: ItemStatus): string {
  if (!status || status === 'pending') return '';
  return t('statusTag')[status] || '';
}

/**
 * 解析日期字符串为 Date 对象
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * 格式化 Date 为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将日期列表分组为连续范围
 */
function groupDatesIntoRanges(dates: string[]): string[][] {
  if (dates.length === 0) return [];

  // 先排序
  const sortedDates = [...dates].sort();

  const ranges: string[][] = [];
  let currentRange: string[] = [sortedDates[0]];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);

    // 检查是否连续
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      // 连续，加入当前范围
      currentRange.push(sortedDates[i]);
    } else {
      // 不连续，结束当前范围，开始新范围
      ranges.push(currentRange);
      currentRange = [sortedDates[i]];
    }
  }

  // 添加最后一个范围
  ranges.push(currentRange);

  return ranges;
}

/**
 * 按时间分组
 */
function groupByTime(
  items: Array<{ date: string; startDateTime?: string; endDateTime?: string }>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const item of items) {
    let timeKey = '';
    if (item.startDateTime) {
      const startTime = item.startDateTime.split(' ')[1];
      const endTime = item.endDateTime?.split(' ')[1];
      timeKey = endTime ? `${startTime}~${endTime}` : startTime;
    }

    if (!groups.has(timeKey)) {
      groups.set(timeKey, []);
    }
    groups.get(timeKey)!.push(item.date);
  }

  return groups;
}

/**
 * 智能优化日期时间表达式
 * 将多个日期时间合并为最简表达方式
 */
function optimizeDateTimeExpressions(
  items: Array<{ date: string; startDateTime?: string; endDateTime?: string }>
): string {
  if (items.length === 0) return '';

  // 1. 按时间分组（相同时间的日期可以合并为范围）
  const timeGroups = groupByTime(items);

  // 2. 对每个时间组，将日期合并为连续范围
  const expressions: string[] = [];

  for (const [timeKey, dates] of timeGroups) {
    const ranges = groupDatesIntoRanges(dates);

    for (const range of ranges) {
      if (range.length === 1) {
        // 单个日期
        expressions.push(buildDateTimeMark(range[0], timeKey || undefined));
      } else {
        // 日期范围
        expressions.push(buildDateRangeMark(range[0], range[range.length - 1], timeKey || undefined));
      }
    }
  }

  // 合并表达式，只保留第一个 @
  if (expressions.length === 0) return '';
  
  // 第一个表达式保留 @
  const firstExpr = expressions[0];
  // 后续表达式移除 @
  const restExprs = expressions.slice(1).map(expr => expr.replace(/^@/, ''));
  
  return [firstExpr, ...restExprs].join(', ');
}

/**
 * 更新块的日期时间
 * @param blockId 块 ID
 * @param newDate 新日期 (YYYY-MM-DD)
 * @param newStartTime 新开始时间 (HH:mm 或 HH:mm:ss) 可选
 * @param newEndTime 新结束时间 (HH:mm 或 HH:mm:ss) 可选
 * @param allDay 是否全天事件
 * @param originalDate 原始日期（用于定位要替换的日期）
 * @param siblingItems 同一块中的其他日期时间信息
 * @param status 事项状态
 * @returns Promise<boolean> 更新是否成功
 */
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 获取块的原始内容
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[Bullet Journal] Failed to get block kramdown');
      return false;
    }

    // 解析原始内容，提取纯文本（去除属性块 {: ...}）
    const kramdown = result.kramdown;
    let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();

    // 提取事项内容（去除日期时间标记和状态标签）
    // 先移除所有日期时间表达式（包括逗号分隔的多个日期）
    let itemContent = content
      .replace(/@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      // 移除残留的逗号和日期（如 ", 2024-01-03"）
      .replace(/[，,]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?/g, '')
      .trim();

    // 构建所有日期时间项列表
    const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = siblingItems ? [...siblingItems] : [];
    console.log('[Bullet Journal] updateBlockDateTime - siblingItems:', siblingItems?.length || 0, 'allItems:', allItems.length);
    console.log('[Bullet Journal] updateBlockDateTime - originalDate:', originalDate, 'newDate:', newDate);

    // 更新当前修改的 Item
    // 如果没有结束时间但有开始时间，自动加1小时
    const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
    const formattedEndTime = newEndTime
      ? formatTimeToSeconds(newEndTime)
      : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

    const updatedItem = {
      date: newDate,
      startDateTime: allDay ? undefined : (formattedStartTime ? `${newDate} ${formattedStartTime}` : undefined),
      endDateTime: allDay ? undefined : (formattedEndTime ? `${newDate} ${formattedEndTime}` : undefined)
    };

    // 替换或添加到列表
    if (originalDate) {
      const itemIndex = allItems.findIndex(item => item.date === originalDate);
      if (itemIndex >= 0) {
        allItems[itemIndex] = updatedItem;
      } else {
        allItems.push(updatedItem);
      }
    } else {
      allItems.push(updatedItem);
    }

    // 去重（按日期）
    const uniqueItems = new Map<string, { date: string; startDateTime?: string; endDateTime?: string }>();
    for (const item of allItems) {
      uniqueItems.set(item.date, item);
    }
    const dedupedItems = Array.from(uniqueItems.values());
    console.log('[Bullet Journal] updateBlockDateTime - dedupedItems:', dedupedItems.length, dedupedItems.map(i => i.date));

    // 智能合并为最优表达式
    const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);
    console.log('[Bullet Journal] updateBlockDateTime - optimizedExpr:', optimizedExpr);

    // 构建状态标签（使用 i18n）
    const statusTag = buildStatusTag(status);

    // 拼接新内容：事项内容 + 优化后的日期时间标记 + 状态标签
    const newContent = `${itemContent} ${optimizedExpr} ${statusTag}`.trim();

    // 更新块
    await updateBlock('markdown', newContent, blockId);

    return true;
  } catch (error) {
    console.error('[Bullet Journal] Failed to update block:', error);
    return false;
  }
}

/**
 * 打开文档
 */
export async function openDocument(docId: string): Promise<boolean> {
  const plugin = usePlugin() as any;
  if (!plugin || !docId) return false;

  try {
    await openTab({
      app: plugin.app,
      doc: {
        id: docId,
      },
    });
    return true;
  } catch (error) {
    console.error('[Bullet Journal] Failed to open document:', error);
    return false;
  }
}

/**
 * 打开文档并定位到特定块
 * @param docId 文档 ID
 * @param blockId 块 ID（可选，如果提供则直接定位到该块）
 * @param lineNumber 行号（可选，如果没有 blockId 则通过行号查询块 ID）
 */
export async function openDocumentAtLine(
  docId: string,
  lineNumber?: number,
  blockId?: string
): Promise<boolean> {
  const plugin = usePlugin() as any;
  if (!plugin || !docId) return false;

  try {
    // 如果没有 blockId 但有 lineNumber，尝试查询块 ID
    let targetBlockId = blockId;
    if (!targetBlockId && lineNumber) {
      targetBlockId = await getBlockIdByLine(docId, lineNumber);
    }

    // 如果有块 ID，直接打开并定位
    if (targetBlockId) {
      await openTab({
        app: plugin.app,
        doc: {
          id: targetBlockId,
          action: ["cb-get-focus", "cb-get-context", "cb-get-hl"], // 光标定位到块
        },
      });
    } else {
      // 否则只打开文档
      await openTab({
        app: plugin.app,
        doc: {
          id: docId,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('[Bullet Journal] Failed to open document at line:', error);
    return false;
  }
}

/**
 * 更新块内容（用于添加标签）
 * @param blockId 块 ID
 * @param suffix 要添加的后缀（如 #done、@2024-01-16）
 */
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
  if (!blockId) return false;

  try {
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[Bullet Journal] Failed to get block kramdown');
      return false;
    }

    const kramdown = result.kramdown;
    let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();

    const newContent = `${content} ${suffix}`;

    await updateBlock('markdown', newContent, blockId);

    return true;
  } catch (error) {
    console.error('[Bullet Journal] Failed to update block content:', error);
    return false;
  }
}

/**
 * 通过行号获取块 ID
 * 思源的块 ID 并不直接对应行号，这里通过查询文档中的块列表来近似定位
 */
async function getBlockIdByLine(docId: string, lineNumber: number): Promise<string | null> {
  try {
    // 查询文档中的块，使用 markdown 字段来判断行数
    // 注意：这是一个近似方法，可能不完全准确
    const sqlQuery = `
      SELECT id, content, type
      FROM blocks
      WHERE root_id = '${docId}'
      AND type IN ('p', 'h', 'l', 'i')
      ORDER BY id ASC
      LIMIT 1 OFFSET ${Math.max(0, lineNumber - 1)}
    `;

    const blocks = await sql(sqlQuery);

    if (blocks && blocks.length > 0) {
      return blocks[0].id;
    }

    return null;
  } catch (error) {
    console.error('[Bullet Journal] Failed to get block id by line:', error);
    return null;
  }
}
