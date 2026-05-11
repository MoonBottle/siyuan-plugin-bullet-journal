# HTTP MCP 服务实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 基于思源内核插件系统，为任务助手提供免 Node.js、免 Token 的 HTTP MCP 服务，同时保留现有 Stdio MCP 不变。

**架构：** 前端 projectStore 数据变更时写入缓存文件到 petal storage；kernel.js 在思源内核 QuickJS 运行时中提供 SSE 端点，读取缓存并实现 MCP 协议的 5 个工具。设置界面新增 HTTP MCP 复制按钮（实验性）。

**技术栈：** 思源内核插件 API（siyuan.storage / siyuan.server.private.es）、MCP Streamable HTTP（SSE）、TypeScript → kernel.js 编译

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/mcp/mcpCacheWriter.ts` | 从 projectStore 提取数据，序列化为 McpCache 格式，通过思源 API 写入 petal storage |
| `src/mcp/kernel.ts` | kernel.js 源码：MCP JSON-RPC 协议层 + SSE handler + 缓存读取 + 5 个工具的过滤逻辑 |
| `vite.kernel.config.ts` | kernel.js 构建配置：IIFE 输出、ES2018 target、零 npm 依赖 |
| `test/mcp/kernel.test.ts` | kernel.ts 中纯函数逻辑的单元测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `plugin.json` | 添加 `"kernels": ["all"]` |
| `src/stores/projectStore.ts` | loadProjects/refresh 完成后调用 writeMcpCache（防抖） |
| `src/components/settings/McpConfigSection.vue` | 新增 HTTP MCP 复制按钮（实验性 + hover 提示） |
| `src/mobile/drawers/settings/MobileMcpConfig.vue` | 移动端同步新增 HTTP MCP 复制按钮 |
| `src/i18n/zh_CN.json` | 新增 HTTP MCP 相关 i18n 文本 |
| `src/i18n/en_US.json` | 新增 HTTP MCP 相关 i18n 文本 |
| `package.json` | 新增 kernel 构建脚本 |
| `vite.config.ts` | viteStaticCopy 添加 kernel.js copy |

---

## 任务 1：更新 plugin.json 和 package.json

**文件：**
- 修改：`plugin.json:1-28`
- 修改：`package.json:10-18`

- [ ] **步骤 1：修改 plugin.json，添加 kernels 字段**

在 `plugin.json` 的 `"frontends": ["all"]` 之后添加：

```json
"kernels": ["all"],
```

- [ ] **步骤 2：修改 package.json，添加 kernel 构建脚本**

在 `package.json` 的 `scripts` 中，在 `"mcp": "node dist/mcp-server.js"` 之后添加：

```json
"build:kernel": "vite build --config vite.kernel.config.ts",
```

修改现有的 `"build"` 脚本，在 mcp 构建之后、插件构建之前插入 kernel 构建：

```
"build": "vite build --config vite.mcp.config.ts && vite build --config vite.kernel.config.ts && cross-env EMPTY_OUT_DIR=false vite build",
```

- [ ] **步骤 3：Commit**

```bash
git add plugin.json package.json
git commit -m "feat(mcp): add kernel plugin build infrastructure"
```

---

## 任务 2：创建前端缓存写入器

**文件：**
- 创建：`src/mcp/mcpCacheWriter.ts`

- [ ] **步骤 1：创建 mcpCacheWriter.ts**

创建 `src/mcp/mcpCacheWriter.ts`，导出 `writeMcpCache` 函数和 `McpCache` 类型：

```typescript
import { putFile } from '@/api';
import type { Project, Item } from '@/types/models';
import type { ProjectGroup } from '@/settings/types';

export interface McpCache {
  version: 1;
  updatedAt: string;
  groups: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | undefined;
    path: string;
    groupId: string | undefined;
    taskCount: number;
  }>;
  items: Array<{
    id: string;
    content: string;
    date: string;
    startDateTime: string | undefined;
    endDateTime: string | undefined;
    status: string;
    projectName: string | undefined;
    taskName: string | undefined;
    projectId: string;
    links: Array<{ name: string; url: string }> | undefined;
    pomodoros: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string | undefined;
      durationMinutes: number;
      actualDurationMinutes: number | undefined;
      description: string | undefined;
    }>;
  }>;
}

const CACHE_PATH = '/data/storage/petal/siyuan-plugin-bullet-journal/mcp-cache.json';

export async function writeMcpCache(
  projects: Project[],
  items: Item[],
  groups: ProjectGroup[]
): Promise<void> {
  const cache: McpCache = {
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: groups.map(g => ({ id: g.id, name: g.name })),
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      path: p.path,
      groupId: p.groupId,
      taskCount: p.tasks.length,
    })),
    items: items.map(i => ({
      id: i.id,
      content: i.content,
      date: i.date,
      startDateTime: i.startDateTime,
      endDateTime: i.endDateTime,
      status: i.status,
      projectName: i.project?.name,
      taskName: i.task?.name,
      projectId: i.project?.id ?? i.docId,
      links: i.links,
      pomodoros: (i.pomodoros ?? []).map(p => ({
        id: p.id,
        date: p.date,
        startTime: p.startTime,
        endTime: p.endTime,
        durationMinutes: p.durationMinutes,
        actualDurationMinutes: p.actualDurationMinutes,
        description: p.description,
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(cache)], { type: 'application/json' });
  await putFile(CACHE_PATH, false, blob);
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/mcp/mcpCacheWriter.ts
git commit -m "feat(mcp): add MCP cache writer for kernel plugin"
```

---

## 任务 3：在 projectStore 中集成缓存写入

**文件：**
- 修改：`src/stores/projectStore.ts:771-873`

- [ ] **步骤 1：在 projectStore.ts 顶部添加导入**

在现有的 import 区域（约 L248 附近，`import { useSettingsStore }` 之后）添加：

```typescript
import { writeMcpCache } from '@/mcp/mcpCacheWriter';
```

- [ ] **步骤 2：添加防抖写入辅助函数**

在 `useProjectStore` 定义之前（`export const useProjectStore` 之前），添加防抖工具：

```typescript
let mcpCacheTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedWriteMcpCache(
  projects: Project[],
  items: Item[],
  groups: Array<{ id: string; name: string }>
) {
  if (mcpCacheTimer) clearTimeout(mcpCacheTimer);
  mcpCacheTimer = setTimeout(() => {
    writeMcpCache(projects, items, groups).catch((err) => {
      console.error('[Task Assistant] Failed to write MCP cache:', err);
    });
  }, 2000);
}
```

注意：`groups` 参数类型使用简单的 `{ id: string; name: string }` 以避免循环导入，因为 `ProjectGroup` 在 settingsStore 中。`writeMcpCache` 函数签名已接受 `ProjectGroup[]`，而 `ProjectGroup` 的结构就是 `{ id: string; name: string }`，所以兼容。

- [ ] **步骤 3：在 loadProjects 方法中插入缓存写入**

在 `loadProjects` 方法的 `eventBus.emit(Events.DATA_REFRESHED, ...)` 之后（约 L794）添加：

```typescript
    const settingsStore = useSettingsStore();
    debouncedWriteMcpCache(this.projects, this.items, settingsStore.groups);
```

- [ ] **步骤 4：在 refresh 方法中插入缓存写入**

在 `refresh` 方法的 `eventBus.emit(Events.DATA_REFRESHED, ...)` 之后（约 L856）添加同样的代码：

```typescript
    const settingsStore = useSettingsStore();
    debouncedWriteMcpCache(this.projects, this.items, settingsStore.groups);
```

- [ ] **步骤 5：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 6：Commit**

```bash
git add src/stores/projectStore.ts
git commit -m "feat(mcp): integrate cache writing into projectStore lifecycle"
```

---

## 任务 4：创建 kernel.js 构建配置

**文件：**
- 创建：`vite.kernel.config.ts`

- [ ] **步骤 1：创建 vite.kernel.config.ts**

```typescript
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/mcp/kernel.ts'),
      fileName: () => 'kernel.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'kernel.js',
      },
    },
    target: 'es2018',
    minify: false,
  },
});
```

关键设计决策：
- `formats: ['iife']` — kernel.js 作为立即执行函数，不使用 import/export
- `target: 'es2018'` — goja 运行时支持的 ES 子集
- `emptyOutDir: false` — 不清空 dist（与插件、MCP 服务器共享）
- `minify: false` — 保持可读性，便于调试

- [ ] **步骤 2：修改 vite.config.ts，添加 kernel.js 静态文件 copy**

在 `vite.config.ts` 的 `viteStaticCopy` targets 数组中，在现有的 MCP 服务器 copy 之后添加：

```typescript
{ src: "./dist/kernel.js", dest: "./" },
```

- [ ] **步骤 3：运行构建验证 kernel.js 产物**

运行：`npx vite build --config vite.kernel.config.ts`
预期：生成 `dist/kernel.js`，无编译错误

- [ ] **步骤 4：Commit**

```bash
git add vite.kernel.config.ts vite.config.ts
git commit -m "feat(mcp): add kernel.js build configuration"
```

---

## 任务 5：创建 kernel.ts — MCP 协议层和工具实现

**文件：**
- 创建：`src/mcp/kernel.ts`

这是最核心的任务。kernel.ts 将编译为 kernel.js，在思源内核的 QuickJS 运行时中执行。

**关键约束**：
- 不能使用任何 npm 依赖（无 dayjs、无 MCP SDK）
- 使用 `globalThis.siyuan.*` API（由内核注入）
- goja 支持 ES2018（Promise、async/await、解构、模板字符串），不支持可选链 `?.` 和空值合并 `??`
- 通过 `declare` 声明 siyuan 全局类型以获得 IDE 支持

- [ ] **步骤 1：创建 siyuan 内核插件类型声明**

在 `src/mcp/kernel.ts` 文件顶部，首先声明 siyuan 全局 API 类型：

```typescript
declare const siyuan: {
  plugin: {
    name: string;
    version: string;
    displayName: string;
    platform: string;
    lifecycle: {
      onload: (() => Promise<void>) | null;
      onloaded: (() => Promise<void>) | null;
      onrunning: (() => Promise<void>) | null;
      onunload: (() => Promise<void>) | null;
    };
  };
  logger: {
    info: (...args: any[]) => Promise<void>;
    error: (...args: any[]) => Promise<void>;
  };
  storage: {
    get: (path: string) => Promise<{
      text: () => Promise<string>;
      json: () => Promise<any>;
    }>;
    put: (path: string, content: string) => Promise<void>;
  };
  server: {
    private: {
      es: {
        handler: ((req: SseRequest) => Promise<void>) | null;
      };
      http: {
        handler: ((req: HttpRequest) => Promise<HttpResponse>) | null;
      };
    };
  };
};

interface SseRequest {
  url: {
    host: string;
    pathname: string;
    query: Record<string, string[]>;
  };
  request: {
    method: string;
    headers: Record<string, string[]>;
    body: {
      data: { text: () => Promise<string>; json: () => Promise<any> } | undefined;
    };
  };
  port: {
    onopen: ((e: { type: string }) => void) | null;
    onclose: ((e: { type: string }) => void) | null;
    send: (name: string, message: any) => void;
    close: () => void;
  };
}

interface HttpRequest {
  url: {
    host: string;
    pathname: string;
    query: Record<string, string[]>;
  };
  request: {
    method: string;
    headers: Record<string, string[]>;
    body: {
      data: { text: () => Promise<string>; json: () => Promise<any> } | undefined;
    };
  };
}

interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string[]>;
  body?: {
    raw?: { contentType: string; data: string };
  };
}
```

- [ ] **步骤 2：实现 MCP 协议层和工具逻辑**

继续在同一个文件中添加核心逻辑。由于 kernel.ts 不使用 import/export（IIFE 模式），所有代码都在文件作用域内：

```typescript
const MCP_CACHE_PATH = 'mcp-cache.json';
const SERVER_NAME = 'sy-task-assistant';
const SERVER_VERSION = '1.0.0';

interface McpCache {
  version: number;
  updatedAt: string;
  groups: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | undefined;
    path: string;
    groupId: string | undefined;
    taskCount: number;
  }>;
  items: Array<{
    id: string;
    content: string;
    date: string;
    startDateTime: string | undefined;
    endDateTime: string | undefined;
    status: string;
    projectName: string | undefined;
    taskName: string | undefined;
    projectId: string;
    links: Array<{ name: string; url: string }> | undefined;
    pomodoros: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string | undefined;
      durationMinutes: number;
      actualDurationMinutes: number | undefined;
      description: string | undefined;
    }>;
  }>;
}

let cachedData: McpCache | null = null;

async function loadCache(): Promise<McpCache> {
  try {
    const file = await siyuan.storage.get(MCP_CACHE_PATH);
    const text = await file.text();
    const data = JSON.parse(text) as McpCache;
    cachedData = data;
    return data;
  } catch (e) {
    throw new Error(
      'MCP 缓存不可用。请先打开思源笔记并确保任务助手插件已加载。'
    );
  }
}

function makeJsonRpcResult(id: any, result: any) {
  return { jsonrpc: '2.0', id: id, result: result };
}

function makeJsonRpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id: id, error: { code: code, message: message } };
}

const TOOLS = [
  {
    name: 'list_groups',
    description:
      '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_projects',
    description:
      '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目',
        },
      },
      required: [],
    },
  },
  {
    name: 'filter_items',
    description:
      '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目文档 ID，来自 list_projects 返回的 id' },
        projectIds: { type: 'array', items: { type: 'string' }, description: '项目 ID 数组，多选时使用' },
        groupId: { type: 'string', description: '分组 ID，来自 list_groups 返回的 id' },
        startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
        endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
        status: { type: 'string', enum: ['pending', 'completed', 'abandoned'], description: 'pending=待办, completed=已完成, abandoned=已放弃' },
      },
      required: [],
    },
  },
  {
    name: 'get_pomodoro_stats',
    description:
      '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选）。返回今日/指定范围的番茄数、专注分钟数。',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', enum: ['today'], description: '设为 "today" 时查询今日统计' },
        startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
        endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
        projectId: { type: 'string', description: '项目 ID，来自 list_projects 返回的 id' },
      },
      required: [],
    },
  },
  {
    name: 'get_pomodoro_records',
    description:
      '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', enum: ['today'], description: '设为 "today" 时查询今日记录' },
        startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
        endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
        projectId: { type: 'string', description: '项目 ID，来自 list_projects 返回的 id' },
      },
      required: [],
    },
  },
];

function toolListGroups(_args: any, cache: McpCache) {
  return { groups: cache.groups || [] };
}

function toolListProjects(args: any, cache: McpCache) {
  const filtered = args.groupId
    ? cache.projects.filter(function(p) { return p.groupId === args.groupId; })
    : cache.projects;
  return { projects: filtered };
}

function toolFilterItems(args: any, cache: McpCache) {
  let items = cache.items || [];

  if (args.projectId) {
    items = items.filter(function(i) { return i.projectId === args.projectId; });
  } else if (args.projectIds && args.projectIds.length > 0) {
    const set = new Set(args.projectIds);
    items = items.filter(function(i) { return set.has(i.projectId); });
  } else if (args.groupId) {
    const projectIds = new Set(
      cache.projects
        .filter(function(p) { return p.groupId === args.groupId; })
        .map(function(p) { return p.id; })
    );
    items = items.filter(function(i) { return projectIds.has(i.projectId); });
  }

  if (args.startDate) {
    items = items.filter(function(i) { return i.date >= args.startDate; });
  }
  if (args.endDate) {
    items = items.filter(function(i) { return i.date <= args.endDate; });
  }
  if (args.status) {
    items = items.filter(function(i) { return i.status === args.status; });
  }

  return { items: items };
}

function collectPomodoros(cache: McpCache) {
  const pomodoros: Array<any> = [];
  const seen = new Set<string>();
  for (const item of cache.items) {
    if (item.pomodoros) {
      for (const p of item.pomodoros) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          pomodoros.push({
            id: p.id,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            durationMinutes: p.durationMinutes,
            actualDurationMinutes: p.actualDurationMinutes,
            description: p.description,
            itemContent: item.content,
            projectName: item.projectName,
          });
        }
      }
    }
  }
  return pomodoros;
}

function filterPomodoros(pomodoros: any[], args: any) {
  let filtered = pomodoros;
  const todayDate = new Date().toISOString().slice(0, 10);
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }
  if (startDate) {
    filtered = filtered.filter(function(p) { return p.date >= startDate; });
  }
  if (endDate) {
    filtered = filtered.filter(function(p) { return p.date <= endDate; });
  }
  if (args.projectId) {
    filtered = filtered.filter(function(p) { return p.projectId === args.projectId; });
  }
  return filtered;
}

function toolGetPomodoroStats(args: any, cache: McpCache) {
  const pomodoros = filterPomodoros(collectPomodoros(cache), args);
  const todayDate = new Date().toISOString().slice(0, 10);

  let todayCount = 0;
  let todayMinutes = 0;
  for (const p of pomodoros) {
    if (p.date === todayDate) {
      todayCount++;
      todayMinutes += p.actualDurationMinutes || p.durationMinutes;
    }
  }

  let totalMinutes = 0;
  for (const p of pomodoros) {
    totalMinutes += p.actualDurationMinutes || p.durationMinutes;
  }

  const result: any = {
    todayCount: todayCount,
    todayMinutes: todayMinutes,
    totalCount: pomodoros.length,
    totalMinutes: totalMinutes,
  };

  const today = new Date().toISOString().slice(0, 10);
  let startDate = args.startDate;
  let endDate = args.endDate;
  if (args.date === 'today') {
    startDate = today;
    endDate = today;
  }
  if (startDate && endDate) {
    result.dateRange = { startDate: startDate, endDate: endDate };
  }
  if (args.projectId) {
    result.projectId = args.projectId;
  }

  return result;
}

function toolGetPomodoroRecords(args: any, cache: McpCache) {
  const pomodoros = filterPomodoros(collectPomodoros(cache), args);

  const records = pomodoros.map(function(p) {
    return {
      id: p.id,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      durationMinutes: p.durationMinutes,
      actualDurationMinutes: p.actualDurationMinutes,
      itemContent: p.itemContent,
      projectName: p.projectName,
      description: p.description,
    };
  });

  records.sort(function(a, b) {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
  });

  return { records: records };
}

async function handleToolCall(name: string, args: any, id: any) {
  let cache: McpCache;
  try {
    cache = await loadCache();
  } catch (e: any) {
    return makeJsonRpcError(id, -32000, e.message || String(e));
  }

  let result: any;
  switch (name) {
    case 'list_groups':
      result = toolListGroups(args, cache);
      break;
    case 'list_projects':
      result = toolListProjects(args, cache);
      break;
    case 'filter_items':
      result = toolFilterItems(args, cache);
      break;
    case 'get_pomodoro_stats':
      result = toolGetPomodoroStats(args, cache);
      break;
    case 'get_pomodoro_records':
      result = toolGetPomodoroRecords(args, cache);
      break;
    default:
      return makeJsonRpcError(id, -32601, 'Method not found: ' + name);
  }

  return makeJsonRpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  });
}

async function handleJsonRpc(message: any): Promise<any> {
  if (!message || message.jsonrpc !== '2.0') {
    return makeJsonRpcError(null, -32600, 'Invalid Request');
  }

  const id = message.id;
  const method = message.method;
  const params = message.params || {};

  switch (method) {
    case 'initialize':
      return makeJsonRpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case 'notifications/initialized':
      return undefined;

    case 'ping':
      return makeJsonRpcResult(id, {});

    case 'tools/list':
      return makeJsonRpcResult(id, { tools: TOOLS });

    case 'tools/call':
      return handleToolCall(params.name, params.arguments || {}, id);

    default:
      return makeJsonRpcError(id, -32601, 'Method not found: ' + method);
  }
}

async function handleSseRequest(req: SseRequest) {
  const bodyData = req.request.body.data;
  if (!bodyData) {
    req.port.close();
    return;
  }

  let message: any;
  try {
    message = await bodyData.json();
  } catch (e) {
    req.port.send('error', JSON.stringify(makeJsonRpcError(null, -32700, 'Parse error')));
    req.port.close();
    return;
  }

  const response = await handleJsonRpc(message);

  if (response !== undefined) {
    req.port.send('message', JSON.stringify(response));
  }

  req.port.close();
}

siyuan.plugin.lifecycle.onrunning = async function () {
  await siyuan.logger.info('[MCP Kernel Plugin] Registering SSE handler');

  siyuan.server.private.es.handler = async function (req: SseRequest) {
    try {
      if (req.port.onopen) {
        req.port.onopen({ type: 'open' });
      }
      await handleSseRequest(req);
    } catch (e: any) {
      await siyuan.logger.error('[MCP Kernel Plugin] SSE handler error:', e.message || String(e));
      try {
        req.port.close();
      } catch (_) {}
    }
  };

  siyuan.server.private.http.handler = async function (req: HttpRequest) {
    const bodyData = req.request.body.data;
    if (!bodyData) {
      return {
        statusCode: 400,
        body: { raw: { contentType: 'application/json', data: '{"error":"no body"}' } },
      };
    }

    let message: any;
    try {
      message = await bodyData.json();
    } catch (e) {
      return {
        statusCode: 400,
        body: { raw: { contentType: 'application/json', data: '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}' } },
      };
    }

    const response = await handleJsonRpc(message);

    if (response === undefined) {
      return { statusCode: 202, headers: {} };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': ['application/json'] },
      body: { raw: { contentType: 'application/json', data: JSON.stringify(response) } },
    };
  };

  await siyuan.logger.info('[MCP Kernel Plugin] SSE and HTTP handlers registered');
};

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[MCP Kernel Plugin] Unloading');
};
```

- [ ] **步骤 3：运行构建验证**

运行：`npx vite build --config vite.kernel.config.ts`
预期：生成 `dist/kernel.js`，无编译错误

- [ ] **步骤 4：检查产物内容**

运行：`head -20 dist/kernel.js`
预期：IIFE 包裹的 JS 代码，不含 import/export 语句

- [ ] **步骤 5：Commit**

```bash
git add src/mcp/kernel.ts
git commit -m "feat(mcp): add kernel.js MCP server implementation"
```

---

## 任务 6：创建 kernel.ts 单元测试

**文件：**
- 创建：`test/mcp/kernel.test.ts`

- [ ] **步骤 1：编写 kernel 工具函数的单元测试**

由于 kernel.ts 中的纯函数逻辑（toolListGroups、toolFilterItems 等）在 IIFE 内部不可直接导入，测试策略为：从 kernel.ts 中提取核心过滤逻辑到 `src/mcp/kernelTools.ts`（纯函数模块），然后 kernel.ts 导入使用，测试只测 kernelTools.ts。

**步骤 1a：提取 `src/mcp/kernelTools.ts`**

```typescript
export interface McpCacheGroup {
  id: string;
  name: string;
}

export interface McpCacheProject {
  id: string;
  name: string;
  description: string | undefined;
  path: string;
  groupId: string | undefined;
  taskCount: number;
}

export interface McpCacheItem {
  id: string;
  content: string;
  date: string;
  startDateTime: string | undefined;
  endDateTime: string | undefined;
  status: string;
  projectName: string | undefined;
  taskName: string | undefined;
  projectId: string;
  links: Array<{ name: string; url: string }> | undefined;
  pomodoros: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string | undefined;
    durationMinutes: number;
    actualDurationMinutes: number | undefined;
    description: string | undefined;
  }>;
}

export interface McpCache {
  version: number;
  updatedAt: string;
  groups: McpCacheGroup[];
  projects: McpCacheProject[];
  items: McpCacheItem[];
}

export function toolListGroups(_args: any, cache: McpCache) {
  return { groups: cache.groups || [] };
}

export function toolListProjects(args: any, cache: McpCache) {
  const filtered = args.groupId
    ? cache.projects.filter(function(p) { return p.groupId === args.groupId; })
    : cache.projects;
  return { projects: filtered };
}

export function toolFilterItems(args: any, cache: McpCache) {
  let items = cache.items || [];

  if (args.projectId) {
    items = items.filter(function(i) { return i.projectId === args.projectId; });
  } else if (args.projectIds && args.projectIds.length > 0) {
    const set = new Set(args.projectIds);
    items = items.filter(function(i) { return set.has(i.projectId); });
  } else if (args.groupId) {
    const projectIds = new Set(
      cache.projects
        .filter(function(p) { return p.groupId === args.groupId; })
        .map(function(p) { return p.id; })
    );
    items = items.filter(function(i) { return projectIds.has(i.projectId); });
  }

  if (args.startDate) {
    items = items.filter(function(i) { return i.date >= args.startDate; });
  }
  if (args.endDate) {
    items = items.filter(function(i) { return i.date <= args.endDate; });
  }
  if (args.status) {
    items = items.filter(function(i) { return i.status === args.status; });
  }

  return { items: items };
}

export function collectPomodoros(cache: McpCache) {
  const pomodoros: Array<any> = [];
  const seen = new Set<string>();
  for (const item of cache.items) {
    if (item.pomodoros) {
      for (const p of item.pomodoros) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          pomodoros.push({
            id: p.id,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            durationMinutes: p.durationMinutes,
            actualDurationMinutes: p.actualDurationMinutes,
            description: p.description,
            itemContent: item.content,
            projectName: item.projectName,
            projectId: item.projectId,
          });
        }
      }
    }
  }
  return pomodoros;
}

export function filterPomodoros(pomodoros: any[], args: any) {
  let filtered = pomodoros;
  const todayDate = new Date().toISOString().slice(0, 10);
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }
  if (startDate) {
    filtered = filtered.filter(function(p) { return p.date >= startDate; });
  }
  if (endDate) {
    filtered = filtered.filter(function(p) { return p.date <= endDate; });
  }
  if (args.projectId) {
    filtered = filtered.filter(function(p) { return p.projectId === args.projectId; });
  }
  return filtered;
}
```

- [ ] **步骤 2：编写测试文件 `test/mcp/kernelTools.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  toolListGroups,
  toolListProjects,
  toolFilterItems,
  collectPomodoros,
  filterPomodoros,
  type McpCache,
} from '@/mcp/kernelTools';

function makeCache(overrides?: Partial<McpCache>): McpCache {
  return {
    version: 1,
    updatedAt: '2026-05-11T00:00:00.000Z',
    groups: [
      { id: 'g1', name: '工作' },
      { id: 'g2', name: '个人' },
    ],
    projects: [
      { id: 'p1', name: '项目A', description: undefined, path: '/a', groupId: 'g1', taskCount: 2 },
      { id: 'p2', name: '项目B', description: undefined, path: '/b', groupId: 'g2', taskCount: 1 },
    ],
    items: [
      {
        id: 'i1', content: '任务1', date: '2026-05-11', startDateTime: undefined,
        endDateTime: undefined, status: 'pending', projectName: '项目A',
        taskName: undefined, projectId: 'p1', links: undefined,
        pomodoros: [
          { id: 'pom1', date: '2026-05-11', startTime: '09:00:00', endTime: '09:25:00',
            durationMinutes: 25, actualDurationMinutes: undefined, description: undefined },
        ],
      },
      {
        id: 'i2', content: '任务2', date: '2026-05-10', startDateTime: undefined,
        endDateTime: undefined, status: 'completed', projectName: '项目A',
        taskName: undefined, projectId: 'p1', links: undefined, pomodoros: [],
      },
      {
        id: 'i3', content: '任务3', date: '2026-05-11', startDateTime: undefined,
        endDateTime: undefined, status: 'pending', projectName: '项目B',
        taskName: undefined, projectId: 'p2', links: undefined,
        pomodoros: [
          { id: 'pom2', date: '2026-05-11', startTime: '14:00:00', endTime: '14:25:00',
            durationMinutes: 25, actualDurationMinutes: 20, description: undefined },
        ],
      },
    ],
    ...overrides,
  };
}

describe('kernelTools', () => {
  describe('toolListGroups', () => {
    it('returns all groups', () => {
      const cache = makeCache();
      const result = toolListGroups({}, cache);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].name).toBe('工作');
    });
  });

  describe('toolListProjects', () => {
    it('returns all projects without filter', () => {
      const cache = makeCache();
      const result = toolListProjects({}, cache);
      expect(result.projects).toHaveLength(2);
    });

    it('filters by groupId', () => {
      const cache = makeCache();
      const result = toolListProjects({ groupId: 'g1' }, cache);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('项目A');
    });
  });

  describe('toolFilterItems', () => {
    it('returns all items without filter', () => {
      const cache = makeCache();
      const result = toolFilterItems({}, cache);
      expect(result.items).toHaveLength(3);
    });

    it('filters by projectId', () => {
      const cache = makeCache();
      const result = toolFilterItems({ projectId: 'p1' }, cache);
      expect(result.items).toHaveLength(2);
    });

    it('filters by projectIds array', () => {
      const cache = makeCache();
      const result = toolFilterItems({ projectIds: ['p1', 'p2'] }, cache);
      expect(result.items).toHaveLength(3);
    });

    it('filters by groupId', () => {
      const cache = makeCache();
      const result = toolFilterItems({ groupId: 'g1' }, cache);
      expect(result.items).toHaveLength(2);
      expect(result.items.every(function(i) { return i.projectId === 'p1'; })).toBe(true);
    });

    it('filters by date range', () => {
      const cache = makeCache();
      const result = toolFilterItems({ startDate: '2026-05-11', endDate: '2026-05-11' }, cache);
      expect(result.items).toHaveLength(2);
    });

    it('filters by status', () => {
      const cache = makeCache();
      const result = toolFilterItems({ status: 'completed' }, cache);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('i2');
    });

    it('combines multiple filters', () => {
      const cache = makeCache();
      const result = toolFilterItems({ projectId: 'p1', status: 'pending' }, cache);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('i1');
    });
  });

  describe('collectPomodoros', () => {
    it('collects pomodoros from all items with dedup', () => {
      const cache = makeCache();
      const result = collectPomodoros(cache);
      expect(result).toHaveLength(2);
    });
  });

  describe('filterPomodoros', () => {
    it('filters by date range', () => {
      const pomodoros = [
        { id: '1', date: '2026-05-10', startTime: '09:00:00', projectId: 'p1' },
        { id: '2', date: '2026-05-11', startTime: '10:00:00', projectId: 'p1' },
      ];
      const result = filterPomodoros(pomodoros, { startDate: '2026-05-11', endDate: '2026-05-11' });
      expect(result).toHaveLength(1);
    });

    it('filters by today', () => {
      const today = new Date().toISOString().slice(0, 10);
      const pomodoros = [
        { id: '1', date: today, startTime: '09:00:00', projectId: 'p1' },
        { id: '2', date: '2020-01-01', startTime: '10:00:00', projectId: 'p1' },
      ];
      const result = filterPomodoros(pomodoros, { date: 'today' });
      expect(result).toHaveLength(1);
    });
  });
});
```

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run test/mcp/kernelTools.test.ts`
预期：所有测试 PASS

- [ ] **步骤 4：修改 kernel.ts，从 kernelTools.ts 导入**

修改 `src/mcp/kernel.ts`，将内联的工具函数替换为从 `kernelTools.ts` 导入：

在文件顶部添加：
```typescript
import {
  toolListGroups, toolListProjects, toolFilterItems,
  collectPomodoros, filterPomodoros,
  type McpCache,
} from './kernelTools';
```

删除 kernel.ts 中重复定义的 `McpCache` 接口、`toolListGroups`、`toolListProjects`、`toolFilterItems`、`collectPomodoros`、`filterPomodoros` 函数。

- [ ] **步骤 5：重新构建验证**

运行：`npx vite build --config vite.kernel.config.ts`
预期：构建成功

- [ ] **步骤 6：运行全量测试**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 7：Commit**

```bash
git add src/mcp/kernelTools.ts src/mcp/kernel.ts test/mcp/kernelTools.test.ts
git commit -m "feat(mcp): extract kernel tool logic with tests"
```

---

## 任务 7：更新 i18n 文本

**文件：**
- 修改：`src/i18n/zh_CN.json:303-310`
- 修改：`src/i18n/en_US.json:303-310`

- [ ] **步骤 1：更新 zh_CN.json 的 mcp 部分**

替换 `src/i18n/zh_CN.json` 中 `"mcp": { ... }` 块为：

```json
"mcp": {
  "title": "MCP 配置",
  "description": "将任务数据暴露给 Cursor、Claude 等 AI 助手。在 Cursor 设置 → MCP 中添加以下配置，并将 SIYUAN_TOKEN 替换为思源 设置→关于 中的 API Token。",
  "copyButton": "复制 MCP 配置",
  "copySuccess": "MCP 配置已复制到剪贴板",
  "copyFailed": "复制失败，请手动复制",
  "workspaceUnavailable": "无法获取工作空间路径，请使用思源桌面版",
  "httpCopyButton": "复制 HTTP MCP 配置（实验性）",
  "httpTooltip": "思源版本 3.7.0 以上可用，无需 Node.js 和 Token 配置",
  "httpDescription": "基于思源内核插件的 HTTP MCP 服务，无需安装 Node.js，无需配置 Token。在 AI 客户端的 MCP 配置中粘贴即可使用。",
  "httpCopySuccess": "HTTP MCP 配置已复制到剪贴板",
  "httpCopyFailed": "复制失败，请手动复制",
  "mobileHint": "MCP 配置需要在桌面端复制后使用"
}
```

- [ ] **步骤 2：更新 en_US.json 的 mcp 部分**

替换 `src/i18n/en_US.json` 中 `"mcp": { ... }` 块为：

```json
"mcp": {
  "title": "MCP Config",
  "description": "Expose task data to AI assistants like Cursor and Claude. Add the config below to Cursor Settings → MCP, and replace SIYUAN_TOKEN with the API Token from SiYuan Settings → About.",
  "copyButton": "Copy MCP Config",
  "copySuccess": "MCP config copied to clipboard",
  "copyFailed": "Copy failed, please copy manually",
  "workspaceUnavailable": "Cannot get workspace path, please use SiYuan desktop",
  "httpCopyButton": "Copy HTTP MCP Config (Experimental)",
  "httpTooltip": "Requires SiYuan v3.7.0+, no Node.js or Token needed",
  "httpDescription": "HTTP MCP service based on SiYuan kernel plugin. No Node.js installation or Token configuration required. Just paste into your AI client's MCP config.",
  "httpCopySuccess": "HTTP MCP config copied to clipboard",
  "httpCopyFailed": "Copy failed, please copy manually",
  "mobileHint": "MCP config must be copied on desktop"
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(mcp): add HTTP MCP i18n texts"
```

---

## 任务 8：更新设置界面 — 桌面端和移动端

**文件：**
- 修改：`src/components/settings/McpConfigSection.vue`
- 修改：`src/mobile/drawers/settings/MobileMcpConfig.vue`

- [ ] **步骤 1：更新 McpConfigSection.vue**

在桌面端的 `SySettingsActionButton` 之后（`@click="copyMcpConfig"` 的按钮之后），添加 HTTP MCP 按钮：

```vue
<SySettingsActionButton
  icon="iconCopy"
  :text="(t('settings') as any).mcp?.httpCopyButton ?? '复制 HTTP MCP 配置（实验性）'"
  :title="(t('settings') as any).mcp?.httpTooltip ?? '思源版本 3.7.0 以上可用'"
  @click="copyHttpMcpConfig"
/>
```

在移动端的 `ios-action-btn` 之后，添加：

```vue
<button class="ios-action-btn ios-action-btn--experimental" :title="(t('settings') as any).mcp?.httpTooltip ?? '思源版本 3.7.0 以上可用'" @click="copyHttpMcpConfig">
  🧪 {{ (t('settings') as any).mcp?.httpCopyButton ?? '复制 HTTP MCP 配置（实验性）' }}
</button>
```

在 `<script setup>` 中添加 `copyHttpMcpConfig` 函数：

```typescript
async function copyHttpMcpConfig() {
  const mcpConfig = {
    mcpServers: {
      'sy-task-assistant': {
        url: 'http://127.0.0.1:6806/plugin/private/siyuan-plugin-bullet-journal/mcp',
      },
    },
  };

  const configStr = JSON.stringify(mcpConfig, null, 2);
  try {
    await navigator.clipboard.writeText(configStr);
    showMessage((t('settings') as any).mcp?.httpCopySuccess ?? 'HTTP MCP 配置已复制到剪贴板', 3000, 'info');
  } catch (err) {
    showMessage((t('settings') as any).mcp?.httpCopyFailed ?? '复制失败，请手动复制', 3000, 'error');
  }
}
```

添加实验性按钮样式（在 `<style scoped>` 中）：

```css
.ios-action-btn--experimental {
  background: #5856d6;
  margin-top: 12px;
}
```

- [ ] **步骤 2：更新 MobileMcpConfig.vue**

同样的 `copyHttpMcpConfig` 函数和按钮，参考步骤 1 中的移动端代码。

- [ ] **步骤 3：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 4：Commit**

```bash
git add src/components/settings/McpConfigSection.vue src/mobile/drawers/settings/MobileMcpConfig.vue
git commit -m "feat(mcp): add HTTP MCP config copy button in settings UI"
```

---

## 任务 9：全量构建验证和最终提交

**文件：**
- 无新增修改

- [ ] **步骤 1：运行全量构建**

运行：`npm run build`
预期：构建成功，产物包含 `dist/kernel.js`、`dist/mcp-server.js`、`dist/index.js`

- [ ] **步骤 2：运行全量测试**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 3：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 4：验证 kernel.js 产物**

运行：`head -5 dist/kernel.js`
预期：IIFE 包裹的 JS 代码

- [ ] **步骤 5：最终 commit（如有未提交的变更）**

```bash
git add -A
git commit -m "feat(mcp): complete HTTP MCP kernel plugin implementation"
```
