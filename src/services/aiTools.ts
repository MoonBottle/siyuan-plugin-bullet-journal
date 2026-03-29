/**
 * AI 工具定义
 * 为 AI 提供查询任务数据的能力
 */
import type { ToolDefinition } from '@/types/ai';

/**
 * 查询分组列表工具
 */
export const listGroupsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_groups',
    description: '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

/**
 * 查询项目列表工具
 */
export const listProjectsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_projects',
    description: '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
    parameters: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目'
        }
      },
      required: []
    }
  }
};

/**
 * 筛选事项工具
 */
export const filterItemsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'filter_items',
    description: '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目文档 ID，来自 list_projects 返回的 id'
        },
        projectIds: {
          type: 'array',
          items: { type: 'string' },
          description: '项目 ID 数组，多选时使用'
        },
        groupId: {
          type: 'string',
          description: '分组 ID，来自 list_groups 返回的 id'
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD'
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD'
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'abandoned'],
          description: 'pending=待办, completed=已完成, abandoned=已放弃'
        }
      },
      required: []
    }
  }
};

/**
 * 获取番茄钟统计工具
 */
export const getPomodoroStatsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_pomodoro_stats',
    description: '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选，来自 list_projects）。返回今日/指定范围的番茄数、专注分钟数。',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          enum: ['today'],
          description: '设为 "today" 时查询今日统计'
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD'
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD'
        },
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id'
        }
      },
      required: []
    }
  }
};

/**
 * 获取番茄钟记录列表工具
 */
export const getPomodoroRecordsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_pomodoro_records',
    description: '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          enum: ['today'],
          description: '设为 "today" 时查询今日记录'
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD'
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD'
        },
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id'
        }
      },
      required: []
    }
  }
};

/**
 * 查询技能列表工具
 */
export const listSkillsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_skills',
    description: '查询所有可用的 AI 技能清单。返回技能名称和描述列表。当用户需要执行特定任务（如生成日报、会议纪要等）时，先调用此工具查看有哪些技能可用。无参数。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

/**
 * 获取技能详情工具
 */
export const getSkillDetailTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_skill_detail',
    description: '获取指定技能的详细内容。当确定要使用某个技能时，调用此工具获取技能的完整工作流程、格式要求等详细说明。参数 skillName 为技能名称，来自 list_skills 返回的 name。',
    parameters: {
      type: 'object',
      properties: {
        skillName: {
          type: 'string',
          description: '技能名称，来自 list_skills 返回的 name'
        }
      },
      required: ['skillName']
    }
  }
};

/**
 * 所有可用的工具列表
 */
export const bulletJournalTools: ToolDefinition[] = [
  listGroupsTool,
  listProjectsTool,
  filterItemsTool,
  getPomodoroStatsTool,
  getPomodoroRecordsTool,
  listSkillsTool,
  getSkillDetailTool
];

/**
 * 工具名称类型
 */
export type ToolName =
  | 'list_groups'
  | 'list_projects'
  | 'filter_items'
  | 'get_pomodoro_stats'
  | 'get_pomodoro_records'
  | 'list_skills'
  | 'get_skill_detail';
