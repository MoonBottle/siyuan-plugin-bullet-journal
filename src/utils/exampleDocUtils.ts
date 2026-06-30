import { expandDocTree } from 'siyuan'
/**
 * 示例文档创建工具函数
 */
import {
  createDocWithMd,
  pushMsg,
} from '@/api'
import {
  getCurrentLocale,
  t,
} from '@/i18n'
import dayjs from '@/utils/dayjs'
import { openDocument } from '@/utils/fileUtils'
import { getOrCreateTaskAssistantNotebook } from '@/utils/notebookUtils'

/**
 * 获取今天的日期字符串
 */
function getToday(): string {
  return dayjs().format('YYYY-MM-DD')
}

/**
 * 获取明天的日期字符串
 */
function getTomorrow(): string {
  return dayjs().add(1, 'day').format('YYYY-MM-DD')
}

/**
 * 获取昨天的日期字符串
 */
function getYesterday(): string {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
}

/**
 * 获取示例文档名称
 */
function getExampleDocName(): string {
  const lang = getCurrentLocale()
  console.log('[Task Assistant] getExampleDocName - current locale:', lang)
  return lang.startsWith('en') ? 'Task Assistant Example' : '任务助手示例文档'
}

/**
 * 生成示例文档的 Markdown 内容
 */
export function generateExampleContent(): string {
  const today = getToday()
  const tomorrow = getTomorrow()
  const yesterday = getYesterday()
  const lang = getCurrentLocale()
  const isEn = lang.startsWith('en')
  console.log('[Task Assistant] generateExampleContent - current locale:', lang, 'isEn:', isEn)

  const taskTag = t('taskTag') || '#任务'
  const completedTag = t('statusTag').completed || '#已完成'
  const dateMarker = t('dateMarker') || '📅'

  if (isEn) {
    return `## Task Assistant Example

## Quick Start

> In slash commands, /today adds today's date to the current line, and /tomorrow adds tomorrow's date.
> Start by writing an item. Then type / in the editor to open slash commands, and use /today or /tomorrow to add a date.

Write daily summary ${dateMarker}${today}

Follow up on release issues ${dateMarker}${tomorrow}

## Item Status

> When an item is done, use /done to mark the current line as completed. If you no longer plan to do it, use /abandon to mark it as abandoned.

Finish meeting notes ${dateMarker}${today} ${completedTag}

Drop outdated draft ${dateMarker}${yesterday} ❌

## Items and Pomodoro

> After a focus session, the pomodoro record is added under the item automatically. You can also write it manually.

Pomodoro focus example ${dateMarker}${today} 10:00~10:25

🍅${today} 10:00:00~10:25:00 First focus record

## Tasks and Items

Homepage refresh ${taskTag}

Review user feedback ${dateMarker}${yesterday} ${completedTag}

Release prep ${taskTag}

Check the release checklist ${dateMarker}${today}

> Here, ${taskTag} marks a task. The lines with ${dateMarker} dates below it are the actual items.
> You can always start with standalone items first. When they start to pile up, use /task to organize them. Mark completed items with /done.

## Priority

> Write the item content normally, then use /priority to add the priority marker.
> Priority markers use 🔥 for high priority, 🌱 for medium priority, and 🍃 for low priority.

Homepage polish ${taskTag}

Design the homepage draft ${dateMarker}${today} 🔥

## Reminders

> Write the item content first, then use /reminder to attach a reminder time.
> Here, ⏰14:00 means a reminder is set for 14:00.

Design review prep ${taskTag}

Review visual draft ${dateMarker}${today} ⏰14:00

## Recurring

> Write the item content first, then use /recurring to turn it into a repeating item.
> Here, 🔁workday means that after you mark this item as done, the plugin will automatically create the next workday occurrence.

Workday routine ${taskTag}

Daily status sync ${dateMarker}${today} 🔁workday

## More Examples

### Habits

> Create or edit habits with /habit, and use /checkin to add a check-in record.

Morning stretch 🎯${today} 🔄daily

Morning stretch ${dateMarker}${today}

### Links

> Put the item first, then keep the related link under it so the context stays clear.
> Links added this way appear in the item details. Press Ctrl and left-click the item line to open it.

Release notes review ${taskTag}

Review API changes ${dateMarker}${today}

[Spec doc](https://example.com/spec)

## Common Slash Commands

- /today: Add today's item
- /tomorrow: Add tomorrow's item
- /task: Mark as task
- /done: Mark as done
- /abandon: Mark as abandoned
- /habit: Create or edit habits
- /checkin: Add a habit check-in
- /detail: Open item details
- /priority: Set priority
- /reminder: Set reminder
- /recurring: Set recurring
- /focus: Start pomodoro
`
  }

  return `## 任务助手示例

## 快速开始

> 在斜杠命令里，/jt 会把当前行标记为今天的事项，/mt 会把当前行标记为明天的事项。
> 先写事项内容。然后在编辑器里输入 / 打开斜杠命令，用 /jt 或 /mt 给当前行补日期。

整理日报 ${dateMarker}${today}

跟进发布问题 ${dateMarker}${tomorrow}

## 事项状态

> 事项完成后，可用 /wc 把当前行标记为已完成；不再处理时，可用 /fq 标记为已放弃。

整理会议结论 ${dateMarker}${today} ${completedTag}

放弃旧方案 ${dateMarker}${yesterday} ❌

## 事项和番茄钟

> 专注结束后会自动在事项下追加一条番茄记录，也可以手写。

番茄专注示例 ${dateMarker}${today} 10:00~10:25

🍅${today} 10:00:00~10:25:00 第一次专注记录

## 任务和事项

首页改版 ${taskTag}

整理需求反馈 ${dateMarker}${yesterday} ${completedTag}

发布准备 ${taskTag}

检查发布清单 ${dateMarker}${today}

> 这里的 ${taskTag} 表示“任务”；下面带 ${dateMarker} 日期的行是这个任务里的具体事项。
> 你也可以先写普通事项；待办变多后，再用 /rw 把内容整理成任务，完成事项可用 /wc

## 优先级

> 先把事项内容写出来，再用 /yxj 添加优先级标记。
> 优先级标记里，🔥 表示高优先级，🌱 表示中优先级，🍃 表示低优先级。

首页细化 ${taskTag}

设计首页原型 ${dateMarker}${today} 🔥

## 提醒

> 先写事项内容，再用 /tx 补一个提醒时间。
> 这里的 ⏰14:00 表示会在 14:00 提醒你。

评审准备 ${taskTag}

评审视觉稿 ${dateMarker}${today} ⏰14:00

## 重复

> 先写事项内容，再用 /cf 把它变成重复事项。
> 这里的 🔁工作日 表示：当你把当前事项标记为完成后，插件会自动生成下一次工作日事项。

工作日例行 ${taskTag}

同步每日进展 ${dateMarker}${today} 🔁工作日

## 更多玩法

### 习惯

> 创建或编辑习惯，推荐使用 /xg；需要打卡时，用 /dk 添加今天的打卡记录。

晨间拉伸 🎯${today} 🔄每天

晨间拉伸 ${dateMarker}${today}

### 链接

> 先写事项，再把相关链接放在下面，避免链接脱离上下文。
> 这样添加的链接会显示在事项详情里。按住 Ctrl 后左键点击事项行，即可打开事项详情。

发布说明整理 ${taskTag}

查看接口变更 ${dateMarker}${today}

[需求文档](https://example.com/spec)

## 常用斜杠命令

- /jt：添加今日事项
- /mt：添加明日事项
- /rw：标记为任务
- /wc：标记为完成
- /fq：标记为放弃
- /xg：创建或编辑习惯
- /dk：添加习惯打卡
- /xq：查看事项详情
- /yxj：设置优先级
- /tx：设置提醒
- /cf：设置重复
- /zz：开始番茄钟
`
}

/**
 * 创建示例文档
 * @param notebookId 笔记本 ID，如果不提供则使用第一个笔记本
 * @param path 文档路径，如果不提供则使用默认路径
 * @returns 创建的文档 ID
 */
export async function createExampleDocument(
  notebookId?: string,
  path?: string,
): Promise<string | null> {
  try {
    // 如果没有提供 notebookId，获取或创建任务助手笔记本
    let targetNotebookId = notebookId
    if (!targetNotebookId) {
      const notebook = await getOrCreateTaskAssistantNotebook()
      if (!notebook) {
        console.error('[Task Assistant] Failed to get or create task assistant notebook')
        await pushMsg(`${t('todo').exampleDocFailed}: ${t('common.notebookCreateFailed')}`, 3000)
        return null
      }
      targetNotebookId = notebook.id
      console.log('[Task Assistant] Using notebook:', notebook.name, 'id:', targetNotebookId)
    }

    // 生成文档路径
    const fullPath = path || getExampleDocName()

    // 生成内容
    const content = generateExampleContent()

    // 创建文档
    console.log('[Task Assistant] Creating document with notebookId:', targetNotebookId, 'path:', fullPath)
    const docId = await createDocWithMd(targetNotebookId, fullPath, content)
    console.log('[Task Assistant] createDocWithMd returned:', docId)

    if (docId) {
      await pushMsg(t('todo').exampleDocCreated, 3000)
      // 自动打开文档
      await openDocument(docId)
      // 在文档树中定位并展开该文档
      expandDocTree({
        id: docId,
        isSetCurrent: true,
      })
    } else {
      console.error('[Task Assistant] createDocWithMd returned null or undefined')
      await pushMsg(`${t('todo').exampleDocFailed}: 创建文档失败`, 3000)
    }

    return docId
  } catch (error) {
    console.error('[Task Assistant] Failed to create example document:', error)
    await pushMsg(t('todo').exampleDocFailed, 3000)
    return null
  }
}
