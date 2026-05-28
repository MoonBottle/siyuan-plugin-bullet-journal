# Webhook 提醒重复推送修复 实现计划（v2 — 架构优化版）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复同一提醒被 webhook 重复推送多次的 bug，根因是多个 `setInterval` 定时器并发 + `checkTimers` 未使用 `notifiedTimerIds` 作为去重源 + 前端冗余 RPC 注册路径与 kernel 内部路径冲突。

**架构：** ① `initScheduler()` 加防护防止多个 `setInterval`；② `checkTimers`/`initScheduler` 使用 `notifiedTimerIds.has(id)` 替代 `!entry.notified` 作为唯一去重判断；③ 移除前端 `rebuildScheduleKernel()` 的 reminder/habit RPC 注册，kernel 通过 fs-notify 自行管理；④ `handleRegisterTimers` 补充 `notified: false`；⑤ `handleFsNotify` 过滤 `timer-registry.json`。

**技术栈：** TypeScript, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/kernel/scheduler.ts` | 修改 | `initScheduler()` 加防护；`checkTimers`/`initScheduler` 使用 `notifiedTimerIds.has()` |
| `src/kernel/pomodoro.ts` | 修改 | `handleRegisterTimers` 补充 `notified: false` |
| `src/kernel/reminder.ts` | 修改 | `handleFsNotify` 过滤 `timer-registry.json` |
| `src/services/reminderService.ts` | 修改 | 移除 `rebuildScheduleKernel()`；简化 `rebuildSchedule()` 和 `kernelAvailable` watch |
| `test/kernel/scheduler.notifiedTimerIds.test.ts` | 修改 | 更新现有测试 + 新增 `initScheduler` 防护测试和 `notifiedTimerIds` source-of-truth 测试 |
| `test/kernel/reminder.dedup.test.ts` | 修改 | 新增 `timer-registry.json` 过滤测试 |

---

### 任务 1：scheduler.ts — `initScheduler()` 防护 + `notifiedTimerIds` 作为唯一去重源

**文件：**
- 修改：`src/kernel/scheduler.ts:116-136`（`initScheduler` 函数）
- 修改：`src/kernel/scheduler.ts:146-157`（`checkTimers` 函数）
- 修改：`test/kernel/scheduler.notifiedTimerIds.test.ts`

- [ ] **步骤 1：编写失败的测试 — initScheduler 防护**

在 `test/kernel/scheduler.notifiedTimerIds.test.ts` 末尾追加：

```typescript
describe('initScheduler guard', () => {
  it('calling initScheduler twice should not create duplicate setInterval timers', async () => {
    vi.useFakeTimers()
    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    var pastTime = Math.floor(Date.now() / 1000) - 2
    var entry: TimerEntry = {
      id: 'guard-test-1',
      type: 'reminder',
      endTime: pastTime,
      metadata: { blockId: 'b1', content: 'guard test' },
      notified: false,
    }
    registerTimer(entry)

    globalThis.siyuan = {
      rpc: { broadcast: vi.fn() },
    } as any

    var { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()
    initScheduler()

    vi.advanceTimersByTime(1000)

    expect(dispatchFn).toHaveBeenCalledTimes(1)

    var { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`
预期：FAIL — `initScheduler` 被调用两次后 `dispatchFn` 被调用超过 1 次（多个 setInterval 导致重复触发）

- [ ] **步骤 3：实现 initScheduler 防护**

修改 `src/kernel/scheduler.ts` 的 `initScheduler` 函数，在开头添加防护：

```typescript
export function initScheduler(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  lastKnownDate = formatDate(new Date())
  console.log('[scheduler] initScheduler: existing timers=' + timers.size + ' today=' + lastKnownDate)
  var now = Date.now() / 1000
  timers.forEach(function (entry) {
    if (!notifiedTimerIds.has(entry.id) && entry.endTime <= now) {
      var diffMs = (now - entry.endTime) * 1000
      if (diffMs <= MISSED_THRESHOLD_MS) {
        entry.notified = true
        notifiedTimerIds.add(entry.id)
        console.log('[scheduler] missed timer (within ' + Math.round(diffMs / 1000) + 's): id=' + entry.id + ' type=' + entry.type + ' content=' + entry.metadata.content)
        dispatchNotification(entry)
      } else {
        entry.notified = true
        notifiedTimerIds.add(entry.id)
        console.log('[scheduler] stale timer (' + Math.round(diffMs / 60000) + 'min ago), skipping: id=' + entry.id + ' type=' + entry.type)
      }
    }
  })

  checkInterval = setInterval(checkTimers, 1000)
}
```

- [ ] **步骤 4：实现 notifiedTimerIds 作为唯一去重源**

修改 `src/kernel/scheduler.ts` 的 `checkTimers` 函数，将 `!entry.notified` 改为 `!notifiedTimerIds.has(entry.id)`：

```typescript
function checkTimers(): void {
  var now = Date.now() / 1000
  var firedCount = 0
  timers.forEach(function (entry) {
    if (!notifiedTimerIds.has(entry.id) && now >= entry.endTime) {
      entry.notified = true
      notifiedTimerIds.add(entry.id)
      firedCount++
      console.log('[scheduler] timer FIRED: id=' + entry.id + ' type=' + entry.type + ' content=' + entry.metadata.content + ' endTime=' + entry.endTime + ' now=' + now)
      dispatchNotification(entry)
    }
  })
  if (firedCount > 0) {
    console.log('[scheduler] checkTimers: ' + firedCount + ' timer(s) fired, active=' + timers.size)
  }

  var toDelete: string[] = []
  timers.forEach(function (entry, key) {
    if (entry.notified && (now - entry.endTime) > PURGE_THRESHOLD_S) {
      toDelete.push(key)
      notifiedTimerIds.delete(key)
    }
  })
  for (var i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) schedulePersist()

  var today = formatDate(new Date())
  if (today !== lastKnownDate) {
    lastKnownDate = today
    siyuan.rpc.broadcast('date-changed', { date: today })
    rebuildReminderSchedule()
  }
}
```

- [ ] **步骤 5：编写失败的测试 — notifiedTimerIds 作为 source of truth**

在 `test/kernel/scheduler.notifiedTimerIds.test.ts` 末尾追加：

```typescript
describe('notifiedTimerIds as source of truth', () => {
  it('checkTimers skips timer when notifiedTimerIds has the id even if entry.notified is false', async () => {
    vi.useFakeTimers()
    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    var futureTime = Math.floor(Date.now() / 1000) + 10
    var entry: TimerEntry = {
      id: 'sot-test-1',
      type: 'reminder',
      endTime: futureTime,
      metadata: { blockId: 'b1', content: 'sot test' },
      notified: false,
    }
    registerTimer(entry)
    markTimerNotified('sot-test-1')

    getTimers().get('sot-test-1')!.notified = false
    getTimers().get('sot-test-1')!.endTime = Math.floor(Date.now() / 1000) - 1

    globalThis.siyuan = {
      rpc: { broadcast: vi.fn() },
    } as any

    var { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()

    vi.advanceTimersByTime(2000)

    expect(dispatchFn).not.toHaveBeenCalled()

    var { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/kernel/scheduler.ts test/kernel/scheduler.notifiedTimerIds.test.ts
git commit -m "fix(kernel): guard initScheduler against multiple calls, use notifiedTimerIds as dedup source"
```

---

### 任务 2：pomodoro.ts — `handleRegisterTimers` 补充 `notified: false`

**文件：**
- 修改：`src/kernel/pomodoro.ts:18-22`（`handleRegisterTimers` 函数）

- [ ] **步骤 1：实现修复**

修改 `src/kernel/pomodoro.ts` 的 `handleRegisterTimers` 函数：

```typescript
export function handleRegisterTimers(params: { entries: TimerEntry[] }): any {
  console.log('[pomodoro] handleRegisterTimers: count=' + params.entries.length)
  for (var i = 0; i < params.entries.length; i++) {
    if (params.entries[i].notified === undefined) {
      params.entries[i].notified = false
    }
  }
  registerTimers(params.entries)
  return { ok: true }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/pomodoro.ts
git commit -m "fix(kernel): set notified=false in handleRegisterTimers for missing field"
```

---

### 任务 3：reminder.ts — `handleFsNotify` 过滤 `timer-registry.json`

**文件：**
- 修改：`src/kernel/reminder.ts:104-108`（`handleFsNotify` 函数）
- 修改：`test/kernel/reminder.dedup.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/kernel/reminder.dedup.test.ts` 的 `describe('handleFsNotify — .tmp file filtering')` 块中追加测试：

```typescript
it('ignores timer-registry.json events and does not trigger rebuild', async () => {
  var handleFsNotify = await importHandleFsNotify()
  var logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  handleFsNotify({
    type: 'fs-notify',
    detail: {
      path: 'timer-registry.json',
    },
  })

  expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[reminder] fs-notify: path=timer-registry.json'))

  logSpy.mockRestore()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：FAIL — `timer-registry.json` 事件未被过滤，日志中出现了 `[reminder] fs-notify: path=timer-registry.json`

- [ ] **步骤 3：实现修复**

修改 `src/kernel/reminder.ts` 的 `handleFsNotify` 函数，在 `.tmp` 过滤之后添加 `timer-registry.json` 过滤：

```typescript
export function handleFsNotify(event: { type: string, detail: any }): void {
  if (event.type !== 'fs-notify') return
  var path = event.detail.path.replace(/\\/g, '/')
  if (path.endsWith('.tmp')) return
  if (path === 'timer-registry.json') return
  console.log('[reminder] fs-notify: path=' + path)
  pendingPaths[path] = true
  if (fsNotifyDebounceTimer) clearTimeout(fsNotifyDebounceTimer)
  fsNotifyDebounceTimer = setTimeout(function () {
    if (pendingPaths['kernel-data.json']) {
      void rebuildReminderSchedule()
    }
    if (pendingPaths['settings']) {
      if (reloadWebhookConfigFn) void reloadWebhookConfigFn()
    }
    pendingPaths = {}
  }, 200)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/kernel/reminder.ts test/kernel/reminder.dedup.test.ts
git commit -m "fix(kernel): filter timer-registry.json from fs-notify events"
```

---

### 任务 4：reminderService.ts — 移除 `rebuildScheduleKernel()`，简化 `rebuildSchedule()`

**文件：**
- 修改：`src/services/reminderService.ts:154-160`（`rebuildSchedule` 方法）
- 修改：`src/services/reminderService.ts:64-71`（`kernelAvailable` watch 回调）
- 删除：`src/services/reminderService.ts:419-495`（`rebuildScheduleKernel` 方法）

- [ ] **步骤 1：简化 `rebuildSchedule()`**

修改 `src/services/reminderService.ts` 的 `rebuildSchedule` 方法，kernel 可用时直接 return：

```typescript
private rebuildSchedule(): void {
  if (!this.projectStore) return;

  if (kernelAvailable.value) {
    return;
  }

  const now = Date.now();
  // ... 原有的 croner 逻辑不变 ...
}
```

- [ ] **步骤 2：简化 `kernelAvailable` watch 回调**

修改 `src/services/reminderService.ts` 的 `kernelAvailable` watch 回调：

```typescript
this.kernelAvailableUnwatch = watch(kernelAvailable, (available) => {
  if (available) {
    console.log('[ReminderService] kernel became available, setting up listeners');
    this.setupKernelListeners();
    this.clearAllJobs();
  }
});
```

- [ ] **步骤 3：移除 `rebuildScheduleKernel()` 方法**

删除 `src/services/reminderService.ts` 中整个 `rebuildScheduleKernel` 方法（第 419-495 行）。

- [ ] **步骤 4：清理未使用的 import**

检查 `reminderService.ts` 顶部，移除 `rebuildScheduleKernel` 不再需要的 import：
- `rpcCall` — 如果 `pomodoroStore` 仍在使用则保留（检查其他引用）
- `getHabitReminderEntries` — 仅在 `rebuildScheduleKernel` 和 croner 路径中使用，croner 路径仍需要，保留
- `calculateReminderTime` — croner 路径仍需要，保留

注意：`rpcCall` 可能在 `pomodoroStore` 中也有使用，但 `reminderService` 中只有 `rebuildScheduleKernel` 使用了它。移除 `reminderService` 中的 `rpcCall` import。

- [ ] **步骤 5：Commit**

```bash
git add src/services/reminderService.ts
git commit -m "refactor(reminder): remove rebuildScheduleKernel, kernel owns reminder/habit timers via fs-notify"
```

---

### 任务 5：全量测试和 lint 验证

**文件：** 无新增

- [ ] **步骤 1：运行全量测试**

运行：`npx vitest run`
预期：所有测试通过

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误（如有自动修复，运行 `npm run lint:fix`）

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：构建成功，无类型错误

- [ ] **步骤 4：Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint fixes for webhook reminder dedup v2"
```
