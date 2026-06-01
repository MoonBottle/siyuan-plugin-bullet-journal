import type { AgentTool } from '@earendil-works/pi-agent-core'
import type {
  ToolExecutionContext,
  ToolName,
} from './aiToolsExecutor'
import type { ToolDefinition } from '@/types/ai'
import {
  StringEnum,
  Type,
} from '@earendil-works/pi-ai'
import {
  executeCreateItem,
  executeCreateProject,
  executeCreateTask,
  executeDeleteItem,
  executeFilterItems,
  executeGetPomodoroRecords,
  executeGetPomodoroStats,
  executeListGroups,
  executeListProjects,
  executeSkill,
  executeUpdateItem,
  executeUpdateItemStatus,
} from './aiToolsExecutor'

let currentContext: ToolExecutionContext = {
  groups: [],
  projects: [],
  allItems: [],
}

export function setToolContext(context: ToolExecutionContext): void {
  currentContext = context
}

export const listGroupsTool: AgentTool = {
  name: 'list_groups',
  label: '查询分组',
  description: '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
  parameters: Type.Object({}),
  execute: async () => {
    const result = executeListGroups(currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const listProjectsTool: AgentTool = {
  name: 'list_projects',
  label: '查询项目',
  description: '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
  parameters: Type.Object({
    groupId: Type.Optional(Type.String({ description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = executeListProjects(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const filterItemsTool: AgentTool = {
  name: 'filter_items',
  label: '筛选事项',
  description: '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
  parameters: Type.Object({
    projectId: Type.Optional(Type.String({ description: '项目文档 ID，来自 list_projects 返回的 id' })),
    projectIds: Type.Optional(Type.Array(Type.String(), { description: '项目 ID 数组，多选时使用' })),
    groupId: Type.Optional(Type.String({ description: '分组 ID，来自 list_groups 返回的 id' })),
    startDate: Type.Optional(Type.String({ description: '起始日期，格式 YYYY-MM-DD' })),
    endDate: Type.Optional(Type.String({ description: '结束日期，格式 YYYY-MM-DD' })),
    status: Type.Optional(StringEnum(['pending', 'completed', 'abandoned'], { description: 'pending=待办, completed=已完成, abandoned=已放弃' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = executeFilterItems(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const getPomodoroStatsTool: AgentTool = {
  name: 'get_pomodoro_stats',
  label: '番茄钟统计',
  description: '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选，来自 list_projects）。返回今日/指定范围的番茄数、专注分钟数。',
  parameters: Type.Object({
    date: Type.Optional(StringEnum(['today'], { description: '设为 "today" 时查询今日统计' })),
    startDate: Type.Optional(Type.String({ description: '起始日期，格式 YYYY-MM-DD' })),
    endDate: Type.Optional(Type.String({ description: '结束日期，格式 YYYY-MM-DD' })),
    projectId: Type.Optional(Type.String({ description: '项目 ID，来自 list_projects 返回的 id' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = executeGetPomodoroStats(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const getPomodoroRecordsTool: AgentTool = {
  name: 'get_pomodoro_records',
  label: '番茄钟记录',
  description: '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
  parameters: Type.Object({
    date: Type.Optional(StringEnum(['today'], { description: '设为 "today" 时查询今日记录' })),
    startDate: Type.Optional(Type.String({ description: '起始日期，格式 YYYY-MM-DD' })),
    endDate: Type.Optional(Type.String({ description: '结束日期，格式 YYYY-MM-DD' })),
    projectId: Type.Optional(Type.String({ description: '项目 ID，来自 list_projects 返回的 id' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = executeGetPomodoroRecords(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const skillTool: AgentTool = {
  name: 'skill',
  label: '使用技能',
  description: '根据技能名称获取并使用技能的完整指令。技能名称来自系统提示中的 <available_skills> 列表。当需要执行某个技能时调用此工具，返回的指令将指导你完成该技能的工作流程。',
  parameters: Type.Object({
    name: Type.String({ description: '技能名称，来自系统提示中 <available_skills> 列表的 <name>' }),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeSkill(args)
    return {
      content: [{
        type: 'text' as const,
        text: typeof result === 'string' ? result : JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const updateItemStatusTool: AgentTool = {
  name: 'update_item_status',
  label: '修改事项状态',
  description: '修改指定事项的状态。将事项标记为已完成、已放弃或恢复为待办。itemId 来自 filter_items 返回的 id。',
  parameters: Type.Object({
    itemId: Type.String({ description: '事项 ID，来自 filter_items 返回的 id' }),
    status: StringEnum(['completed', 'abandoned', 'pending'], { description: '目标状态：completed=已完成, abandoned=已放弃, pending=恢复待办' }),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeUpdateItemStatus(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const createItemTool: AgentTool = {
  name: 'create_item',
  label: '创建事项',
  description: '在指定项目下创建新事项。projectId 来自 list_projects 返回的 id；content 为事项内容；date 为日期（YYYY-MM-DD）；可选 startTime/endTime（HH:mm:ss）设置时间范围。',
  parameters: Type.Object({
    projectId: Type.String({ description: '项目 ID，来自 list_projects 返回的 id' }),
    content: Type.String({ description: '事项内容' }),
    date: Type.String({ description: '日期，格式 YYYY-MM-DD' }),
    startTime: Type.Optional(Type.String({ description: '开始时间，格式 HH:mm:ss（可选）' })),
    endTime: Type.Optional(Type.String({ description: '结束时间，格式 HH:mm:ss（可选）' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeCreateItem(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const updateItemTool: AgentTool = {
  name: 'update_item',
  label: '修改事项',
  description: '修改指定事项的日期、时间或内容。itemId 来自 filter_items 返回的 id。只传需要修改的字段，未传的字段保持不变。',
  parameters: Type.Object({
    itemId: Type.String({ description: '事项 ID，来自 filter_items 返回的 id' }),
    content: Type.Optional(Type.String({ description: '新的事项内容（可选，不传则不修改内容）' })),
    date: Type.Optional(Type.String({ description: '新日期，格式 YYYY-MM-DD（可选）' })),
    startTime: Type.Optional(Type.String({ description: '新的开始时间，格式 HH:mm:ss（可选，传空字符串清除时间）' })),
    endTime: Type.Optional(Type.String({ description: '新的结束时间，格式 HH:mm:ss（可选，传空字符串清除时间）' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeUpdateItem(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const deleteItemTool: AgentTool = {
  name: 'delete_item',
  label: '删除事项',
  description: '删除指定事项。itemId 来自 filter_items 返回的 id。此操作不可撤销，请谨慎使用。',
  parameters: Type.Object({
    itemId: Type.String({ description: '事项 ID，来自 filter_items 返回的 id' }),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeDeleteItem(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const createTaskTool: AgentTool = {
  name: 'create_task',
  label: '创建任务',
  description: '在指定项目下创建新任务。projectId 来自 list_projects 返回的 id；name 为任务名称；level 为任务层级（L1/L2/L3，默认 L1）。',
  parameters: Type.Object({
    projectId: Type.String({ description: '项目 ID，来自 list_projects 返回的 id' }),
    name: Type.String({ description: '任务名称' }),
    level: Type.Optional(StringEnum(['L1', 'L2', 'L3'], { description: '任务层级，默认 L1' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeCreateTask(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const createProjectTool: AgentTool = {
  name: 'create_project',
  label: '创建项目',
  description: '创建新项目（新建一个思源笔记文档）。name 为项目名称；description 为项目描述（可选）。如果用户配置了项目目录，需要传 directoryId（来自配置的目录列表）；如果未配置目录，directoryId 可不传，程序会自动选择笔记本。',
  parameters: Type.Object({
    directoryId: Type.Optional(Type.String({ description: '目录 ID（来自配置的目录列表，确定文档创建位置）。如果未配置项目目录则不需要传。' })),
    name: Type.String({ description: '项目名称' }),
    description: Type.Optional(Type.String({ description: '项目描述（可选）' })),
  }),
  execute: async (_toolCallId, args) => {
    const result = await executeCreateProject(args, currentContext)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result),
      }],
      details: result,
    }
  },
}

export const bulletJournalTools: AgentTool[] = [
  listGroupsTool,
  listProjectsTool,
  filterItemsTool,
  getPomodoroStatsTool,
  getPomodoroRecordsTool,
  skillTool,
]

const allTools: AgentTool[] = [
  listGroupsTool,
  listProjectsTool,
  filterItemsTool,
  getPomodoroStatsTool,
  getPomodoroRecordsTool,
  skillTool,
  updateItemStatusTool,
  createItemTool,
  updateItemTool,
  deleteItemTool,
  createTaskTool,
  createProjectTool,
]

export function agentToolToToolDefinition(tool: AgentTool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as ToolDefinition['function']['parameters'],
    },
  }
}

export const bulletJournalToolDefinitions: ToolDefinition[] = bulletJournalTools.map(agentToolToToolDefinition)

export const allToolDefinitions: ToolDefinition[] = allTools.map(agentToolToToolDefinition)

export type { ToolName }
