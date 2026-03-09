# MCP 服务器功能

## 一、功能概述

MCP（Model Context Protocol）服务器允许外部 AI 助手（如 Cursor、Claude）直接访问任务助手的任务数据，实现智能问答、周报分析、工作规划等功能。

## 二、需求规格

### 2.1 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| MCP 服务器 | 内置 MCP 服务 | ✅ |
| 分组查询 | 查询所有项目分组 | ✅ |
| 项目查询 | 查询所有项目 | ✅ |
| 事项筛选 | 按条件筛选事项 | ✅ |
| 时间查询 | 获取用户当前时间 | ✅ |

### 2.2 工具列表

| 工具 | 描述 | 参数 |
|------|------|------|
| `list_groups` | 查询所有分组 | 无 |
| `list_projects` | 查询所有项目 | `groupId?` |
| `filter_items` | 筛选事项 | `projectId?, projectIds?, groupId?, startDate?, endDate?, status?` |
| `get_user_time` | 获取当前时间 | 无 |

### 2.3 验收标准

- [x] MCP 服务器正常启动
- [x] 支持 stdio 传输
- [x] 工具正确注册
- [x] 工具参数正确验证
- [x] 返回格式符合 MCP 规范
- [x] 支持环境变量配置
- [x] 配置生成正确

## 三、技术实现

### 3.1 架构设计

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Cursor/    │◄────►│  MCP 服务   │◄────►│  思源笔记   │
│  Claude 等  │      │  (stdio)    │      │  API        │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  任务数据    │
                     │  解析器      │
                     └─────────────┘
```

### 3.2 服务器实现

```typescript
// MCP 服务器入口
// src/mcp/server.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new McpServer({
  name: 'sy-task-assistant',
  version: '0.6.0'
});

// 注册工具
server.registerTool('list_groups', ...);
server.registerTool('list_projects', ...);
server.registerTool('filter_items', ...);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3.3 工具实现

#### list_groups

```typescript
server.registerTool(
  'list_groups',
  {
    description: '查询任务助手中配置的所有分组',
    inputSchema: z.object({})
  },
  async () => {
    const { groups } = await loadSettings(client);
    return {
      content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }]
    };
  }
);
```

#### list_projects

```typescript
server.registerTool(
  'list_projects',
  {
    description: '查询任务助手中的所有项目',
    inputSchema: z.object({
      groupId: z.string().optional()
    })
  },
  async (args) => {
    const { directories } = await loadSettings(client);
    const result = await executeListProjects(client, directories, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);
```

#### filter_items

```typescript
server.registerTool(
  'filter_items',
  {
    description: '按项目、时间范围、分组、状态筛选任务事项',
    inputSchema: z.object({
      projectId: z.string().optional(),
      projectIds: z.array(z.string()).optional(),
      groupId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(['pending', 'completed', 'abandoned']).optional()
    })
  },
  async (args) => {
    const { directories } = await loadSettings(client);
    const result = await executeFilterItems(client, directories, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);
```

### 3.4 文件结构

```
src/
├── mcp/
│   ├── server.ts           # MCP 服务器入口
│   ├── siyuan-client.ts    # 思源 API 客户端
│   ├── dataLoader.ts       # 数据加载
│   ├── listProjects.ts     # list_projects 实现
│   ├── filterItems.ts      # filter_items 实现
│   └── config.ts           # 配置管理
```

## 四、配置使用

### 4.1 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `SIYUAN_TOKEN` | 是 | 思源 API Token |
| `SIYUAN_API_URL` | 否 | 思源 API 地址，默认 `http://127.0.0.1:6806` |

### 4.2 MCP 配置示例

```json
{
  "mcpServers": {
    "sy-task-assistant": {
      "command": "node",
      "args": [
        "/path/to/siyuan-plugin-bullet-journal/dist/mcp-server.js"
      ],
      "env": {
        "SIYUAN_TOKEN": "your-token-here",
        "SIYUAN_API_URL": "http://127.0.0.1:6806"
      }
    }
  }
}
```

### 4.3 配置生成

插件设置中提供「复制 MCP 配置」按钮，自动生成完整配置：

```typescript
function generateMCPConfig(plugin: Plugin) {
  return {
    mcpServers: {
      'sy-task-assistant': {
        command: 'node',
        args: [`${plugin.path}/dist/mcp-server.js`],
        env: {
          SIYUAN_TOKEN: 'YOUR_TOKEN_HERE',
          SIYUAN_API_URL: 'http://127.0.0.1:6806'
        }
      }
    }
  };
}
```

## 五、使用场景

### 5.1 在 Cursor 中使用

1. 打开 Cursor 设置 → MCP
2. 粘贴 MCP 配置
3. 替换 `SIYUAN_TOKEN` 为你的 Token
4. 开始使用

### 5.2 AI 提示词

```
你可以访问一个任务助手 MCP 服务器，该服务器提供以下工具：

1. **list_groups**：列出所有项目分组
2. **list_projects**：列出所有项目，支持 groupId 过滤
3. **filter_items**：筛选任务事项，支持多种条件
4. **get_user_time**：获取用户当前时间

**何时使用这些工具：**
- 用户询问任务、项目或日程安排时
- 用户想要追踪进度或回顾已完成的工作时
- 用户需要规划或组织工作时
- 用户要求汇总或报告任务数据时

**最佳实践：**
1. 始终先调用 list_groups 了解项目结构
2. 使用 list_projects 获取所有项目的概览
3. 使用 filter_items 配合适当的筛选条件获取具体任务事项
4. 组合使用筛选条件进行精确查询
```

### 5.3 示例对话

```
用户: 我这周有哪些待办任务？

AI: [调用 get_user_time]
    [调用 filter_items with startDate, endDate, status='pending']
    
    您本周（3月4日-3月10日）有 5 个待办事项：
    - 周一：需求评审会议
    - 周三：代码审查
    - 周五：项目汇报
    ...
```

## 六、数据安全

### 6.1 Token 安全

- Token 存储在 MCP 配置中
- 不随插件代码分发
- 用户需手动配置

### 6.2 数据访问范围

- MCP 仅读取任务数据
- 不修改任何笔记内容
- 不访问非任务相关文档

## 七、故障排查

### 7.1 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| MCP 无法连接 | Token 错误 | 检查 SIYUAN_TOKEN |
| 无数据返回 | 目录未配置 | 在插件设置中配置目录 |
| 工具调用失败 | API 地址错误 | 检查 SIYUAN_API_URL |

### 7.2 调试方法

```bash
# 手动运行 MCP 服务器测试
SIYUAN_TOKEN=xxx node dist/mcp-server.js
```
