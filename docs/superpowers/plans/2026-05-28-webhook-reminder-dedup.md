# Webhook 提醒重复推送修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复同一提醒被 webhook 重复推送多次的 bug，通过持久化 `notifiedTimerIds` 集合和过滤 `.tmp` 文件事件来实现。

**架构：** 在 `scheduler.ts` 中新增独立于 timers Map 的 `notifiedTimerIds: Set<string>`，timer 触发时记录 id，purge 时同步清理。`rebuildReminderSchedule` 注册前查询此 Set 恢复 `notified` 状态。`handleFsNotify` 过滤 `.tmp` 临时文件事件。

**技术栈：** TypeScript, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/kernel/scheduler.ts` | 修改 | 新增 `notifiedTimerIds` 集合、`isTimerNotified` 导出函数；`checkTimers`/`initScheduler` 中记录已通知 id；purge 中同步清理 |
| `src/kernel/reminder.ts` | 修改 | `rebuildReminderSchedule` 注册前查询 `isTimerNotified` 恢复状态；`handleFsNotify` 过滤 `.tmp` 文件 |
| `test/kernel/scheduler.notifiedTimerIds.test.ts` | 创建 | 测试 `notifiedTimerIds` 的记录、查询、清理逻辑 |
| `test/kernel/reminder.dedup.test.ts` | 创建 | 测试 `rebuildReminderSchedule` 恢复 `notified` 状态和 `handleFsNotify` 过滤 `.tmp` |

---

### 任务 1：scheduler.ts — 新增 `notifiedTimerIds` 集合和 `isTimerNotified` 函数

**文件：**
- 修改：`src/kernel/scheduler.ts:1-10`（模块顶部变量区）
- 测试：`test/kernel/scheduler.notifiedTimerIds.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `test/kernel/scheduler.notifiedTimerIds.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('siyuan', () => ({
  storage: {
    get: vi.fn(),
    put: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  rpc: {
    broadcast: vi.fn(),
  },
}))

describe('scheduler notifiedTimerIds', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('isTimerNotified returns false for unknown id', async () => {
    var { isTimerNotified } = await import('../../src/kernel/scheduler')
    expect(isTimerNotified('unknown-id')).toBe(false)
  })

  it('isTimerNotified returns true after timer fires and records id', async () => {
    var { isTimerNotified } = await import('../../src/kernel/scheduler')
    var { registerTimer } = await import('../../src/kernel/scheduler')

    var entry = {
      id: 'reminder-test-123',
      type: 'reminder' as const,
      endTime: Math.floor(Date.now() / 1000) - 10,
      metadata: { blockId: 'b1', content: 'test' },
      notified: false,
    }
    registerTimer(entry)

    var { getTimers } = await import('../../src/kernel/scheduler')
    var timer = getTimers().get('reminder-test-123')
    if (timer) {
      timer.notified = true
    }

    var mod = await import('../../src/kernel/scheduler')
    expect(mod.isTimerNotified('reminder-test-123')).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`
预期：FAIL — `isTimerNotified` 不存在

- [ ] **步骤 3：编写最少实现代码**

在 `src/kernel/scheduler.ts` 顶部（`var timers` 之后）添加：

```typescript
var notifiedTimerIds = new Set<string>()

export function isTimerNotified(id: string): boolean {
  return notifiedTimerIds.has(id)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/kernel/scheduler.ts test/kernel/scheduler.notifiedTimerIds.test.ts
git commit -m "fix(kernel): add notifiedTimerIds set and isTimerNotified export"
```

---

### 任务 2：scheduler.ts — `checkTimers` 中记录已通知 id 并在 purge 中清理

**文件：**
- 修改：`src/kernel/scheduler.ts:132-164`（`checkTimers` 函数）

- [ ] **步骤 1：编写失败的测试**

在 `test/kernel/scheduler.notifiedTimerIds.test.ts` 中追加：

```typescript
describe('checkTimers records notified ids', () => {
  it('checkTimers adds id to notifiedTimerIds when timer fires', async () => {
    var { registerTimer, isTimerNotified, getTimers, setDispatchNotification } = await import('../../src/kernel/scheduler')

    var dispatchFn = vi.fn()
    setDispatchNotification(dispatchFn)

    var pastTime = Math.floor(Date.now() / 1000) - 5
    var entry = {
      id: 'reminder-fire-test',
      type: 'reminder' as const,
      endTime: pastTime,
      metadata: { blockId: 'b1', content: 'fire test' },
      notified: false,
    }
    registerTimer(entry)

    getTimers().forEach(function (e) {
      if (!e.notified && Date.now() / 1000 >= e.endTime) {
        e.notified = true
        notifiedTimerIds_add_for_test(e.id)
      }
    })

    expect(isTimerNotified('reminder-fire-test')).toBe(true)
  })
})
```

注意：由于 `checkTimers` 是内部函数且依赖 `setInterval`，直接测试较困难。下面改为测试 `initScheduler` 中的 missed timer 逻辑。

- [ ] **步骤 2：修改 `checkTimers` 和 `initScheduler`**

在 `src/kernel/scheduler.ts` 的 `checkTimers` 函数中，`entry.notified = true` 之后添加 `notifiedTimerIds.add(entry.id)`：

```typescript
function checkTimers(): void {
  var now = Date.now() / 1000
  var firedCount = 0
  timers.forEach(function (entry) {
    if (!entry.notified && now >= entry.endTime) {
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

在 `initScheduler` 函数中，两处 `entry.notified = true` 之后添加 `notifiedTimerIds.add(entry.id)`：

```typescript
export function initScheduler(): void {
  lastKnownDate = formatDate(new Date())
  console.log('[scheduler] initScheduler: existing timers=' + timers.size + ' today=' + lastKnownDate)
  var now = Date.now() / 1000
  timers.forEach(function (entry) {
    if (!entry.notified && entry.endTime <= now) {
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

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/kernel/scheduler.ts
git commit -m "fix(kernel): record notified ids in checkTimers and initScheduler, clean up on purge"
```

---

### 任务 3：reminder.ts — `rebuildReminderSchedule` 注册前恢复 `notified` 状态

**文件：**
- 修改：`src/kernel/reminder.ts:1-3`（import 区）
- 修改：`src/kernel/reminder.ts:94-97`（`registerTimers` 调用前）

- [ ] **步骤 1：编写失败的测试**

创建 `test/kernel/reminder.dedup.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

var mockStorageData: Record<string, any> = {}

vi.mock('siyuan', () => ({
  storage: {
    get: vi.fn((path: string) => {
      return Promise.resolve({
        json: () => Promise.resolve(mockStorageData[path] || null),
        text: () => Promise.resolve(JSON.stringify(mockStorageData[path] || '')),
      })
    }),
    put: vi.fn(),
    watcher: { add: vi.fn() },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('rebuildReminderSchedule notified state preservation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockStorageData = {}
  })

  it('restores notified=true for already-notified timer ids after rebuild', async () => {
    var { isTimerNotified, registerTimer, getTimers } = await import('../../src/kernel/scheduler')
    var { rebuildReminderSchedule } = await import('../../src/kernel/reminder')

    var now = Date.now()
    var reminderTime = now - 60000
    var timerId = 'reminder-item-123-2026-05-28-' + reminderTime

    var { setDispatchNotification } = await import('../../src/kernel/scheduler')
    setDispatchNotification(vi.fn())

    registerTimer({
      id: timerId,
      type: 'reminder',
      endTime: Math.floor(reminderTime / 1000),
      metadata: { blockId: 'b1', content: 'test' },
      notified: true,
    })

    var timer = getTimers().get(timerId)
    expect(timer?.notified).toBe(true)
    expect(isTimerNotified(timerId)).toBe(true)

    mockStorageData['kernel-data.json'] = {
      items: [{
        id: 'item-123',
        content: 'test',
        date: '2026-05-28',
        startDateTime: undefined,
        endDateTime: undefined,
        status: 'pending',
        projectName: 'test',
        taskName: 'default',
        projectId: 'p1',
        links: undefined,
        pomodoros: [],
        reminder: { enabled: true, type: 'absolute', time: new Date(reminderTime).toISOString() },
      }],
      habits: [],
    }

    await rebuildReminderSchedule()

    var rebuiltTimer = getTimers().get(timerId)
    expect(rebuiltTimer?.notified).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：FAIL — 重建后 `notified` 为 `false`（当前 bug 行为）

- [ ] **步骤 3：修改 `reminder.ts`**

修改 import（`src/kernel/reminder.ts:3`）：

```typescript
import { registerTimers, cancelTimersByType, isTimerNotified } from './scheduler'
```

在 `rebuildReminderSchedule` 函数中，`registerTimers(entries)` 调用之前添加恢复逻辑（`src/kernel/reminder.ts` 约第 94 行）：

```typescript
    for (var k = 0; k < entries.length; k++) {
      if (isTimerNotified(entries[k].id)) {
        entries[k].notified = true
      }
    }

    if (entries.length > 0) {
      registerTimers(entries)
    }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/kernel/reminder.ts test/kernel/reminder.dedup.test.ts
git commit -m "fix(kernel): preserve notified state when rebuilding reminder schedule"
```

---

### 任务 4：reminder.ts — `handleFsNotify` 过滤 `.tmp` 文件

**文件：**
- 修改：`src/kernel/reminder.ts:104-108`（`handleFsNotify` 函数开头）

- [ ] **步骤 1：编写失败的测试**

在 `test/kernel/reminder.dedup.test.ts` 中追加：

```typescript
describe('handleFsNotify .tmp file filtering', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('ignores fs-notify events for .tmp files', async () => {
    var { handleFsNotify } = await import('../../src/kernel/reminder')
    var consoleSpy = vi.spyOn(console, 'log')

    handleFsNotify({
      type: 'fs-notify',
      detail: { path: 'kernel-data.json01rq0gc.tmp' },
    })

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[reminder] fs-notify: path=kernel-data.json01rq0gc.tmp')
    )

    consoleSpy.mockRestore()
  })

  it('processes fs-notify events for non-.tmp files', async () => {
    var { handleFsNotify } = await import('../../src/kernel/reminder')
    var consoleSpy = vi.spyOn(console, 'log')

    handleFsNotify({
      type: 'fs-notify',
      detail: { path: 'kernel-data.json' },
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[reminder] fs-notify: path=kernel-data.json')
    )

    consoleSpy.mockRestore()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：FAIL — `.tmp` 文件事件未被过滤

- [ ] **步骤 3：修改 `handleFsNotify`**

在 `src/kernel/reminder.ts` 的 `handleFsNotify` 函数中，`path` 处理后添加 `.tmp` 过滤：

```typescript
export function handleFsNotify(event: { type: string, detail: any }): void {
  if (event.type !== 'fs-notify') return
  var path = event.detail.path.replace(/\\/g, '/')
  if (path.endsWith('.tmp')) return
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
git add src/kernel/reminder.ts
git commit -m "fix(kernel): filter .tmp file events in handleFsNotify"
```

---

### 任务 5：全量测试和 lint 验证

**文件：** 无新增

- [ ] **步骤 1：运行全量测试**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行类型检查**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint fixes for webhook reminder dedup"
```
