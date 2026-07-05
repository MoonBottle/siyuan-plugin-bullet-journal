# 修复：自定义短时长专注倒计时完成后保存显示分钟数偏少

## 摘要

用户设置自定义 2 分钟专注，倒计时正常到期后，完成弹窗与保存的记录却显示「专注 1 分钟」。根因在 `completePomodoro()` 中用 `Math.floor(accumulatedSeconds / 60)` 计算保存时长，而 `accumulatedSeconds` 受前端 `setInterval` 1 秒粒度与内核到期广播的时间窗口（race condition）影响，在短时长场景下经常未走到目标值就被终结，导致向下取整后跨分钟丢失。

修复策略：倒计时模式正常到期时（累计已达到目标），保存时长直接用 `ap.targetDurationMinutes`；正计时与手动提前结束仍用真实累计。通知时长与保存时长保持一致。

## 当前状态分析

### 数据流（倒计时模式）

1. `startPomodoro(item, 2, parentBlockId, plugin, 'countdown')`
   - [pomodoroStore.ts:230](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L230)：`targetDurationMinutes = 2`
   - [pomodoroStore.ts:255](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L255)：`remainingSeconds = 120`
   - [pomodoroStore.ts:262](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L262)：`startTimer()` 启动 `setInterval(updateTimer, 1000)`
2. `updateTimer()` 每秒基于时间戳更新 `accumulatedSeconds`（[L446](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L446)）
3. 到期触发有两条路径：
   - **前端路径**（`kernelAvailable === false`）：`updateTimer` 检测 `accumulatedSeconds >= targetSeconds` 时调用 `completePomodoro()`（[L454-458](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L454)）
   - **内核广播路径**（`kernelAvailable === true`）：内核计时器到期 → `eventBus(KERNEL_NOTIFICATION)` → `setupKernelNotificationListener` 回调 → `completePomodoro()`（[L1251-1253](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1251)）
4. `completePomodoro()` 第 [L584](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L584) 行：
   ```js
   const actualMinutes = Math.floor(ap.accumulatedSeconds / 60)
   ```
   该值写入 `pending.durationMinutes`（[L600](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L600)），用于：
   - [PomodoroCompleteDialog.vue:114](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/pomodoro/PomodoroCompleteDialog.vue#L114)：完成弹窗显示「专注时长」
   - [L737](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L737)：保存提示消息
   - 写入文档的 `🍅{minutes},...` 记录（[L691-700](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L691)）
   - [L633](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L633)：系统通知 `showPomodoroCompleteNotification`

### 根因

- `accumulatedSeconds` 由 `setInterval` 1 秒粒度驱动，最后一次 tick 可能只走到 119 秒（或内核广播比前端最后一次 tick 更早抵达，只走到 ~60 秒）
- `Math.floor(60/60) = 1` → 保存显示「专注 1 分钟」
- 默认 25 分钟场景因分钟数大，1-2 秒偏差不足以跨分钟取整，所以不易复现；自定义 2 分钟是边界值，必然暴露

### 已有正确先例

[pomodoroStore.ts:1020](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1020) `markExpiredPomodoroComplete` 中：
```js
const actualMinutes = data.targetDurationMinutes
```
即「倒计时到期 = 目标时长」。本次修复与之对齐。

## 假设与决策

| # | 决策 | 依据 |
|---|------|------|
| A1 | 倒计时模式**正常到期**（累计已达到目标）时，`durationMinutes = ap.targetDurationMinutes` | 用户明确选择「用目标时长」（推荐）；与 `markExpiredPomodoroComplete` 一致；符合「设 2 分钟记 2 分钟」的直觉 |
| A2 | **手动提前结束**（用户点结束按钮、累计未达目标）仍用真实累计 `Math.round(accumulatedSeconds/60)` | 提前结束不应记满目标时长；`round` 比 `floor` 更准（避免 90 秒记 1 分钟） |
| A3 | **正计时（stopwatch）** 无目标时长，仍用 `Math.round(accumulatedSeconds/60)` | 正计时本就按真实时长记录 |
| A4 | 通知 `showPomodoroCompleteNotification` 的 minutes 参数复用同一个 `actualMinutes` | 避免修复引入「通知说 1 分钟、保存写 2 分钟」的新不一致 |
| A5 | 区分「正常到期 vs 手动提前结束」的判据：`ap.timerMode === 'countdown' && ap.accumulatedSeconds >= ap.targetDurationMinutes * 60` | 倒计时且累计已达目标即为正常到期；否则视为提前结束/正计时 |
| A6 | 仅改 `completePomodoro` 内的 `actualMinutes` 计算；`pending.accumulatedSeconds` 保持真实值不变 | `accumulatedSeconds` 是统计/分析用真实数据，不应被目标时长覆盖 |

## 提议变更

### 文件 1：[src/stores/pomodoroStore.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts)

**变更点**：`completePomodoro` action 内 `actualMinutes` 计算（第 [L584](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L584) 行）。

**改前**：
```js
const ap = this.activePomodoro
const now = Date.now()
const actualMinutes = Math.floor(ap.accumulatedSeconds / 60)
cancelMobileFocusEnd()
```

**改后**：
```js
const ap = this.activePomodoro
const now = Date.now()
const targetSeconds = ap.targetDurationMinutes * 60
const reachedTarget = ap.timerMode === 'countdown' && ap.accumulatedSeconds >= targetSeconds
const actualMinutes = reachedTarget
  ? ap.targetDurationMinutes
  : Math.round(ap.accumulatedSeconds / 60)
cancelMobileFocusEnd()
```

**为什么**：
- 倒计时正常到期 → 用目标时长（A1），根治短时长向下取整 bug
- 提前结束 / 正计时 → 用 `Math.round`（比 `Math.floor` 更准），保留真实时长语义（A2、A3）
- `actualMinutes` 同时用于 `pending.durationMinutes`（写文档记录、弹窗显示、保存提示）和 `showPomodoroCompleteNotification`（[L633](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L633)），一处修复，通知与保存自然一致（A4）

**不动的地方**：
- `pending.accumulatedSeconds = ap.accumulatedSeconds`（[L599](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L599)）保持真实累计秒数不变（A6）
- `markExpiredPomodoroComplete`（[L1020](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1020)）已是目标时长，不改
- `autoExtendPomodoro` 中 `newTargetMinutes`（[L839](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L839)）逻辑独立，不改

### 文件 2：[test/stores/pomodoroStore.test.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/test/stores/pomodoroStore.test.ts)

**新增测试用例**（在 `completePomodoro on mobile...` 用例附近，复用其 mock 体系）：

1. **倒计时正常到期 → durationMinutes = targetDurationMinutes**
   - `activePomodoro.accumulatedSeconds = 60`（模拟内核广播提前触发，未走到 120）
   - `targetDurationMinutes = 2`，`timerMode = 'countdown'`
   - 断言 `pending.durationMinutes === 2`（而非旧的 `Math.floor(60/60)=1`）
   - 通过监听 `eventBus.emit(Events.POMODORO_PENDING_COMPLETION, pending)` 或 mock `savePendingCompletion` 捕获 pending 参数

2. **手动提前结束（倒计时未达目标）→ durationMinutes = round(accumulated/60)**
   - `accumulatedSeconds = 90`，`targetDurationMinutes = 2`，`timerMode = 'countdown'`
   - 断言 `pending.durationMinutes === Math.round(90/60) = 2`（90 秒记 2 分钟，比旧 floor=1 更准）

3. **正计时（stopwatch）→ durationMinutes = round(accumulated/60)**
   - `accumulatedSeconds = 150`，`timerMode = 'stopwatch'`
   - 断言 `pending.durationMinutes === Math.round(150/60) = 3`

4. **现有用例不回归**：`completePomodoro on mobile...`（[L389](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/test/stores/pomodoroStore.test.ts#L389)）的 `accumulatedSeconds=25*60, targetDurationMinutes=25` → `actualMinutes` 仍为 25（正常到期，reachedTarget=true）

**为什么**：覆盖三条分支（正常到期/提前结束/正计时）+ 回归保护，符合 TDD（systematic-debugging 第四阶段「先写测试」）。

## 验证步骤

1. **单元测试**：`npm run test`
   - 新增 3 个用例通过
   - 现有 `completePomodoro on mobile` 用例不回归
2. **Lint**：`npm run lint`
3. **类型检查**：`npm run typecheck`
4. **手动验证（可选，由用户在 SiYuan 中执行）**：
   - 设置自定义 2 分钟专注 → 等待倒计时正常到期 → 完成弹窗显示「专注 2 分钟」、保存提示与文档记录均为 2 分钟、系统通知也显示 2 分钟
   - 提前结束（例如专注 1 分 30 秒手动点结束）→ 显示约 2 分钟（round），符合预期

## 不在本次范围

- 不重构 `accumulatedSeconds` 计时机制（不引入更高精度的 `requestAnimationFrame` 或让内核广播触发一次 `updateTimer` 校准）
- 不改 `PomodoroCompleteDialog` 的「时长过短警告」逻辑（`isDurationTooShort` 基于 `durationMinutes`，修复后 2 分钟仍可能触发 `minFocusMinutes` 警告，但那是另一条产品逻辑，本次不动）
- 不改自动延迟（autoExtend）相关时长计算
