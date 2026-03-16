/**
 * 文件操作工具函数
 */
import { openTab } from 'siyuan';
import { usePlugin } from '@/main';
import { sql, getBlockKramdown, getBlockByID, updateBlock, getBlockAttrs, setBlockAttrs } from '@/api';
import type { ItemStatus } from '@/types/models';
import { t } from '@/i18n';
import { stripListAndBlockAttr, parseKramdownBlocks } from '@/parser/core';
import { processLineText } from '@/utils/slashCommandUtils';
import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';

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
 * 检测是否使用任务列表格式
 * @param line 行内容
 * @returns 是否使用任务列表格式
 */
function isTaskListFormat(line: string): boolean {
  return /\[\s*[xX]?\s*\]/.test(line);
}

/**
 * 构建任务列表标记
 * @param status 状态
 * @returns 任务列表标记
 */
function buildTaskListMarker(status?: ItemStatus): string {
  if (status === 'completed') return '[x] ';
  return '[ ] ';
}

/**
 * 构建状态标签（使用 i18n）
 * @param status 状态
 * @param isTaskList 是否使用任务列表格式
 */
function buildStatusTag(status?: ItemStatus, isTaskList?: boolean): string {
  if (!status || status === 'pending') return '';

  if (isTaskList) {
    // 任务列表格式：返回空字符串（[x] 会单独处理）
    return '';
  } else {
    // 标签格式：返回 #已完成
    return t('statusTag')[status] || '';
  }
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
 * 按日期顺序排列，相同时间的连续日期合并为范围
 */
function optimizeDateTimeExpressions(
  items: Array<{ date: string; startDateTime?: string; endDateTime?: string }>
): string {
  if (items.length === 0) return '';

  // 1. 按日期排序
  const sortedItems = [...items].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // 2. 按时间分组，合并连续日期，然后按日期排序
  const timeGroups = new Map<string, typeof sortedItems>();

  for (const item of sortedItems) {
    let timeKey = '';
    if (item.startDateTime) {
      const startTime = item.startDateTime.split(' ')[1];
      const endTime = item.endDateTime?.split(' ')[1];
      timeKey = endTime ? `${startTime}~${endTime}` : startTime;
    }

    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, []);
    }
    timeGroups.get(timeKey)!.push(item);
  }

  // 3. 对每个时间组合并连续日期，收集所有表达式
  const expressionList: Array<{ expr: string; startDate: string }> = [];

  for (const [timeKey, groupItems] of timeGroups) {
    const dates = groupItems.map(i => i.date);
    const ranges = groupDatesIntoRanges(dates);

    for (const range of ranges) {
      const expr = range.length === 1
        ? buildDateTimeMark(range[0], timeKey || undefined)
        : buildDateRangeMark(range[0], range[range.length - 1], timeKey || undefined);

      expressionList.push({
        expr,
        startDate: range[0]
      });
    }
  }

  // 4. 按开始日期排序
  expressionList.sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const expressions = expressionList.map(item => item.expr);

  // 4. 合并表达式，只保留第一个 @
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
/**
 * 处理单行更新的辅助函数（用于 updateBlockDateTime 的单行内容回退处理）
 */
function handleSingleLineUpdate(
  content: string,
  newDate: string,
  allDay: boolean,
  formattedStartTime?: string,
  formattedEndTime?: string,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus
): string {
  // 提取事项内容：先去除斜杠命令，再去除列表标记和块属性（支持父块 kramdown 格式），最后去除日期时间标记和状态标签
  let itemContent = processLineText(content, ALL_SLASH_COMMAND_FILTERS);
  itemContent = stripListAndBlockAttr(itemContent)
    .replace(/@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
    .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
    // 移除残留的逗号、日期和时间（如 ", 2024-01-03" 或 ", 2024-01-03 10:00:00~11:00:00"）
    .replace(/[，,]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
    .trim();

  // 构建所有日期时间项列表
  const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = siblingItems ? [...siblingItems] : [];

  // 更新当前修改的 Item
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

  // 智能合并为最优表达式
  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);

  // 检测原始内容是否使用任务列表格式
  const isTaskList = isTaskListFormat(content);

  // 构建状态标签（使用 i18n）
  const statusTag = buildStatusTag(status, isTaskList);

  // 构建任务列表标记
  const taskListMarker = isTaskList ? buildTaskListMarker(status) : '';

  // 拼接新内容：任务列表标记 + 事项内容 + 日期时间 + 状态标签（非任务列表时）
  return `${taskListMarker}${itemContent} ${optimizedExpr} ${statusTag}`.trim();
}

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
    // 获取块的现有自定义属性（在更新前保存，因为 updateBlock 会清除自定义属性）
    const existingAttrs = await getBlockAttrs(blockId).catch(() => ({}));
    const attrsToPreserve: Record<string, string> = {};
    for (const [key, value] of Object.entries(existingAttrs)) {
      // 保留以 custom- 开头的属性和 bookmark
      if (key.startsWith('custom-') || key === 'bookmark') {
        attrsToPreserve[key] = value as string;
      }
    }

    // 统一先查父块：若父块 kramdown 中含 blockId 对应块且该块事项行有 [ ]/[x]，则用父块 kramdown（避免内容子块无 [x] 导致错误添加 #已完成）
    let kramdown: string | null = null;
    let targetBlockId = blockId;
    const block = await getBlockByID(blockId);
    if (block?.parent_id) {
      const parentResult = await getBlockKramdown(block.parent_id);
      if (parentResult?.kramdown) {
        const blocks = parseKramdownBlocks(parentResult.kramdown);
        const itemBlockIndex = blocks.findIndex((b) => b.blockId === blockId);
        const itemBlock = itemBlockIndex >= 0 ? blocks[itemBlockIndex] : null;
        // 当 blockId 为内容子块时，事项行可能在前一块（列表项块）中
        const blocksToCheck = itemBlock
          ? (itemBlockIndex > 0 ? [itemBlock, blocks[itemBlockIndex - 1]] : [itemBlock])
          : [];
        for (const checkBlock of blocksToCheck) {
          const linesToCheck = checkBlock.content.split('\n');
          for (const line of linesToCheck) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{:')) continue;
            if (trimmed.startsWith('🍅')) continue;
            if (trimmed.includes('@') && /\d{4}-\d{2}-\d{2}/.test(trimmed) && isTaskListFormat(trimmed)) {
              kramdown = parentResult.kramdown;
              targetBlockId = block.parent_id;
              break;
            }
          }
          if (kramdown) break;
        }
      }
    }
    if (!kramdown) {
      const result = await getBlockKramdown(blockId);
      if (!result?.kramdown) {
        console.error('[Task Assistant] Failed to get block kramdown');
        return false;
      }
      kramdown = result.kramdown;
    }

    // 按行分割，处理多行内容
    const lines = kramdown.split('\n');

    // 检查是否有番茄钟行（以 🍅 开头）
    const hasTomatoClock = lines.some(line => line.trim().startsWith('🍅'));

    // 使用父块时需保留完整格式（含块属性行），走多行逻辑；否则无番茄钟时用单行逻辑
    const useMultiLineForStructure = targetBlockId !== blockId && lines.length > 1;

    // 如果没有番茄钟行且不需要保留结构，使用单行处理逻辑
    if (!hasTomatoClock && !useMultiLineForStructure) {
      const content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
      const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
      const formattedEndTime = newEndTime
        ? formatTimeToSeconds(newEndTime)
        : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

      const newContent = handleSingleLineUpdate(
        content,
        newDate,
        allDay,
        formattedStartTime,
        formattedEndTime,
        originalDate,
        siblingItems,
        status
      );

      await updateBlock('markdown', newContent, targetBlockId);

      // 恢复自定义属性（updateBlock 会清除自定义属性）
      if (Object.keys(attrsToPreserve).length > 0) {
        await setBlockAttrs(targetBlockId, attrsToPreserve);
      }
      return true;
    }

    // 有番茄钟行的情况：找到包含 @日期 的事项行（不是番茄钟行，不是块属性行）
    let itemLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 跳过块属性行 {: ...}
      if (line.trim().startsWith('{:')) continue;
      // 跳过番茄钟行（以 🍅 开头）
      if (line.trim().startsWith('🍅')) continue;
      // 包含 @日期 的行是事项行
      if (/@\d{4}-\d{2}-\d{2}/.test(line)) {
        itemLineIndex = i;
        break;
      }
    }

    // 如果没有找到事项行，使用单行处理逻辑作为回退
    if (itemLineIndex === -1) {
      const content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
      const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
      const formattedEndTime = newEndTime
        ? formatTimeToSeconds(newEndTime)
        : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

      const newContent = handleSingleLineUpdate(
        content,
        newDate,
        allDay,
        formattedStartTime,
        formattedEndTime,
        originalDate,
        siblingItems,
        status
      );

      await updateBlock('markdown', newContent, targetBlockId);

      // 恢复自定义属性（updateBlock 会清除自定义属性）
      if (Object.keys(attrsToPreserve).length > 0) {
        await setBlockAttrs(targetBlockId, attrsToPreserve);
      }
      return true;
    }

    // 获取事项行内容并清理
    const itemLine = lines[itemLineIndex];
    const cleanedItemLine = stripListAndBlockAttr(itemLine);

    // 提取事项内容（去除日期时间标记和状态标签）
    // 先移除所有日期时间表达式（包括逗号分隔的多个日期）
    let itemContent = cleanedItemLine
      .replace(/@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      // 移除残留的逗号、日期和时间（如 ", 2024-01-03" 或 ", 2024-01-03 10:00:00~11:00:00"）
      .replace(/[，,]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
      .trim();

    // 去除斜杠命令（/sx, /事项, /today 等）
    itemContent = processLineText(itemContent, ALL_SLASH_COMMAND_FILTERS);

    // 构建所有日期时间项列表
    const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = siblingItems ? [...siblingItems] : [];

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

    // 智能合并为最优表达式
    const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);

    // 检测原始内容是否使用任务列表格式
    const isTaskList = isTaskListFormat(itemLine);

    // 构建状态标签（使用 i18n）
    const statusTag = buildStatusTag(status, isTaskList);

    // 构建任务列表标记
    const taskListMarker = isTaskList ? buildTaskListMarker(status) : '';

    // 拼接新事项行内容
    let newItemLine: string;
    if (targetBlockId !== blockId) {
      // 更新父块时保留完整列表项格式（- 和 {: id=... }），仅替换日期部分
      const dateExpr =
        /@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?(?:\s*[,\uFF0C]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?)*/g;
      newItemLine = itemLine.replace(dateExpr, optimizedExpr);
    } else {
      newItemLine = `${taskListMarker}${itemContent} ${optimizedExpr} ${statusTag}`.trim();
    }

    // 更新事项行
    lines[itemLineIndex] = newItemLine;

    // 重新组合所有行
    const newContent = lines.join('\n');

    // 更新块（使用 targetBlockId：父块解析时更新父块）
    await updateBlock('markdown', newContent, targetBlockId);

    // 恢复自定义属性（updateBlock 会清除自定义属性）
    if (Object.keys(attrsToPreserve).length > 0) {
      await setBlockAttrs(targetBlockId, attrsToPreserve);
    }

    return true;
  } catch (error) {
    console.error('[Task Assistant] Failed to update block:', error);
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
    console.error('[Task Assistant] Failed to open document:', error);
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
    console.error('[Task Assistant] Failed to open document at line:', error);
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
    // 统一先查父块：若父块 kramdown 中含 blockId 对应块且该块事项行有 [ ]/[x]，则用解析出的事项块 kramdown
    let kramdown: string | null = null;
    let usedParentKramdown = false;
    let parentKramdown: string | null = null;
    let itemBlockRawForReplace: string | null = null;
    const block = await getBlockByID(blockId);
    if (block?.parent_id) {
      const parentResult = await getBlockKramdown(block.parent_id);
      if (parentResult?.kramdown) {
        const blocks = parseKramdownBlocks(parentResult.kramdown);
        const itemBlock = blocks.find((b) => b.blockId === blockId);
        if (itemBlock) {
          const itemBlockLines = itemBlock.content.split('\n');
          for (const line of itemBlockLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{:')) continue;
            if (trimmed.startsWith('🍅')) continue;
            if (trimmed.includes('@') && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
              if (isTaskListFormat(trimmed)) {
                kramdown = itemBlock.raw;
                usedParentKramdown = true;
                parentKramdown = parentResult.kramdown;
                itemBlockRawForReplace = itemBlock.raw;
              }
              break;
            }
          }
        }
      }
    }
    if (!kramdown) {
      const result = await getBlockKramdown(blockId);
      if (!result?.kramdown) {
        console.error('[Task Assistant] Failed to get block kramdown');
        return false;
      }
      kramdown = result.kramdown;
    }
    console.log('[Task Assistant] updateBlockContent - kramdown 来源:', kramdown ? (block?.parent_id ? '父块解析' : '当前块') : '无', '| blockId:', blockId, '| parent_id:', block?.parent_id);
    console.log('[Task Assistant] updateBlockContent - raw kramdown:', JSON.stringify(kramdown));
    const lines = kramdown.split('\n');
    console.log('[Task Assistant] updateBlockContent - lines:', lines);

    // 找到事项行（包含 @日期 的行，且不是番茄钟行、不是块属性行）
    let itemLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 跳过块属性行
      if (line.startsWith('{:')) continue;
      // 跳过番茄钟行
      if (line.startsWith('🍅')) continue;
      // 找到包含 @日期 的事项行
      if (line.includes('@') && /\d{4}-\d{2}-\d{2}/.test(line)) {
        itemLineIndex = i;
        break;
      }
    }

    if (itemLineIndex >= 0) {
      // 只修改事项行，添加后缀
      let itemLine = lines[itemLineIndex];

      // 检测是否使用任务列表格式
      const isTaskList = isTaskListFormat(itemLine);
      console.log('[Task Assistant] updateBlockContent - isTaskList:', isTaskList, 'itemLine:', itemLine);

      // 检测后缀是否是状态标签
      const isStatusTag = suffix === '#done' || suffix === '#abandoned' || suffix === '#已完成' || suffix === '#已放弃';
      console.log('[Task Assistant] updateBlockContent - suffix:', suffix, 'isStatusTag:', isStatusTag);

      if (isTaskList && isStatusTag) {
        // 任务列表格式 + 状态标签
        // #已完成/#done：将 [ ] 改为 [x]，不添加标签
        // #已放弃/#abandoned：将 [x] 改为 [ ]，并添加 #已放弃 标签
        const taskListMatch = itemLine.match(/(\[\s*)([xX]?)(\s*\]\s*)/);
        console.log('[Task Assistant] updateBlockContent - taskListMatch:', taskListMatch);
        if (taskListMatch) {
          const isAbandon = suffix === '#abandoned' || suffix === '#已放弃';
          const newMarker = (suffix === '#done' || suffix === '#已完成') ? '[x] ' : '[ ] ';
          console.log('[Task Assistant] updateBlockContent - newMarker:', newMarker);
          let newLine = itemLine.replace(taskListMatch[0], newMarker);
          if (isAbandon && !itemLine.includes('#已放弃') && !itemLine.includes('#abandoned')) {
            newLine = newLine.trimEnd() + ' ' + suffix;
          }
          if (usedParentKramdown) {
            // 更新父块时保留完整列表项格式（- 和块属性），仅替换任务标记
            lines[itemLineIndex] = newLine;
          } else {
            // 更新内容子块时 strip 后拼接
            const contentWithoutMarker = itemLine.replace(taskListMatch[0], '');
            const cleanedContent = stripListAndBlockAttr(contentWithoutMarker);
            lines[itemLineIndex] = isAbandon && !cleanedContent.includes('#已放弃') && !cleanedContent.includes('#abandoned')
              ? `${newMarker}${cleanedContent} ${suffix}`.trim()
              : `${newMarker}${cleanedContent}`.trim();
          }
          console.log('[Task Assistant] updateBlockContent - new line:', lines[itemLineIndex]);
        } else {
          // 如果匹配失败，使用原来的方式
          console.log('[Task Assistant] updateBlockContent - match failed, using fallback');
          const cleanedContent = stripListAndBlockAttr(itemLine);
          lines[itemLineIndex] = `${cleanedContent} ${suffix}`.trim();
        }
      } else if (isTaskList) {
        // 任务列表格式 + 非状态标签（如日期）：保留 [x] 或 [ ] 标记
        console.log('[Task Assistant] updateBlockContent - task list + non-status tag');
        // 提取任务列表标记
        const taskListMatch = itemLine.match(/(\[\s*[xX]?\s*\]\s*)/);
        if (taskListMatch) {
          const taskListMarker = taskListMatch[1];
          // 去除任务列表标记后的内容
          const contentWithoutMarker = itemLine.replace(taskListMarker, '');
          // 使用 stripListAndBlockAttr 去除列表标记、块属性
          const cleanedContent = stripListAndBlockAttr(contentWithoutMarker);
          // 重新拼接：任务列表标记 + 清理后的内容 + 后缀
          lines[itemLineIndex] = `${taskListMarker}${cleanedContent} ${suffix}`.trim();
        } else {
          // 如果匹配失败，使用原来的方式
          const cleanedContent = stripListAndBlockAttr(itemLine);
          lines[itemLineIndex] = `${cleanedContent} ${suffix}`.trim();
        }
      } else {
        // 非任务列表格式：使用原来的方式
        console.log('[Task Assistant] updateBlockContent - non-task list format');
        // 使用 stripListAndBlockAttr 去除列表标记、任务标记、块属性
        const cleanedContent = stripListAndBlockAttr(itemLine);
        // 添加后缀
        lines[itemLineIndex] = `${cleanedContent} ${suffix}`.trim();
      }

      // 回写整个块（父块解析时更新父块，否则更新当前块）
      let newContent = lines.join('\n');
      let targetBlockId = blockId;
      if (usedParentKramdown && parentKramdown && itemBlockRawForReplace) {
        newContent = parentKramdown.replace(itemBlockRawForReplace, newContent);
        targetBlockId = block!.parent_id!;
      }
      console.log('[Task Assistant] updateBlockContent - updateBlock 调用:', {
        targetBlockId,
        newContent: JSON.stringify(newContent),
        newContentPreview: newContent.substring(0, 200) + (newContent.length > 200 ? '...' : '')
      });
      await updateBlock('markdown', newContent, targetBlockId);
      return true;
    }

    // 降级：如果没有找到事项行，使用原来的方式
    let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
    let newContent = `${content} ${suffix}`;
    let targetBlockId = blockId;
    if (usedParentKramdown && parentKramdown && itemBlockRawForReplace) {
      newContent = parentKramdown.replace(itemBlockRawForReplace, newContent);
      targetBlockId = block!.parent_id!;
    }
    console.log('[Task Assistant] updateBlockContent - updateBlock 调用(降级):', {
      targetBlockId,
      newContent: JSON.stringify(newContent)
    });
    await updateBlock('markdown', newContent, targetBlockId);

    return true;
  } catch (error) {
    console.error('[Task Assistant] Failed to update block content:', error);
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
    console.error('[Task Assistant] Failed to get block id by line:', error);
    return null;
  }
}
