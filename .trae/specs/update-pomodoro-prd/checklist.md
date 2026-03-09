# Checklist

## 数据格式章节
- [x] 番茄钟记录格式包含实际专注时长说明 `🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss`
- [x] 说明支持中英文逗号、逗号后空格
- [x] 元素说明表格包含实际时长字段
- [x] `ActivePomodoroData` 接口包含所有字段：
  - `blockId`, `itemId`, `itemContent`, `startTime`
  - `targetDurationMinutes`, `accumulatedSeconds`
  - `isPaused`, `pauseCount`, `totalPausedSeconds`, `currentPauseStartTime`
  - `projectId`, `projectName`, `taskId`, `taskName`, `taskLevel`

## 技术实现方案
- [x] 状态管理章节包含 `pausePomodoro()` action 说明
- [x] 状态管理章节包含 `resumePomodoro()` action 说明
- [x] State 定义包含 `timerStartTimestamp` 和 `lastAccumulatedSeconds`
- [x] 页面可见性监听机制有完整说明
- [x] 计时器实现说明包含基于时间戳的计算方案

## UI 组件
- [x] `PomodoroActiveTimer.vue` 功能说明包含：
  - 圆形进度条
  - 时间线展示（开始/预计结束时间）
  - 信息卡片（项目、任务、事项）
  - 复制功能
  - 链接跳转功能
- [x] 组件关系图与当前代码一致

## 核心模块
- [x] `pomodoroStore.ts` 说明包含：
  - `completePomodoro()` 区分有无暂停的逻辑
  - `restorePomodoro()` 支持暂停状态恢复
- [x] 番茄钟记录创建逻辑说明包含：
  - 有暂停时的记录格式
  - 正常完成的记录格式

## 类型定义
- [x] `ActivePomodoroData` 接口定义与代码一致
- [x] `ActivePomodoro` 接口定义与代码一致
- [x] `PomodoroRecord` 接口字段完整

## 文档质量
- [x] PRD 文档格式正确，Markdown 语法无误
- [x] 所有代码示例可正常显示
- [x] 表格格式正确
