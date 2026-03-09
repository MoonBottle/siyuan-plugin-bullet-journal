# Tasks

## Task 1: 更新数据格式章节
- [x] SubTask 1.1: 更新番茄钟记录格式说明
  - 添加实际专注时长格式 `🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss`
  - 说明中英文逗号、逗号后空格的支持
  - 更新元素说明表格
- [x] SubTask 1.2: 更新文件存储格式说明
  - 更新 `ActivePomodoroData` 接口字段
  - 添加 `accumulatedSeconds`, `isPaused`, `pauseCount`, `totalPausedSeconds`, `currentPauseStartTime`
  - 添加 `projectName`, `taskName`, `taskLevel` 字段

## Task 2: 更新技术实现方案
- [x] SubTask 2.1: 更新状态管理章节
  - 添加 `pausePomodoro()` action 说明
  - 添加 `resumePomodoro()` action 说明
  - 更新 State 定义（添加 `timerStartTimestamp`, `lastAccumulatedSeconds`）
- [x] SubTask 2.2: 添加页面可见性监听机制说明
  - 说明 `setupVisibilityListener()` 方法
  - 说明后台计时不准问题的解决方案
- [x] SubTask 2.3: 更新计时器实现说明
  - 说明基于时间戳的计算方案（替代单纯的 setInterval）
  - 说明 `updateTimer()` 方法的逻辑

## Task 3: 更新 UI 组件说明
- [x] SubTask 3.1: 更新 `PomodoroActiveTimer.vue` 功能说明
  - 添加圆形进度条说明
  - 添加时间线展示说明（开始/预计结束时间）
  - 添加信息卡片说明（项目、任务、事项）
  - 添加复制功能说明
  - 添加链接跳转功能说明
- [x] SubTask 3.2: 更新组件关系图
  - 确认组件关系与当前代码一致

## Task 4: 更新核心模块说明
- [x] SubTask 4.1: 更新 `pomodoroStore.ts` 说明
  - 更新 `completePomodoro()` 逻辑（区分有无暂停的情况）
  - 更新 `restorePomodoro()` 逻辑（支持暂停状态恢复）
- [x] SubTask 4.2: 更新番茄钟记录创建逻辑
  - 说明有暂停时的记录格式
  - 说明正常完成的记录格式

## Task 5: 同步类型定义
- [x] SubTask 5.1: 更新 `ActivePomodoroData` 接口定义
- [x] SubTask 5.2: 更新 `ActivePomodoro` 接口定义
- [x] SubTask 5.3: 确认 `PomodoroRecord` 接口字段

# Task Dependencies
- Task 2 依赖 Task 1（需要数据格式定义）
- Task 3 依赖 Task 2（需要状态管理说明）
- Task 4 依赖 Task 2（需要 Store 方法说明）
- Task 5 可与其他任务并行
