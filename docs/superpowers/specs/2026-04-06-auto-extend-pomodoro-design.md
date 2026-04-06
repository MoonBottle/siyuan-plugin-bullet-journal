# 倒计时自动延迟设计

## 背景

倒计时模式下，番茄钟结束时弹出确认弹窗，用户需要手动保存记录。如果用户正在深度专注中未能及时操作，番茄钟就停止了，打断心流。

用户希望：弹窗等待一段时间后，如果用户没有操作，自动延长倒计时继续计时，等下次倒计时结束时再弹窗。

来源：[链滴 pingzi89](https://ld246.com/article/1773759733461/comment/1774959922298)

## 核心流程

```
倒计时结束
  → completePomodoro() 照常执行（保存 pending、停止计时、弹窗）
  → store 启动自动延迟倒计时（如果开启）
  → 等待 N 秒...

情况 1：用户操作了弹窗（保存/放弃/开始休息）
  → cancelAutoExtend()，正常完成

情况 2：等待超时 且 extendCount < maxCount
  → autoExtendPomodoro()：
      1. 从 pending 文件恢复数据
      2. 删除 pending 文件
      3. 创建新 active pomodoro（保留 startTime/blockId 等）
         newTarget = accumulatedSeconds + extendMinutes * 60
      4. 启动计时器
      5. emit POMODORO_AUTO_EXTENDED → 弹窗关闭（跳过自动保存）
      6. extendCount++
  → 下次倒计时结束时再次弹窗，重复流程

情况 3：等待超时 且 extendCount >= maxCount
  → 弹窗保持打开，等用户手动操作
```

同一专注记录：startTime 不变，accumulatedSeconds 接续计算，延迟后结束仍是同一条番茄钟记录。

## 配置项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoExtendEnabled` | `boolean` | `false` | 是否开启自动延迟 |
| `autoExtendWaitSeconds` | `number` | `30` | 弹窗等待时间（秒） |
| `autoExtendMinutes` | `number` | `5` | 每次延长分钟数 |
| `autoExtendMaxCount` | `number` | `3` | 最大延迟次数 |

配置存储在 `PomodoroSettings` 中，默认关闭。

## 实现方案：Store 层自动延迟

### Store 改动（pomodoroStore.ts）

**新增状态：**
- `autoExtendCount: number` — 当前已延迟次数（内存中，不持久化，startPomodoro 时重置）
- `autoExtendTimeoutId: ReturnType<typeof setTimeout> | null` — 延迟定时器

**`completePomodoro()` 改动：**
- 在现有逻辑末尾：如果 `autoExtendEnabled` 且 `autoExtendCount < autoExtendMaxCount`，启动 `setTimeout`，等待 `autoExtendWaitSeconds` 秒后调用 `autoExtendPomodoro(plugin)`

**新增 `autoExtendPomodoro(plugin)`：**
1. 清除 autoExtendTimeoutId
2. 调用 `loadPendingCompletion(plugin)` 加载 pending 数据
3. 如果没有 pending 数据，直接返回
4. 调用 `removePendingCompletion(plugin)` 删除 pending 文件
5. 基于 pending 数据创建新的 active pomodoro：
   - 复用 blockId、itemId、itemContent、startTime
   - `targetDurationMinutes = Math.ceil(pending.accumulatedSeconds / 60) + autoExtendMinutes`
   - `accumulatedSeconds` = pending.accumulatedSeconds（接续）
   - `timerMode = 'countdown'`
6. 保存 active pomodoro 文件
7. 启动计时器（startTimer）
8. `autoExtendCount++`
9. `emit(POMODORO_AUTO_EXTENDED)`

**新增 `cancelAutoExtend()`：**
- 清除 setTimeout
- 重置 autoExtendCount 为 0

**重置时机：**
- `startPomodoro()` 时重置 `autoExtendCount = 0`
- `cancelAutoExtend()` 时重置

### 事件改动

**新增事件：**
- `POMODORO_AUTO_EXTENDED` — 通知弹窗关闭

### 弹窗改动

**PomodoroCompleteDialog.vue：**
- 新增 `skipAutoSave` ref（默认 false）
- 监听 `POMODORO_AUTO_EXTENDED` 事件：设置 `skipAutoSave = true`，调用 `closeDialog()`
- `onBeforeUnmount`：如果 `skipAutoSave` 为 true，跳过自动保存逻辑

**dialog.ts（`showPomodoroCompleteDialog`）：**
- 同样监听 `POMODORO_AUTO_EXTENDED`，关闭 SiYuan Dialog 实例

### 设置 UI

在 `PomodoroConfigSection.vue` 中添加自动延迟配置区域（放在 `minFocusMinutes` 之后）：
- 开关：是否开启自动延迟
- 等待时间（秒）：数字输入，范围 10-300
- 延长分钟数：数字输入，范围 1-60
- 最大次数：数字输入，范围 1-10

### i18n

新增以下 key（zh_CN / en_US）：
- `autoExtend` — 自动延迟
- `autoExtendDesc` — 说明文字
- `autoExtendWaitSeconds` — 等待时间
- `autoExtendWaitSecondsDesc` — 说明文字
- `autoExtendMinutes` — 延长分钟数
- `autoExtendMinutesDesc` — 说明文字
- `autoExtendMaxCount` — 最大延迟次数
- `autoExtendMaxCountDesc` — 说明文字

## 边界情况

- **插件重启恢复：** `checkAndRestorePomodoro()` 恢复 pending 时不触发自动延迟（原始定时器已丢失，按正常流程弹窗）
- **页面刷新：** autoExtendCount 重置为 0，可接受
- **手动提前结束：** 正常走 completePomodoro 流程，startPomodoro 时 autoExtendCount 重置
- **弹窗自动保存：** auto-extend 关闭弹窗时设置 skipAutoSave 标志，避免 onBeforeUnmount 触发自动保存
- **延迟期间暂停：** 延迟是针对弹窗等待时间的，与暂停无关（倒计时已经结束）
- **连续延迟：** 每次延迟后 extendCount 递增，达到 maxCount 后弹窗保持打开

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/stores/pomodoroStore.ts` | 新增 auto-extend 状态和方法，修改 completePomodoro |
| `src/types/events.ts` | 新增 POMODORO_AUTO_EXTENDED 事件 |
| `src/components/pomodoro/PomodoroCompleteDialog.vue` | 监听 auto-extend 事件，skipAutoSave |
| `src/utils/dialog.ts` | showPomodoroCompleteDialog 监听 auto-extend 事件 |
| `src/settings/types.ts` | 新增 4 个配置字段 |
| `src/components/settings/PomodoroConfigSection.vue` | 新增配置 UI |
| `src/i18n/zh_CN.json` | 新增翻译 key |
| `src/i18n/en_US.json` | 新增翻译 key |
