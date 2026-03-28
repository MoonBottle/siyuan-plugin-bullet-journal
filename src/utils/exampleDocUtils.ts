/**
 * 示例文档创建工具函数
 */
import { createDocWithMd, lsNotebooks, pushMsg } from '@/api';
import { openDocument } from '@/utils/fileUtils';
import { t, getCurrentLocale } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { expandDocTree } from 'siyuan';

/**
 * 获取今天的日期字符串
 */
function getToday(): string {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * 获取明天的日期字符串
 */
function getTomorrow(): string {
  return dayjs().add(1, 'day').format('YYYY-MM-DD');
}

/**
 * 获取昨天的日期字符串
 */
function getYesterday(): string {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD');
}

/**
 * 获取示例文档名称
 */
function getExampleDocName(): string {
  const lang = getCurrentLocale();
  console.log('[Task Assistant] getExampleDocName - current locale:', lang);
  return lang.startsWith('en') ? 'Task Assistant Example' : '任务助手示例文档';
}

/**
 * 生成示例文档的 Markdown 内容
 */
function generateExampleContent(): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  const yesterday = getYesterday();
  const lang = getCurrentLocale();
  const isEn = lang.startsWith('en');
  console.log('[Task Assistant] generateExampleContent - current locale:', lang, 'isEn:', isEn);

  const taskTag = t('taskTag') || '#任务';
  const completedTag = t('statusTag').completed || '#已完成';
  const abandonedTag = t('statusTag').abandoned || '#已放弃';
  const dateMarker = t('dateMarker') || '📅';

  if (isEn) {
    return `## Task Assistant Tutorial

Quick Add with Slash Commands:
Type /task then Enter → Mark as task ${taskTag}
Type /today then Enter → Add today's item ${dateMarker}${today}
Type /tomorrow then Enter → Add tomorrow's item ${dateMarker}${tomorrow}
Type /done then Enter → Mark as completed ${completedTag}
Type /focus then Enter → Start pomodoro 🍅

This is a task ${taskTag}

This is an all-day item ${dateMarker}${today}

This is an item with time ${dateMarker}${today} 09:00:00~10:00:00

This is a completed item ${dateMarker}${today} ${completedTag}

This is an abandoned item ${dateMarker}${today} ${abandonedTag}

🍅${today} 10:00:00~10:25:00 This is a pomodoro record
`;
  }

  return `这是一个任务 ${taskTag}

这是一个全天事项 ${dateMarker}${today}

这是一个带时间的事项 ${dateMarker}${today} 09:00:00~10:00:00

这是一个已完成的事项 ${dateMarker}${today} ${completedTag}

这是一个已放弃的事项 ${dateMarker}${today} ${abandonedTag}

🍅${today} 10:00:00~10:25:00 这是一个番茄钟记录

  > 📌 斜杠命令快速添加：
输入 /rw 回车 → 标记为任务
输入 /jt 回车 → 添加今日事项
输入 /mt 回车 → 添加明日事项
输入 /wc 回车 → 标记为完成
输入 /rl 回车 → 查看日历视图
输入 /todo 回车 → 查看待办事项
输入 /zz 回车 → 开始番茄钟
`;
}

/**
 * 创建示例文档
 * @param notebookId 笔记本 ID，如果不提供则使用第一个笔记本
 * @param path 文档路径，如果不提供则使用默认路径
 * @returns 创建的文档 ID
 */
export async function createExampleDocument(
  notebookId?: string,
  path?: string
): Promise<string | null> {
  try {
    // 如果没有提供 notebookId，获取第一个未关闭的笔记本
    let targetNotebookId = notebookId;
    if (!targetNotebookId) {
      const result = await lsNotebooks();
      console.log('[Task Assistant] lsNotebooks result:', result);
      if (!result) {
        console.error('[Task Assistant] Failed to query notebooks: API returned null');
        await pushMsg(t('todo').exampleDocFailed + ': 查询笔记本失败', 3000);
        return null;
      }
      // 过滤掉已关闭的笔记本
      const availableNotebooks = result.notebooks?.filter(nb => !nb.closed) || [];
      if (availableNotebooks.length === 0) {
        console.error('[Task Assistant] No available notebooks found (all closed)');
        await pushMsg(t('todo').exampleDocFailed + ': 没有可用的笔记本（请打开一个笔记本）', 3000);
        return null;
      }
      targetNotebookId = availableNotebooks[0].id;
      console.log('[Task Assistant] Using notebook:', availableNotebooks[0].name, 'id:', targetNotebookId);
    }

    // 生成文档路径
    const fullPath = path || getExampleDocName();

    // 生成内容
    const content = generateExampleContent();

    // 创建文档
    console.log('[Task Assistant] Creating document with notebookId:', targetNotebookId, 'path:', fullPath);
    const docId = await createDocWithMd(targetNotebookId, fullPath, content);
    console.log('[Task Assistant] createDocWithMd returned:', docId);

    if (docId) {
      await pushMsg(t('todo').exampleDocCreated, 3000);
      // 自动打开文档
      await openDocument(docId);
      // 在文档树中定位并展开该文档
      expandDocTree({ id: docId, isSetCurrent: true });
    } else {
      console.error('[Task Assistant] createDocWithMd returned null or undefined');
      await pushMsg(t('todo').exampleDocFailed + ': 创建文档失败', 3000);
    }

    return docId;
  } catch (error) {
    console.error('[Task Assistant] Failed to create example document:', error);
    await pushMsg(t('todo').exampleDocFailed, 3000);
    return null;
  }
}
