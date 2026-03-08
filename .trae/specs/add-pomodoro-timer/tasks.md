# Tasks

## Task 1: 数据模型和类型定义
- [ ] SubTask 1.1: 在 `src/types/models.ts` 中扩展 `PomodoroRecord` 接口
  - 添加 `status?: 'running' | 'completed'` 字段
  - 添加 `itemContent?: string` 字段用于保存关联事项内容
- [ ] SubTask 1.2: 在 `src/types/models.ts` 中添加 `PomodoroStatus` 类型
  - 定义 `export type PomodoroStatus = 'running' | 'completed'`
- [ ] SubTask 1.3: 在 `src/types/models.ts` 中添加 `ActivePomodoro` 接口
  - 字段：blockId, itemId, itemContent, startTime, durationMinutes, remainingSeconds

## Task 2: 解析器增强
- [ ] SubTask 2.1: 在 `src/parser/lineParser.ts` 中添加块属性解析功能
  - 添加 `parseBlockAttrs()` 方法解析 `{: ... }` 格式的属性
  - 提取 `custom-pomodoro-status`、`custom-pomodoro-start` 等属性
- [ ] SubTask 2.2: 修改 `parsePomodoroLine()` 方法
  - 支持解析块属性中的专注状态
  - 返回包含 `status` 字段的 `PomodoroRecord`
- [ ] SubTask 2.3: 在 `test/parser/lineParser.test.ts` 添加块属性解析测试
  - 测试 `{: custom-pomodoro-status="running" ...}` 格式
  - 测试无状态属性的情况

## Task 3: 专注状态管理 Store
- [ ] SubTask 3.1: 创建 `src/stores/pomodoroStore.ts`
  - 定义 `usePomodoroStore` Pinia store
  - State: `activePomodoro`（当前专注状态）、`timerInterval`（计时器）
- [ ] SubTask 3.2: 实现 `startPomodoro()` action
  - 调用思源 API 创建番茄钟块
  - 设置块属性
  - 启动倒计时
- [ ] SubTask 3.3: 实现 `completePomodoro()` action
  - 更新块内容为带结束时间的格式
  - 更新块属性状态为 completed
  - 清除倒计时
- [ ] SubTask 3.4: 实现 `cancelPomodoro()` action
  - 调用 deleteBlock 删除番茄钟块
  - 清除倒计时
- [ ] SubTask 3.5: 实现 `restorePomodoro()` action
  - 从块属性恢复专注状态
  - 计算剩余时间并继续倒计时

## Task 4: 专注弹框组件
- [ ] SubTask 4.1: 创建 `src/components/pomodoro/PomodoroTimerDialog.vue`
  - 使用 `Dialog` 创建弹框
  - 左右两栏布局（flex 布局）
- [ ] SubTask 4.2: 实现左侧待办事项列表
  - 从 `projectStore` 获取过期和今天的待办
  - 使用 `getExpiredItems` 和 `getFutureItems` getters
  - 实现事项选择功能（单选）
  - 选中项高亮显示
- [ ] SubTask 4.3: 实现右侧专注时长设置
  - 快捷按钮：15、25、45、60 分钟
  - 自定义输入框（1-180 分钟）
  - 默认选中 25 分钟
- [ ] SubTask 4.4: 实现开始专注按钮
  - 未选择事项时禁用
  - 点击调用 `pomodoroStore.startPomodoro()`
  - 关闭弹框

## Task 5: 专注中展示组件
- [ ] SubTask 5.1: 创建 `src/components/pomodoro/PomodoroActiveTimer.vue`
  - 圆形进度条或数字倒计时展示
  - 显示当前专注事项名称
  - 显示剩余时间（MM:SS）
- [ ] SubTask 5.2: 实现控制按钮
  - "结束专注"按钮 - 调用 `completePomodoro()`
  - "取消"按钮 - 调用 `cancelPomodoro()`
- [ ] SubTask 5.3: 实现倒计时完成处理
  - 时间到达 0 时自动调用 `completePomodoro()`
  - 播放提示音（使用 Web Audio API）
  - 显示完成通知

## Task 6: PomodoroDock 集成
- [ ] SubTask 6.1: 修改 `src/tabs/PomodoroDock.vue`
  - 在"专注记录"标题旁添加"开始专注"按钮
  - 使用条件渲染：专注中显示 `PomodoroActiveTimer`，未专注显示统计和记录列表
- [ ] SubTask 6.2: 实现开始专注按钮点击处理
  - 打开 `PomodoroTimerDialog` 弹框
- [ ] SubTask 6.3: 实现专注状态监听
  - 监听 `pomodoroStore.activePomodoro` 变化
  - 切换 Dock 展示内容

## Task 7: 状态恢复
- [ ] SubTask 7.1: 在 `PomodoroDock.vue` 的 `onMounted` 中添加状态恢复逻辑
  - 遍历所有番茄钟记录
  - 查找 `status === 'running'` 的记录
  - 调用 `pomodoroStore.restorePomodoro()`
- [ ] SubTask 7.2: 处理过期状态
  - 如果倒计时已过期，自动标记为完成
  - 更新块内容和属性

## Task 8: 测试
- [ ] SubTask 8.1: 在 `test/parser/lineParser.test.ts` 添加测试
  - 测试块属性解析
  - 测试带状态的番茄钟行解析
- [ ] SubTask 8.2: 在 `test/stores/pomodoroStore.test.ts` 添加测试（可选）
  - 测试 store 的 actions

# Task Dependencies
- Task 2 依赖 Task 1（需要类型定义）
- Task 3 依赖 Task 1 和 Task 2（需要解析器）
- Task 4 依赖 Task 3（需要 store）
- Task 5 依赖 Task 3（需要 store）
- Task 6 依赖 Task 4 和 Task 5（需要组件）
- Task 7 依赖 Task 3 和 Task 6（需要 store 和 Dock）
- Task 8 依赖 Task 2（需要解析器）
