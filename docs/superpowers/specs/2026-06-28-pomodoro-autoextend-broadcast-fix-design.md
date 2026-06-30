# 番茄钟 autoExtend 后到期不触发广播的修复设计

## 背景

番茄钟专注到期后，前端会调用 `completePomodoro` 完成专注。如果用户启用了「自动延迟」（autoExtend），`completePomodoro` 会通过 `scheduleAutoExtend` 在若干秒后调用 `autoExtendPomodoro`，该方法会：

1. 调用内核 RPC `cancelTimer({ id: 'pomodoro-${blockId}' })` 取消旧计时器
2. 调用内核 RPC `registerTimer({ id: 'pomodoro-${blockId}', ... })` 用相同的 id 注册新的 endTime

期望：新注册的 timer 到期后，内核 `checkTimers` 检测到到期 → 调用 `dispatchNotification` → `siyuan.rpc.broadcast('timer-expired', ...)` → 前端 `useKernelTimer` 接收 → 触发 `completePomodoro` 完成第二轮专注。

实际：autoExtend 后第二次到期不触发 `timer-expired` 广播，前端永远不会收到完成通知，专注无法结束。

## 根因

内核中存在**两个独立的去重 Set**，生命周期不同步：

| Set | 文件 | 清理时机 |
|-----|------|---------|
| `notifiedTimerIds` | `src/kernel/scheduler.ts:5` | `cancelTimer` 会清（已修复） |
| `dispatchedNotificationIds` | `src/kernel/webhook.ts:43` | **从不清理**（仅 `clearModuleState` 之外的卸载流程会重置模块） |

### 完整链路（第二次到期被吞）

```
autoExtendPomodoro
  → rpc.call.cancelTimer → handleCancelTimer → scheduler.cancelTimer
    → timers.delete(id) ✓
    → notifiedTimerIds.delete(id) ✓   ← 之前已修
  → rpc.call.registerTimer → handleRegisterTimer → scheduler.registerTimer
    → notifiedTimerIds.has(id) === false → 不 SKIP ✓
    → timers.set(id, newEntry) ✓

checkTimers (每秒 tick)
  → notifiedTimerIds.has(id) === false → 进入触发分支 ✓
  → notifiedTimerIds.add(id)
  → dispatchNotification(entry)
    → webhook.dispatchNotification
      → ❌ dispatchedNotificationIds.has(entry.id) === true
      → SKIP，不调用 siyuan.rpc.broadcast('timer-expired')
      → 前端永远收不到通知
```

### 为什么 `dispatchedNotificationIds` 是冗余的

`dispatchNotification` 只有两个调用点，都在 `scheduler.ts` 中：

- [scheduler.ts:162](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/kernel/scheduler.ts#L162) — `initScheduler` 补发 missed timer
- [scheduler.ts:221](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/kernel/scheduler.ts#L221) — `checkTimers` 正常到期

**两个调用点在调用前都已经做了 `notifiedTimerIds.add(entry.id)`**，所以 `dispatchNotification` 永远只会被同一个 id 调用一次（除非 `notifiedTimerIds` 被 `cancelTimer` 清理）。

也就是说，`webhook.ts` 中的 `dispatchedNotificationIds` 去重检查永远不可能在生产代码中触发——除非 `notifiedTimerIds` 已经被清（这正是 autoExtend 的合法场景）。在这种场景下，`dispatchedNotificationIds` 反而成了 bug 源：它不允许「同一 id 二次通知」，但这恰恰是 autoExtend 需要的语义。

## 设计：移除 `dispatchedNotificationIds`

### 改动范围

仅修改 `src/kernel/webhook.ts`：

1. 删除 `const dispatchedNotificationIds = new Set<string>()`（L43）
2. 删除 `dispatchNotification` 入口的去重检查（L51-54）
3. 删除 `dispatchedNotificationIds.add(entry.id)`（L55）

### 不变的部分

- `scheduler.ts` 的 `notifiedTimerIds` 保持不变（它承担真正的去重职责）
- `dispatchNotification` 的其他逻辑（broadcast + webhook 推送）保持不变
- `cancelTimer` 清理 `notifiedTimerIds` 的修复保持不变

### 数据流（修复后）

```
autoExtendPomodoro
  → cancelTimer(id) → notifiedTimerIds.delete(id) ✓
  → registerTimer(newEntry) → 不 SKIP ✓

checkTimers 检测到期
  → notifiedTimerIds.has(id) === false → 进入分支 ✓
  → notifiedTimerIds.add(id)
  → dispatchNotification(entry)
    → (无冗余检查)
    → siyuan.rpc.broadcast('timer-expired', ...) ✓
    → 前端 useKernelTimer 收到 → eventBus.emit(KERNEL_NOTIFICATION)
    → setupKernelNotificationListener → completePomodoro ✓
```

## 测试策略

### TDD：先写失败测试

追加到现有 `test/kernel/scheduler.notifiedTimerIds.test.ts`（该文件已有 `cancelTimer clears notifiedTimerIds（pomodoro autoExtend 场景）` 测试组，复用其 fake timers + `siyuan.rpc.broadcast` mock 基础设施）。新增测试组 `dispatchedNotificationIds 不应阻止 autoExtend 后的二次广播`：

1. 调用 `setDispatchNotification(dispatchNotification)`（来自 `webhook.ts`，使用真实实现而非 mock）
2. 注册 timer A（endTime 已过）→ 推进 fake timer 1 秒 → 期望 `siyuan.rpc.broadcast` 被调用 1 次
3. `cancelTimer(A.id)` → 重新注册 timer A（newEndTime 在未来 2 秒）
4. 推进 fake timer 3 秒 → 期望 `siyuan.rpc.broadcast` 被调用第 2 次

**预期：修复前第 4 步失败（broadcast 仍为 1 次，因为 `dispatchedNotificationIds` 静默吞掉第二次），修复后通过（broadcast 为 2 次）。**

### 现有测试不受影响

- `test/kernel/scheduler.notifiedTimerIds.test.ts` 中已有的测试不涉及 `dispatchedNotificationIds`，不受影响
- 新增的 autoExtend 二次广播测试组使用真实的 `dispatchNotification` 实现（而非 mock），才能复现 `dispatchedNotificationIds` 拦截行为
- `notifiedTimerIds` 的去重语义保持不变

## 风险评估

### 风险 1：是否会引入重复广播？

不会。`dispatchNotification` 的两个调用点都在调用前 `notifiedTimerIds.add(id)`，`checkTimers` 的去重条件 `!notifiedTimerIds.has(entry.id) && now >= entry.endTime` 确保同一 id 在同一 `notifiedTimerIds` 生命周期内只会触发一次 `dispatchNotification`。

### 风险 2：webhook 通道是否会重复推送？

不会。webhook 推送依赖 `dispatchNotification` 被调用，而后者已被 `notifiedTimerIds` 去重。移除 `dispatchedNotificationIds` 后，webhook 推送的频率与 `dispatchNotification` 的调用频率一致，不会重复。

### 风险 3：是否有其他模块依赖 `dispatchedNotificationIds`？

无。`dispatchedNotificationIds` 是 `webhook.ts` 的模块私有变量，未导出，无外部引用。

## YAGNI 说明

`dispatchedNotificationIds` 是历史遗留的冗余防御层。当前架构中 `notifiedTimerIds` 已经是 single source of truth（参见 `test/kernel/scheduler.notifiedTimerIds.test.ts` 中的 `notifiedTimerIds as source of truth` 测试组），`dispatchedNotificationIds` 的存在反而引入了「两层 Set 必须手动同步」的维护负担。移除它符合 YAGNI 原则。
