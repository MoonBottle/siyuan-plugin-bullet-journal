/**
 * AI 工具执行器
 * 执行 AI 请求的工具调用
 */
import type { ToolCall } from '@/types/ai';
import type { Item, Project, ProjectGroup } from '@/types/models';
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
      return JSON.stringify(executeListSkills());

    case 'get_skill_detail':
      return JSON.stringify(await executeGetSkillDetail(args));

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * 执行 list_skills 工具
 * 返回所有可用技能的名称和描述列表
 */
function executeListSkills(): Array<{ name: string; description: string; source: 'builtin' | 'user' }> {
  const skillService = SkillService.getInstance();
  const allSkills = skillService.getAllSkills();
  
  return allSkills
    .filter(skill => skill.enabled)
    .map(skill => ({
      name: skill.name,
      description: skill.description,
      source: (skill as SkillConfig & { isBuiltin?: boolean }).isBuiltin ? 'builtin' : 'user'
    }));
}

/**
 * 执行 get_skill_detail 工具
 * 获取指定技能的详细内容
 */
async function executeGetSkillDetail(args: { skillName: string }): Promise<{ 
  name: string; 
  description: string;
  content: string;
  source: 'builtin' | 'user';
} | { error: string }> {
  const skillService = SkillService.getInstance();
  
  try {
    const result = await skillService.resolveSkill(args.skillName);
    
    return {
      name: result.skill.metadata.name,
      description: result.skill.metadata.description,
      content: result.skill.content,
      source: result.source
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
