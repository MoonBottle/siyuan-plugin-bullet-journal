/**
 * 示例文档创建工具函数
 */
import { createDocWithMd, pushMsg } from '@/api';
import { openDocument } from '@/utils/fileUtils';
import { t, getCurrentLocale } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { expandDocTree } from 'siyuan';
import { getOrCreateTaskAssistantNotebook } from '@/utils/notebookUtils';

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
export function generateExampleContent(): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  const yesterday = getYesterday();
  const lang = getCurrentLocale();
  const isEn = lang.startsWith('en');
  console.log('[Task Assistant] generateExampleContent - current locale:', lang, 'isEn:', isEn);

  const taskTag = t('taskTag') || '#任务';
  const completedTag = t('statusTag').completed || '#已完成';
  const dateMarker = t('dateMarker') || '📅';

  if (isEn) {
    return `## Task Assistant Example

Start with the first half. The rest shows more features when you need them.

## Quick Start

You can also add standalone items in a daily note:

Write daily summary ${dateMarker}${today}

Review meeting notes ${dateMarker}${today} 18:00

Follow up on release issues ${dateMarker}${tomorrow}

> Skip manual dates with /jt /today and /mt /tomorrow

## Items and Pomodoro

Pomodoro focus example ${dateMarker}${today} 10:00~10:25

🍅${today} 10:00:00~10:25:00 First focus record

> After a focus session, the pomodoro record is added under the item automatically. You can also write it manually.

## Tasks and Items

Homepage refresh ${taskTag} @L1

Review user feedback ${dateMarker}${yesterday} ${completedTag}

Design the homepage draft ${dateMarker}${today} 🔥

Review visual draft ${dateMarker}${tomorrow} ⏰14:00

Release prep ${taskTag} @L1

Check the release checklist ${dateMarker}${today}

Weekly release review ${dateMarker}${tomorrow} 🔁weekly

> When items start to pile up, use /rw /task to organize them. Mark completed items with /wc /done.

## More Examples

Morning stretch 🎯${today} 🔄daily

> Create or edit habits with /xg /habit

Prepare workshop material ${dateMarker}${today}, ${tomorrow}

[Spec doc](https://example.com/spec)

## Common Slash Commands

- /jt /today: Add today's item
- /mt /tomorrow: Add tomorrow's item
- /rw /task: Mark as task
- /wc /done: Mark as done
- /xg /habit: Create or edit habits
- /xq /detail: Open item details
- /tx /reminder: Set reminder
- /cf /recurring: Set recurring
- /zz /focus: Start pomodoro
`;
  }

  return `## 任务助手示例

先看前半部分就能开始使用；后半部分展示更多能力。

## 快速开始

你也可以在 daily note 里直接写独立事项：

整理日报 ${dateMarker}${today}

复盘会议 ${dateMarker}${today} 18:00

跟进发布问题 ${dateMarker}${tomorrow}

> 不想手写日期时，可用 /jt /today 和 /mt /tomorrow

## 事项和番茄钟

番茄专注示例 ${dateMarker}${today} 10:00~10:25

🍅${today} 10:00:00~10:25:00 第一次专注记录

> 专注结束后会自动在事项下追加一条番茄记录，也可以手写。

## 任务和事项

首页改版 ${taskTag} @L1

整理需求反馈 ${dateMarker}${yesterday} ${completedTag}

设计首页原型 ${dateMarker}${today} 🔥

评审视觉稿 ${dateMarker}${tomorrow} ⏰14:00

发布准备 ${taskTag} @L1

检查发布清单 ${dateMarker}${today}

发布例行检查 ${dateMarker}${tomorrow} 🔁每周

> 待办变多后，再用 /rw /task 把内容整理成任务；完成事项可用 /wc /done

## 更多玩法

晨间拉伸 🎯${today} 🔄每天

> 创建或编辑习惯，推荐使用 /xg /habit

整理培训资料 ${dateMarker}${today}, ${tomorrow}

[需求文档](https://example.com/spec)

## 常用斜杠命令

- /jt /today：添加今日事项
- /mt /tomorrow：添加明日事项
- /rw /task：标记为任务
- /wc /done：标记为完成
- /xg /habit：创建或编辑习惯
- /xq /detail：查看事项详情
- /tx /reminder：设置提醒
- /cf /recurring：设置重复
- /zz /focus：开始番茄钟
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
