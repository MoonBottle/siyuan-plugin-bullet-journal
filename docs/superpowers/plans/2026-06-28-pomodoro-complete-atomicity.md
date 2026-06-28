# 番茄钟完成流程原子性修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `completePomodoro` 的并发缺陷——内核倒计时到期后「UI 停在 0 秒、专注状态不清空、却推送了完成通知」。

**架构：** 把 `completePomodoro` 的「清空 activePomodoro + stopTimer」从 `await` 之后移到之前（同步区），后续异步逻辑全部用快照 `ap` 和已构建的 `pending`。这样切断 setInterval 并发源，并激活已有的 L578 重入防线。严格遵循 spec：内核可用时前端 setInterval 只更新 UI，到期仅由 KERNEL_NOTIFICATION 触发完成。

**技术栈：** Vue 3.5 + Pinia 3 + TypeScript + Vitest

**规格：** [2026-06-28-pomodoro-complete-atomicity-design.md](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/docs/superpowers/specs/2026-06-28-pomodoro-complete-atomicity-design.md)

---

## 文件结构

| 文件 | 职责 | 本次操作 |
|------|------|---------|
| `src/stores/pomodoroStore.ts` | 番茄钟状态管理（`completePomodoro` action） | 修改：原子化 completePomodoro |
| `test/stores/pomodoroStore.test.ts` | pomodoroStore 单元测试 | 修改：新增重入保护测试 |

---

## 任务 1：重入保护测试（RED）

**文件：**
- 修改：`test/stores/pomodoroStore.test.ts`（在 `completePomodoro durationMinutes` describe 块末尾追加）

- [ ] **步骤 1：编写失败的测试**

在 `test/stores/pomodoroStore.test.ts` 的 `describe('pomodoroStore completePomodoro durationMinutes', ...)` 块内，最后一个 `it` 之后追加：

```typescript
  it('completePomodoro 重入保护：并发第二次调用返回 false 且不重复保存', async () => {
    const store = usePomodoroStore()
    const plugin = { isMobile: false }

    store.$patch({
      activePomodoro: {
        blockId: 'block-reentry',
        rootId: 'doc-reentry',
        itemId: 'item-reentry',
        itemContent: '重入测试',
        startTime: new Date('2026-06-28T10:00:00').getTime(),
        accumulatedSeconds: 120,
        remainingSeconds: 0,
        targetDurationMinutes: 2,
        isPaused: false,
        pauseCount: 0,
        totalPausedSeconds: 0,
        timerMode: 'countdown',
      } as any,
      timerInterval: 1,
    })

    mockSavePendingCompletion.mockClear()

    // 并发触发两次 completePomodoro（模拟内核广播 + 手动结束同时发生）
    const [result1, result2] = await Promise.all([
      store.completePomodoro(plugin as any),
      store.completePomodoro(plugin as any),
    ])

    // 第一次成功，第二次被重入防线拦截
    expect(result1).toBe(true)
    expect(result2).toBe(false)
    // savePendingCompletion 只被调用一次（重入保护生效）
    expect(mockSavePendingCompletion).toHaveBeenCalledTimes(1)
    // 状态已清空
    expect(store.activePomodoro).toBeNull()
    expect(store.timerInterval).toBeNull()
  })
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/stores/pomodoroStore.test.ts -t "重入保护"`

预期：FAIL。当前代码中 `stopTimer()` 和 `activePomodoro = null` 在 `await` 之后，第二次调用进入时 `activePomodoro` 仍非空，导致两次都尝试执行完整流程。`result2` 不为 false，或 `savePendingCompletion` 被调用两次，或因并发状态污染报错。

- [ ] **步骤 3：（此任务无实现代码，仅测试。实现见任务 2）**

先确认测试失败，然后进入任务 2 的实现。

---

## 任务 2：completePomodoro 原子化（GREEN）

**文件：**
- 修改：`src/stores/pomodoroStore.ts:577-668`（`completePomodoro` action）

- [ ] **步骤 1：实现原子化改造**

将 `src/stores/pomodoroStore.ts` 中的 `completePomodoro` action（第 577-668 行）替换为以下内容。**关键变化：`stopTimer()` + `activePomodoro = null` 移到 `await` 之前；pending 在清空前用 ap 构建。**

改前（第 586-662 行的 try 块）：
```typescript
      try {
        const ap = this.activePomodoro
        const now = Date.now()
        // 同步累计秒数到当前时刻（内联实现，不复用 updateTimer 以避免触发完成检查/TICK 的递归）
        if (this.timerStartTimestamp != null && !ap.isPaused) {
          const elapsedSeconds = Math.floor((now - this.timerStartTimestamp) / 1000)
          ap.accumulatedSeconds = this.lastAccumulatedSeconds + elapsedSeconds
        }
        const actualMinutes = Math.round(ap.accumulatedSeconds / 60)
        cancelMobileFocusEnd()

        if (kernelAvailable.value && ap.blockId) {
          usePlugin()!.kernel!.rpc.call.cancelTimer({ id: `pomodoro-${ap.blockId}` }).catch(() => {})
        }

        // 1. 构建并持久化待完成记录
        const pending: PendingPomodoroCompletion = {
          blockId: ap.blockId,
          rootId: ap.rootId, // 传递文档ID
          itemId: ap.itemId,
          itemContent: ap.itemContent,
          startTime: ap.startTime,
          endTime: now,
          accumulatedSeconds: ap.accumulatedSeconds,
          durationMinutes: actualMinutes,
          projectId: ap.projectId,
          projectName: ap.projectName,
          projectLinks: ap.projectLinks,
          taskId: ap.taskId,
          taskName: ap.taskName,
          taskLevel: ap.taskLevel,
          taskLinks: ap.taskLinks,
          itemStatus: ap.itemStatus,
          itemLinks: ap.itemLinks,
          timerMode: ap.timerMode,
        }

        const saved = await savePendingCompletion(pluginToUse, pending)
        if (!saved) {
          showMessage('❌ 保存待完成记录失败', 'error')
          return false
        }

        // 2. 删除进行中文件
        await removeActivePomodoro(pluginToUse)

        // 3. 清理状态
        this.stopTimer()
        this.activePomodoro = null

        // 3.5 触发完成事件，通知悬浮窗和底栏隐藏
        eventBus.emit(Events.POMODORO_COMPLETED)

        // 4. 播放提示音
        this.playNotificationSound()

        // 5. 系统通知（此时用户可能在其他应用，提醒回来补填说明）
        void showPomodoroCompleteNotification(ap.itemContent, actualMinutes, () => {
          if (typeof window !== 'undefined' && (window as any).require) {
            try {
              const { ipcRenderer } = (window as any).require('electron')
              ipcRenderer.send('focus-window')
            } catch {
              // 忽略
            }
          }
        }).catch((error) => {
          console.error('[Pomodoro] 显示完成通知失败:', error)
        })

        // 6. 触发弹窗（由监听器显示完成弹窗）
        eventBus.emit(Events.POMODORO_PENDING_COMPLETION, pending)

        // 启动自动延迟倒计时（如果开启）
        this.scheduleAutoExtend(pluginToUse)

        return true
      } catch (error) {
        console.error('[Pomodoro] 完成专注失败:', error)
        showMessage('❌ 完成专注失败', 'error')
        return false
      }
```

改后：
```typescript
      try {
        const ap = this.activePomodoro
        const now = Date.now()
        // 同步累计秒数到当前时刻（内联实现，不复用 updateTimer 以避免触发完成检查/TICK 的递归）
        if (this.timerStartTimestamp != null && !ap.isPaused) {
          const elapsedSeconds = Math.floor((now - this.timerStartTimestamp) / 1000)
          ap.accumulatedSeconds = this.lastAccumulatedSeconds + elapsedSeconds
        }
        const actualMinutes = Math.round(ap.accumulatedSeconds / 60)
        cancelMobileFocusEnd()

        if (kernelAvailable.value && ap.blockId) {
          usePlugin()!.kernel!.rpc.call.cancelTimer({ id: `pomodoro-${ap.blockId}` }).catch(() => {})
        }

        // 1. 构建 pending（在清空 activePomodoro 之前，用 ap 快照构建）
        const pending: PendingPomodoroCompletion = {
          blockId: ap.blockId,
          rootId: ap.rootId, // 传递文档ID
          itemId: ap.itemId,
          itemContent: ap.itemContent,
          startTime: ap.startTime,
          endTime: now,
          accumulatedSeconds: ap.accumulatedSeconds,
          durationMinutes: actualMinutes,
          projectId: ap.projectId,
          projectName: ap.projectName,
          projectLinks: ap.projectLinks,
          taskId: ap.taskId,
          taskName: ap.taskName,
          taskLevel: ap.taskLevel,
          taskLinks: ap.taskLinks,
          itemStatus: ap.itemStatus,
          itemLinks: ap.itemLinks,
          timerMode: ap.timerMode,
        }

        // 2. 同步区：立即切断并发源（停 setInterval）+ 清空状态（激活 L578 重入防线）
        //    必须在 await 之前完成，避免 await 挂起期间 setInterval 污染状态或并发调用绕过守卫
        this.stopTimer()
        this.activePomodoro = null

        // 3. 异步区：以下全部用 ap 快照和 pending，不读 this.activePomodoro
        const saved = await savePendingCompletion(pluginToUse, pending)
        if (!saved) {
          showMessage('❌ 保存待完成记录失败', 'error')
          return false
        }

        // 4. 删除进行中文件
        await removeActivePomodoro(pluginToUse)

        // 5. 触发完成事件，通知悬浮窗和底栏隐藏
        eventBus.emit(Events.POMODORO_COMPLETED)

        // 6. 播放提示音
        this.playNotificationSound()

        // 7. 系统通知（此时用户可能在其他应用，提醒回来补填说明）
        void showPomodoroCompleteNotification(ap.itemContent, actualMinutes, () => {
          if (typeof window !== 'undefined' && (window as any).require) {
            try {
              const { ipcRenderer } = (window as any).require('electron')
              ipcRenderer.send('focus-window')
            } catch {
              // 忽略
            }
          }
        }).catch((error) => {
          console.error('[Pomodoro] 显示完成通知失败:', error)
        })

        // 8. 触发弹窗（由监听器显示完成弹窗）
        eventBus.emit(Events.POMODORO_PENDING_COMPLETION, pending)

        // 9. 启动自动延迟倒计时（如果开启）
        this.scheduleAutoExtend(pluginToUse)

        return true
      } catch (error) {
        console.error('[Pomodoro] 完成专注失败:', error)
        showMessage('❌ 完成专注失败', 'error')
        return false
      }
```

- [ ] **步骤 2：运行重入测试验证通过**

运行：`npx vitest run test/stores/pomodoroStore.test.ts -t "重入保护"`

预期：PASS。第一次 `completePomodoro` 在同步区立即清空 `activePomodoro`，第二次调用进入时 L578 守卫 `if (!this.activePomodoro) return false` 拦截，返回 false。`savePendingCompletion` 只被调一次。

- [ ] **步骤 3：运行完整测试文件验证无回归**

运行：`npx vitest run test/stores/pomodoroStore.test.ts`

预期：PASS（全部测试通过，含已有的「倒计时到期时 completePomodoro 能正常结束专注」「时长正确」等回归测试）。

---

## 任务 3：全量验证 + Commit

- [ ] **步骤 1：运行全量测试**

运行：`npm run test`

预期：所有测试通过（1914+ passed | 48 skipped），含新增的重入保护测试。

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`

预期：clean（无错误无警告）。

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`

预期：clean（无错误）。

- [ ] **步骤 4：Commit**

```bash
git add src/stores/pomodoroStore.ts test/stores/pomodoroStore.test.ts docs/superpowers/specs/2026-06-28-pomodoro-complete-atomicity-design.md docs/superpowers/plans/2026-06-28-pomodoro-complete-atomicity.md
git commit -m "fix(pomodoro): completePomodoro 原子化修复并发缺陷

将 stopTimer + activePomodoro=null 从 await 之后移到之前（同步区），
切断 setInterval 并发源并激活 L578 重入防线。
修复内核倒计时到期后「UI 停 0 秒、专注不清空、却推通知」的不一致。

新增重入保护测试：并发第二次调用返回 false 且不重复保存。"
```

注意：PowerShell 不支持 heredoc，commit message 用单行或 `-m` 多个参数。实际命令：
```bash
git add src/stores/pomodoroStore.ts test/stores/pomodoroStore.test.ts docs/superpowers/specs/2026-06-28-pomodoro-complete-atomicity-design.md docs/superpowers/plans/2026-06-28-pomodoro-complete-atomicity.md; git commit -m "fix(pomodoro): completePomodoro 原子化修复并发缺陷`n`n将 stopTimer + activePomodoro=null 从 await 之后移到之前（同步区），切断 setInterval 并发源并激活 L578 重入防线。修复内核倒计时到期后 UI 停 0 秒、专注不清空、却推通知的不一致。新增重入保护测试。"
```

---

## 自检

**1. 规格覆盖度：**
- 改造点 1（completePomodoro 原子化）→ 任务 2 ✓
- 改造点 2（updateTimer 完成分支）→ 无需改动，规格已确认 ✓
- 改造点 3（内核广播监听器）→ 无需改动，规格已确认 ✓
- 改造点 4（测试）→ 任务 1 ✓
- 验证步骤 → 任务 3 ✓

**2. 占位符扫描：** 无 TODO/待定，所有步骤含完整代码块。✓

**3. 类型一致性：** `PendingPomodoroCompletion` 类型、`ap`/`pending`/`pluginToUse`/`actualMinutes` 变量名在测试与实现中一致。`stopTimer`/`activePomodoro`/`timerInterval` 属性名与现有代码一致。✓
