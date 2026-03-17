/**
 * 示例文档创建工具函数
 */
import { createDocWithMd, lsNotebooks, pushMsg } from '@/api';
import { openDocument } from '@/utils/fileUtils';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

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
 * 生成示例文档的 Markdown 内容
 */
function generateExampleContent(): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  const yesterday = getYesterday();
  const taskTag = t('taskTag') || '#任务';
  const completedTag = t('statusTag').completed || '#已完成';
  const abandonedTag = t('statusTag').abandoned || '#已放弃';

  return `## 网站重构项目

> 公司官网全面改版，提升用户体验

[设计稿](https://figma.com/design/xxx)

首页改版 ${taskTag}

[需求文档](https://doc.example.com/homepage)

确定设计风格 @${today}

[参考案例](https://example.com/ref)

完成首页原型设计 @${yesterday} 10:00:00~12:00:00 ${completedTag}

评审会议 @${yesterday} 14:00:00~15:00:00 ${abandonedTag}

开发首页组件 @${tomorrow} 09:00:00~12:00:00

响应式适配 @${tomorrow} 14:00:00~17:00:00

性能优化 ${taskTag}

图片压缩和懒加载 @${today}

代码分割和缓存策略 @${tomorrow}
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
    // 如果没有提供 notebookId，获取第一个笔记本
    let targetNotebookId = notebookId;
    if (!targetNotebookId) {
      const result = await lsNotebooks();
      if (!result?.notebooks || result.notebooks.length === 0) {
        console.error('[Task Assistant] No notebooks found');
        return null;
      }
      targetNotebookId = result.notebooks[0].id;
    }

    // 生成文档路径
    const fullPath = path || `任务助手示例项目`;

    // 生成内容
    const content = generateExampleContent();

    // 创建文档
    const docId = await createDocWithMd(targetNotebookId, fullPath, content);

    if (docId) {
      await pushMsg(t('todo').exampleDocCreated, 3000);
      // 自动打开文档
      await openDocument(docId);
    }

    return docId;
  } catch (error) {
    console.error('[Task Assistant] Failed to create example document:', error);
    await pushMsg(t('todo').exampleDocFailed, 3000);
    return null;
  }
}
