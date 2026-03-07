/**
 * AI 工具定义
 * 为 AI 提供查询子弹笔记数据的能力
 */
import type { ToolDefinition } from '@/types/ai';

/**
 * 查询分组列表工具
 */
export const listGroupsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_groups',
    description: '查询子弹笔记中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
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
    description: '查询子弹笔记中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
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
    description: '按项目、时间范围、分组、状态筛选子弹笔记事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。',
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
 * 所有可用的工具列表
 */
export const bulletJournalTools: ToolDefinition[] = [
  listGroupsTool,
  listProjectsTool,
  filterItemsTool
];

/**
 * 工具名称类型
 */
export type ToolName = 'list_groups' | 'list_projects' | 'filter_items';
