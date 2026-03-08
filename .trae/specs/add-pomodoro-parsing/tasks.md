# Tasks

## Task 1: 数据模型扩展
- [x] SubTask 1.1: 在 `src/types/models.ts` 中添加 `PomodoroRecord` 接口
  - 字段：id, date, startTime, endTime, description, durationMinutes, blockId, projectId?, taskId?, itemId?
- [x] SubTask 1.2: 在 `Project` 接口中添加 `pomodoros?: PomodoroRecord[]` 字段
- [x] SubTask 1.3: 在 `Task` 接口中添加 `pomodoros?: PomodoroRecord[]` 字段
- [x] SubTask 1.4: 在 `Item` 接口中添加 `pomodoros?: PomodoroRecord[]` 字段

## Task 2: 解析器增强
- [x] SubTask 2.1: 在 `src/parser/lineParser.ts` 中添加 `parsePomodoroLine()` 静态方法
  - 解析格式：`🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述`
  - 返回 `PomodoroRecord` 对象
  - 计算 durationMinutes
- [x] SubTask 2.2: 修改 `src/parser/core.ts` 的解析逻辑
  - 在解析项目描述后，继续检查后续行是否是番茄钟行，关联到项目
  - 在解析任务行后，继续检查后续行是否是番茄钟行，关联到任务
  - 在解析事项行后，继续检查后续行是否是番茄钟行，关联到事项

## Task 3: 单元测试
- [x] SubTask 3.1: 在 `test/parser/lineParser.test.ts` 添加番茄钟解析测试
  - 测试完整格式：`🍅2026-03-08 15:45:32~15:45:36 哈哈哈`
  - 测试无描述格式：`🍅2026-03-08 15:45:32~15:45:36`
  - 测试无结束时间格式：`🍅2026-03-08 15:45:32`（默认25分钟）
  - 测试无序列表格式：`- 🍅2026-03-08 15:45:32~15:45:36 哈哈哈`
  - 测试有序列表格式：`1. 🍅2026-03-08 15:45:32~15:45:36 哈哈哈`
  - 测试 durationMinutes 计算正确
  - 测试 blockId 正确记录
- [x] SubTask 3.2: 在 `test/parser/core.test.ts` 添加番茄钟关联测试
  - 测试项目级别番茄钟解析（普通文本行）
  - 测试任务级别番茄钟解析（普通文本行）
  - 测试普通文本行事项下的番茄钟（普通文本行）
  - 测试无序列表事项下的番茄钟（使用 - 标记）
  - 测试有序列表事项下的番茄钟（使用 1. 标记）
  - 测试混合层级番茄钟解析

## Task 4: Store 扩展
- [x] SubTask 4.1: 在 `src/stores/projectStore.ts` 中添加番茄钟相关 getters
  - `getAllPomodoros`: 从所有项目和事项中收集番茄钟记录
  - `getTodayPomodoros`: 过滤今日日期的番茄钟
  - `getTodayFocusMinutes`: 计算今日专注总分钟数
  - `getTotalPomodoros`: 返回总番茄数
  - `getTotalFocusMinutes`: 返回总专注分钟数
  - `getPomodorosByDate`: 按日期分组返回番茄钟记录

## Task 5: 番茄钟 Dock 组件
- [x] SubTask 5.1: 创建 `src/components/pomodoro/PomodoroStats.vue` 统计概览组件
  - 2x2 网格布局
  - 显示今日番茄数、今日专注时长、总番茄数、总专注时长
  - 专注时长格式化为 "25m" 或 "1h 30m"
- [x] SubTask 5.2: 创建 `src/components/pomodoro/PomodoroRecordList.vue` 专注记录列表组件
  - 按日期分组显示
  - 每条记录显示：番茄图标、时间范围、关联任务/事项名称、描述、时长
  - 点击记录通过 blockId 跳转到思源笔记对应位置
- [x] SubTask 5.3: 创建 `src/tabs/PomodoroDock.vue` Dock 主组件
  - 整合 Stats 和 RecordList 组件
  - 响应式布局，适配思源 Dock 面板

## Task 6: Dock 注册
- [x] SubTask 6.1: 在 `src/constants.ts` 中添加 `POMODORO` Dock 类型
- [x] SubTask 6.2: 在 `src/index.ts` 中注册番茄钟 Dock
  - 使用 `addDock()` 方法
  - 配置图标、标题、位置

# Task Dependencies
- Task 2 依赖 Task 1（需要数据模型）
- Task 3 依赖 Task 2（需要解析器实现）
- Task 4 依赖 Task 1（需要数据模型）
- Task 5 依赖 Task 4（需要 Store getters）
- Task 6 依赖 Task 5（需要 Dock 组件）

## 番茄钟层级说明
番茄钟可以出现在三个层级：
1. **项目层级** - 在项目描述（`> 描述`）之后，任务之前
2. **任务层级** - 在任务行（`## 任务名 #任务`）之后，事项之前  
3. **事项层级** - 在事项行（`- [ ] 事项 @日期`）之后
