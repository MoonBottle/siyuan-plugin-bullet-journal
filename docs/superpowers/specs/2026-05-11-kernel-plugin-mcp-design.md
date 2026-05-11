# HTTP MCP 服务设计：基于内核插件的免 Node.js 方案

## 背景

当前 MCP 服务器（`src/mcp/server.ts`）以独立 Node.js 进程运行，通过 Stdio 传输与 AI 客户端通信。用户需要：
1. 安装 Node.js 运行环境
2. 手动获取并配置 `SIYUAN_TOKEN`
3. 在 AI 客户端中配置 `command: "node"` 启动方式

思源 v3.7.0 引入了**内核插件系统**（PR #17487），允许插件通过 `kernel.js` 在思源内核的 QuickJS 运行时中执行，并提供 HTTP/SSE 服务端能力。这使得我们可以提供一个纯 HTTP 形式的 MCP 服务，用户无需 Node.js、无需配置 Token（本机免认证）。

## 目标

- 提供一个 HTTP 形式的 MCP 服务，用户只需一行 URL 配置即可使用
- 保留现有 Node.js Stdio MCP 服务器不变（向后兼容）
- 在设置界面新增「HTTP MCP 配置」复制按钮，标记为实验性
- 利用前后端协作架构：前端解析数据 → 缓存到 storage → kernel.js 读取并提供 MCP 服务

## 架构

```
AI 客户端 (Trae/Cursor/Claude)
  │ HTTP POST (MCP Streamable HTTP / SSE)
  ▼
kernel.js (思源内核 QuickJS 运行时)
  │ siyuan.server.private.es.handler
  │ MCP JSON-RPC 2.0 协议层
  │ siyuan.storage.get("mcp-cache.json")
  ▼
petal storage (缓存文件)
  ▲ 写入
前端插件 (Vue + Pinia)
  │ projectStore.$subscribe → 数据变更
  │ writeMcpCache() → siyuan API 写入缓存
  ▼
projectStore (现有解析管线)
```

## 缓存数据格式

文件路径：`/data/storage/petal/siyuan-plugin-bullet-journal/mcp-cache.json`

```typescript
interface McpCache {
  version: 1
  updatedAt: string           // ISO 8601
  groups: Array<{
    id: string
    name: string
  }>
  projects: Array<{
    id: string                // 文档 ID
    name: string
    description?: string
    path: string
    groupId?: string
    taskCount: number
  }>
  items: Array<{
    id: string
    content: string
    date: string              // YYYY-MM-DD
    startDateTime?: string
    endDateTime?: string
    status: 'pending' | 'completed' | 'abandoned'
    projectName?: string
    taskName?: string
    projectId: string
    links?: Array<{ name: string; url: string }>
    pomodoros?: Array<{
      date: string
      duration: number
      startTime?: string
      endTime?: string
    }>
  }>
}
```

## 模块设计

### 1. 前端缓存写入器 — `src/mcp/mcpCacheWriter.ts`

**职责**：从 projectStore 和 settingsStore 提取数据，序列化为 McpCache 格式，写入思源 storage。

**导出函数**：

```typescript
export function writeMcpCache(): Promise<void>
```

**写入时机**（在 projectStore 中调用）：
- `loadProjects()` 完成后
- `refresh()` 完成后（增量或全量）
- 防抖 2 秒，避免频繁写入

**写入方式**：通过思源 API `POST /api/file/putFile` 写入 petal storage 路径。

**数据提取逻辑**：
- `groups`：来自 settingsStore.groups
- `projects`：遍历 projectStore.projects，映射为 `{ id, name, description, path, groupId, taskCount }`
- `items`：遍历 projectStore.items（已扁平化），映射为 McpCache.items 格式

### 2. kernel.js 源码 — `src/mcp/kernel.ts`

**职责**：在思源内核 QuickJS 运行时中提供 MCP HTTP 服务。

**编译目标**：纯 ES5+ JavaScript（无 npm 依赖），输出为 `kernel.js`。

**核心模块**：

#### 2.1 MCP 协议层

实现 MCP Streamable HTTP 传输：
- 接收 `POST /plugin/private/siyuan-plugin-bullet-journal/mcp` 请求
- 解析 JSON-RPC 2.0 消息
- 路由到对应 handler（`initialize`, `tools/list`, `tools/call`, `ping`）
- 返回 SSE 响应流

#### 2.2 缓存读取

通过 `siyuan.storage.get("mcp-cache.json")` 读取前端写入的缓存数据。如果缓存不存在或为空，返回错误提示"请先打开思源笔记并加载任务助手插件"。

#### 2.3 工具实现

与现有 MCP 服务器相同的 5 个工具，但从缓存读取数据而非实时查询：

| 工具 | 实现 |
|------|------|
| `list_groups` | 直接返回 cache.groups |
| `list_projects` | 按 groupId 过滤 cache.projects |
| `filter_items` | 多维度过滤 cache.items（projectId/projectIds/groupId/startDate/endDate/status） |
| `get_pomodoro_stats` | 聚合 cache.items 中的 pomodoros |
| `get_pomodoro_records` | 提取 cache.items 中的 pomodoros 列表 |

#### 2.4 生命周期

```javascript
siyuan.plugin.lifecycle.onrunning = async function() {
  // 注册 SSE handler
  siyuan.server.private.es.handler = async function(request) {
    // MCP Streamable HTTP 处理
  };
};
```

### 3. 设置界面更新 — `McpConfigSection.vue`

**变更**：在现有「复制 MCP 配置」按钮下方，新增一个「复制 HTTP MCP 配置」按钮。

**UI 设计**：
```
MCP 配置
将任务数据暴露给 Cursor、Claude 等 AI 助手...

[复制 MCP 配置]              ← 现有按钮，保留不变

[🧪 复制 HTTP MCP 配置]     ← 新按钮，实验性标记
  hover 提示：思源版本 3.7.0 以上可用
```

**HTTP MCP 配置内容**：
```json
{
  "mcpServers": {
    "sy-task-assistant": {
      "url": "http://127.0.0.1:6806/plugin/private/siyuan-plugin-bullet-journal/mcp"
    }
  }
}
```

### 4. i18n 更新

`zh_CN.json` 新增：
```json
"mcp": {
  "title": "MCP 配置",
  "description": "将任务数据暴露给 Cursor、Claude 等 AI 助手...",
  "copyButton": "复制 MCP 配置",
  "httpCopyButton": "复制 HTTP MCP 配置（实验性）",
  "httpTooltip": "思源版本 3.7.0 以上可用，无需 Node.js 和 Token 配置",
  "httpCopySuccess": "HTTP MCP 配置已复制到剪贴板",
  ...
}
```

`en_US.json` 新增：
```json
"mcp": {
  "httpCopyButton": "Copy HTTP MCP Config (Experimental)",
  "httpTooltip": "Requires SiYuan v3.7.0+, no Node.js or Token needed",
  "httpCopySuccess": "HTTP MCP config copied to clipboard",
  ...
}
```

### 5. 构建变更

#### plugin.json

添加 `"kernels": ["all"]` 字段。

#### vite.config.ts

新增一个构建入口将 `src/mcp/kernel.ts` 编译为 `kernel.js`：
- 输出格式：IIFE（立即执行函数）
- Target：ES2018（goja 支持的 ES 子集）
- 不打包任何 npm 依赖（dayjs 等）
- 输出到插件目录根目录

#### 构建脚本

在 `build` 脚本中增加一步：先编译 kernel.ts → kernel.js，再执行原有构建流程。kernel.js 作为静态文件 copy 到插件包中。

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/mcp/kernel.ts` | kernel.js 源码（MCP 协议层 + 缓存读取 + 过滤逻辑） |
| `src/mcp/mcpCacheWriter.ts` | 前端缓存写入器 |
| `vite.kernel.config.ts` | kernel.js 构建配置 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `plugin.json` | 添加 `"kernels": ["all"]` |
| `src/components/settings/McpConfigSection.vue` | 新增 HTTP MCP 复制按钮（实验性标记 + hover 提示） |
| `src/mobile/drawers/settings/MobileMcpConfig.vue` | 移动端同步新增 HTTP MCP 复制按钮 |
| `src/stores/projectStore.ts` | 数据加载/刷新完成后调用 `writeMcpCache()` |
| `src/i18n/zh_CN.json` | 新增 HTTP MCP 相关 i18n 文本 |
| `src/i18n/en_US.json` | 新增 HTTP MCP 相关 i18n 文本 |
| `package.json` | 新增 kernel 构建脚本 |
| `vite.config.ts` | 添加 kernel.js 静态文件 copy |

## 约束与风险

1. **goja 运行时限制**：不支持 ES2020+ 的可选链 `?.`、空值合并 `??` 等。kernel.ts 编译时需降级到 ES2018。
2. **数据延迟**：kernel.js 读取的是缓存，可能有最多 2 秒延迟。对 AI 查询场景完全可接受。
3. **前端未加载**：如果用户没有打开思源前端（纯 headless 模式），缓存不存在，MCP 工具返回错误提示。
4. **向后兼容**：现有 Node.js MCP 服务器完全保留，两套方案并存。
5. **实验性标记**：HTTP MCP 功能标记为实验性，未来思源内核 API 可能变化。
