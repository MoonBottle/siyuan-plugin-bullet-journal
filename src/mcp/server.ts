#!/usr/bin/env node
/**
 * 任务助手 MCP 服务器
 * 提供 list_groups、list_projects、filter_items、get_pomodoro_stats、get_pomodoro_records 工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';
import { SiYuanClient } from './siyuan-client';
import { loadSettings } from './dataLoader';
import { executeListProjects } from './listProjects';
import { executeFilterItems } from './filterItems';
import { executeGetPomodoroStats, executeGetPomodoroRecords } from './pomodoro';

async function main() {
  const token = process.env.SIYUAN_TOKEN;
  if (!token) {
    console.error('[Task Assistant MCP] SIYUAN_TOKEN is required');
    process.exit(1);
  }

  const apiUrl = process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';
  const client = new SiYuanClient({ apiUrl, token });

  console.error('[Task Assistant MCP] 服务已就绪');

  const server = new McpServer({
    name: 'sy-task-assistant',
    version: '0.6.0'
  });

  server.registerTool(
    'list_groups',
    {
      description: '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
      inputSchema: z.object({})
    },
    async () => {
      const { groups } = await loadSettings(client);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(groups || [], null, 2) }]
      };
    }
  );

  server.registerTool(
    'list_projects',
    {
      description: '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
      inputSchema: z.object({
        groupId: z.string().optional().describe('分组 ID，来自 list_groups 返回的 id，不传则返回全部项目')
      })
    },
    async (args) => {
      const { directories } = await loadSettings(client);
      const result = await executeListProjects(client, directories || [], args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.registerTool(
    'filter_items',
    {
      description: '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
      inputSchema: z.object({
        projectId: z.string().optional().describe('项目文档 ID，来自 list_projects 返回的 id'),
        projectIds: z.array(z.string()).optional().describe('项目 ID 数组，多选时使用'),
        groupId: z.string().optional().describe('分组 ID，来自 list_groups 返回的 id'),
        startDate: z.string().optional().describe('起始日期，格式 YYYY-MM-DD'),
        endDate: z.string().optional().describe('结束日期，格式 YYYY-MM-DD'),
        status: z.enum(['pending', 'completed', 'abandoned']).optional()
          .describe('pending=待办, completed=已完成, abandoned=已放弃')
      })
    },
    async (args) => {
      const { directories } = await loadSettings(client);
      const result = await executeFilterItems(client, directories || [], args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.registerTool(
    'get_pomodoro_stats',
    {
      description: '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选）。返回今日/指定范围的番茄数、专注分钟数。',
      inputSchema: z.object({
        date: z.enum(['today']).optional().describe('设为 "today" 时查询今日统计'),
        startDate: z.string().optional().describe('起始日期，格式 YYYY-MM-DD'),
        endDate: z.string().optional().describe('结束日期，格式 YYYY-MM-DD'),
        projectId: z.string().optional().describe('项目 ID，来自 list_projects 返回的 id')
      })
    },
    async (args) => {
      const result = await executeGetPomodoroStats(client, args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.registerTool(
    'get_pomodoro_records',
    {
      description: '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
      inputSchema: z.object({
        date: z.enum(['today']).optional().describe('设为 "today" 时查询今日记录'),
        startDate: z.string().optional().describe('起始日期，格式 YYYY-MM-DD'),
        endDate: z.string().optional().describe('结束日期，格式 YYYY-MM-DD'),
        projectId: z.string().optional().describe('项目 ID，来自 list_projects 返回的 id')
      })
    },
    async (args) => {
      const result = await executeGetPomodoroRecords(client, args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[Task Assistant MCP] Fatal error:', err);
  process.exit(1);
});
