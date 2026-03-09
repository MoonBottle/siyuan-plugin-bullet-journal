# Tasks

- [x] Task 1: 修改 lineParser.ts 支持任务列表状态解析
  - [x] SubTask 1.1: 在 `parseItemLine` 方法中添加任务列表标记 `[ ]`、`[x]`、`[X]` 的正则匹配
  - [x] SubTask 1.2: 根据匹配到的任务列表标记设置事项状态
  - [x] SubTask 1.3: 从内容中移除任务列表标记，确保内容解析正确
  - [x] SubTask 1.4: 确保状态标签（#done/#abandoned）优先级高于任务列表标记

- [x] Task 2: 添加单元测试
  - [x] SubTask 2.1: 添加 `[ ]` 未选中状态的测试用例
  - [x] SubTask 2.2: 添加 `[x]` 已完成状态的测试用例
  - [x] SubTask 2.3: 添加 `[X]` 已完成状态的测试用例
  - [x] SubTask 2.4: 添加任务列表与状态标签共存的测试用例
  - [x] SubTask 2.5: 添加思源笔记完整格式的测试用例
  - [x] SubTask 2.6: 添加任务列表与多日期组合的测试用例

# Task Dependencies
- Task 2 依赖 Task 1
