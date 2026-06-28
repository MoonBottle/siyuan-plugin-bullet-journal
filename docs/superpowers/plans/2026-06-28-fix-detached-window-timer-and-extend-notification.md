# 桌面悬浮窗倒计时与延长通知修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复桌面端 detached 悬浮窗在主窗口最小化时倒计时停止刷新的问题，以及 autoExtendPomodoro 漏注册内核 timer 导致延长后无完成通知的问题。

**架构：** 问题 1 通过在 detached 窗口 HTML 内置本地计时器（基于 deadlineTimestamp）实现自主刷新；问题 3 通过抽取 registerKernelPomodoroTimer 公共 helper 并在 autoExtendPomodoro 中调用来补全链路。

**技术栈：** TypeScript、Vue 3 + Pinia、Vitest、Electron BrowserWindow、思源 kernel plugin RPC

---

## 文件结构

| 文件 | 职责 | 类型 |
|------|------|------|
| `src/utils/floatingPomodoroViewState.ts` | 扩展 ViewState 接口与构造函数，新增 deadlineTimestamp | 修改 |
| `src/utils/detachedPomodoroWindow.ts` | Payload 携带 deadlineTimestamp；detached HTML 内置本地计时器 | 修改 |
| `src/stores/pomodoroStore.ts` | 抽 registerKernelPomodoroTimer helper；autoExtendPomodoro 补注册 | 修改 |
| `test/utils/detachedPomodoroWindow.test.ts` | 验证 payload 含 deadlineTimestamp、HTML 脚本含本地计时关键字 | 扩展 |
| `test/utils/floatingPomodoroViewState.test.ts` | 验证 buildFloatingPomodoroViewState 计算 deadlineTimestamp | 新建或扩展 |
| `test/stores/pomodoroStore.test.ts` | 验证 autoExtendPomodoro 调用 registerTimer/cancelTimer | 扩展 |

---

## 任务 1：扩展 FloatingPomodoroViewState 接口与构造逻辑

**文件：**
- 修改：`src/utils/floatingPomodoroViewState.ts`
- 测试：`test/utils/floatingPomodoroViewState.test.ts`（如不存在则新建）

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/floatingPomodoroViewState.test.ts` 中新增（若文件不存在则创建）：

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildFloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState'

const labels = {
  focusing: '专注中',
  paused: '已暂停',
  breaking: '休息中',
  pause: '暂停',
  resume: '继续',
  endFocus: '结束',
  skipBreak: '跳过休息',
  unknownItem: '未知事项',
}

describe('buildFloatingPomodoroViewState deadlineTimestamp', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-06-28T10:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('focus 阶段计算 deadlineTimestamp', () => {
    const state = buildFloatingPomodoroViewState({
      phase: 'focus',
      remainingSeconds: 1500,
      accumulatedSeconds: 0,
      isPaused: false,
      labels,
      timerMode: 'countdown',
      targetDurationMinutes: 25,
    })
    expect(state.phase).toBe('focus')
    expect(state.deadlineTimestamp).toBe(Date.now() + 1500 * 1000)
  })

  it('break 阶段计算 deadlineTimestamp', () => {
    const state = buildFloatingPomodoroViewState({
      phase: 'break',
      remainingSeconds: 300,
      breakDurationSeconds: 300,
      labels,
    })
    expect(state.phase).toBe('break')
    expect(state.deadlineTimestamp).toBe(Date.now() + 300 * 1000)
  })

  it('暂停状态也携带 deadlineTimestamp', () => {
    const state = buildFloatingPomodoroViewState({
      phase: 'focus',
      remainingSeconds: 1500,
      accumulatedSeconds: 0,
      isPaused: true,
      labels,
      timerMode: 'countdown',
      targetDurationMinutes: 25,
    })
    expect(state.isPaused).toBe(true)
    expect(state.deadlineTimestamp).toBe(Date.now() + 1500 * 1000)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/floatingPomodoroViewState.test.ts`
预期：FAIL，`state.deadlineTimestamp` 为 `undefined`

- [ ] **步骤 3：实现接口扩展和构造逻辑**

在 `src/utils/floatingPomodoroViewState.ts` 中：

1. 在 `FloatingPomodoroViewStateBase` 接口末尾新增字段：`deadlineTimestamp?: number`
2. 在 `buildFloatingPomodoroViewState` 函数的 break 分支 `return {` 对象中，在 `isPaused: false,` 之前新增：`deadlineTimestamp: Date.now() + remainingSeconds * 1000,`
3. 在 focus 分支 `return {` 对象中，在 `isPaused: source.isPaused,` 之前新增：`deadlineTimestamp: Date.now() + remainingSeconds * 1000,`

注意：focus 分支中 `remainingSeconds` 在函数体第 90 行已定义；break 分支中 `remainingSeconds` 在第 68 行定义。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/floatingPomodoroViewState.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/floatingPomodoroViewState.ts test/utils/floatingPomodoroViewState.test.ts
git commit -m "feat(pomodoro): ViewState 新增 deadlineTimestamp 字段供 detached 窗口本地计时"
```

## 任务 2：detached 窗口 payload 携带 deadlineTimestamp

**文件：**
- 修改：`src/utils/detachedPomodoroWindow.ts`
- 测试：`test/utils/detachedPomodoroWindow.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/detachedPomodoroWindow.test.ts` 文件末尾（最后一个 `})` 之前）新增：

```ts
it('payload 携带 deadlineTimestamp 字段', () => {
  document.documentElement.style.setProperty('--b3-theme-surface', '#ffffff')
  const executeJavaScript = vi.fn()
  const BrowserWindow = vi.fn<any>().mockImplementation(class {
    loadURL = vi.fn()
    showInactive = vi.fn()
    show = vi.fn()
    close = vi.fn()
    isDestroyed = vi.fn(() => false)
    isVisible = vi.fn(() => true)
    webContents = { executeJavaScript, on: vi.fn() }
    on = vi.fn()
    once = vi.fn()
    setAlwaysOnTop = vi.fn()
    setPosition = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
  })
  ;(BrowserWindow as any).getAllWindows = vi.fn(() => [])

  const host = createDetachedPomodoroWindowHost({
    frontEnd: 'desktop',
    runtimeRequire: () => ({ BrowserWindow }),
    createMarkup: () => '<div class="floating-tomato-shell"></div>',
    applyViewState: vi.fn(),
    onAction: vi.fn(),
  })

  host.show({ ...focusState, deadlineTimestamp: 1234567890 })

  expect(executeJavaScript).toHaveBeenCalledWith(
    expect.stringContaining('"deadlineTimestamp":1234567890'),
  )
})
```

注意：`focusState` 在文件第 16 行已定义，用 spread 追加字段。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/detachedPomodoroWindow.test.ts`
预期：FAIL，`executeJavaScript` 调用参数中不含 `deadlineTimestamp`

- [ ] **步骤 3：扩展 RenderedPayload 接口和 renderPayload 函数**

在 `src/utils/detachedPomodoroWindow.ts` 中：

1. 找到 `interface RenderedPayload`（约第 655 行），在 `state: {` 块内的 `isPaused: boolean,` 之后新增：`deadlineTimestamp?: number`
2. 找到 `renderPayload` 函数（约第 183 行），在 `state: {` 对象的 `isPaused: state.isPaused,` 之后新增：`deadlineTimestamp: state.deadlineTimestamp,`

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/detachedPomodoroWindow.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/detachedPomodoroWindow.ts test/utils/detachedPomodoroWindow.test.ts
git commit -m "feat(pomodoro): detached 窗口 payload 携带 deadlineTimestamp"
```
## 任务 3：detached 窗口 HTML 内置本地计时器

**文件：**
- 修改：`src/utils/detachedPomodoroWindow.ts`（`buildDetachedWindowHtml` 函数内 `<script>` 标签）
- 测试：`test/utils/detachedPomodoroWindow.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/detachedPomodoroWindow.test.ts` 中新增测试，断言 HTML 字符串包含本地计时器关键字：

```ts
it('detached 窗口 HTML 内置本地计时器脚本', () => {
  document.documentElement.style.setProperty('--b3-theme-surface', '#ffffff')
  const loadURL = vi.fn()
  const BrowserWindow = vi.fn<any>().mockImplementation(class {
    loadURL = loadURL
    showInactive = vi.fn()
    show = vi.fn()
    close = vi.fn()
    isDestroyed = vi.fn(() => false)
    isVisible = vi.fn(() => true)
    webContents = { executeJavaScript: vi.fn(), on: vi.fn() }
    on = vi.fn()
    once = vi.fn()
    setAlwaysOnTop = vi.fn()
    setPosition = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
  })
  ;(BrowserWindow as any).getAllWindows = vi.fn(() => [])

  const host = createDetachedPomodoroWindowHost({
    frontEnd: 'desktop',
    runtimeRequire: () => ({ BrowserWindow }),
    createMarkup: () => '<div class="floating-tomato-shell"></div>',
    applyViewState: vi.fn(),
    onAction: vi.fn(),
  })

  host.show(focusState)

  expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('countdownDeadline')))
  expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('tickClock')))
  expect(loadURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('setInterval(tickClock')))
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/detachedPomodoroWindow.test.ts`
预期：FAIL，HTML 字符串中不含 `countdownDeadline`、`tickClock` 等关键字

- [ ] **步骤 3：在 detached HTML 的 IIFE 内新增本地计时器**

打开 `src/utils/detachedPomodoroWindow.ts`，定位到 `buildDetachedWindowHtml` 函数中 `<script>` 标签内（约第 546 行 `(() => {`）。

在 `let currentState = { phase: 'focus', isPaused: false };`（约第 550 行）之后，新增：

```js
        let countdownDeadline = null;
        let countdownIntervalId = null;
        const formatClockFromDeadline = () => {
          if (countdownDeadline === null || !Number.isFinite(countdownDeadline)) return null;
          const diffMs = countdownDeadline - Date.now();
          if (diffMs <= 0) return '00:00';
          const totalSec = Math.floor(diffMs / 1000);
          const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
          const ss = String(totalSec % 60).padStart(2, '0');
          return mm + ':' + ss;
        };
        const tickClock = () => {
          if (currentState.isPaused) return;
          const text = formatClockFromDeadline();
          if (text === null) return;
          const el = document.querySelector('.floating-tomato-primary');
          if (el) el.textContent = text;
        };
        const startLocalTimer = () => {
          if (countdownIntervalId !== null) return;
          countdownIntervalId = setInterval(tickClock, 1000);
        };
```

然后找到 `window.${UPDATE_FN} = (payload) => {` 函数（约第 588 行），在 `currentState = payload.state || currentState;` 之后（约第 601 行），新增：

```js
          countdownDeadline = (payload.state && typeof payload.state.deadlineTimestamp === 'number')
            ? payload.state.deadlineTimestamp
            : null;
          startLocalTimer();
          tickClock();
```

关键设计点：
- `countdownDeadline` 为 null 或非有限数字时 `formatClockFromDeadline` 返回 null，`tickClock` 不修改 DOM（保留主窗口 payload 传入的 primaryText）
- `currentState.isPaused` 为 true 时 `tickClock` 直接 return（暂停态不刷倒计时）
- `startLocalTimer` 仅在首次调用时创建 interval，后续幂等
- 不需要 stopLocalTimer：detached 窗口关闭时整个渲染进程上下文销毁，interval 自动清理

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/detachedPomodoroWindow.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/detachedPomodoroWindow.ts test/utils/detachedPomodoroWindow.test.ts
git commit -m "fix(pomodoro): detached 窗口新增本地计时器避免主窗口最小化时倒计时冻结"
```

## 任务 4：抽取 registerKernelPomodoroTimer 公共 helper

**文件：**
- 修改：`src/stores/pomodoroStore.ts`
- 测试：无新增（纯重构，由任务 5/6 的测试覆盖回归）

- [ ] **步骤 1：新增 helper 函数**

在 `src/stores/pomodoroStore.ts` 中，定位到文件顶部模块级函数区（约第 73 行 `function isMobilePomodoroNotificationsEnabled` 之前），新增：

```ts
function registerKernelPomodoroTimer(
  blockId: string,
  remainingSeconds: number,
  metadata: {
    content: string
    projectName?: string
    taskName?: string
  },
): void {
  if (!kernelAvailable.value)
    return
  const endTime = Math.floor((Date.now() + remainingSeconds * 1000) / 1000)
  usePlugin()!.kernel!.rpc.call.registerTimer({
    id: `pomodoro-${blockId}`,
    type: 'pomodoro',
    endTime,
    metadata: {
      blockId,
      content: metadata.content,
      projectName: metadata.projectName,
      taskName: metadata.taskName,
    },
  }).catch(() => {})
}
```

注意：`kernelAvailable` 已在文件第 17 行 import；`usePlugin` 已在第 19 行 import。无需新增 import。

- [ ] **步骤 2：替换 startPomodoro 中的重复代码**

定位 `startPomodoro` 方法（约第 246-267 行）。将 `if (kernelAvailable.value && timerMode === 'countdown') { ... } else { ... }` 整块替换为：

```ts
        console.log(`[Pomodoro] kernelAvailable=${kernelAvailable.value} timerMode=${timerMode} durationMinutes=${durationMinutes}`)
        if (timerMode === 'countdown') {
          registerKernelPomodoroTimer(parentBlockId, durationMinutes * 60, {
            content: item.content,
            projectName: item.project?.name,
            taskName: item.task?.name,
          })
        }
```

删除原 `console.log(\`[Pomodoro] skipping kernel timer...\`)` 的 else 分支。

- [ ] **步骤 3：替换 resumePomodoro 中的重复代码**

定位 `resumePomodoro` 方法（约第 357-371 行）的 `if (kernelAvailable.value && this.activePomodoro?.blockId && ...) { ... }` 块。替换为：

```ts
        if (this.activePomodoro?.blockId && this.activePomodoro.timerMode === 'countdown') {
          registerKernelPomodoroTimer(
            this.activePomodoro.blockId,
            this.activePomodoro.remainingSeconds,
            {
              content: this.activePomodoro.itemContent,
              projectName: this.activePomodoro.projectName,
              taskName: this.activePomodoro.taskName,
            },
          )
        }
```

- [ ] **步骤 4：替换 restorePomodoro 中的重复代码**

定位 `restorePomodoro` 方法（约第 958-971 行）的 `if (kernelAvailable.value && data.timerMode !== 'stopwatch') { ... }` 块。替换为：

```ts
          if (data.timerMode !== 'stopwatch') {
            registerKernelPomodoroTimer(data.blockId, remainingSeconds, {
              content: data.itemContent,
              projectName: data.projectName,
              taskName: data.taskName,
            })
          }
```

注意：`remainingSeconds` 变量在该方法第 936 行已定义。

- [ ] **步骤 5：运行全量测试验证回归**

运行：`npm run test`
预期：所有现有测试 PASS（此任务是纯重构，不应有测试失败）

- [ ] **步骤 6：Commit**

```bash
git add src/stores/pomodoroStore.ts
git commit -m "refactor(pomodoro): 抽取 registerKernelPomodoroTimer 消除三处重复注册逻辑"
```
## 任务 5：编写 autoExtendPomodoro 注册 timer 的失败测试

**文件：**
- 测试：`test/stores/pomodoroStore.test.ts`

注意：`pomodoroStore.test.ts` 当前未 mock `@/composables/useKernelTimer`，默认 `kernelAvailable` 为 `false`（由 `useKernelTimer.ts` 导出的 `ref(false)` 初始值决定）。为测试 kernel 可用场景，需在测试文件顶部新增 mock。

- [ ] **步骤 1：在测试文件顶部新增 kernel mock**

在 `test/stores/pomodoroStore.test.ts` 中，定位到现有 `vi.mock('@/main', ...)`（约第 52 行）。

首先在文件顶部 import 区（约第 4-17 行的 vitest import 之后）新增：

```ts
import { ref } from 'vue'
```

然后替换原 `vi.mock('@/main', ...)` 为：

```ts
const mockKernelAvailable = ref(false)
const mockRegisterTimer = vi.fn().mockResolvedValue({ ok: true })
const mockCancelTimer = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({
    kernel: {
      rpc: {
        call: {
          registerTimer: mockRegisterTimer,
          cancelTimer: mockCancelTimer,
          cancelTimersByType: vi.fn().mockResolvedValue({ ok: true }),
        },
      },
    },
  })),
}))

vi.mock('@/composables/useKernelTimer', () => ({
  kernelAvailable: mockKernelAvailable,
}))
```

说明：现有测试中 `usePlugin` 返回 `{}`，旧代码因 `kernelAvailable.value` 默认 false 不会触发 kernel 调用，所以原来不会报错。mock 增强后更安全，且让任务 5/6 的测试能控制 kernelAvailable。

- [ ] **步骤 2：新增 autoExtendPomodoro 注册 timer 的失败测试**

在 `describe('pomodoroStore autoExtendPomodoro', ...)` 块（约第 504 行）末尾（最后一个 `it` 之后、`})` 之前）新增两个测试：

```ts
  it('kernel 可用时注册新 timer 并取消旧 timer', async () => {
    mockKernelAvailable.value = true
    mockRegisterTimer.mockClear()
    mockCancelTimer.mockClear()
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b1',
      itemId: 'i1',
      itemContent: '测试事项',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    expect(mockCancelTimer).toHaveBeenCalledWith({ id: 'pomodoro-b1' })
    expect(mockRegisterTimer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pomodoro-b1',
      type: 'pomodoro',
    }))
    const callArg = mockRegisterTimer.mock.calls[0][0]
    expect(callArg.endTime).toBeCloseTo(Math.floor((Date.now() + 5 * 60 * 1000) / 1000), -1)
    mockKernelAvailable.value = false
  })

  it('kernel 不可用时不调用 registerTimer', async () => {
    mockKernelAvailable.value = false
    mockRegisterTimer.mockClear()
    const store = usePomodoroStore()
    mockLoadPendingCompletion.mockResolvedValue({
      blockId: 'b2',
      itemId: 'i2',
      itemContent: '测试事项',
      startTime: new Date('2026-05-07T05:35:00').getTime(),
      accumulatedSeconds: 25 * 60,
      durationMinutes: 25,
      timerMode: 'countdown',
    } as any)

    await store.autoExtendPomodoro({
      isMobile: true,
      getSettings: () => ({ pomodoro: { autoExtendMinutes: 5 } }),
    } as any)

    expect(mockRegisterTimer).not.toHaveBeenCalled()
  })
```

说明：`toBeCloseTo(value, -1)` 允许 10 秒级误差。如测试仍不稳定，可放宽到 `-2`（100 秒）。

- [ ] **步骤 3：运行测试验证失败**

运行：`npx vitest run test/stores/pomodoroStore.test.ts`
预期：FAIL，`mockRegisterTimer` 未被调用（autoExtendPomodoro 还没添加注册逻辑）

- [ ] **步骤 4：Commit（测试先行）**

```bash
git add test/stores/pomodoroStore.test.ts
git commit -m "test(pomodoro): 新增 autoExtendPomodoro 注册内核 timer 的失败测试"
```

## 任务 6：autoExtendPomodoro 补注册内核 timer

**文件：**
- 修改：`src/stores/pomodoroStore.ts`（`autoExtendPomodoro` 方法）

- [ ] **步骤 1：在 autoExtendPomodoro 中补注册逻辑**

定位 `src/stores/pomodoroStore.ts` 中的 `async autoExtendPomodoro(plugin: any)` 方法（约第 817 行）。

找到 `this.startTimer()` 这一行（约第 867 行），在其之前新增取消旧 timer 逻辑，在其之后新增注册新 timer 调用。修改后相关代码段应为：

```ts
        const remainingSeconds = newTargetMinutes * 60 - pending.accumulatedSeconds
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds,
        }

        if (kernelAvailable.value && pending.blockId) {
          usePlugin()!.kernel!.rpc.call.cancelTimer({ id: `pomodoro-${pending.blockId}` }).catch(() => {})
        }

        this.startTimer()
        await scheduleMobileFocusEnd(this)

        registerKernelPomodoroTimer(pending.blockId, remainingSeconds, {
          content: pending.itemContent ?? '',
          projectName: pending.projectName,
          taskName: pending.taskName,
        })

        this.autoExtendCount++
```

关键点：
- `cancelTimer` 显式调用是保险措施（id 相同会被 registerTimer 覆盖，但显式取消更稳）
- `registerKernelPomodoroTimer` 在 `kernelAvailable=false` 时内部直接 return，安全
- `remainingSeconds` 在该行之前刚定义，直接复用

- [ ] **步骤 2：运行测试验证通过**

运行：`npx vitest run test/stores/pomodoroStore.test.ts`
预期：PASS，任务 5 新增的两个测试都通过

- [ ] **步骤 3：Commit**

```bash
git add src/stores/pomodoroStore.ts
git commit -m "fix(pomodoro): autoExtendPomodoro 补注册内核 timer 修复延长后无完成通知"
```

## 任务 7：全量验证

**文件：** 无代码改动，仅运行验证命令

- [ ] **步骤 1：运行全量测试**

运行：`npm run test`
预期：所有测试 PASS，无失败

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误（warning 可接受，但本次改动不应引入新 warning）

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：无类型错误

- [ ] **步骤 4：手动验收（可选，需思源桌面端环境）**

参照规格文档 `docs/superpowers/specs/2026-06-28-fix-detached-window-timer-and-extend-notification-design.md` 中的「手动验收」章节执行。

---

## 自检结果

**1. 规格覆盖度：**
- 规格第 1 节「ViewState 扩展」 → 任务 1 覆盖
- 规格第 2.1 节「Payload 扩展」 → 任务 2 覆盖
- 规格第 2.2 节「HTML 内脚本增强」 → 任务 3 覆盖
- 规格第 3 节「抽公共 Helper」 → 任务 4 覆盖
- 规格第 4 节「autoExtendPomodoro 补注册」 → 任务 5（测试）+ 任务 6（实现）覆盖
- 规格「错误处理」 → 任务 3 边界处理（非法 deadline）、任务 4 helper（kernelAvailable=false return）、任务 6 cancelTimer no-op 覆盖
- 规格「测试计划」单元测试 → 任务 1/2/3/5 覆盖；回归测试 → 任务 4 步骤 5 覆盖

**2. 占位符扫描：** 无 TODO、无"待定"、所有代码块完整

**3. 类型一致性：** `deadlineTimestamp?: number` 在任务 1（接口）、任务 2（payload）、任务 3（脚本）中拼写一致；`registerKernelPomodoroTimer` 在任务 4（定义）、任务 6（调用）中签名一致