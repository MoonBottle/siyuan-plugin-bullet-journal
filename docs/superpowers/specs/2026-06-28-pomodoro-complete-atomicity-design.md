# 番茄钟完成流程原子性修复设计

> **目标：** 修复内核倒计时到期后「UI 停在 0 秒、专注状态不清空、却推送了完成通知」的并发缺陷，理顺 `completePomodoro` 的原子性。

## 背景

### 架构原则（源自 [kernel-timer-webhook-design.md](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/docs/superpowers/specs/2026-05-23-kernel-timer-webhook-design.md) L528-533）

- **内核可用时**：前端 `setInterval` 只负责 UI 每秒更新（`remainingSeconds`、进度环），**永不触发** `completePomodoro()`；到期触发完全由内核广播 `KERNEL_NOTIFICATION` 驱动
- **内核不可用时**（fallback）：`updateTimer()` 检测 `accumulatedSeconds >= targetSeconds` 后调 `completePomodoro()`

### Bug 现象

内核可用时，倒计时到期后出现三症状：
1. **UI 停在 0 秒**——`setInterval` 仍在跑，每秒把 `remainingSeconds` 算成 0
2. **专注状态不清空**——`activePomodoro` 仍非空，界面不切换到完成态
3. **完成通知已推送**——通知代码执行了，但状态清理没有完成

## 根因

`completePomodoro`（[pomodoroStore.ts:577](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L577)）是 `async` 函数，包含多个 `await`（`savePendingCompletion` L623、`removeActivePomodoro` L630）。

**致命的顺序问题**：

```
L587  const ap = this.activePomodoro         ← 引用（未快照）
L590  内联同步 accumulatedSeconds（修改 ap）
L623  await savePendingCompletion            ← 挂起！setInterval 仍在每秒改 ap
L630  await removeActivePomodoro             ← 又挂起
L633  this.stopTimer()                       ← 在 await 之后，太晚
L634  this.activePomodoro = null             ← 在 await 之后，太晚
```

在 `await` 挂起期间：
- `setInterval` 的 `updateTimer` 继续修改 `this.activePomodoro.accumulatedSeconds` 和 `remainingSeconds`（因为 `activePomodoro` 还是 ap 引用，非 null）
- 任何并发调用源（手动结束、数据刷新、重复的内核广播）进入 `completePomodoro` 时，`if (!this.activePomodoro) return false`（L578）守卫**失效**——因为 `activePomodoro` 还没被清空

导致：状态清理（`activePomodoro = null`、`stopTimer`）与副作用（通知、事件）执行顺序错乱，最终状态不一致。

## 决策（已与用户确认）

| # | 决策 | 选项 | 理由 |
|---|------|------|------|
| A1 | 完成触发源 | **严格按 spec**：内核可用时仅 `KERNEL_NOTIFICATION` 触发；前端 setInterval 永不触发 | 符合架构原则，职责清晰 |
| A2 | 重入保护 | **提前清空 `activePomodoro`** | 复用已有 L578 守卫，最小改动 |
| A3 | accumulatedSeconds 同步 | **入口内联计算** | 不依赖 setInterval tick，不触发 updateTimer 副作用 |
| A4 | accumulatedSeconds 语义 | **实际专注时长**（`round(accumulated/60)`）| 番茄记录应记录实际专注时长，手动提前结束记录真实时长而非目标时长 |

## 改造点

### 改造点 1：`completePomodoro` 原子化（[pomodoroStore.ts:577-668](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L577-L668)）

**核心原则：同步区做完所有状态变更，异步区只用快照。**

改后的执行顺序：

```
1. if (!this.activePomodoro) return false       ← 重入防线（已有）
2. const ap = this.activePomodoro                ← 引用快照
3. const pluginToUse = plugin ?? usePlugin()      ← 获取 plugin
4. 内联计算 accumulatedSeconds（写到 ap 快照）
5. 构建 pending 对象（用 ap 的数据）
6. cancelMobileFocusEnd()
7. cancelTimer (kernel 可用时)
   —— 同步区结束前，立即切断并发源 ——
8. this.stopTimer()                              ← 立即停 setInterval（切断并发源）
9. this.activePomodoro = null                    ← 立即清空（激活重入防线）
   —— 以下异步区，全部用 ap 快照 + pending ——
10. await savePendingCompletion(plugin, pending)
11. await removeActivePomodoro(plugin)
12. eventBus.emit(POMODORO_COMPLETED)
13. playNotificationSound()
14. showPomodoroCompleteNotification(ap.itemContent, ...)
15. eventBus.emit(PENDING_COMPLETION, pending)
16. scheduleAutoExtend(plugin)
```

**关键变化**：
- `stopTimer()` + `activePomodoro = null` 从 `await` **之后**移到 **之前**（同步区）
- pending 对象在清空 `activePomodoro` **之前**用 ap 构建，异步区不再读 `this.activePomodoro`
- L578 守卫 `if (!this.activePomodoro) return false` 成为有效的重入防线：第一次调用立即清空，第二次调用立即返回 false

**错误处理**：`try/catch` 覆盖整个流程。若 `savePendingCompletion` 失败 early return false，此时 `activePomodoro` 已清空、`stopTimer` 已执行——状态一致（专注已结束，只是记录未保存），不会卡死。

### 改造点 2：`updateTimer` 完成分支（[pomodoroStore.ts:457-464](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L457-L464)）

**无需改动。** 当前已符合 spec：

```js
if (!isStopwatch && accumulatedSeconds >= targetSeconds) {
  if (!kernelAvailable.value) {      // ← 内核可用时跳过 completePomodoro
    this.completePomodoro()
  }
}
```

内核可用时，前端 setInterval 只更新 `remainingSeconds` 供 UI 显示，永不触发完成。到期完全由 `KERNEL_NOTIFICATION` 驱动。

### 改造点 3：内核广播监听器（[pomodoroStore.ts:1259-1264](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1259-L1264)）

**无需改动。** 当前已符合设计：

```js
if (params.type === 'pomodoro' && this.activePomodoro) {
  this.completePomodoro()
}
```

`&& this.activePomodoro` 检查 + `completePomodoro` 内部 L578 守卫 + 改造点 1 的立即清空，共同构成三道防线。即便广播重复投递，第二次调用会被 L578 拦截。

### 改造点 4：测试（[pomodoroStore.test.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/test/stores/pomodoroStore.test.ts)）

新增/调整测试：

1. **重入保护**：在 `completePomodoro` 的 `await` 期间并发第二次调用 → 第二次返回 false，`savePendingCompletion` 只被调一次
2. **setInterval 不污染**：`completePomodoro` 执行后 `activePomodoro` 为 null、`timerInterval` 为 null（验证 `stopTimer` 已执行）
3. **现有测试**：「不递归崩溃」「时长正确」继续通过；已有的回归测试（「倒计时到期时 completePomodoro 能正常结束专注」）会自然通过——它验证了 `activePomodoro` 被清空

### 不改动的地方

- `updateTimer` 的内联同步逻辑（L441-444 的 `timerStartTimestamp == null` 保护）保留——它对 `completePomodoro` 无影响
- `autoExtendPomodoro`、`pausePomodoro`、`resumePomodoro` 不受影响（它们在调 `completePomodoro` 前已各自管理状态）
- 组件文件（PomodoroCompleteDialog、MobileComplete）不改动——`durationMinutes` 已是实际专注时长，过短判断用 `durationMinutes` 即可

## 数据流（修复后，内核可用场景）

```
1. startPomodoro(item, 2, ..., 'countdown')
   ├── targetDurationMinutes = 2
   ├── registerKernelPomodoroTimer(blockId, 120s)   ← 内核注册
   └── startTimer() → setInterval(updateTimer, 1000) ← 仅 UI 更新

2. 每秒 updateTimer（内核可用）
   ├── accumulatedSeconds 基于 Date.now() 时间戳更新
   ├── remainingSeconds = max(0, target - accumulated)  ← UI 显示
   └── accumulated >= target 但 kernelAvailable=true → 不调 completePomodoro ✓

3. 内核到期 → KERNEL_NOTIFICATION
   └── completePomodoro()
       ├── ap = activePomodoro（快照）
       ├── 内联算 accumulatedSeconds
       ├── 构建 pending（用 ap）
       ├── stopTimer()           ← 立即停 setInterval
       ├── activePomodoro = null ← 立即清空（重入防线激活）
       ├── await savePendingCompletion(pending)
       ├── await removeActivePomodoro()
       ├── emit POMODORO_COMPLETED  ← UI 切换到完成态
       ├── 通知 + 弹窗
       └── scheduleAutoExtend
```

## 验证步骤

1. `npm run test`：新增重入测试通过 + 现有测试不回归
2. `npm run lint`：clean
3. `npm run typecheck`：clean
4. 手动验证（内核可用）：
   - 设自定义 2 分钟专注 → 等待到期 → UI 立即切换到完成弹窗、专注状态清空、通知显示 2 分钟
   - 设自定义 25 分钟专注 → 手动提前结束（专注 1 分 30 秒）→ 记录显示 2 分钟（实际时长）
   - 快速连续点击「结束专注」按钮 → 只触发一次完成流程（重入保护）

## 不在本次范围

- 不重构 `updateTimer` 的计时机制（时间戳计算本身精确）
- 不改 `markExpiredPomodoroComplete`（已是目标时长，独立流程）
- 不改自动延迟（autoExtend）相关时长计算
- 不改内核计时器注册/取消的 RPC 逻辑
