# 升级内核插件代码以使用 siyuan 1.2.2-alpha.0 官方 kernel 类型

## 背景

`siyuan` 1.2.2-alpha.0 已内置 `kernel.d.ts`，提供了完整的内核插件 API 类型定义。当前项目有两套自定义类型与官方类型冲突/重复：

1. **`src/types/siyuanKernel.d.ts`** — 自定义 `Plugin.kernel` 增强（旧版客户端→内核 RPC 通道）
2. **`src/kernel/types.ts`** — 手写的 `siyuan` 全局对象声明（与官方 `kernel.d.ts` 重复且不一致）

用户要求：参考 `C:\dev\projects\open-source\plugin-sample\src\kernel.ts` 官方示例写法，去掉自定义类型增强。

## 关键发现

- `kernel.d.ts` 声明了 `declare global { const siyuan: ISiyuan }`，内核侧代码中的 `siyuan.xxx` 调用会自动获得类型提示
- `plugin-sample` 使用 `kernel.IServerWebSocketRequest` 和 `kernel.IServerEventSourceRequest`，但这些类型在当前 `siyuan@1.2.2-alpha.0` 的 `kernel.d.ts` 中**尚未导出**（属于 `petal/kernel.d.ts` 计划添加的类型）
- 当前项目的 SSE handler 使用了 `port` 属性（`IServerEventSourceRequest` 特有），HTTP handler 使用了 `IServerRequest` + `IHttpResponse`
- 客户端侧 `plugin.kernel` 是旧版 API，新版不再需要

## 实施步骤

### 步骤 1：更新 `src/kernel/types.ts` — 使用官方 `siyuan/kernel` 类型

**改动**：
- 在文件顶部添加 `/// <reference types="siyuan/kernel" />`
- 删除 `export declare const siyuan: {...}` 整个声明（官方 `kernel.d.ts` 已通过 `declare global` 提供）
- 删除 `SseRequest`、`HttpRequest`、`HttpResponse` 接口（官方已有 `IServerRequest`、`IHttpResponse`）
- 保留项目特有的业务类型：`TimerEntry`、`WebhookConfig`、`WebhookChannel`、`ReminderConfig`、`KernelData*` 等

对于 SSE handler 中使用的 `port` 属性，由于官方 `kernel.d.ts` 暂未导出 `IServerEventSourceRequest`，需要在 `types.ts` 中定义一个本地扩展接口：
```ts
interface IServerEventSourceRequest extends kernel.IServerRequest {
  port: IEsServerPort
}
interface IEsServerPort {
  onopen: ((e: { type: string }) => void | Promise<void>) | null
  onclose: ((e: { type: string }) => void | Promise<void>) | null
  send: (event: { event?: string, data: string, id?: string, retry?: number }) => void
  close: () => void
}
```

### 步骤 2：更新 `src/kernel/index.ts` — 使用官方类型

**改动**：
- 添加 `/// <reference types="siyuan/kernel" />`
- 添加 `import type * as kernel from 'siyuan/kernel'`
- 将 `siyuan.event.handler` 的参数类型从 `{ type: string, detail: any }` 改为 `kernel.IEventMessage`
- `siyuan.server.private.es.handler` 的参数类型改为本地 `IServerEventSourceRequest`
- `siyuan.server.private.http.handler` 的参数类型改为 `kernel.IServerRequest`，返回值改为 `kernel.IHttpResponse`
- `siyuan.logger.info` 返回 `Promise<void>`，当前代码用 `void` 丢弃返回值，这是可以的
- `siyuan.rpc.bind` 返回 `Promise<void>`，当前代码未 await，需要加 `await` 或 `void`

### 步骤 3：更新 `src/kernel/mcp.ts` — 使用官方类型

**改动**：
- 删除对 `SseRequest`、`HttpRequest`、`HttpResponse` 的引用
- `siyuan.server.private.es.handler` 参数改为 `IServerEventSourceRequest`（从 `./types` 导入）
- `siyuan.server.private.http.handler` 参数改为 `kernel.IServerRequest`，返回值改为 `kernel.IHttpResponse`
- 更新 handler 内部属性访问以匹配官方接口：
  - HTTP handler: `req.request.body.data` → `req.request.body.data`（结构相同）
  - SSE handler: `req.port.send(...)` 保持不变
  - HTTP response: 使用 `kernel.IResponseBody` 的 `raw` 字段

### 步骤 4：更新 `src/kernel/webhook.ts` — 使用官方类型

**改动**：
- `siyuan.client.fetch()` 返回 `Promise<IFetchResponse>`，已有 `text()`, `json()`, `ok`, `status`
- `siyuan.rpc.broadcast()` 返回 `Promise<void>`，当前代码未 await，需要加 `void` 前缀
- `siyuan.storage.get()` 返回 `Promise<IDataObject>`，`IDataObject` 包含 `text()`, `json()`, `buffer()`, `arrayBuffer()`

### 步骤 5：更新 `src/kernel/scheduler.ts` — 使用官方类型

**改动**：
- `siyuan.logger.warn()` 返回 `Promise<void>`
- `siyuan.storage.get/put()` 签名与官方一致
- `siyuan.rpc.broadcast()` 返回 `Promise<void>`

### 步骤 6：更新 `src/kernel/reminder.ts` — 使用官方类型

**改动**：
- `siyuan.storage.watcher.add()` 返回 `Promise<void>`
- `siyuan.storage.get()` 返回 `Promise<IDataObject>`

### 步骤 7：更新 `src/kernel/rpc.ts` — 使用官方类型

**改动**：
- `siyuan.rpc.bind()` 返回 `Promise<void>` 而非 `void`，当前代码已在循环中用 `await`

### 步骤 8：删除 `src/types/siyuanKernel.d.ts`

**改动**：删除整个文件。`Plugin.kernel` 是旧版 API，新版 siyuan 不再需要。

### 步骤 9：更新客户端侧代码 — 移除 `plugin.kernel` 依赖

**影响文件**：
- `src/composables/useKernelTimer.ts` — 使用 `plugin.kernel!.rpc.bind/unbind` 和 `plugin.kernel!.state.code`
- `src/stores/pomodoroStore.ts` — 使用 `usePlugin()!.kernel!.rpc.call.registerTimer/cancelTimer`

**改动**：客户端侧改用 `siyuan.client.fetch()` 调用内核 RPC（通过 HTTP JSON-RPC），或通过 `siyuan.client.event()` 建立 SSE 连接接收内核广播。

**具体方案**：

#### 9a. `useKernelTimer.ts` 重写

- 删除 `plugin.kernel` 相关代码
- 使用 `siyuan.client.event('/es/broadcast/subscribe')` 建立 SSE 连接接收内核广播事件（`timer-expired`、`date-changed`）
- 内核可用性检测：尝试建立 SSE 连接，成功则 `kernelAvailable = true`
- 监听 `kernel-plugin-state-change` 事件总线保持不变（这是前端插件的事件总线，与内核无关）

#### 9b. `pomodoroStore.ts` 更新

- 将 `usePlugin()!.kernel!.rpc.call.registerTimer(...)` 改为通过 `siyuan.client.fetch()` 发送 JSON-RPC 请求
- 封装一个 `kernelRpcCall(method, params)` 辅助函数：
  ```ts
  async function kernelRpcCall(method: string, params: any): Promise<any> {
    const resp = await fetch('/api/plugin/rpc/siyuan-plugin-bullet-journal', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method, params: [params], id: Date.now() })
    })
    const data = await resp.json()
    if (data.error) throw new Error(data.error.message)
    return data.result
  }
  ```
- 替换所有 `kernel!.rpc.call.xxx(...)` 调用

### 步骤 10：验证

- `npm run build` 确认构建成功
- `npm run lint` 确认无 lint 问题
- `npm run test` 确认测试通过

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/kernel/types.ts` | 重写：删除 `siyuan` 声明，添加 `/// <reference>`，保留业务类型，添加 SSE 扩展接口 |
| `src/kernel/index.ts` | 更新：添加 `/// <reference>` + `import type`，更新类型注解 |
| `src/kernel/mcp.ts` | 更新：使用官方 `IServerRequest`/`IHttpResponse` + 本地 SSE 扩展接口 |
| `src/kernel/webhook.ts` | 更新：适配官方 API 签名变化 |
| `src/kernel/scheduler.ts` | 更新：适配官方 API 签名变化 |
| `src/kernel/reminder.ts` | 更新：适配官方 API 签名变化 |
| `src/kernel/rpc.ts` | 更新：适配官方 API 签名变化 |
| `src/types/siyuanKernel.d.ts` | 删除 |
| `src/composables/useKernelTimer.ts` | 重写：改用 SSE 连接 |
| `src/stores/pomodoroStore.ts` | 更新：改用 HTTP JSON-RPC 调用 |
