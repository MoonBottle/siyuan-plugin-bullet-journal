import type { ToolCall } from '@/types/ai'
import type {
  Item,
  ItemStatus,
  Project,
  ProjectDirectory,
  ProjectGroup,
} from '@/types/models'
import type {
  PomodoroRecordCompact,
  PomodoroStatsOutput,
} from '@/utils/pomodoroUtils'
import * as siyuanAPI from '@/api'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  insertBlockAfterWithResult,
  writeBlock,
} from '@/utils/blockWriter'
import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'
import dayjs from '@/utils/dayjs'
import {
  aggregatePomodorosFromProjects,
  computePomodoroStats,
  filterPomodoros,
  toPomodoroRecordCompact,
  toPomodoroRecordOutput,
} from '@/utils/pomodoroUtils'
import {
  createFullRefreshRequest,
  RefreshReasons,
  submitRefreshRequest,
} from '@/utils/refreshRequests'
import { SkillService } from './skillService'

export interface FilterItemsArgs {
  projectId?: string
  projectIds?: string[]
  groupId?: string
  startDate?: string
  endDate?: string
  status?: 'pending' | 'completed' | 'abandoned'
}

export interface ListProjectOutput {
  id: string
  name: string
  description: string | undefined
  path: string
  groupId: string | undefined
  taskCount: number
}

export interface FilterItemOutput {
  id: string
  content: string
  date: string
  startDateTime?: string
  endDateTime?: string
  status: string
  projectName?: string
  taskName?: string
  links?: Array<{ name: string, url: string }>
  pomodoros?: PomodoroRecordCompact[]
}

export interface ToolExecutionContext {
  groups: ProjectGroup[]
  projects: Project[]
  allItems: Item[]
  directories?: ProjectDirectory[]
}

export type ToolName =
  | 'list_groups'
  | 'list_projects'
  | 'filter_items'
  | 'get_pomodoro_stats'
  | 'get_pomodoro_records'
  | 'list_skills'
  | 'get_skill_detail'
  | 'update_item_status'
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'create_task'
  | 'create_project'

export function executeListGroups(context: ToolExecutionContext): ProjectGroup[] {
  return context.groups
}

export function executeListProjects(
  args: { groupId?: string },
  context: ToolExecutionContext,
): ListProjectOutput[] {
  const filtered = args.groupId
    ? context.projects.filter((p) => p.groupId === args.groupId)
    : context.projects

  return filtered.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    path: p.path,
    groupId: p.groupId,
    taskCount: p.tasks.length,
  }))
}

export function executeFilterItems(
  args: FilterItemsArgs,
  context: ToolExecutionContext,
): FilterItemOutput[] {
  let filtered = [...context.allItems]

  if (args.projectId) {
    filtered = filtered.filter((i) => i.project?.id === args.projectId)
  } else if (args.projectIds?.length) {
    const set = new Set(args.projectIds)
    filtered = filtered.filter((i) => i.project && set.has(i.project.id))
  } else if (args.groupId) {
    filtered = filtered.filter((i) => i.project?.groupId === args.groupId)
  }

  if (args.startDate) {
    filtered = filtered.filter((i) => i.date >= args.startDate)
  }
  if (args.endDate) {
    filtered = filtered.filter((i) => i.date <= args.endDate)
  }
  if (args.status) {
    filtered = filtered.filter((i) => i.status === args.status)
  }

  return filtered.map((i) => ({
    id: i.id,
    content: i.content,
    date: i.date,
    startDateTime: i.startDateTime,
    endDateTime: i.endDateTime,
    status: i.status,
    projectName: i.project?.name,
    taskName: i.task?.name,
    links: i.links,
    pomodoros: i.pomodoros?.map(toPomodoroRecordCompact) ?? [],
  }))
}

export function executeGetPomodoroStats(
  args: { date?: string, startDate?: string, endDate?: string, projectId?: string },
  context: ToolExecutionContext,
): PomodoroStatsOutput {
  const todayDate = dayjs().format('YYYY-MM-DD')
  let startDate = args.startDate
  let endDate = args.endDate

  if (args.date === 'today') {
    startDate = todayDate
    endDate = todayDate
  }

  const enriched = aggregatePomodorosFromProjects(context.projects)
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId,
  })
  const stats = computePomodoroStats(filtered, todayDate)

  const result: PomodoroStatsOutput = {
    todayCount: stats.todayCount,
    todayMinutes: stats.todayMinutes,
    totalCount: stats.count,
    totalMinutes: stats.totalMinutes,
  }

  if (startDate && endDate) {
    result.dateRange = {
      startDate,
      endDate,
    }
  }
  if (args.projectId) {
    result.projectId = args.projectId
  }

  return result
}

export function executeGetPomodoroRecords(
  args: { date?: string, startDate?: string, endDate?: string, projectId?: string },
  context: ToolExecutionContext,
): { records: ReturnType<typeof toPomodoroRecordOutput>[] } {
  const todayDate = dayjs().format('YYYY-MM-DD')
  let startDate = args.startDate
  let endDate = args.endDate

  if (args.date === 'today') {
    startDate = todayDate
    endDate = todayDate
  }

  const enriched = aggregatePomodorosFromProjects(context.projects)
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId,
  })

  const records = filtered.map(toPomodoroRecordOutput)
  records.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime)
  })

  return { records }
}

export async function executeUpdateItemStatus(
  args: { itemId: string, status: 'completed' | 'abandoned' | 'pending' },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string }> {
  const item = context.allItems.find((i) => i.id === args.itemId)
  if (!item) {
    return {
      success: false,
      message: `未找到事项 ID: ${args.itemId}。请先用 filter_items 查询获取正确的 itemId。`,
    }
  }
  if (!item.blockId) {
    return {
      success: false,
      message: `事项"${item.content}"没有关联的块 ID，无法修改。`,
    }
  }

  const targetStatus = args.status as ItemStatus

  try {
    const success = await writeBlock(
      {
        blockId: item.blockId,
        listItemBlockId: item.listItemBlockId,
      },
      {
        type: 'setStatus',
        status: targetStatus,
      },
    )
    if (!success) {
      return {
        success: false,
        message: `更新事项"${item.content}"状态失败`,
      }
    }

    const statusText = targetStatus === 'completed'
      ? '标记为已完成'
      : targetStatus === 'abandoned'
        ? '标记为已放弃'
        : '恢复为待办'

    return {
      success: true,
      message: `已将"${item.content}"${statusText}`,
    }
  } catch (error) {
    return {
      success: false,
      message: `更新状态失败: ${(error as Error).message}`,
    }
  }
}

function buildCreateItemContent(
  content: string,
  date: string,
  startTime?: string,
  endTime?: string,
): string {
  let datePart = `📅${date}`
  if (startTime && endTime) {
    datePart = `📅${date} ${startTime}~${endTime}`
  } else if (startTime) {
    datePart = `📅${date} ${startTime}`
  }
  return `${content} ${datePart}`
}

export async function executeCreateItem(
  args: {
    projectId: string
    content: string
    date: string
    startTime?: string
    endTime?: string
  },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string, itemId?: string }> {
  const project = context.projects.find((p) => p.id === args.projectId)
  if (!project) {
    return {
      success: false,
      message: `未找到项目 ID: ${args.projectId}。请先用 list_projects 查询获取正确的 projectId。`,
    }
  }

  const lastTask = project.tasks.at(-1)
  if (!lastTask?.blockId) {
    return {
      success: false,
      message: `项目"${project.name}"中没有可用的任务块，请先创建任务。`,
    }
  }

  const itemContent = buildCreateItemContent(
    args.content,
    args.date,
    args.startTime,
    args.endTime,
  )

  try {
    const result = await insertBlockAfterWithResult(lastTask.blockId, {
      type: 'replaceMarkdown',
      markdown: itemContent,
    })

    if (result && result[0]) {
      const newBlockId = (result[0] as any).doOperations?.[0]?.id
      return {
        success: true,
        message: `已在项目"${project.name}"的任务"${lastTask.name}"下创建事项"${args.content}"（${args.date}${args.startTime ? ` ${args.startTime}` : ''}）`,
        itemId: newBlockId,
      }
    }

    return {
      success: false,
      message: '创建事项失败：SiYuan API 未返回结果',
    }
  } catch (error) {
    return {
      success: false,
      message: `创建事项失败: ${(error as Error).message}`,
    }
  }
}

export async function executeUpdateItem(
  args: {
    itemId: string
    content?: string
    date?: string
    startTime?: string
    endTime?: string
  },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string }> {
  const item = context.allItems.find((i) => i.id === args.itemId)
  if (!item) {
    return {
      success: false,
      message: `未找到事项 ID: ${args.itemId}。请先用 filter_items 查询获取正确的 itemId。`,
    }
  }
  if (!item.blockId) {
    return {
      success: false,
      message: `事项"${item.content}"没有关联的块 ID，无法修改。`,
    }
  }

  try {
    const hasDateTimeChange = args.date !== undefined || args.startTime !== undefined || args.endTime !== undefined
    const hasContentChange = args.content !== undefined

    if (hasDateTimeChange) {
      const newDate = args.date || item.date
      const newStartTime = args.startTime !== undefined
        ? (args.startTime === '' ? undefined : args.startTime)
        : item.startDateTime?.split(' ')[1]
      const newEndTime = args.endTime !== undefined
        ? (args.endTime === '' ? undefined : args.endTime)
        : item.endDateTime?.split(' ')[1]

      const success = await writeBlock(
        { blockId: item.blockId },
        buildDatePatchFromItem(item, newDate, {
          includeCurrentItemInSiblings: true,
          startTime: newStartTime,
          endTime: newEndTime,
          allDay: !(newStartTime || newEndTime),
        }),
      )
      if (!success) {
        return {
          success: false,
          message: `更新事项"${item.content}"日期时间失败`,
        }
      }
    }

    if (hasContentChange && args.content) {
      const success = await writeBlock(
        { blockId: item.blockId },
        {
          type: 'setContent',
          newItemContent: args.content,
        },
      )
      if (!success) {
        return {
          success: false,
          message: `更新事项"${item.content}"内容失败`,
        }
      }
    }

    return {
      success: true,
      message: `已更新事项"${item.content}"${hasContentChange ? '（内容）' : ''}${hasDateTimeChange ? '（日期时间）' : ''}`,
    }
  } catch (error) {
    return {
      success: false,
      message: `更新事项失败: ${(error as Error).message}`,
    }
  }
}

export async function executeDeleteItem(
  args: { itemId: string },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string }> {
  const item = context.allItems.find((i) => i.id === args.itemId)
  if (!item) {
    return {
      success: false,
      message: `未找到事项 ID: ${args.itemId}。请先用 filter_items 查询获取正确的 itemId。`,
    }
  }
  if (!item.blockId) {
    return {
      success: false,
      message: `事项"${item.content}"没有关联的块 ID，无法删除。`,
    }
  }

  try {
    await siyuanAPI.deleteBlock(item.blockId)
    return {
      success: true,
      message: `已删除事项"${item.content}"`,
    }
  } catch (error) {
    return {
      success: false,
      message: `删除事项失败: ${(error as Error).message}`,
    }
  }
}

export async function executeCreateTask(
  args: {
    projectId: string
    name: string
    level?: string
  },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string, taskId?: string }> {
  const project = context.projects.find((p) => p.id === args.projectId)
  if (!project) {
    return {
      success: false,
      message: `未找到项目 ID: ${args.projectId}。请先用 list_projects 查询获取正确的 projectId。`,
    }
  }

  const level = args.level || 'L1'
  const taskMarkdown = `${args.name} #task @${level}`

  try {
    const result = await siyuanAPI.appendBlock(
      'markdown',
      taskMarkdown,
      project.id,
    )

    if (result && result[0]) {
      const newBlockId = (result[0] as any).doOperations?.[0]?.id
      return {
        success: true,
        message: `已在项目"${project.name}"下创建任务"${args.name}"（${level}）`,
        taskId: newBlockId,
      }
    }

    return {
      success: false,
      message: '创建任务失败：SiYuan API 未返回结果',
    }
  } catch (error) {
    return {
      success: false,
      message: `创建任务失败: ${(error as Error).message}`,
    }
  }
}

export async function executeCreateProject(
  args: {
    directoryId?: string
    name: string
    description?: string
  },
  context: ToolExecutionContext,
): Promise<{ success: boolean, message: string, projectId?: string }> {
  const directories = context.directories || []
  const hasEnabledDirs = directories.some((d) => d.enabled)

  try {
    const notebooksResult = await siyuanAPI.lsNotebooks()
    if (!notebooksResult?.notebooks) {
      return {
        success: false,
        message: '无法获取笔记本列表',
      }
    }
    const notebook = notebooksResult.notebooks.find((nb: any) => !nb.closed)
    if (!notebook) {
      return {
        success: false,
        message: '没有可用的笔记本',
      }
    }

    let docContent = `# ${args.name}\n`
    if (args.description) {
      docContent += `\n${args.description}\n`
    }

    if (!hasEnabledDirs) {
      const docId = await siyuanAPI.createDocWithMd(
        notebook.id,
        args.name,
        docContent,
      )

      if (docId) {
        return {
          success: true,
          message: `已创建项目"${args.name}"`,
          projectId: docId,
        }
      }
      return {
        success: false,
        message: '创建项目失败：SiYuan API 未返回结果',
      }
    }

    if (!args.directoryId) {
      const availableDirs = directories
        .filter((d) => d.enabled)
        .map((d) => `  - ${d.id}: ${d.path}${d.groupId ? ` (分组: ${d.groupId})` : ''}`)
        .join('\n')
      return {
        success: false,
        message: `已配置项目目录，请指定 directoryId。\n可用目录：\n${availableDirs}`,
      }
    }

    const directory = directories.find((d) => d.id === args.directoryId)
    if (!directory) {
      const availableDirs = directories
        .filter((d) => d.enabled)
        .map((d) => `  - ${d.id}: ${d.path}${d.groupId ? ` (分组: ${d.groupId})` : ''}`)
        .join('\n')
      return {
        success: false,
        message: `未找到目录 ID: ${args.directoryId}。\n可用目录：\n${availableDirs}`,
      }
    }

    const docPath = `${directory.path}/${args.name}`
    const docId = await siyuanAPI.createDocWithMd(
      notebook.id,
      docPath,
      docContent,
    )

    if (!docId) {
      return {
        success: false,
        message: '创建项目失败：SiYuan API 未返回结果',
      }
    }

    const newDir: ProjectDirectory = {
      id: `dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path: docPath,
      enabled: true,
      groupId: directory.groupId,
    }

    const settingsStore = useSettingsStore()
    settingsStore.directories.push(newDir)
    settingsStore.saveToPlugin()

    submitRefreshRequest(createFullRefreshRequest(RefreshReasons.AI_TOOLS_CREATE_PROJECT_DOC))

    return {
      success: true,
      message: `已在目录"${directory.path}"下创建项目"${args.name}"，并已添加到目录配置`,
      projectId: docId,
    }
  } catch (error) {
    return {
      success: false,
      message: `创建项目失败: ${(error as Error).message}`,
    }
  }
}

export async function executeListSkills(): Promise<Array<{
  name: string
  description: string
}>> {
  const skillService = SkillService.getInstance()

  console.log('[executeListSkills] 开始加载技能...')

  await skillService.preloadAllSkills()

  const skillNames = skillService.getCachedSkillNames()
  const result = skillNames.map((name) => {
    const skill = skillService.getSkillFromCache(name)!
    return {
      name: skill.name,
      description: skill.description,
    }
  })

  console.log('[executeListSkills] 返回技能列表:', result.map((s) => s.name))
  return result
}

export async function executeGetSkillDetail(args: {
  name: string
}): Promise<{
  name: string
  description: string
  content: string
} | { error: string }> {
  const skillService = SkillService.getInstance()

  try {
    let skill = skillService.getSkillFromCache(args.name)

    if (!skill) {
      await skillService.preloadAllSkills()
      skill = skillService.getSkillFromCache(args.name)
    }

    if (!skill) {
      return { error: `未找到技能: ${args.name}` }
    }

    return {
      name: skill.name,
      description: skill.description,
      content: skill.content,
    }
  } catch (error) {
    return {
      error: `获取技能详情失败: ${(error as Error).message}`,
    }
  }
}

export async function executeTool(
  toolCall: ToolCall,
  context: ToolExecutionContext,
): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments)
  const toolName = toolCall.function.name as ToolName

  switch (toolName) {
    case 'list_groups':
      return JSON.stringify(executeListGroups(context))

    case 'list_projects':
      return JSON.stringify(executeListProjects(args, context))

    case 'filter_items':
      return JSON.stringify(executeFilterItems(args, context))

    case 'get_pomodoro_stats':
      return JSON.stringify(executeGetPomodoroStats(args, context))

    case 'get_pomodoro_records':
      return JSON.stringify(executeGetPomodoroRecords(args, context))

    case 'list_skills':
      return JSON.stringify(await executeListSkills())

    case 'get_skill_detail':
      return JSON.stringify(await executeGetSkillDetail(args))

    case 'update_item_status':
      return JSON.stringify(await executeUpdateItemStatus(args, context))

    case 'create_item':
      return JSON.stringify(await executeCreateItem(args, context))

    case 'update_item':
      return JSON.stringify(await executeUpdateItem(args, context))

    case 'delete_item':
      return JSON.stringify(await executeDeleteItem(args, context))

    case 'create_task':
      return JSON.stringify(await executeCreateTask(args, context))

    case 'create_project':
      return JSON.stringify(await executeCreateProject(args, context))

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  context: ToolExecutionContext,
): Promise<Array<{ toolCallId: string, result: string }>> {
  const results = []

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall, context)
    results.push({
      toolCallId: toolCall.id,
      result,
    })
  }

  return results
}
