# 修复内核 MCP SSE 传输协议实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `src/kernel/mcp.ts` 中违反 MCP SSE 传输协议的实现，使 Trae 等 MCP 客户端能正常连接。

**架构：** SSE handler 设置 `port.onopen` 回调（而非调用），在回调中发送 `endpoint` 事件并保持连接打开。HTTP handler 校验 sessionId 后处理 JSON-RPC 请求，通过 `activePort.send('message', ...)` 推送响应，返回 HTTP 202。模块级 `activePort` 和 `sessionId` 连接两个 handler。

**技术栈：** TypeScript, SiYuan 内核插件 API, MCP SSE 传输协议（2024-11-05）

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/kernel/mcp.ts` | MCP SSE/HTTP handler 注册、JSON-RPC 处理 | 修改 |
| `src/kernel/index.ts` | 内核插件生命周期，调用 initMcpServer | 修改 |

---

### 任务 1：重写 SSE handler 和 HTTP handler，删除 handleSseRequest

**文件：**
- 修改：`src/kernel/mcp.ts:1-310`

- [ ] **步骤 1：添加模块级状态变量**

在 `src/kernel/mcp.ts` 文件顶部的常量定义之后（第 12 行 `const SERVER_VERSION = '1.0.0'` 之后），添加：

```typescript
let activePort: SseRequest['port'] | null = null
let sessionId = ''
```

- [ ] **步骤 2：删除 handleSseRequest 函数**

删除 `src/kernel/mcp.ts` 第 239-262 行的整个 `handleSseRequest` 函数。

- [ ] **步骤 3：重写 initMcpServer 中的 SSE handler**

将 `initMcpServer` 函数中的 SSE handler（第 265-277 行）替换为：

```typescript
export function initMcpServer(): void {
  siyuan.server.private.es.handler = async function (req: SseRequest) {
    req.port.onopen = async function (_event) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2)
      activePort = req.port
      req.port.send('endpoint', '/api/plugin/private/siyuan-plugin-bullet-journal/mcp?sid=' + sessionId)
    }

    req.port.onclose = async function (_event) {
      if (activePort === req.port) {
        activePort = null
        sessionId = ''
      }
    }
  }
```

- [ ] **步骤 4：重写 initMcpServer 中的 HTTP handler**

将 `initMcpServer` 函数中的 HTTP handler（第 279-309 行）替换为：

```typescript
  siyuan.server.private.http.handler = async function (req: HttpRequest) {
    const sid = req.url.query?.['sid']?.[0]
    if (!sid || sid !== sessionId) {
      return {
        statusCode: 403,
        body: { raw: { contentType: 'application/json', data: '{"error":"forbidden"}' } },
      }
    }

    const bodyData = req.request.body.data
    if (!bodyData) {
      return {
        statusCode: 400,
        body: { raw: { contentType: 'application/json', data: '{"error":"no body"}' } },
      }
    }

    let message: any
    try {
      message = await bodyData.json()
    } catch (e) {
      return {
        statusCode: 400,
        body: { raw: { contentType: 'application/json', data: '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}' } },
      }
    }

    const response = await handleJsonRpc(message)

    if (response !== undefined && activePort) {
      activePort.send('message', JSON.stringify(response))
    }

    return { statusCode: 202, headers: {} }
  }
}
```

- [ ] **步骤 5：添加 closeMcpServer 导出函数**

在 `initMcpServer` 函数之后添加：

```typescript
export function closeMcpServer(): void {
  if (activePort) {
    try {
      activePort.close()
    } catch (_) {}
    activePort = null
    sessionId = ''
  }
}
```

- [ ] **步骤 6：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 7：Commit**

```bash
git add src/kernel/mcp.ts
git commit -m "fix(kernel): 重写 MCP SSE 传输协议实现

- 修复 port.onopen 被调用而非被设置的错误
- SSE handler 设置 onopen 回调，发送 endpoint 事件，保持连接打开
- HTTP handler 校验 sessionId，通过 activePort 推送响应
- 删除 handleSseRequest 函数
- 添加 closeMcpServer 导出函数"
```

---

### 任务 2：在 index.ts 的 onunload 中调用 closeMcpServer

**文件：**
- 修改：`src/kernel/index.ts:1-82`

- [ ] **步骤 1：添加 closeMcpServer 导入**

将 `src/kernel/index.ts` 第 4 行：

```typescript
import { initMcpServer } from './mcp'
```

改为：

```typescript
import { initMcpServer, closeMcpServer } from './mcp'
```

- [ ] **步骤 2：在 onunload 中调用 closeMcpServer**

在 `src/kernel/index.ts` 的 `onunload` 函数中，在 `stopScheduler()` 之前添加 `closeMcpServer()` 调用：

将第 71-82 行：

```typescript
siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')
  
  stopScheduler()
  await persistTimerRegistry()
  
  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.logger.info('[kernel] unloaded')
}
```

改为：

```typescript
siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')

  closeMcpServer()
  stopScheduler()
  await persistTimerRegistry()

  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.logger.info('[kernel] unloaded')
}
```

- [ ] **步骤 3：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 4：运行构建验证**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add src/kernel/index.ts
git commit -m "fix(kernel): onunload 中关闭 MCP SSE 连接"
```
