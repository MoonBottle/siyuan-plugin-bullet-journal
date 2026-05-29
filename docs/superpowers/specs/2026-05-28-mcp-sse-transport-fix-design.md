# 修复内核 MCP SSE 传输协议实现

## 问题

内核日志持续刷屏：`[mcp] SSE handler error: event.data is required`

根因：`src/kernel/mcp.ts` 的 SSE handler 存在两个致命问题：

1. **`port.onopen` 被调用而非被设置**（第 267-268 行）— 内核回调期望参数有 `data` 字段，`{ type: 'open' }` 没有，触发 `event.data is required`
2. **违反 MCP SSE 传输协议** — 把 SSE 当作一次性请求-响应通道（读 body → 处理 → 关闭），而非持久连接。客户端连接后立即被关闭，不断重试导致错误刷屏

## MCP SSE 传输协议（2024-11-05）要求

1. 客户端连接 SSE 端点
2. 服务端必须发送 `endpoint` 事件，包含客户端发送消息的 URI
3. 客户端通过 HTTP POST 向该 URI 发送 JSON-RPC 消息
4. 服务端通过 SSE `message` 事件推送 JSON-RPC 响应
5. SSE 连接保持打开直到客户端断开或服务端关闭

## SiYuan 内核 API 约束

- SSE handler 接收 `{ url, request, context, port }`
- `port.onopen` 是回调属性，**设置**后由内核在流式传输开始时触发
- `port.send(eventType, data)` 推送 SSE 事件（eventType → SSE `event:` 字段）
- `port.close()` 关闭连接
- `port.onclose` 回调在客户端断开时触发
- HTTP handler 接收 `HttpRequest`，返回 `HttpResponse`
- SSE 和 HTTP handler 运行在同一插件进程，可共享模块级状态

## 设计

### 架构

```
┌─────────────────────────────────────────────────┐
│  模块级状态                                       │
│  activePort: SsePort | null                      │
│  sessionId: string                               │
└──────────┬──────────────────┬────────────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────┐
    │ SSE Handler │    │ HTTP Handler │
    │             │    │              │
    │ 1. 设置     │    │ 1. 校验      │
    │    onopen   │    │    sessionId │
    │    onclose  │    │ 2. 解析      │
    │ 2. onopen   │    │    JSON-RPC  │
    │    触发时:  │    │ 3. 处理请求  │
    │    - 生成   │    │ 4. 通过      │
    │      session │    │    activePort│
    │    - 发送   │    │    .send()   │
    │      endpoint │    │    推送响应  │
    │      事件    │    │ 5. 返回     │
    │ 3. 保持连接 │    │    HTTP 202  │
    │    打开     │    │              │
    └─────────────┘    └──────────────┘
```

### SSE Handler

```typescript
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

关键改动：
- 设置 `port.onopen` 回调（而非调用它）
- 在 `onopen` 回调中发送 `endpoint` 事件
- 不读取 request body，不关闭连接
- `onclose` 清理状态

### HTTP Handler

```typescript
siyuan.server.private.http.handler = async function (req: HttpRequest) {
  const sid = req.url.query?.['sid']?.[0]
  if (!sid || sid !== sessionId) {
    return { statusCode: 403, body: { raw: { contentType: 'application/json', data: '{"error":"forbidden"}' } } }
  }

  const bodyData = req.request.body.data
  if (!bodyData) {
    return { statusCode: 400, body: { raw: { contentType: 'application/json', data: '{"error":"no body"}' } } }
  }

  let message: any
  try {
    message = await bodyData.json()
  } catch (e) {
    return { statusCode: 400, body: { raw: { contentType: 'application/json', data: '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}' } } }
  }

  const response = await handleJsonRpc(message)

  if (response !== undefined && activePort) {
    activePort.send('message', JSON.stringify(response))
  }

  return { statusCode: 202, headers: {} }
}
```

关键改动：
- 校验 `sid` 查询参数匹配当前会话
- 通过 `activePort.send('message', ...)` 推送响应（而非 HTTP 响应体）
- 返回 HTTP 202（MCP SSE 协议约定）

### 插件卸载清理

在 `index.ts` 的 `onunload` 中导出并调用 `closeMcpServer()`：

```typescript
export function closeMcpServer(): void {
  if (activePort) {
    try { activePort.close() } catch (_) {}
    activePort = null
    sessionId = ''
  }
}
```

### 边界情况

| 场景 | 处理方式 |
|------|---------|
| 多个 SSE 客户端连接 | 只保留最后一个活跃连接（覆盖 activePort），旧连接的 onclose 会清理 |
| SSE 未连接时收到 HTTP POST | 返回 403（sessionId 不匹配） |
| SSE 连接断开 | onclose 回调清理 activePort 和 sessionId |
| 插件卸载 | onunload 中关闭 activePort 并清空 handlers |

### 不改动的部分

- `handleJsonRpc`、`handleToolCall`、`TOOLS` 等业务逻辑 — 完全不变
- `src/mcp/` 目录（独立 MCP 服务器）— 不受影响
- `src/kernel/mcpTools.ts` — 不受影响

### 文件变更范围

| 文件 | 变更 |
|------|------|
| `src/kernel/mcp.ts` | 重写 SSE handler 和 HTTP handler；删除 `handleSseRequest`；添加模块级状态和 `closeMcpServer` |
| `src/kernel/index.ts` | `onunload` 中调用 `closeMcpServer()` |
