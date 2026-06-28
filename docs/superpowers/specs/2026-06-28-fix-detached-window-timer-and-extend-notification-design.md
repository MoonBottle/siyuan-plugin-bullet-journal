# 桌面悬浮窗倒计时与延长通知修复设计

## 背景

桌面端 detached 番茄钟悬浮窗（由 `src/utils/detachedPomodoroWindow.ts` 创建的独立 BrowserWindow）存在两个独立缺陷：

1. **思源主窗口最小化时悬浮窗倒计时停止刷新**：悬浮窗自身已设置 `backgroundThrottling: false` 不被节流，但它没有自主计时能力，每秒 UI 更新完全依赖主窗口 `pomodoroStore` 的 `setInterval` 通过 `executeJavaScript` 注入 payload 推送。主窗口最小化后 Chromium 会把后台窗口 timer 节流到约 1 分钟/次，TICK 推送停摆，悬浮窗显示冻结。时间本身没丢（`updateTimer` 用 `Date.now()` 差值计算），但最小化期间显示错误。
2. **倒计时延长后结束无通知**：`pomodoroStore.autoExtendPomodoro` 漏掉了向内核 scheduler 注册新 endTime 的步骤。其他三个创建 active pomodoro 的入口（`startPomodoro`/`resumePomodoro`/`restorePomodoro`）都注册了内核 timer，只有 `autoExtendPomodoro` 没有。前端 `updateTimer` 又因 `kernelAvailable=true` 短路（不自动完成，等待内核通知），导致延长后链路死锁，永远不会触发完成通知。

## 目标

- 主窗口最小化/后台时，detached 悬浮窗倒计时仍每秒正确刷新
- 自动/手动延长番茄钟后，结束时能正常触发内核通知 → 完成流程
- 不影响现有 inline 悬浮按钮、底栏、Dock 等其他显示终端
- 不引入动态 import（项目规范禁止）

## 非目标（YAGNI）

- 不重写悬浮窗的渲染架构（仍由主窗口 payload 驱动 DOM 结构）
- 不改变 `pomodoroStore` 作为单一真相源的设计
- 不处理问题 2「桌面通知不弹出」（用户确认现已恢复，本次忽略）
- 不为 break 阶段之外的状态引入新事件类型

## 方案概述

保持现有「store 驱动 DOM、detached 窗口仅显示」的架构不变，只补两个缺口：

- 缺口 1（计时停止）：detached 窗口内部新增本地计时器，根据 payload 携带的 `deadlineTimestamp` 自主渲染剩余时间文本，不再依赖主窗口每秒推送
- 缺口 2（延长无通知）：`autoExtendPomodoro` 中补注册内核 timer 的逻辑，并抽取公共 helper 消除四处重复

## 详细设计

### 1. ViewState 扩展（问题 1 基础设施）

文件：`src/utils/floatingPomodoroViewState.ts`

在 `FloatingPomodoroViewStateBase` 接口上新增可选字段 `deadlineTimestamp?: number`（到点时间戳，毫秒），仅用于 detached 窗口本地计时。

`buildFloatingPomodoroViewState` 在 focus 阶段计算 `deadlineTimestamp = Date.now() + remainingSeconds * 1000`；break 阶段同理用 `remainingSeconds` 计算。`source` 接口已包含 `remainingSeconds`，无需扩展入参。

说明：`deadlineTimestamp` 仅被 detached 窗口读取，inline 悬浮按钮和 DOM 渲染路径（`applyFloatingPomodoroViewState`）忽略此字段，不影响现有行为。

### 2. Detached 窗口本地计时器（问题 1 主体）

文件：`src/utils/detachedPomodoroWindow.ts`

**2.1 Payload 扩展**

`RenderedPayload.state` 新增 `deadlineTimestamp?: number`。`renderPayload` 从传入的 `FloatingPomodoroViewState` 拷贝该字段。

**2.2 Detached 窗口 HTML 内脚本增强**

在现有 IIFE 内，新增本地计时器逻辑：

- 模块级变量 `countdownDeadline: number | null`（初始 null）和 `countdownPhase`
- 函数 `formatClockFromDeadline()`：根据 `countdownDeadline - Date.now()` 计算 `MM:SS` 文本（不与主窗口的 `formatClock` 冲突，作用域独立）
- 函数 `tickClock()`：读取 `countdownDeadline`，若为 null/非法或 `isPaused=true` 则不刷新；否则查询 `.floating-tomato-primary` 元素并更新 `textContent`
- 函数 `startLocalTimer()`：若已存在 interval 则跳过；否则 `setInterval(tickClock, 1000)`
- 在 `window[UPDATE_FN]` 入口处：更新 `countdownDeadline = payload.state.deadlineTimestamp ?? null`、`countdownPhase = payload.state.phase`，随后调用 `startLocalTimer()` 并立即 `tickClock()` 一次
- 不需要 `stopLocalTimer`：detached 窗口生命周期内常驻；payload 未带 deadline 时 `tickClock` 自动跳过

精度保障：detached 窗口已配置 `webPreferences.backgroundThrottling = false`（第 159 行），主窗口最小化不影响此窗口的 timer。

边界处理：

- `deadlineTimestamp` 缺失/非法/已过去：`tickClock` 不修改 DOM，保留主窗口最后一次推送的 `primaryText`（避免显示错误字符）
- `isPaused = true`：`tickClock` 不更新（暂停态主窗口会立即推送新 payload 显示暂停时长，detached 仅在不覆盖时保持原值）
- 主窗口 TICK 推送仍正常工作：每次 payload 到达会触发一次完整重渲（包含图标、状态、进度、按钮等），本地计时器只在两次 payload 之间填充「秒级倒计时文本」

### 3. 内核 Timer 注册抽公共 Helper（问题 3）

文件：`src/stores/pomodoroStore.ts`

新增模块级私有函数 `registerKernelPomodoroTimer(blockId, remainingSeconds, metadata)`（位于文件顶部 helper 区，紧邻 `scheduleMobileFocusEnd` 等）。函数逻辑：

- 若 `kernelAvailable.value === false` 则直接 return
- 计算 `endTime = Math.floor((Date.now() + remainingSeconds * 1000) / 1000)`
- 调用 `usePlugin()!.kernel!.rpc.call.registerTimer({ id: \`pomodoro-${blockId}\`, type: 'pomodoro', endTime, metadata: { blockId, content, projectName, taskName } })`，并 `.catch(() => {})` 容错

将 `startPomodoro`、`resumePomodoro`、`restorePomodoro` 中重复的 `registerTimer` 调用替换为对该 helper 的调用（行为完全等价，只是消除重复）。

### 4. autoExtendPomodoro 补注册（问题 3 主体）

文件：`src/stores/pomodoroStore.ts`，`autoExtendPomodoro` 方法

在 `this.startTimer()` 之后、`await scheduleMobileFocusEnd(this)` 旁边，补两步：

1. 取消旧 timer（保险）：`if (kernelAvailable.value && pending.blockId)` 为真时调用 `cancelTimer({ id: \`pomodoro-${pending.blockId}\` }).catch(() => {})`。id 相同会被 registerTimer 覆盖，但显式取消更稳。
2. 注册新 endTime：调用 `registerKernelPomodoroTimer(pending.blockId, remainingSeconds, { content: pending.itemContent ?? '', projectName: pending.projectName, taskName: pending.taskName })`

`remainingSeconds` 在该方法现有第 861 行已经计算（`newTargetMinutes * 60 - pending.accumulatedSeconds`），直接复用。

### 数据流（问题 1 修复后）

主窗口 `pomodoroStore.updateTimer()` 每秒触发 `eventBus POMODORO_TICK` → `index.ts updateTimerDisplaysFromStore` → `updateFloatingTomatoView` → `detachedHost.show(viewState)`（viewState 现携带 `deadlineTimestamp`）→ `executeJavaScript` 注入 payload（含 `state.deadlineTimestamp`）→ detached 窗口完整重渲 DOM（图标/状态/进度/按钮，由 payload 直接 innerHTML 替换）并更新本地 `countdownDeadline` 基准；本地 `setInterval(1000)` 每秒仅刷新 `.floating-tomato-primary` 文本，即使主窗口被节流不再推送，detached 仍按本地 deadline 自主刷新。

### 数据流（问题 3 修复后，延长场景完成链路）

`autoExtendPomodoro` → `startTimer + scheduleMobileFocusEnd` → `cancelTimer(pomodoro-blockId)`（新增，保险）→ `registerKernelPomodoroTimer`（新增，关键）→ `kernel.scheduler` 注册 `id=pomodoro-blockId, endTime=新值` → `eventBus POMODORO_AUTO_EXTENDED` 关闭完成弹窗。延长倒计时到达 endTime 时 → `kernel.scheduler.checkTimers` fire → `dispatchNotification` → `siyuan.rpc.broadcast timer-expired` → `useKernelTimer onTimerExpired` → `eventBus KERNEL_NOTIFICATION` → `pomodoroStore.setupKernelNotificationListener` 回调 → `completePomodoro` → 通知声音 + 系统通知 + 完成弹窗。

## 错误处理

- detached 窗口 `executeJavaScript` 失败：现有 `?.` 链式调用已容错，本地计时器独立运行不受影响
- payload 中 `deadlineTimestamp` 为非法值：`tickClock` 内部 `Number.isFinite` 校验，非法时跳过本次刷新
- `registerKernelPomodoroTimer` 在 `kernelAvailable=false` 时：静默跳过（与现状一致），前端 `updateTimer` 仍会自己触发完成
- `cancelTimer` 在没有旧 timer 时：内核 scheduler `cancelTimer` 对不存在的 id 是 no-op，安全
- detached 窗口销毁时：`destroy()` 关闭 BrowserWindow，内部 interval 随进程上下文一起清理（data URL 窗口无独立生命周期泄漏）

## 测试计划

### 单元测试（Vitest）

`test/utils/detachedPomodoroWindow.test.ts`（已有，扩展）：

- 新增：`renderPayload` 输出 payload 的 `state.deadlineTimestamp` 与输入 `FloatingPomodoroViewState.deadlineTimestamp` 一致
- 新增：`buildDetachedWindowHtml` 内联脚本中存在 `setInterval`、`deadlineTimestamp`、`floating-tomato-primary` 关键字（字符串包含断言）
- 新增：`buildFloatingPomodoroViewState` 在 focus/break 阶段都正确计算 `deadlineTimestamp`（`Date.now()` mock + remainingSeconds 推算）

`test/stores/pomodoroStore.test.ts`（已有，扩展）：

- 新增：`autoExtendPomodoro` 在 `kernelAvailable=true` 时调用了 `kernel.rpc.call.registerTimer`，且 `endTime` 约等于 `Math.floor((Date.now() + remainingSeconds*1000)/1000)`
- 新增：`autoExtendPomodoro` 在 `kernelAvailable=true` 时先调用了 `cancelTimer`（id=`pomodoro-${blockId}`）
- 新增：`autoExtendPomodoro` 在 `kernelAvailable=false` 时不调用 `registerTimer`
- 回归：`startPomodoro`/`resumePomodoro`/`restorePomodoro` 抽 helper 后仍正确注册 timer（保留现有断言）

### 手动验收（Windows 桌面端）

问题 1 验收步骤：

1. 启动一个 1 分钟倒计时专注，确认悬浮窗显示并开始倒计时
2. 最小化思源主窗口
3. 等待约 30 秒后还原主窗口
4. 预期：悬浮窗显示的时间应接近真实剩余时间（允许 ±2 秒），而不是停在最小化时的数值
5. 对照：修复前同样操作，悬浮窗会显示一个明显陈旧的数值然后跳变

问题 3 验收步骤：

1. 设置中开启「自动延长」`autoExtendEnabled=true`、`autoExtendMinutes=1`、`autoExtendWaitSeconds=5`（便于测试）
2. 启动一个 1 分钟专注
3. 等倒计时结束后，完成弹窗出现 → 不操作，等 5 秒自动延长
4. 延长后的 1 分钟倒计时结束
5. 预期：触发完成通知（声音 + 系统通知 + 完成弹窗）
6. 对照：修复前同样操作，延长后的倒计时结束后无任何反应

## 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/utils/floatingPomodoroViewState.ts` | 接口扩展+逻辑 | 新增 `deadlineTimestamp` 字段及计算 |
| `src/utils/detachedPomodoroWindow.ts` | 接口扩展+HTML 脚本增强 | Payload 携带 deadline，detached 内本地计时 |
| `src/stores/pomodoroStore.ts` | 新增 helper + 修改 autoExtendPomodoro | 抽公共函数，补 registerTimer |
| `test/utils/detachedPomodoroWindow.test.ts` | 扩展 | 新增 deadline 相关断言 |
| `test/stores/pomodoroStore.test.ts` | 扩展 | 新增 autoExtend 注册 timer 断言 |

## 验证命令

- `npm run test` — 全部测试通过
- `npm run lint` — ESLint 无错误
- `npm run typecheck` — 类型检查通过

## 风险与回滚

- 风险低：所有改动都是补全性和局部增强，不改变现有事件流和 store 责任划分
- 回滚：`autoExtendPomodoro` 的两行新增可独立回滚；detached 本地计时器是增量逻辑，删除 IIFE 内新增代码即可回滚；ViewState 的 `deadlineTimestamp` 是可选字段，向后兼容
- 兼容性：detached 窗口 payload 通过 `JSON.stringify` 传输，新增字段不影响旧窗口反序列化（data URL 每次重新加载最新脚本，无版本漂移）