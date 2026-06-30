# Kernel Timer 重构设计：用手写 WS 改为 Plugin.kernel API

## 背景

当前 `src/composables/useKernelTimer.ts` 手写了一套完整的 WebSocket 连接管理（含连接、重连、重试）和 RPC 调用。但 SiYuan 插件框架已在 `Plugin.kernel` 上提供了相同功能：

- `plugin.kernel.rpc.call.xxx(params)` — RPC 调用（替代手写 HTTP POST `rpcCall`）
- `plugin.kernel.rpc.bind('method', handler)` — 监听内核 WS 推送（替代手写 WS 消息解析）
- `plugin.kernel.state.code` — 内核插件状态（`2` = running）
- 框架自动管理 WS 连接、重连、状态监听

重构目标：删除所有手写 WS/RPC 代码，统一使用 `Plugin.kernel` 官方 API。

## 方案选择

选择方案 A（最小侵入）：保留 `useKernelTimer.ts` 文件和 `kernelAvailable` ref，内部实现替换为调用 `plugin.kernel` API。

理由：`kernelAvailable` 被 `reminderService.ts` 和 `pomodoroStore.ts` 通过 Vue `watch` 使用，保留该 ref 避免大范围改造。

## 设计详情

### Section 1: useKernelTimer.ts 重构

**删除：**

- 手写 WebSocket 管理层：`ws`、`wsReconnectTimer`、`wsReconnectAttempts`、`WS_MAX_RECONNECT_ATTEMPTS`、`connectKernelWebSocket()`、`disconnectKernelWebSocket()`
- 可用性重试层：`retryTimer`、`retryAttempts`、`MAX_RETRY_ATTEMPTS`、`RETRY_INTERVAL`、`startKernelAvailabilityCheck()`、`stopKernelAvailabilityCheck()`、`checkKernelAvailable()`
- 手写 `rpcCall()` 函数

**保留：**

- `kernelAvailable` ref — 保留，通过 `kernel.state.code === 2` 判断
- `KernelDiagnoseResult` 类型 — 保留

**新增：**

- `initKernelConnection(plugin)` — 注册 `kernel-plugin-state-change` 事件监听 + 绑定 `timer-expired` / `date-changed` RPC 通知
- `destroyKernelConnection(plugin)` — 解绑所有 handler

**可用性检测：** 监听 `kernel-plugin-state-change` 事件，`state.code === 2` 时设 `kernelAvailable = true`。

**通知监听：** `plugin.kernel.rpc.bind('timer-expired', handler)` 和 `plugin.kernel.rpc.bind('date-changed', handler)`。

**RPC 调用：** 删除全局 `rpcCall`，改由调用方直接使用 `plugin.kernel.rpc.call.xxx(params)`。

**diagnoseKernel：** 改为接收 plugin 参数，调用 `plugin.kernel.rpc.call.diagnose()`。

### Section 2: index.ts 改动

**onload：** 原 `startKernelAvailabilityCheck()` + watch 块替换为 `this.initKernelTimer()`，封装：

1. 调用 `initKernelConnection(this)`
2. `watch(kernelAvailable, ...)` 保持 pomodoroStore 通知监听器设置
3. 通过 `cleanupManager` 注册清理

**onunload：** 原 `stopKernelAvailabilityCheck()` + `disconnectKernelWebSocket()` 替换为 `destroyKernelConnection(this)`。

**新增私有方法：** `private initKernelTimer()`

### Section 3: pomodoroStore.ts 改动

所有 `rpcCall('xxx', params)` 改为 `plugin.kernel.rpc.call.xxx(params)`，约 8 处：

- `rpcCall('registerTimer', { ... })` → `plugin.kernel.rpc.call.registerTimer({ ... })`
- `rpcCall('cancelTimer', { id })` → `plugin.kernel.rpc.call.cancelTimer({ id })`
- `rpcCall('cancelTimersByType', { type })` → `plugin.kernel.rpc.call.cancelTimersByType({ type })`

`kernelAvailable` import 和 watch 使用保持不变。

### Section 4: reminderService.ts — 无需改动

只使用 `kernelAvailable` ref 判断状态，不调用 `rpcCall`。

## 影响范围

| 文件                                | 改动类型                       | 复杂度 |
| ----------------------------------- | ------------------------------ | ------ |
| `src/composables/useKernelTimer.ts` | 大幅简化，删除 WS/RPC 手写实现 | 高     |
| `src/index.ts`                      | 少量改动，替换初始化/清理调用  | 低     |
| `src/stores/pomodoroStore.ts`       | 8 处 rpcCall 替换              | 中     |
| `src/services/reminderService.ts`   | 无改动                         | 无     |
| `src/kernel/types.ts`               | 可能无需改动                   | 无     |

## 风险与注意事项

1. **参数传递格式**：SiYuan `kernel.rpc.call` 通过 Proxy 将参数展开为 `...params` 传给 JSON-RPC，需要确保后端期望的 `params` 格式一致
2. **时序问题**：`plugin.kernel.init()` 由框架在 `onload()` 之后异步调用，`kernel-plugin-state-change` 事件可能延迟到达。当前设计通过 watch `kernelAvailable` ref 处理此问题
3. **unbind 必须传入同一函数引用**：绑定 handler 时需保存引用，unbind 时传入同一引用
