# 番茄钟功能 PRD 更新规格

## Why

基于最新代码实现更新 `docs/prd/pomodoro.md`，使其与实际代码保持一致。当前代码已实现比原 PRD 更丰富的功能（如暂停/继续、实际专注时长记录、页面可见性监听等），PRD 需要同步更新以准确反映当前实现。

## What Changes

- **更新数据格式章节**：添加实际专注时长格式（`🍅N,YYYY-MM-DD...`）的完整说明
- **更新存储数据结构**：添加 `accumulatedSeconds`, `isPaused`, `pauseCount`, `totalPausedSeconds`, `currentPauseStartTime` 等字段
- **更新 Store Actions**：添加 `pausePomodoro()` 和 `resumePomodoro()` 方法说明
- **更新技术实现细节**：添加页面可见性监听机制、时间戳计算方案等
- **更新 UI 组件说明**：添加时间线展示、信息卡片等实际 UI 元素

## Impact

- 受影响文档：`docs/prd/pomodoro.md`
- 受影响代码：无（仅文档更新）

## ADDED Requirements

### Requirement: 实际专注时长记录

The system SHALL support recording actual focus duration for pause/resume functionality.

#### Scenario: 正常完成
- **WHEN** 用户正常完成专注（无暂停）
- **THEN** 记录格式为 `🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss`

#### Scenario: 有暂停的专注
- **WHEN** 用户暂停后继续并完成专注
- **THEN** 记录格式为 `🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss`（N为实际专注分钟数）

### Requirement: 暂停/继续功能

The system SHALL allow users to pause and resume pomodoro timer.

#### Scenario: 暂停专注
- **WHEN** 用户点击暂停按钮
- **THEN** 停止计时器，记录暂停开始时间，增加暂停计数

#### Scenario: 继续专注
- **WHEN** 用户点击继续按钮
- **THEN** 计算并累加本次暂停时长，恢复计时器

### Requirement: 页面可见性监听

The system SHALL use Page Visibility API to ensure accurate timing when tab is in background.

#### Scenario: 页面后台运行
- **WHEN** 页面切换到后台
- **THEN** 使用 Date.now() 时间戳计算，不受 setInterval 节流影响

#### Scenario: 页面重新可见
- **WHEN** 页面重新切换到前台
- **THEN** 立即校准时间，更新显示

## MODIFIED Requirements

### Requirement: ActivePomodoroData 接口

```typescript
interface ActivePomodoroData {
  blockId: string;              // 事项块ID
  itemId: string;               // 事项ID
  itemContent: string;          // 事项内容
  startTime: number;            // 开始时间戳（毫秒）
  targetDurationMinutes: number;// 目标专注时长（分钟）
  accumulatedSeconds: number;   // 已累计专注秒数（新增）
  isPaused: boolean;            // 是否处于暂停状态（新增）
  pauseCount: number;           // 暂停次数（新增）
  totalPausedSeconds: number;   // 总暂停秒数（新增）
  currentPauseStartTime?: number;// 当前暂停开始时间戳（新增）
  projectId?: string;           // 项目ID
  projectName?: string;         // 项目名称（新增）
  taskId?: string;              // 任务ID
  taskName?: string;            // 任务名称（新增）
  taskLevel?: string;           // 任务层级（新增）
}
```

### Requirement: PomodoroActiveTimer 组件功能

- 圆形进度条显示剩余时间
- 时间线展示（开始时间 -> 预计结束时间）
- 信息卡片展示（项目、任务、事项）
- 暂停/继续按钮
- 复制功能（项目名、任务名、事项内容）
- 链接跳转功能

### Requirement: 番茄钟记录完成逻辑

```typescript
// 有暂停时，包含实际专注时长
pomodoroContent = `🍅${actualMinutes},${dateStr} ${startTimeStr}~${endTimeStr}`;

// 正常完成的只显示时间范围
pomodoroContent = `🍅${dateStr} ${startTimeStr}~${endTimeStr}`;
```

## REMOVED Requirements

无移除的需求。
