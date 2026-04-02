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
    description: '查询所有可用的 AI 技能清单。返回技能名称和描述列表，用于了解有哪些技能可用。获取完整技能内容请使用 get_skill_detail。无参数。',
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
    description: '根据技能名称获取技能的完整内容，包括工作流程、格式要求等详细说明。',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '技能名称，来自 list_skills 返回的 name'
        }
      },
      required: ['name']
    }
  }
};

/**
 * 修改事项状态工具
 */
export const updateItemStatusTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_item_status',
    description: '修改指定事项的状态。将事项标记为已完成、已放弃或恢复为待办。itemId 来自 filter_items 返回的 id。',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: '事项 ID，来自 filter_items 返回的 id'
        },
        status: {
          type: 'string',
          enum: ['completed', 'abandoned', 'pending'],
          description: '目标状态：completed=已完成, abandoned=已放弃, pending=恢复待办'
        }
      },
      required: ['itemId', 'status']
    }
  }
};

/**
 * 创建事项工具
 */
export const createItemTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_item',
    description: '在指定项目下创建新事项。projectId 来自 list_projects 返回的 id；content 为事项内容；date 为日期（YYYY-MM-DD）；可选 startTime/endTime（HH:mm:ss）设置时间范围。',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id'
        },
        content: {
          type: 'string',
          description: '事项内容'
        },
        date: {
          type: 'string',
          description: '日期，格式 YYYY-MM-DD'
        },
        startTime: {
          type: 'string',
          description: '开始时间，格式 HH:mm:ss（可选）'
        },
        endTime: {
          type: 'string',
          description: '结束时间，格式 HH:mm:ss（可选）'
        }
      },
      required: ['projectId', 'content', 'date']
    }
  }
};

/**
 * 修改事项工具
 */
export const updateItemTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_item',
    description: '修改指定事项的日期、时间或内容。itemId 来自 filter_items 返回的 id。只传需要修改的字段，未传的字段保持不变。',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: '事项 ID，来自 filter_items 返回的 id'
        },
        content: {
          type: 'string',
          description: '新的事项内容（可选，不传则不修改内容）'
        },
        date: {
          type: 'string',
          description: '新日期，格式 YYYY-MM-DD（可选）'
        },
        startTime: {
          type: 'string',
          description: '新的开始时间，格式 HH:mm:ss（可选，传空字符串清除时间）'
        },
        endTime: {
          type: 'string',
          description: '新的结束时间，格式 HH:mm:ss（可选，传空字符串清除时间）'
        }
      },
      required: ['itemId']
    }
  }
};

/**
 * 删除事项工具
 */
export const deleteItemTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_item',
    description: '删除指定事项。itemId 来自 filter_items 返回的 id。此操作不可撤销，请谨慎使用。',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: '事项 ID，来自 filter_items 返回的 id'
        }
      },
      required: ['itemId']
    }
  }
};

/**
 * 创建任务工具
 */
export const createTaskTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_task',
    description: '在指定项目下创建新任务。projectId 来自 list_projects 返回的 id；name 为任务名称；level 为任务层级（L1/L2/L3，默认 L1）。',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id'
        },
        name: {
          type: 'string',
          description: '任务名称'
        },
        level: {
          type: 'string',
          enum: ['L1', 'L2', 'L3'],
          description: '任务层级，默认 L1'
        }
      },
      required: ['projectId', 'name']
    }
  }
};

/**
 * 创建项目工具
 */
export const createProjectTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_project',
    description: '创建新项目（新建一个思源笔记文档）。name 为项目名称；description 为项目描述（可选）。如果用户配置了项目目录，需要传 directoryId（来自配置的目录列表）；如果未配置目录，directoryId 可不传，程序会自动选择笔记本。',
    parameters: {
      type: 'object',
      properties: {
        directoryId: {
          type: 'string',
          description: '目录 ID（来自配置的目录列表，确定文档创建位置）。如果未配置项目目录则不需要传。'
        },
        name: {
          type: 'string',
          description: '项目名称'
        },
        description: {
          type: 'string',
          description: '项目描述（可选）'
        }
      },
      required: ['name']
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
  getSkillDetailTool,
  updateItemStatusTool,
  createItemTool,
  updateItemTool,
  deleteItemTool,
  createTaskTool,
  createProjectTool
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
  | 'get_skill_detail'
  | 'update_item_status'
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'create_task'
  | 'create_project';
