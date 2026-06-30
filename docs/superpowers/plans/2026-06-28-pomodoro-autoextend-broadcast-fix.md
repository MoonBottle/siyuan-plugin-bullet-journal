# 移除 webhook.ts 冗余 dispatchedNotificationIds 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复番茄钟 autoExtend 后第二次到期不触发 `timer-expired` 广播的 bug，根因是 `src/kernel/webhook.ts` 中的 `dispatchedNotificationIds` Set 永远不被清理，静默吞掉了相同 id 的二次通知。

**架构：** 移除 `webhook.ts` 中冗余的 `dispatchedNotificationIds` Set 及其去重检查。去重职责完全由 `scheduler.ts` 的 `notifiedTimerIds` 承担（已在上一轮修复中通过 `cancelTimer` 清理）。新增覆盖完整链路（scheduler → webhook → broadcast）的回归测试。

**技术栈：** TypeScript + Vitest + fake timers

**规格：** `docs/superpowers/specs/2026-06-28-pomodoro-autoextend-broadcast-fix-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `test/kernel/scheduler.notifiedTimerIds.test.ts` | 修改（追加测试组） | 验证 autoExtend 后 `siyuan.rpc.broadcast('timer-expired')` 被调用第二次 |
| `src/kernel/webhook.ts` | 修改（删除 3 处） | 移除 `dispatchedNotificationIds` Set 及其去重检查 |

---

### 任务 1：编写失败测试 — autoExtend 后二次广播被吞

**文件：**
- 修改：`test/kernel/scheduler.notifiedTimerIds.test.ts`（在文件末尾追加新测试组）

- [ ] **步骤 1：编写失败的测试**

在 `test/kernel/scheduler.notifiedTimerIds.test.ts` 文件末尾（最后一个 `})` 之后）追加新测试组：

```typescript
describe('dispatchedNotificationIds 不应阻止 autoExtend 后的二次广播', () => {
  it('autoExtend 后第二次到期应再次调用 siyuan.rpc.broadcast', async () => {
    vi.useFakeTimers()

    // 使用真实的 dispatchNotification 实现（来自 webhook.ts），而非 vi.fn()
    // 这样才能覆盖 scheduler → webhook → siyuan.rpc.broadcast 的完整链路
    const { dispatchNotification } = await import('@/kernel/webhook')
    setDispatchNotification(dispatchNotification)

    const broadcastMock = vi.fn()
    ;(globalThis as any).siyuan = {
      rpc: { broadcast: broadcastMock },
    }

    const { initScheduler } = await import('@/kernel/scheduler')
    initScheduler()

    // 第一次到期：注册一个已过期的 timer
    const pastTime = Math.floor(Date.now() / 1000) - 1
    const entry: TimerEntry = {
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
      endTime: pastTime,
      metadata: {
        blockId: 'block-autoextend',
        content: 'autoextend test',
      },
      notified: false,
    }
    registerTimer(entry)

    // 推进 1 秒，让 checkTimers tick 一次
    vi.advanceTimersByTime(1000)

    // 验证：第一次广播已发出
    expect(broadcastMock).toHaveBeenCalledTimes(1)
    expect(broadcastMock).toHaveBeenCalledWith('timer-expired', expect.objectContaining({
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
    }))

    // 模拟 autoExtend：cancelTimer + 用相同 id 重新注册未来的 endTime
    cancelTimer('pomodoro-block-autoextend')
    const newFutureTime = Math.floor(Date.now() / 1000) + 2
    const newEntry: TimerEntry = {
      id: 'pomodoro-block-autoextend',
      type: 'pomodoro',
      endTime: newFutureTime,
      metadata: {
        blockId: 'block-autoextend',
        content: 'autoextend test',
      },
      notified: false,
    }
    registerTimer(newEntry)

    // 推进 3 秒，让 newEndTime 到期并被 checkTimers 检测到
    vi.advanceTimersByTime(3000)

    // 期望：autoExtend 后的第二次到期应再次广播（这是修复的目标）
    expect(broadcastMock).toHaveBeenCalledTimes(2)

    const { stopScheduler } = await import('@/kernel/scheduler')
    stopScheduler()
    vi.useRealTimers()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`

预期：FAIL。新增的测试失败，错误信息类似：

```
AssertionError: expected "broadcastMock" to be called 2 times, but was called 1 times
```

这证明：尽管 `scheduler.ts` 的 `notifiedTimerIds` 已被 `cancelTimer` 清理（scheduler 层的 `dispatchNotification` 被调用了第二次），但 `webhook.ts` 的 `dispatchedNotificationIds` 仍然记录着该 id，导致 `siyuan.rpc.broadcast` 第二次调用被静默吞掉。

如果测试通过（即 broadcast 被调用 2 次），说明根因不在 `dispatchedNotificationIds`，需要回到 brainstorming 重新调查。

---

### 任务 2：移除 `dispatchedNotificationIds` 冗余去重

**文件：**
- 修改：`src/kernel/webhook.ts:43` 和 `src/kernel/webhook.ts:50-55`

- [ ] **步骤 1：移除 Set 声明**

在 `src/kernel/webhook.ts` 中删除第 43 行：

```typescript
const dispatchedNotificationIds = new Set<string>()
```

删除后，`let instanceTag = ''`（第 44 行）紧接在 `reloadWebhookConfig` 函数之后。

- [ ] **步骤 2：移除 `dispatchNotification` 入口的去重检查**

在 `src/kernel/webhook.ts` 中，将 `dispatchNotification` 函数开头从：

```typescript
export function dispatchNotification(entry: TimerEntry): void {
  if (dispatchedNotificationIds.has(entry.id)) {
    console.log(`[webhook${instanceTag}] dispatch SKIP id=${entry.id} (already dispatched)`)
    return
  }
  dispatchedNotificationIds.add(entry.id)
  console.log(`[webhook${instanceTag}] dispatchNotification: type=${entry.type} id=${entry.id} webhookEnabled=${webhookConfig.enabled} channels=${webhookConfig.channels.length}`)
```

改为：

```typescript
export function dispatchNotification(entry: TimerEntry): void {
  console.log(`[webhook${instanceTag}] dispatchNotification: type=${entry.type} id=${entry.id} webhookEnabled=${webhookConfig.enabled} channels=${webhookConfig.channels.length}`)
```

- [ ] **步骤 3：运行任务 1 的测试验证通过**

运行：`npx vitest run test/kernel/scheduler.notifiedTimerIds.test.ts`

预期：PASS。所有测试组（包括新增的 autoExtend 二次广播测试）通过。

- [ ] **步骤 4：运行全量测试验证无回归**

运行：`npm run test`

预期：PASS。所有测试通过，无回归。

- [ ] **步骤 5：运行 lint 验证**

运行：`npm run lint`

预期：PASS。无 lint 错误（删除未使用的 Set 后不会有未使用变量警告）。

- [ ] **步骤 6：运行 typecheck 验证**

运行：`npm run typecheck`

预期：PASS。无类型错误。

- [ ] **步骤 7：Commit**

```powershell
git add src/kernel/webhook.ts test/kernel/scheduler.notifiedTimerIds.test.ts; git commit -m "fix(kernel): 移除 webhook.dispatchNotification 冗余去重，修复 autoExtend 后到期不广播`n`n`n根因：webhook.ts 的 dispatchedNotificationIds Set 永不清理，`n与 scheduler.ts 的 notifiedTimerIds 形成两层不同步的去重。`n`n移除冗余层后，notifiedTimerIds 成为单一去重源（single source of truth），`nautoExtend 通过 cancelTimer 清理 notifiedTimerIds 后，`n重新注册的 timer 到期能正常触发 siyuan.rpc.broadcast。`n`n新增覆盖完整链路（scheduler → webhook → broadcast）的回归测试。"
```

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 |
|---------|---------|
| 根因（双去重 Set 不同步） | 任务 1 测试复现 + 任务 2 移除冗余 Set |
| 设计：移除 `dispatchedNotificationIds` | 任务 2 步骤 1-2 |
| 测试策略：TDD 失败测试 | 任务 1 |
| 测试策略：现有测试不受影响 | 任务 2 步骤 4（全量测试） |
| 风险评估：不引入重复广播 | 由 `notifiedTimerIds` 的现有测试组覆盖 |
| YAGNI 说明 | 任务 2 移除冗余代码 |

无遗漏。

### 2. 占位符扫描

- 无"待定"、"TODO"、"后续实现"
- 所有代码步骤都包含完整代码
- 命令和预期输出都精确给出

### 3. 类型一致性

- `TimerEntry` 类型在任务 1 测试中复用现有导入（文件顶部已导入）
- `dispatchNotification` 函数签名 `(entry: TimerEntry) => void` 与 `setDispatchNotification` 期望的类型一致
- `siyuan.rpc.broadcast` 的 mock 签名与现有 autoExtend 测试组一致

无类型不一致。
