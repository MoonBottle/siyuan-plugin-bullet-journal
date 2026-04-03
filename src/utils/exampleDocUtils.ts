/**
 * 示例文档创建工具函数
 */
import { createDocWithMd, lsNotebooks, pushMsg, createNotebook } from '@/api';
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
 * 获取任务助手笔记本名称（根据当前语言）
 */
function getTaskAssistantNotebookName(): string {
  const lang = getCurrentLocale();
  return lang.startsWith('en') ? 'Task Assistant' : '任务助手';
}

/**
 * 获取或创建任务助手笔记本
 * @returns 笔记本信息或 null
 */
async function getOrCreateTaskAssistantNotebook(): Promise<{ id: string; name: string } | null> {
  try {
    const result = await lsNotebooks();
    if (!result) {
      console.error('[Task Assistant] Failed to query notebooks: API returned null');
      return null;
    }

    const targetName = getTaskAssistantNotebookName();

    // 查找已存在的笔记本（不区分大小写，只找未关闭的）
    const availableNotebooks = result.notebooks?.filter(nb => !nb.closed) || [];
    const existingNotebook = availableNotebooks.find(
      nb => nb.name.toLowerCase() === targetName.toLowerCase()
    );

    if (existingNotebook) {
      console.log('[Task Assistant] Found existing notebook:', existingNotebook.name, 'id:', existingNotebook.id);
      return { id: existingNotebook.id, name: existingNotebook.name };
    }

    // 创建新笔记本
    console.log('[Task Assistant] Creating new notebook:', targetName);
    const newNotebook = await createNotebook(targetName);
    if (newNotebook && newNotebook.id) {
      console.log('[Task Assistant] Created new notebook:', newNotebook.name, 'id:', newNotebook.id);
      return { id: newNotebook.id, name: newNotebook.name };
    }

    console.error('[Task Assistant] createNotebook returned invalid result:', newNotebook);
    return null;
  } catch (error) {
    console.error('[Task Assistant] Failed to get or create notebook:', error);
    return null;
  }
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
    return `This is a task ${taskTag}

This is an all-day item ${dateMarker}${today}

This is an item with time ${dateMarker}${today} 09:00:00~10:00:00

This is a completed item ${dateMarker}${today} ${completedTag}

This is an abandoned item ${dateMarker}${today} ${abandonedTag}

🍅${today} 10:00:00~10:25:00 This is a pomodoro record

  > 📌 Quick Add with Slash Commands:
Type /task then Enter → Mark as task
Type /today then Enter → Add today's item
Type /tomorrow then Enter → Add tomorrow's item
Type /done then Enter → Mark as completed
Type /cal then Enter → View calendar view
Type /todo then Enter → View todo items
Type /focus then Enter → Start pomodoro
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
    // 如果没有提供 notebookId，获取或创建任务助手笔记本
    let targetNotebookId = notebookId;
    if (!targetNotebookId) {
      const notebook = await getOrCreateTaskAssistantNotebook();
      if (!notebook) {
        console.error('[Task Assistant] Failed to get or create task assistant notebook');
        await pushMsg(t('todo').exampleDocFailed + ': ' + t('common.notebookCreateFailed'), 3000);
        return null;
      }
      targetNotebookId = notebook.id;
      console.log('[Task Assistant] Using notebook:', notebook.name, 'id:', targetNotebookId);
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
