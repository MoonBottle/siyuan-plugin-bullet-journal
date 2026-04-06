# 进度条方向自动适配计时类型

## 背景

当前所有进度条（圆形进度环、线性时间轴条、底栏进度条）方向均为固定的"延长"方向（从空到满）。底栏进度条有一个手动设置项 `statusBarDirection` 可切换为"缩短"。

用户需要根据计时类型手动选择方向，不够直觉。

## 设计

### 核心规则

进度条方向由计时类型自动决定，不再提供手动设置：

| 计时类型 | 方向 | 视觉效果 |
|---------|------|---------|
| 正计时 (stopwatch) | `extend` | 从空到满 |
| 倒计时 (countdown) | `shrink` | 从满到空 |
| 休息 (break) | `shrink` | 从满到空 |

### 1. 工具函数

新增 `getProgressDirection(timerMode)` 工具函数，统一提供方向判断：

```ts
type ProgressBarDirection = 'extend' | 'shrink'

function getProgressDirection(timerMode?: 'countdown' | 'stopwatch'): ProgressBarDirection {
  return timerMode === 'stopwatch' ? 'extend' : 'shrink'
}
```

正计时返回 `extend`，倒计时和休息（无 timerMode）均返回 `shrink`。

### 2. 圆形进度环改动

**PomodoroActiveTimer.vue**（专注圆环）：
- 从 pomodoroStore 读取 `timerMode`，通过工具函数获取方向
- `direction === 'shrink'` 时：`strokeDashoffset = circumference * progress`（从满到空）
- `direction === 'extend'` 时：`strokeDashoffset = circumference * (1 - progress)`（从空到满，与当前逻辑一致）

**PomodoroBreakTimer.vue**（休息圆环）：
- 休息本质是倒计时，固定 `shrink`
- `strokeDashoffset = circumference * progress`

**PomodoroBreakOverlay.vue**（全屏休息覆盖层圆环）：
- 同上，固定 `shrink`

### 3. 线性时间轴条改动

**PomodoroActiveTimer.vue**（timeline bar）：
- 与圆环共用同一个 `direction` 判断
- `direction === 'shrink'` 时：`width = (1 - progress) * 100%`
- `direction === 'extend'` 时：`width = progress * 100%`

### 4. 底栏进度条改动

**src/index.ts**：
- 专注期间：从 pomodoroStore 读取 `timerMode`，调用工具函数获取方向
- 休息期间：固定 `shrink`
- 移除对 `pomodoro.statusBarDirection` 设置的读取

### 5. 清理设置项

删除 `statusBarDirection` 相关代码：

- `src/settings/types.ts` — 移除 `statusBarDirection` 类型字段和默认值
- `src/components/settings/PomodoroConfigSection.vue` — 移除方向选择下拉框
- `src/i18n/zh_CN.json` + `en_US.json` — 移除相关翻译 key

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/utils/progressDirection.ts` | 新增工具函数 |
| `src/components/pomodoro/PomodoroActiveTimer.vue` | 圆环 + 时间轴条加入方向逻辑 |
| `src/components/pomodoro/PomodoroBreakTimer.vue` | 圆环改为 shrink |
| `src/components/pomodoro/PomodoroBreakOverlay.vue` | 圆环改为 shrink |
| `src/index.ts` | 底栏进度条改为动态方向 |
| `src/settings/types.ts` | 删除 statusBarDirection |
| `src/components/settings/PomodoroConfigSection.vue` | 删除方向设置 UI |
| `src/i18n/*.json` | 删除相关翻译 key |
