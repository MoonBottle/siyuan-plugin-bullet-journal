# 恢复 kernel/index.ts 的业务逻辑代码

## 问题分析

当前 `src/kernel/index.ts`（最新提交 `1fe39a3`）是一个被精简后的测试版本，仅包含：
- `ping` RPC 绑定
- `testBroadcast` 测试 RPC
- `broadcast` 测试事件
- 最基本的 `onunload`（只停止 scheduler + 持久化 timer）

而历史版本（`b600633` ~ `d39b841`）包含了完整的内核业务逻辑：

### 当前代码（丢失的业务逻辑）

| 功能 | 当前状态 | 历史版本 |
|------|---------|---------|
| `setDispatchNotification` | ❌ 缺失 | ✅ scheduler 注入 webhook 通知 |
| `setRebuildReminderSchedule` | ❌ 缺失 | ✅ scheduler 注入 reminder 重建 |
| `setReloadWebhookConfig` | ❌ 缺失 | ✅ reminder 注入 webhook 重载 |
| `loadTimerRegistry` | ❌ 缺失 | ✅ 加载持久化的计时器 |
| `initScheduler` | ❌ 缺失 | ✅ 初始化调度器 |
| `initReminderScheduler` | ❌ 缺失 | ✅ 初始化提醒调度 |
| `loadWebhookConfig` | ❌ 缺失 | ✅ 加载 webhook 配置 |
| `initRpcApi` | ❌ 缺失 | ✅ 绑定所有 RPC API |
| `initMcpServer` | ❌ 缺失 | ✅ 启动 MCP 服务器 |
| `siyuan.event.handler` | ❌ 缺失 | ✅ 监听文件系统事件 |
| `onunload` 清理 | ❌ 不完整 | ✅ 清理 http/es handler、event handler、watcher |

### 测试代码（应移除）

| 功能 | 说明 |
|------|------|
| `siyuan.rpc.broadcast('test-event', ...)` | 测试广播，非业务代码 |
| `testBroadcast` RPC 绑定 | 测试 RPC，非业务代码 |
| `handlePing` 单独导入 | 已包含在 `initRpcApi` 中 |

## 恢复方案

以 `d39b841`（修复内核与前端时序问题）版本为基础，结合当前代码风格（`siyuan.logger` + `void` 前缀）进行恢复：

### 目标代码

```typescript
import { initScheduler, stopScheduler, loadTimerRegistry, persistTimerRegistry, setDispatchNotification, setRebuildReminderSchedule } from './scheduler'
import { initReminderScheduler, handleFsNotify, rebuildReminderSchedule, setReloadWebhookConfig } from './reminder'
import { initRpcApi } from './rpc'
import { initMcpServer } from './mcp'
import { dispatchNotification, loadWebhookConfig, reloadWebhookConfig } from './webhook'

siyuan.plugin.lifecycle.onload = async function () {
  void siyuan.logger.info('[kernel] onload fired')
}

siyuan.plugin.lifecycle.onloaded = async function () {
  void siyuan.logger.info('[kernel] onloaded fired')
}

siyuan.plugin.lifecycle.onrunning = async function () {
  void siyuan.logger.info('[kernel] onrunning fired, platform=' + siyuan.plugin.platform)

  setDispatchNotification(dispatchNotification)
  setRebuildReminderSchedule(rebuildReminderSchedule)
  setReloadWebhookConfig(reloadWebhookConfig)

  await loadTimerRegistry()
  initScheduler()

  await initReminderScheduler()
  await loadWebhookConfig()

  await initRpcApi()
  initMcpServer()

  siyuan.event.handler = function (event: { type: string, detail: any }) {
    handleFsNotify(event)
  }

  void siyuan.logger.info('[kernel] initialized successfully')
}

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')

  stopScheduler()
  await persistTimerRegistry()

  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.storage.watcher.remove('.')

  await siyuan.logger.info('[kernel] unloaded')
}
```

### 变更要点

1. **恢复 imports**：从 `./scheduler`、`./reminder`、`./rpc`、`./mcp`、`./webhook` 导入所有业务函数
2. **移除测试 imports**：删除 `handlePing` from `./pomodoro`（已由 `initRpcApi` 内部处理）
3. **恢复 `onrunning` 业务逻辑**：
   - 依赖注入：`setDispatchNotification`、`setRebuildReminderSchedule`、`setReloadWebhookConfig`
   - 计时器加载与调度：`loadTimerRegistry` → `initScheduler`
   - 提醒与 Webhook：`initReminderScheduler` → `loadWebhookConfig`
   - RPC 与 MCP：`initRpcApi` → `initMcpServer`
   - 事件监听：`siyuan.event.handler` → `handleFsNotify`
4. **移除测试代码**：删除 `broadcast` 测试和 `testBroadcast` RPC
5. **恢复 `onunload` 完整清理**：http handler、es handler、event handler、storage watcher
6. **保留当前代码风格**：使用 `siyuan.logger` + `void` 前缀（而非历史版本的 `console.log`）

### 依赖验证

所有依赖模块当前均存在且导出正确：
- `scheduler.ts`：`initScheduler`, `stopScheduler`, `loadTimerRegistry`, `persistTimerRegistry`, `setDispatchNotification`, `setRebuildReminderSchedule` ✅
- `reminder.ts`：`initReminderScheduler`, `handleFsNotify`, `rebuildReminderSchedule`, `setReloadWebhookConfig` ✅
- `rpc.ts`：`initRpcApi` ✅
- `mcp.ts`：`initMcpServer` ✅
- `webhook.ts`：`dispatchNotification`, `loadWebhookConfig`, `reloadWebhookConfig` ✅

## 实施步骤

1. 编辑 `src/kernel/index.ts`，替换为上述目标代码
2. 运行 `npm run lint` 检查代码风格
3. 运行 `npm run build` 确认编译通过
