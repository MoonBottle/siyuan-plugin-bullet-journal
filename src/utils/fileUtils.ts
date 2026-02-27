/**
 * 文件操作工具函数
 */
import { openTab } from 'siyuan';
import { usePlugin } from '@/main';
import { sql, getBlockKramdown, updateBlock } from '@/api';

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
 * 更新块的日期时间
 * @param blockId 块 ID
 * @param newDate 新日期 (YYYY-MM-DD)
 * @param newStartTime 新开始时间 (HH:mm 或 HH:mm:ss) 可选
 * @param newEndTime 新结束时间 (HH:mm 或 HH:mm:ss) 可选
 * @param allDay 是否全天事件
 * @returns Promise<boolean> 更新是否成功
 */
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 获取块的原始内容
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[Bullet Journal] Failed to get block kramdown');
      return false;
    }

    // 解析原始内容，提取纯文本（去除旧的日期时间标记和属性）
    const kramdown = result.kramdown;
    // 去除属性块 {: ...}
    let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
    // 去除旧的日期时间标记 @YYYY-MM-DD HH:mm:ss~HH:mm:ss 或 @YYYY-MM-DD
    content = content.replace(/@\d{4}-\d{2}-\d{2}(\s+\d{1,2}:\d{2}(?::\d{2})?\s*[~至]\s*\d{1,2}:\d{2}(?::\d{2})?)?/g, '').trim();

    // 构建新的日期时间标记
    let newDateTimeMark = `@${newDate}`;

    if (!allDay && newStartTime) {
      // 格式化开始时间
      const formattedStart = formatTimeToSeconds(newStartTime);

      if (newEndTime) {
        // 有结束时间，格式化
        const formattedEnd = formatTimeToSeconds(newEndTime);
        newDateTimeMark += ` ${formattedStart}~${formattedEnd}`;
      } else {
        // 没有结束时间，自动加1小时
        const autoEnd = addOneHour(formattedStart);
        newDateTimeMark += ` ${formattedStart}~${autoEnd}`;
      }
    }

    // 组合新内容
    const newContent = `${content} ${newDateTimeMark}`;

    // 更新块
    await updateBlock('markdown', newContent, blockId);

    console.log('[Bullet Journal] Block updated:', { blockId, newContent });
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

    console.log('[Bullet Journal] Block content updated:', { blockId, newContent });
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
