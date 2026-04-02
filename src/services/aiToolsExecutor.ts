/**
 * AI 工具执行器
 * 执行 AI 请求的工具调用
 */
import type { ToolCall } from '@/types/ai';
import type { Item, ItemStatus, Project, ProjectGroup } from '@/types/models';
import dayjs from '@/utils/dayjs';
import {
  aggregatePomodorosFromProjects,
  filterPomodoros,
  computePomodoroStats,
  toPomodoroRecordOutput,
  toPomodoroRecordCompact,
  type PomodoroRecordCompact,
  type PomodoroStatsOutput
} from '@/utils/pomodoroUtils';
import type { ToolName } from './aiTools';
import { SkillService } from './skillService';
import type { SkillConfig } from '@/types/skill';
import * as siyuanAPI from '@/api';
import { updateBlockContent } from '@/utils/fileUtils';

/**
 * 筛选事项参数
 */
export interface FilterItemsArgs {
  projectId?: string;
  projectIds?: string[];
  groupId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'completed' | 'abandoned';
}

/**
 * 项目列表输出
 */
export interface ListProjectOutput {
  id: string;
  name: string;
  description: string | undefined;
  path: string;
  groupId: string | undefined;
  taskCount: number;
}

/**
 * 事项筛选输出
 */
export interface FilterItemOutput {
  id: string;
  content: string;
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  status: string;
  projectName?: string;
  taskName?: string;
  links?: Array<{ name: string; url: string }>;
  pomodoros?: PomodoroRecordCompact[];
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  groups: ProjectGroup[];
  projects: Project[];
  allItems: Item[];
}

/**
 * 执行 list_groups 工具
 */
function executeListGroups(context: ToolExecutionContext): ProjectGroup[] {
  return context.groups;
}

/**
 * 执行 list_projects 工具
 */
function executeListProjects(
  context: ToolExecutionContext,
  args: { groupId?: string }
): ListProjectOutput[] {
  const filtered = args.groupId
    ? context.projects.filter(p => p.groupId === args.groupId)
    : context.projects;

  return filtered.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    path: p.path,
    groupId: p.groupId,
    taskCount: p.tasks.length
  }));
}

/**
 * 执行 filter_items 工具
 */
function executeFilterItems(
  context: ToolExecutionContext,
  args: FilterItemsArgs
): FilterItemOutput[] {
  let filtered = [...context.allItems];

  if (args.projectId) {
    filtered = filtered.filter(i => i.project?.id === args.projectId);
  } else if (args.projectIds?.length) {
    const set = new Set(args.projectIds);
    filtered = filtered.filter(i => i.project && set.has(i.project.id));
  } else if (args.groupId) {
    filtered = filtered.filter(i => i.project?.groupId === args.groupId);
  }

  if (args.startDate) {
    filtered = filtered.filter(i => i.date >= args.startDate);
  }
  if (args.endDate) {
    filtered = filtered.filter(i => i.date <= args.endDate);
  }
  if (args.status) {
    filtered = filtered.filter(i => i.status === args.status);
  }

  return filtered.map(i => ({
    id: i.id,
    content: i.content,
    date: i.date,
    startDateTime: i.startDateTime,
    endDateTime: i.endDateTime,
    status: i.status,
    projectName: i.project?.name,
    taskName: i.task?.name,
    links: i.links,
    pomodoros: i.pomodoros?.map(toPomodoroRecordCompact) ?? []
  }));
}

/**
 * 执行 get_pomodoro_stats 工具
 */
function executeGetPomodoroStats(
  context: ToolExecutionContext,
  args: { date?: string; startDate?: string; endDate?: string; projectId?: string }
): PomodoroStatsOutput {
  const todayDate = dayjs().format('YYYY-MM-DD');
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }

  const enriched = aggregatePomodorosFromProjects(context.projects);
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId
  });
  const stats = computePomodoroStats(filtered, todayDate);

  const result: PomodoroStatsOutput = {
    todayCount: stats.todayCount,
    todayMinutes: stats.todayMinutes,
    totalCount: stats.count,
    totalMinutes: stats.totalMinutes
  };

  if (startDate && endDate) {
    result.dateRange = { startDate, endDate };
  }
  if (args.projectId) {
    result.projectId = args.projectId;
  }

  return result;
}

/**
 * 执行 get_pomodoro_records 工具
 */
function executeGetPomodoroRecords(
  context: ToolExecutionContext,
  args: { date?: string; startDate?: string; endDate?: string; projectId?: string }
): { records: ReturnType<typeof toPomodoroRecordOutput>[] } {
  const todayDate = dayjs().format('YYYY-MM-DD');
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }

  const enriched = aggregatePomodorosFromProjects(context.projects);
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId
  });

  const records = filtered.map(toPomodoroRecordOutput);
  records.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
  });

  return { records };
}

/**
 * 执行 update_item_status 工具
 * 修改事项状态（完成/放弃/恢复待办）
 */
async function executeUpdateItemStatus(
  context: ToolExecutionContext,
  args: { itemId: string; status: 'completed' | 'abandoned' | 'pending' }
): Promise<{ success: boolean; message: string }> {
  const item = context.allItems.find(i => i.id === args.itemId);
  if (!item) {
    return { success: false, message: `未找到事项 ID: ${args.itemId}。请先用 filter_items 查询获取正确的 itemId。` };
  }
  if (!item.blockId) {
    return { success: false, message: `事项"${item.content}"没有关联的块 ID，无法修改。` };
  }

  const targetStatus = args.status as ItemStatus;

  try {
    if (targetStatus === 'pending') {
      // 恢复待办：读取块 kramdown，清除状态标记
      const kramdownResult = await siyuanAPI.getBlockKramdown(item.blockId);
      if (!kramdownResult?.kramdown) {
        return { success: false, message: '无法读取事项内容' };
      }
      let content = kramdownResult.kramdown
        .replace(/#已完成|#已放弃|#done|#abandoned|[✅❌]/g, '');
      content = content.replace(/\[[xX]\]/g, '[ ]');
      await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
    } else {
      // 完成/放弃：使用 fileUtils 的 updateBlockContent 添加状态标记
      const suffix = targetStatus === 'completed' ? '#已完成' : '#已放弃';
      const success = await updateBlockContent(item.blockId, suffix);
      if (!success) {
        return { success: false, message: `更新事项"${item.content}"状态失败` };
      }
    }

    const statusText = targetStatus === 'completed'
      ? '标记为已完成'
      : targetStatus === 'abandoned'
        ? '标记为已放弃'
        : '恢复为待办';

    return {
      success: true,
      message: `已将"${item.content}"${statusText}`
    };
  } catch (error) {
    return {
      success: false,
      message: `更新状态失败: ${(error as Error).message}`
    };
  }
}

/**
 * 构建 AI 创建事项的 Markdown 内容
 */
function buildCreateItemContent(
  content: string,
  date: string,
  startTime?: string,
  endTime?: string
): string {
  let datePart = `📅${date}`;
  if (startTime && endTime) {
    datePart = `📅${date} ${startTime}~${endTime}`;
  } else if (startTime) {
    datePart = `📅${date} ${startTime}`;
  }
  return `${content} ${datePart}`;
}

/**
 * 执行 create_item 工具
 * 在指定项目下创建新事项
 */
async function executeCreateItem(
  context: ToolExecutionContext,
  args: {
    projectId: string;
    content: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }
): Promise<{ success: boolean; message: string; itemId?: string }> {
  // 查找项目
  const project = context.projects.find(p => p.id === args.projectId);
  if (!project) {
    return { success: false, message: `未找到项目 ID: ${args.projectId}。请先用 list_projects 查询获取正确的 projectId。` };
  }

  // 找到最后一个任务的 blockId 作为插入锚点
  const lastTask = project.tasks[project.tasks.length - 1];
  if (!lastTask?.blockId) {
    return { success: false, message: `项目"${project.name}"中没有可用的任务块，请先创建任务。` };
  }

  // 构建事项 Markdown
  const itemContent = buildCreateItemContent(
    args.content,
    args.date,
    args.startTime,
    args.endTime
  );

  try {
    // 在任务块后追加事项（previousID = lastTask.blockId 表示在其后插入）
    const result = await siyuanAPI.insertBlock(
      'markdown',
      itemContent,
      undefined,
      lastTask.blockId,
      undefined
    );

    if (result && result[0]) {
      const newBlockId = (result[0] as any).doOperations?.[0]?.id;
      return {
        success: true,
        message: `已在项目"${project.name}"的任务"${lastTask.name}"下创建事项"${args.content}"（${args.date}${args.startTime ? ` ${args.startTime}` : ''}）`,
        itemId: newBlockId
      };
    }

    return { success: false, message: '创建事项失败：SiYuan API 未返回结果' };
  } catch (error) {
    return {
      success: false,
      message: `创建事项失败: ${(error as Error).message}`
    };
  }
}

/**
 * 执行工具调用
 */
export async function executeTool(
  toolCall: ToolCall,
  context: ToolExecutionContext
): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments);
  const toolName = toolCall.function.name as ToolName;

  switch (toolName) {
    case 'list_groups':
      return JSON.stringify(executeListGroups(context));

    case 'list_projects':
      return JSON.stringify(executeListProjects(context, args));

    case 'filter_items':
      return JSON.stringify(executeFilterItems(context, args));

    case 'get_pomodoro_stats':
      return JSON.stringify(executeGetPomodoroStats(context, args));

    case 'get_pomodoro_records':
      return JSON.stringify(executeGetPomodoroRecords(context, args));

    case 'list_skills':
      return JSON.stringify(await executeListSkills());

    case 'get_skill_detail':
      return JSON.stringify(await executeGetSkillDetail(args));

    case 'update_item_status':
      return JSON.stringify(await executeUpdateItemStatus(context, args));

    case 'create_item':
      return JSON.stringify(await executeCreateItem(context, args));

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * 执行 list_skills 工具
 * 预加载所有技能到内存，返回技能名称和描述列表
 */
async function executeListSkills(): Promise<Array<{ 
  name: string; 
  description: string;
}>> {
  const skillService = SkillService.getInstance();
  
  console.log('[executeListSkills] 开始加载技能...');
  
  // 预加载所有技能到内存缓存
  await skillService.preloadAllSkills();
  
  // 返回缓存中的技能元数据
  const skillNames = skillService.getCachedSkillNames();
  const result = skillNames.map(name => {
    const skill = skillService.getSkillFromCache(name)!;
    return {
      name: skill.name,
      description: skill.description
    };
  });
  
  console.log('[executeListSkills] 返回技能列表:', result.map(s => s.name));
  return result;
}

/**
 * 执行 get_skill_detail 工具
 * 根据技能名称从内存缓存获取详细内容
 * 参数：name（技能名称）
 */
async function executeGetSkillDetail(args: { 
  name: string;
}): Promise<{ 
  name: string; 
  description: string;
  content: string;
} | { error: string }> {
  const skillService = SkillService.getInstance();
  
  try {
    // 从内存缓存获取技能
    let skill = skillService.getSkillFromCache(args.name);
    
    // 如果缓存未命中，重新加载所有技能
    if (!skill) {
      await skillService.preloadAllSkills();
      skill = skillService.getSkillFromCache(args.name);
    }
    
    if (!skill) {
      return { error: `未找到技能: ${args.name}` };
    }
    
    return {
      name: skill.name,
      description: skill.description,
      content: skill.content
    };
  } catch (error) {
    return { 
      error: `获取技能详情失败: ${(error as Error).message}` 
    };
  }
}

/**
 * 批量执行多个工具调用
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  context: ToolExecutionContext
): Promise<Array<{ toolCallId: string; result: string }>> {
  const results = [];
  
  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall, context);
    results.push({
      toolCallId: toolCall.id,
      result
    });
  }
  
  return results;
}
